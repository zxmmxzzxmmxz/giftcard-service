package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.BarcodeDtos;
import com.google.zxing.*;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import nu.pattern.OpenCV;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.*;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class BarcodeDecodeService {

    private static final AtomicBoolean OPENCV_LOADED = new AtomicBoolean(false);
    private static final AtomicBoolean OPENCV_LOAD_ATTEMPTED = new AtomicBoolean(false);

    public BarcodeDtos.DecodeBarcodeResponse decodeCode128(byte[] imageBytes, boolean debug) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("file is empty");
        }

        boolean opencvAvailable = tryLoadOpenCv();

        BarcodeDtos.DecodeBarcodeResponse resp = new BarcodeDtos.DecodeBarcodeResponse();
        resp.usedOpenCv = opencvAvailable;
        if (debug) {
            resp.tried = new ArrayList<>();
            resp.attempts = 0;
        }

        MultiFormatReader reader = new MultiFormatReader();
        Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
        hints.put(DecodeHintType.POSSIBLE_FORMATS, List.of(BarcodeFormat.CODE_128));
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        reader.setHints(hints);

        try {
            if (opencvAvailable) {
                String text = decodeWithOpenCv(reader, imageBytes, debug, resp);
                resp.rawText = text;
                resp.serialNumber = normalizeDigits(text);
                return resp;
            }
        } catch (NotFoundException e) {
            // Fall back to Java2D pipeline below.
            if (debug) resp.error = "opencv_not_found";
        } catch (Exception e) {
            // OpenCV path failed unexpectedly; fall back but preserve debug signal.
            if (debug) resp.error = "opencv_error:" + e.getClass().getSimpleName();
        }

        String text = decodeWithJava2D(reader, imageBytes, debug, resp);
        resp.rawText = text;
        resp.serialNumber = normalizeDigits(text);
        return resp;
    }

    private static String normalizeDigits(String rawText) {
        if (rawText == null) return null;
        String digits = rawText.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            throw new IllegalArgumentException("Decoded barcode contains no digits");
        }
        return digits;
    }

    private static boolean tryLoadOpenCv() {
        if (OPENCV_LOADED.get()) return true;
        if (OPENCV_LOAD_ATTEMPTED.getAndSet(true)) return false;
        try {
            OpenCV.loadLocally();
            OPENCV_LOADED.set(true);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    private static String decodeWithOpenCv(MultiFormatReader reader, byte[] imageBytes, boolean debug, BarcodeDtos.DecodeBarcodeResponse resp)
            throws IOException, NotFoundException {
        Mat mat = Imgcodecs.imdecode(new MatOfByte(imageBytes), Imgcodecs.IMREAD_COLOR);
        if (mat.empty()) {
            mat.release();
            throw new IllegalArgumentException("Unsupported image");
        }

        List<MatVariant> bases = buildOpenCvBaseVariants(mat);
        try {
            for (MatVariant base : bases) {
                String text = tryDecodeMatVariants(reader, base, debug, resp);
                if (text != null) return text;
            }
        } finally {
            // Release all derived mats (but not the shared original twice).
            for (int i = 1; i < bases.size(); i++) {
                try {
                    bases.get(i).mat.release();
                } catch (Exception ignored) {
                }
            }
            mat.release();
        }
        throw NotFoundException.getNotFoundInstance();
    }

    private static List<MatVariant> buildOpenCvBaseVariants(Mat srcBgr) {
        List<MatVariant> out = new ArrayList<>();
        out.add(new MatVariant("bgr", srcBgr));

        Mat gray = new Mat();
        Imgproc.cvtColor(srcBgr, gray, Imgproc.COLOR_BGR2GRAY);
        out.add(new MatVariant("gray", gray));

        Mat blur = new Mat();
        Imgproc.GaussianBlur(gray, blur, new Size(3, 3), 0);
        out.add(new MatVariant("blur", blur));

        Mat binOtsu = new Mat();
        Imgproc.threshold(blur, binOtsu, 0, 255, Imgproc.THRESH_BINARY | Imgproc.THRESH_OTSU);
        out.add(new MatVariant("bin_otsu", binOtsu));

        Mat binInvOtsu = new Mat();
        Imgproc.threshold(blur, binInvOtsu, 0, 255, Imgproc.THRESH_BINARY_INV | Imgproc.THRESH_OTSU);
        out.add(new MatVariant("bin_inv_otsu", binInvOtsu));

        // Morphological close to connect broken bars (modest kernel).
        Mat kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, new Size(9, 3));
        Mat close = new Mat();
        Imgproc.morphologyEx(binOtsu, close, Imgproc.MORPH_CLOSE, kernel);
        out.add(new MatVariant("bin_close", close));

        Mat closeInv = new Mat();
        Imgproc.morphologyEx(binInvOtsu, closeInv, Imgproc.MORPH_CLOSE, kernel);
        out.add(new MatVariant("bin_inv_close", closeInv));

        kernel.release();
        return out;
    }

    private static String tryDecodeMatVariants(MultiFormatReader reader, MatVariant base, boolean debug, BarcodeDtos.DecodeBarcodeResponse resp) throws IOException {
        // Crop rectangles as ratios: full, center-ish, and lower section (common for phone photos).
        Crop[] crops = new Crop[]{
                new Crop("full", 0.0, 0.0, 1.0, 1.0),
                new Crop("center", 0.1, 0.2, 0.8, 0.6),
                new Crop("lower", 0.05, 0.45, 0.9, 0.5),
        };
        int[] rotations = new int[]{0, 90, 180, 270};
        double[] scales = new double[]{1.0, 0.85, 0.7, 0.55};

        for (Crop crop : crops) {
            for (int rot : rotations) {
                for (double scale : scales) {
                    Mat v = transformMat(base.mat, crop, rot, scale);
                    try {
                        BufferedImage img = matToBufferedImage(v);
                        String label = base.name + "|crop=" + crop.name + "|rot=" + rot + "|scale=" + scale + "|" + img.getWidth() + "x" + img.getHeight();
                        String text = tryDecodeBufferedImage(reader, img, debug, resp, label);
                        if (text != null) return text;
                    } finally {
                        v.release();
                    }
                }
            }
        }
        return null;
    }

    private static Mat transformMat(Mat src, Crop crop, int rotationDeg, double scale) {
        int w = src.cols();
        int h = src.rows();

        int x = (int) Math.floor(w * crop.rx);
        int y = (int) Math.floor(h * crop.ry);
        int cw = (int) Math.floor(w * crop.rw);
        int ch = (int) Math.floor(h * crop.rh);
        cw = Math.max(1, Math.min(cw, w - x));
        ch = Math.max(1, Math.min(ch, h - y));

        Rect roi = new Rect(x, y, cw, ch);
        Mat cropped = new Mat(src, roi);

        Mat rotated;
        switch (rotationDeg) {
            case 90 -> {
                rotated = new Mat();
                Core.rotate(cropped, rotated, Core.ROTATE_90_CLOCKWISE);
            }
            case 180 -> {
                rotated = new Mat();
                Core.rotate(cropped, rotated, Core.ROTATE_180);
            }
            case 270 -> {
                rotated = new Mat();
                Core.rotate(cropped, rotated, Core.ROTATE_90_COUNTERCLOCKWISE);
            }
            default -> rotated = cropped.clone();
        }

        // Scale and cap max dimension to keep decode time bounded.
        int maxDim = 2200;
        int tw = Math.max(1, (int) Math.round(rotated.cols() * scale));
        int th = Math.max(1, (int) Math.round(rotated.rows() * scale));
        double fit = Math.min(1.0, (double) maxDim / Math.max(tw, th));
        tw = Math.max(1, (int) Math.round(tw * fit));
        th = Math.max(1, (int) Math.round(th * fit));

        Mat resized = new Mat();
        Imgproc.resize(rotated, resized, new Size(tw, th), 0, 0, Imgproc.INTER_AREA);

        if (rotated != cropped) rotated.release();
        cropped.release();
        return resized;
    }

    private static BufferedImage matToBufferedImage(Mat mat) throws IOException {
        MatOfByte mob = new MatOfByte();
        Imgcodecs.imencode(".png", mat, mob);
        byte[] bytes = mob.toArray();
        mob.release();
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
        if (img == null) throw new IllegalArgumentException("Unsupported image after processing");
        return img;
    }

    private static String decodeWithJava2D(MultiFormatReader reader, byte[] imageBytes, boolean debug, BarcodeDtos.DecodeBarcodeResponse resp) {
        BufferedImage src;
        try {
            src = ImageIO.read(new ByteArrayInputStream(imageBytes));
        } catch (IOException e) {
            throw new IllegalArgumentException("Unsupported image");
        }
        if (src == null) throw new IllegalArgumentException("Unsupported image");

        List<BufferedVariant> bases = buildJava2DBaseVariants(src);
        for (BufferedVariant base : bases) {
            String text = tryDecodeBufferedVariants(reader, base, debug, resp);
            if (text != null) return text;
        }
        throw new IllegalArgumentException("No Code 128 barcode found");
    }

    private static List<BufferedVariant> buildJava2DBaseVariants(BufferedImage src) {
        List<BufferedVariant> out = new ArrayList<>();
        out.add(new BufferedVariant("orig", src));
        out.add(new BufferedVariant("gray", toGrayscale(src)));
        out.add(new BufferedVariant("hi_contrast", adjustContrast(toGrayscale(src), 1.35f)));
        out.add(new BufferedVariant("threshold", threshold(toGrayscale(src))));
        return out;
    }

    private static String tryDecodeBufferedVariants(MultiFormatReader reader, BufferedVariant base, boolean debug, BarcodeDtos.DecodeBarcodeResponse resp) {
        Crop[] crops = new Crop[]{
                new Crop("full", 0.0, 0.0, 1.0, 1.0),
                new Crop("center", 0.1, 0.2, 0.8, 0.6),
                new Crop("lower", 0.05, 0.45, 0.9, 0.5),
        };
        int[] rotations = new int[]{0, 90, 180, 270};
        double[] scales = new double[]{1.0, 0.85, 0.7, 0.55};

        for (Crop crop : crops) {
            for (int rot : rotations) {
                for (double scale : scales) {
                    BufferedImage v = transformBuffered(base.img, crop, rot, scale);
                    String label = base.name + "|crop=" + crop.name + "|rot=" + rot + "|scale=" + scale + "|" + v.getWidth() + "x" + v.getHeight();
                    String text = tryDecodeBufferedImage(reader, v, debug, resp, label);
                    if (text != null) return text;
                }
            }
        }
        return null;
    }

    private static String tryDecodeBufferedImage(MultiFormatReader reader, BufferedImage img, boolean debug, BarcodeDtos.DecodeBarcodeResponse resp, String label) {
        if (debug) {
            resp.tried.add(label);
            resp.attempts = resp.attempts + 1;
        }

        try {
            LuminanceSource src = new BufferedImageLuminanceSource(img);
            BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(src));
            Result result = reader.decodeWithState(bitmap);
            return result.getText();
        } catch (NotFoundException e) {
            return null;
        } finally {
            reader.reset();
        }
    }

    private static BufferedImage transformBuffered(BufferedImage src, Crop crop, int rotationDeg, double scale) {
        int w = src.getWidth();
        int h = src.getHeight();

        int x = (int) Math.floor(w * crop.rx);
        int y = (int) Math.floor(h * crop.ry);
        int cw = (int) Math.floor(w * crop.rw);
        int ch = (int) Math.floor(h * crop.rh);
        cw = Math.max(1, Math.min(cw, w - x));
        ch = Math.max(1, Math.min(ch, h - y));

        BufferedImage cropped = src.getSubimage(x, y, cw, ch);

        BufferedImage rotated = rotate(cropped, rotationDeg);

        int maxDim = 2200;
        int tw = Math.max(1, (int) Math.round(rotated.getWidth() * scale));
        int th = Math.max(1, (int) Math.round(rotated.getHeight() * scale));
        double fit = Math.min(1.0, (double) maxDim / Math.max(tw, th));
        tw = Math.max(1, (int) Math.round(tw * fit));
        th = Math.max(1, (int) Math.round(th * fit));

        if (tw == rotated.getWidth() && th == rotated.getHeight()) return rotated;

        BufferedImage out = new BufferedImage(tw, th, rotated.getType());
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(rotated, 0, 0, tw, th, null);
        g.dispose();
        return out;
    }

    private static BufferedImage rotate(BufferedImage src, int rotationDeg) {
        int deg = ((rotationDeg % 360) + 360) % 360;
        if (deg == 0) return src;

        double rads = Math.toRadians(deg);
        double sin = Math.abs(Math.sin(rads));
        double cos = Math.abs(Math.cos(rads));
        int w = src.getWidth();
        int h = src.getHeight();
        int newW = (int) Math.floor(w * cos + h * sin);
        int newH = (int) Math.floor(h * cos + w * sin);

        BufferedImage rotated = new BufferedImage(newW, newH, src.getType());
        Graphics2D g2d = rotated.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2d.translate((newW - w) / 2.0, (newH - h) / 2.0);
        g2d.rotate(rads, w / 2.0, h / 2.0);
        g2d.drawRenderedImage(src, null);
        g2d.dispose();
        return rotated;
    }

    private static BufferedImage toGrayscale(BufferedImage src) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = out.createGraphics();
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    private static BufferedImage adjustContrast(BufferedImage srcGray, float factor) {
        BufferedImage out = new BufferedImage(srcGray.getWidth(), srcGray.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        for (int y = 0; y < srcGray.getHeight(); y++) {
            for (int x = 0; x < srcGray.getWidth(); x++) {
                int v = srcGray.getRaster().getSample(x, y, 0);
                int vv = (int) Math.round((v - 128) * factor + 128);
                vv = Math.max(0, Math.min(255, vv));
                out.getRaster().setSample(x, y, 0, vv);
            }
        }
        return out;
    }

    private static BufferedImage threshold(BufferedImage srcGray) {
        // Simple global threshold around mid-point; try-harder on ZXing covers a lot, this is only a fallback.
        int t = 128;
        BufferedImage out = new BufferedImage(srcGray.getWidth(), srcGray.getHeight(), BufferedImage.TYPE_BYTE_BINARY);
        for (int y = 0; y < srcGray.getHeight(); y++) {
            for (int x = 0; x < srcGray.getWidth(); x++) {
                int v = srcGray.getRaster().getSample(x, y, 0);
                int b = v >= t ? 255 : 0;
                out.getRaster().setSample(x, y, 0, b);
            }
        }
        return out;
    }

    private record Crop(String name, double rx, double ry, double rw, double rh) {
    }

    private record MatVariant(String name, Mat mat) {
    }

    private record BufferedVariant(String name, BufferedImage img) {
    }
}
