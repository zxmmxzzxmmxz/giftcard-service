package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.BarcodeDtos;
import com.dlb.giftcards.service.BarcodeDecodeService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/barcode")
public class BarcodeController {

    private final BarcodeDecodeService barcodeDecodeService;

    public BarcodeController(BarcodeDecodeService barcodeDecodeService) {
        this.barcodeDecodeService = barcodeDecodeService;
    }

    @PostMapping(value = "/decode/code128", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BarcodeDtos.DecodeBarcodeResponse decodeCode128(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "debug", required = false, defaultValue = "false") boolean debug
    ) {
        try {
            return barcodeDecodeService.decodeCode128(file.getBytes(), debug);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read file");
        }
    }
}
