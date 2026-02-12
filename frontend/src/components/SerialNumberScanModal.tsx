import React, { useRef, useState } from "react";
import { api } from "../api";

type Props = {
    open: boolean;
    title?: string;
    onClose: () => void;
    onDetected: (serialNumberDigits: string) => void;
};

function normalizeDigits(rawText: string): string | null {
    const digits = rawText.replace(/\D/g, "");
    return digits ? digits : null;
}

export default function SerialNumberScanModal({ open, title, onClose, onDetected }: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [err, setErr] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);

    const decodeFile = async (file: File) => {
        setErr("");
        setBusy(true);
        try {
            const decoded = await api.decodeCode128(file);
            const serial = decoded?.serialNumber ? normalizeDigits(decoded.serialNumber) : null;
            if (!serial) {
                throw new Error("No Code 128 barcode found");
            }
            onDetected(serial);
            onClose();
        } catch (e: any) {
            setErr(e?.message || "Failed to decode image");
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    if (!open) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
            }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                style={{
                    background: "white",
                    borderRadius: 10,
                    width: "min(720px, 100%)",
                    padding: 14,
                    boxShadow: "0 12px 36px rgba(0,0,0,0.22)",
                }}
            >
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 700 }}>{title || "Scan Serial Number"}</div>
                    <button onClick={onClose} disabled={busy}>
                        Close
                    </button>
                </div>

                <div style={{ height: 10 }} />

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Upload a photo of the Code 128 barcode. Decoding runs on the backend.
                </div>

                {err ? <div style={{ color: "crimson", marginTop: 8 }}>{err}</div> : null}

                <div style={{ height: 10 }} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={busy}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            decodeFile(f);
                        }}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                        {busy ? "Decoding..." : "Choose / Take Photo"}
                    </button>
                </div>

                <div style={{ height: 10 }} />

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button
                        onClick={() => {
                            onClose();
                        }}
                        disabled={busy}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

