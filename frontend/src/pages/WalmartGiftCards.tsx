import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { WalmartGiftCard } from "../types";
import Barcode128 from "../components/Barcode128";

export default function WalmartGiftCards() {
    const [items, setItems] = useState<WalmartGiftCard[]>([]);
    const [err, setErr] = useState<string>("");

    const [storeId, setStoreId] = useState<string>("");
    const storeItem = useMemo(
        () => items.find((x) => x.id === storeId) || null,
        [items, storeId]
    );

    const [cCardNumber, setCCardNumber] = useState<string>("");
    const [cPin, setCPin] = useState<string>("");
    const [cBalance, setCBalance] = useState<string>("");

    const [editingId, setEditingId] = useState<string>("");
    const editingItem = useMemo(
        () => items.find((x) => x.id === editingId) || null,
        [items, editingId]
    );

    const [eCardNumber, setECardNumber] = useState<string>("");
    const [ePin, setEPin] = useState<string>("");
    const [eBalance, setEBalance] = useState<string>("");

    const [listening, setListening] = useState<boolean>(false);
    const [listenEndAt, setListenEndAt] = useState<string>("");
    const [listenLastError, setListenLastError] = useState<string>("");

    const barcodeValueFor = (cardNumber: string) => {
        const cn = (cardNumber || "").trim();
        return cn ? `79936686504000${cn}` : "";
    };

    const load = async () => {
        setErr("");
        const res = (await api.listWalmartGiftCards()) as WalmartGiftCard[];
        const ts = (s: string) => {
            const t = Date.parse(s);
            return Number.isFinite(t) ? t : 0;
        };
        const sorted = [...res].sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
        setItems(sorted);
    };

    useEffect(() => {
        load().catch((e) => setErr(e.message));
    }, []);

    const refreshListenerStatus = async () => {
        try {
            const s = await api.walmartEmailListenerStatus();
            setListening(!!s?.running);
            setListenEndAt(s?.endAt || "");
            setListenLastError(s?.lastError || "");
        } catch (e: any) {
            setListenLastError(e?.message || "listener status failed");
        }
    };

    useEffect(() => {
        refreshListenerStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!listening) return;
        const id = window.setInterval(() => {
            refreshListenerStatus();
            load().catch(() => {});
        }, 5000);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listening]);

    const startListening = async () => {
        setErr("");
        setListenLastError("");
        try {
            const s = await api.walmartEmailListenerStart();
            setListening(!!s?.running);
            setListenEndAt(s?.endAt || "");
            setListenLastError(s?.lastError || "");
        } catch (e: any) {
            setErr(e?.message || "start listener failed");
        }
    };

    const stopListening = async () => {
        setErr("");
        setListenLastError("");
        try {
            const s = await api.walmartEmailListenerStop();
            setListening(!!s?.running);
            setListenEndAt(s?.endAt || "");
            setListenLastError(s?.lastError || "");
        } catch (e: any) {
            setErr(e?.message || "stop listener failed");
        }
    };

    useEffect(() => {
        if (!editingItem) return;
        setECardNumber(editingItem.cardNumber || "");
        setEPin(editingItem.pin || "");
        setEBalance(
            editingItem.balance === null || editingItem.balance === undefined ? "" : String(editingItem.balance)
        );
    }, [editingItem]);

    const create = async () => {
        setErr("");
        try {
            const balance = Number(cBalance);
            if (!Number.isFinite(balance)) throw new Error("Balance must be a number");

            await api.createWalmartGiftCard({
                cardNumber: cCardNumber,
                pin: cPin,
                balance,
            });
            setCCardNumber("");
            setCPin("");
            setCBalance("");
            await load();
        } catch (e: any) {
            setErr(e.message || "create failed");
        }
    };

    const openStore = (id: string) => {
        setErr("");
        setStoreId(id);
    };

    const closeStore = () => setStoreId("");

    const nextCardIdFrom = (id: string): string => {
        const idx = items.findIndex((x) => x.id === id);
        if (idx < 0) return "";
        const next = items[idx + 1];
        return next ? next.id : "";
    };

    const usedAll = async () => {
        if (!storeItem) return;
        setErr("");
        try {
            const nextId = nextCardIdFrom(storeItem.id);
            await api.updateWalmartGiftCard(storeItem.id, {
                cardNumber: storeItem.cardNumber,
                pin: storeItem.pin,
                balance: 0,
            });
            await load();
            setStoreId(nextId);
        } catch (e: any) {
            setErr(e.message || "update failed");
        }
    };

    const partialUse = async () => {
        if (!storeItem) return;
        setErr("");
        try {
            const raw = window.prompt("Amount used:", "0");
            if (raw === null) return;
            const amount = Number(raw);
            if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive number");
            if (!Number.isFinite(storeItem.balance)) throw new Error("Invalid current balance");
            if (amount > storeItem.balance) throw new Error("Amount exceeds current balance");

            const nextBalance = storeItem.balance - amount;
            await api.updateWalmartGiftCard(storeItem.id, {
                cardNumber: storeItem.cardNumber,
                pin: storeItem.pin,
                balance: nextBalance,
            });
            await load();
            closeStore();
        } catch (e: any) {
            setErr(e.message || "update failed");
        }
    };

    const save = async () => {
        if (!editingId) return;
        setErr("");
        try {
            const balance = Number(eBalance);
            if (!Number.isFinite(balance)) throw new Error("Balance must be a number");

            await api.updateWalmartGiftCard(editingId, {
                cardNumber: eCardNumber,
                pin: ePin,
                balance,
            });
            setEditingId("");
            await load();
        } catch (e: any) {
            setErr(e.message || "save failed");
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this Walmart gift card?")) return;
        setErr("");
        try {
            await api.deleteWalmartGiftCard(id);
            if (editingId === id) setEditingId("");
            await load();
        } catch (e: any) {
            setErr(e.message || "delete failed");
        }
    };

    return (
        <div>
            <h3>Walmart Gift Cards</h3>
            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

            <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h4 style={{ margin: 0 }}>Email Listener</h4>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                        {listening ? (
                            <span style={{ fontSize: 12, opacity: 0.75 }}>
                                Listening{listenEndAt ? ` (until ${String(listenEndAt).replace("T", " ")})` : ""}
                            </span>
                        ) : (
                            <span style={{ fontSize: 12, opacity: 0.75 }}>Not listening</span>
                        )}
                        {listening ? (
                            <button onClick={stopListening}>Cancel</button>
                        ) : (
                            <button onClick={startListening}>Listen on Email</button>
                        )}
                    </div>
                </div>
                {listenLastError ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "crimson" }}>{listenLastError}</div>
                ) : (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                        Backend polls Gmail every 10s for up to 2 hours (env vars required: GMAIL_ADDRESS, GMAIL_APP_PASSWORD).
                    </div>
                )}
            </div>

            {storeItem ? (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            width: "min(720px, 100%)",
                            background: "white",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                            padding: 14,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <h3 style={{ margin: 0 }}>Store</h3>
                            <div style={{ marginLeft: "auto" }}>
                                <button
                                    onClick={closeStore}
                                    aria-label="Close"
                                    title="Close"
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        border: "1px solid #ddd",
                                        background: "white",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div style={{ height: 12 }} />

                            <div style={{ display: "grid", gap: 10 }}>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    ID: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{storeItem.id}</span>
                                </div>

                                <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ padding: 8, border: "1px solid #eee", borderRadius: 8, background: "white" }}>
                                        <Barcode128 value={barcodeValueFor(storeItem.cardNumber)} height={62} />
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                                        Barcode value:{" "}
                                        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                            {barcodeValueFor(storeItem.cardNumber) || "-"}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10 }}>
                                    <label>
                                        Card Number
                                        <input
                                        readOnly
                                        value={storeItem.cardNumber}
                                        style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                                    />
                                </label>
                                <label>
                                    PIN
                                    <input
                                        readOnly
                                        value={storeItem.pin}
                                        style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                                    />
                                </label>
                                <label>
                                    Balance
                                    <input readOnly value={String(storeItem.balance ?? "")} style={{ width: "100%" }} />
                                </label>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <label>
                                    Created
                                    <input readOnly value={storeItem.createdAt?.replace("T", " ") || ""} style={{ width: "100%" }} />
                                </label>
                                <label>
                                    Updated
                                    <input readOnly value={storeItem.updatedAt?.replace("T", " ") || ""} style={{ width: "100%" }} />
                                </label>
                            </div>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={usedAll}>Used All</button>
                                <button onClick={partialUse}>Partial Use</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ marginTop: 0 }}>Add Walmart Gift Card</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px auto", gap: 10, alignItems: "end" }}>
                    <label>
                        Card Number *
                        <input value={cCardNumber} onChange={(e) => setCCardNumber(e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label>
                        PIN *
                        <input value={cPin} onChange={(e) => setCPin(e.target.value)} style={{ width: "100%" }} />
                    </label>
                    <label>
                        Balance *
                        <input
                            value={cBalance}
                            onChange={(e) => setCBalance(e.target.value)}
                            inputMode="decimal"
                            style={{ width: "100%" }}
                        />
                    </label>
                    <button onClick={create}>Create</button>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                            <th style={{ padding: 8 }}>Card Number</th>
                            <th style={{ padding: 8 }}>PIN</th>
                            <th style={{ padding: 8 }}>Balance</th>
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
                                    {x.pin}
                                </td>
                                <td style={{ padding: 8 }}><strong>{x.balance ?? "-"}</strong></td>
                                <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                    {x.createdAt ? x.createdAt.replace("T", " ") : "-"}
                                </td>
                                <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                    {x.updatedAt ? x.updatedAt.replace("T", " ") : "-"}
                                </td>
                                <td style={{ padding: 8, whiteSpace: "nowrap", textAlign: "right" }}>
                                    <button onClick={() => openStore(x.id)} style={{ marginRight: 8 }}>
                                        Store
                                    </button>
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
                    <h4 style={{ marginTop: 0 }}>Edit Walmart Gift Card</h4>
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
                                PIN *
                                <input value={ePin} onChange={(e) => setEPin(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                Balance *
                                <input
                                    value={eBalance}
                                    onChange={(e) => setEBalance(e.target.value)}
                                    inputMode="decimal"
                                    style={{ width: "100%" }}
                                />
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
