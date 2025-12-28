import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Card, Template } from "../types";
import Barcode128 from "../components/Barcode128";


export default function CardDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [err, setErr] = useState<string>("");

    const [card, setCard] = useState<Card | null>(null);
    const [template, setTemplate] = useState<Template | null>(null);

    // always-edit mode state
    const [displayName, setDisplayName] = useState<string>("");
    const [data, setData] = useState<Record<string, string>>({});

    const fieldsSorted = useMemo(() => {
        if (!template) return [];
        return [...template.fields].sort((a, b) => {
            const ak = (a.key || "").toLowerCase();
            const bk = (b.key || "").toLowerCase();
            if (ak === "balance" && bk !== "balance") return -1;
            if (bk === "balance" && ak !== "balance") return 1;
            return ak.localeCompare(bk);
        });
    }, [template]);

    const load = async () => {
        if (!id) throw new Error("Missing card id");
        const c = (await api.getCard(id)) as Card;
        setCard(c);

        const t = (await api.getTemplate(c.templateId)) as Template;
        setTemplate(t);

        setDisplayName(c.displayName || "");
        setData({ ...(c.data || {}) });

        // ensure balance exists in UI even for old cards
        const hasBalance = Object.keys(c.data || {}).some((k) => k.toLowerCase() === "balance");
        if (!hasBalance) {
            setData((d) => ({ balance: d["balance"] ?? "", ...d }));
        }
    };

    useEffect(() => {
        (async () => {
            try {
                setErr("");
                await load();
            } catch (e: any) {
                setErr(e.message || "load failed");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const updateField = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }));

    const save = async () => {
        if (!id || !card) return;
        setErr("");
        try {
            // required validation
            if (template) {
                for (const f of template.fields) {
                    if (f.required) {
                        const v = (data[f.key] || "").trim();
                        if (!v) throw new Error(`Field "${f.label}" is required`);
                    }
                }
            }

            const updated = (await api.updateCard(id, {
                templateId: card.templateId,
                displayName,
                data,
            })) as Card;

            setCard(updated);
            setDisplayName(updated.displayName || "");
            setData({ ...(updated.data || {}) });
        } catch (e: any) {
            setErr(e.message || "save failed");
        }
    };

    const archive = async () => {
        if (!id) return;
        if (!confirm("Archive this card?")) return;
        setErr("");
        try {
            await api.deleteCard(id); // backend will archive (soft delete)
            nav("/cards");
        } catch (e: any) {
            setErr(e.message || "archive failed");
        }
    };

    const fullyUsedAndArchive = async () => {
        if (!id || !card) return;
        if (!confirm("Set balance to 0 and archive this card?")) return;

        setErr("");
        try {
            const nextData = { ...(data || {}), balance: "0" };

            // 1) 先保存余额=0
            await api.updateCard(id, {
                templateId: card.templateId,
                displayName,
                data: nextData,
            });

            // 2) 再归档
            await api.deleteCard(id);

            nav("/cards");
        } catch (e: any) {
            setErr(e.message || "fully used & archive failed");
        }
    };


    if (err) return <div style={{ color: "crimson" }}>{err}</div>;
    if (!card) return <div>Loading...</div>;

    const balanceValue = data["balance"] ?? data["Balance"] ?? "";

    return (
        <div>
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <button onClick={() => nav("/cards")}>Back</button>
                <h3 style={{ margin: 0 }}>Card</h3>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    <button onClick={save}>Save</button>
                </div>
            </div>

            <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
                    ID: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{card.id}</span>
                </div>

                <div style={{ marginBottom: 10, opacity: 0.85 }}>
                    Template: {template ? template.name : card.templateId}
                </div>

                {/* Display name (always editable) */}
                <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>Display name</div>
                    <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        style={{ width: "100%" }}
                    />
                </label>

                {/* Fields (always editable) */}
                <div style={{ display: "grid", gap: 10 }}>
                    {template ? (
                        fieldsSorted.map((f) => {
                            const key = f.key;
                            const isSecret = f.type === "SECRET" || f.sensitive;
                            const inputType =
                                f.type === "NUMBER"
                                    ? "number"
                                    : isSecret
                                        ? "password"
                                        : "text";

                            const isBalance = (key || "").toLowerCase() === "balance";

                            return (
                                <label key={key} style={{ display: "grid", gap: 4 }}>
                                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                                        {f.label} {f.required ? "*" : ""}{" "}
                                        {(f.sensitive || f.type === "SECRET") ? (
                                            <span style={{ opacity: 0.6 }}>(sensitive)</span>
                                        ) : null}
                                    </div>

                                    {(key || "").toLowerCase() === "cardnumber" ? (
                                        <div style={{ display: "grid", gap: 8 }}>
                                            <input
                                                value={data[key] || ""}
                                                type="text"
                                                onChange={(e) => updateField(key, e.target.value)}
                                                style={{ width: "100%" }}
                                            />

                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ padding: 8, border: "1px solid #eee", borderRadius: 8, background: "white" }}>
                                                    {(() => {
                                                        const cardNo = (data[key] || "").trim();

                                                        // 支持你说的 key: "barcode-prefix"（也容错大小写/下划线）
                                                        const prefix =
                                                            (data["barcode-prefix"] ||
                                                                data["BARCODE-PREFIX"] ||
                                                                data["barcodePrefix"] ||
                                                                data["BARCODEPREFIX"] ||
                                                                "") as string;

                                                        const barcodeValue = `${(prefix || "").trim()}${cardNo}`;

                                                        return (
                                                            <div style={{ display: "grid", gap: 6 }}>
                                                                <div style={{ padding: 8, border: "1px solid #eee", borderRadius: 8, background: "white" }}>
                                                                    <Barcode128 value={barcodeValue} height={52} />
                                                                </div>

                                                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                                                    Barcode value:{" "}
                                                                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {barcodeValue || "-"}
        </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <input
                                            value={data[key] || ""}
                                            type={inputType}
                                            step={f.type === "NUMBER" ? "0.01" : undefined}
                                            onChange={(e) => updateField(key, e.target.value)}
                                            style={{
                                                width: "100%",
                                                fontWeight: ((key || "").toLowerCase() === "balance") ? 600 : 400,
                                            }}
                                        />
                                    )}


                                    <div style={{ fontSize: 12, opacity: 0.6 }}>key: {key} · type: {f.type}</div>
                                </label>
                            );
                        })
                    ) : (
                        // Fallback if template missing
                        Object.keys(data || {}).map((k) => (
                            <label key={k} style={{ display: "grid", gap: 4 }}>
                                <div style={{ fontSize: 13, opacity: 0.9 }}>{k}</div>
                                <input
                                    value={data[k] || ""}
                                    onChange={(e) => updateField(k, e.target.value)}
                                    style={{ width: "100%" }}
                                />
                            </label>
                        ))
                    )}
                </div>

                {/* Balance summary + Archive big button under it */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        <button
                            onClick={fullyUsedAndArchive}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: 10,
                                border: "1px solid #ddd",
                                cursor: "pointer",
                                fontSize: 16,
                                fontWeight: 700,
                            }}
                            title="把余额清零并归档"
                        >
                            清空余额并归档
                        </button>

                        <button
                            onClick={archive}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: 10,
                                border: "1px solid #ddd",
                                cursor: "pointer",
                                fontSize: 16,
                            }}
                        >
                            归档
                        </button>
                    </div>


                </div>
            </div>
        </div>
    );
}
