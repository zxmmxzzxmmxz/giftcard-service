import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { VanillaGiftCard } from "../types";
import SerialNumberScanModal from "../components/SerialNumberScanModal";

export default function VanillaGiftCards() {
    const [items, setItems] = useState<VanillaGiftCard[]>([]);
    const [err, setErr] = useState<string>("");

    const [cCardNumber, setCCardNumber] = useState<string>("");
    const [cCcv, setCCcv] = useState<string>("");
    const [cExpiryDate, setCExpiryDate] = useState<string>("");
    const [cSerialPrefix, setCSerialPrefix] = useState<string>("");
    const [cSerialNumber, setCSerialNumber] = useState<string>("");
    const [cBalance, setCBalance] = useState<string>("");
    const [cNeedsRedeem, setCNeedsRedeem] = useState<boolean>(false);

    const [editingId, setEditingId] = useState<string>("");
    const editingItem = useMemo(
        () => items.find((x) => x.id === editingId) || null,
        [items, editingId]
    );

    const [eCardNumber, setECardNumber] = useState<string>("");
    const [eCcv, setECcv] = useState<string>("");
    const [eExpiryDate, setEExpiryDate] = useState<string>("");
    const [eSerialNumber, setESerialNumber] = useState<string>("");
    const [eBalance, setEBalance] = useState<string>("");
    const [eNeedsRedeem, setENeedsRedeem] = useState<boolean>(false);

    const [scanOpen, setScanOpen] = useState<boolean>(false);

    const load = async () => {
        setErr("");
        const res = (await api.listVanillaGiftCards()) as VanillaGiftCard[];
        const sorted = [...res].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        setItems(sorted);
    };

    useEffect(() => {
        load().catch((e) => setErr(e.message));
    }, []);

    useEffect(() => {
        if (!editingItem) return;
        setECardNumber(editingItem.cardNumber || "");
        setECcv(editingItem.ccv || "");
        setEExpiryDate(editingItem.expiryDate || "");
        setESerialNumber(editingItem.serialNumber || "");
        setEBalance(editingItem.balance === null || editingItem.balance === undefined ? "" : String(editingItem.balance));
        setENeedsRedeem(!!editingItem.needsRedeem);
    }, [editingItem]);

    const create = async () => {
        setErr("");
        try {
            const balance = cBalance.trim() === "" ? null : Number(cBalance);
            if (balance !== null && !Number.isFinite(balance)) throw new Error("Balance must be a number");

            const raw = cSerialNumber.trim();
            const serialNumber = raw ? `${cSerialPrefix}${raw}` : null;
            await api.createVanillaGiftCard({
                cardNumber: cCardNumber,
                ccv: cCcv || null,
                expiryDate: cExpiryDate || null,
                serialNumber,
                balance,
                needsRedeem: cNeedsRedeem,
            });
            setCCardNumber("");
            setCCcv("");
            setCExpiryDate("");
            setCSerialNumber("");
            setCBalance("");
            setCNeedsRedeem(false);
            await load();
        } catch (e: any) {
            setErr(e.message || "create failed");
        }
    };

    const save = async () => {
        if (!editingId) return;
        setErr("");
        try {
            const balance = eBalance.trim() === "" ? null : Number(eBalance);
            if (balance !== null && !Number.isFinite(balance)) throw new Error("Balance must be a number");

            await api.updateVanillaGiftCard(editingId, {
                cardNumber: eCardNumber,
                ccv: eCcv || null,
                expiryDate: eExpiryDate || null,
                serialNumber: eSerialNumber || null,
                balance,
                needsRedeem: eNeedsRedeem,
            });
            setEditingId("");
            await load();
        } catch (e: any) {
            setErr(e.message || "save failed");
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this Vanilla gift card?")) return;
        setErr("");
        try {
            await api.deleteVanillaGiftCard(id);
            if (editingId === id) setEditingId("");
            await load();
        } catch (e: any) {
            setErr(e.message || "delete failed");
        }
    };

    return (
        <div>
            <h3>Vanilla Gift Cards</h3>
            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

            <SerialNumberScanModal
                open={scanOpen}
                title="Scan Vanilla Serial Number"
                onClose={() => setScanOpen(false)}
                onDetected={(serial) => setCSerialNumber(serial)}
            />

            <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ marginTop: 0 }}>Add Vanilla Gift Card</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px 1fr 160px 1fr", gap: 10, alignItems: "end" }}>
                    <label>
                        Card Number *
                        <input value={cCardNumber} onChange={(e) => setCCardNumber(e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label>
                        CCV
                        <input value={cCcv} onChange={(e) => setCCcv(e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label>
                        Expiry Date
                        <input value={cExpiryDate} onChange={(e) => setCExpiryDate(e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label>
                        Serial Number
                        <div style={{ display: "flex", gap: 8 }}>
                            <select
                                value={cSerialPrefix}
                                onChange={(e) => setCSerialPrefix(e.target.value)}
                                style={{ width: 110 }}
                                title="Serial number prefix"
                            >
                                <option value="">(none)</option>
                                <option value="1234">1234</option>
                            </select>
                            <input value={cSerialNumber} onChange={(e) => setCSerialNumber(e.target.value)} style={{ width: "100%" }} />
                            <button type="button" onClick={() => setScanOpen(true)}>
                                Scan
                            </button>
                        </div>
                    </label>
                    <label>
                        Balance
                        <input value={cBalance} onChange={(e) => setCBalance(e.target.value)} inputMode="decimal" style={{ width: "100%" }} />
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                        <input
                            type="checkbox"
                            checked={cNeedsRedeem}
                            onChange={(e) => setCNeedsRedeem(e.target.checked)}
                        />
                        needsRedeem
                    </label>
                </div>
                <div style={{ height: 10 }} />
                <button onClick={create}>Create</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                            <th style={{ padding: 8 }}>Card Number</th>
                            <th style={{ padding: 8 }}>CCV</th>
                            <th style={{ padding: 8 }}>Expiry</th>
                            <th style={{ padding: 8 }}>Serial</th>
                            <th style={{ padding: 8 }}>Balance</th>
                            <th style={{ padding: 8 }}>needsRedeem</th>
                            <th style={{ padding: 8 }}>Created</th>
                            <th style={{ padding: 8 }}>Updated</th>
                            <th style={{ padding: 8 }} />
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((x) => (
                            <tr
                                key={x.id}
                                style={{ borderBottom: "1px solid #eee", background: x.id === editingId ? "#fafafa" : "white" }}
                            >
                                <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                    {x.cardNumber}
                                </td>
                                <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.85 }}>
                                    {x.ccv || "-"}
                                </td>
                                <td style={{ padding: 8, opacity: 0.85 }}>{x.expiryDate || "-"}</td>
                                <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.85 }}>
                                    {x.serialNumber || "-"}
                                </td>
                                <td style={{ padding: 8 }}><strong>{x.balance ?? "-"}</strong></td>
                                <td style={{ padding: 8, opacity: 0.85 }}>{x.needsRedeem ? "Yes" : "No"}</td>
                                <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                    {x.createdAt ? x.createdAt.replace("T", " ") : "-"}
                                </td>
                                <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                    {x.updatedAt ? x.updatedAt.replace("T", " ") : "-"}
                                </td>
                                <td style={{ padding: 8, whiteSpace: "nowrap", textAlign: "right" }}>
                                    <button onClick={() => setEditingId(x.id)} style={{ marginRight: 8 }}>
                                        Edit
                                    </button>
                                    <button onClick={() => del(x.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
                    <h4 style={{ marginTop: 0 }}>Edit Vanilla Gift Card</h4>
                    {!editingItem ? (
                        <div style={{ opacity: 0.7 }}>Select a card to edit.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                ID: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{editingItem.id}</span>
                            </div>

                            <label>
                                Card Number *
                                <input value={eCardNumber} onChange={(e) => setECardNumber(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                CCV
                                <input value={eCcv} onChange={(e) => setECcv(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                Expiry Date
                                <input value={eExpiryDate} onChange={(e) => setEExpiryDate(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                Serial Number
                                <input value={eSerialNumber} onChange={(e) => setESerialNumber(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                Balance
                                <input value={eBalance} onChange={(e) => setEBalance(e.target.value)} inputMode="decimal" style={{ width: "100%" }} />
                            </label>

                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                    type="checkbox"
                                    checked={eNeedsRedeem}
                                    onChange={(e) => setENeedsRedeem(e.target.checked)}
                                />
                                needsRedeem
                            </label>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={save}>Save</button>
                                <button onClick={() => setEditingId("")}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
