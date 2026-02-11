import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Anycard } from "../types";

export default function Anycards() {
    const [items, setItems] = useState<Anycard[]>([]);
    const [err, setErr] = useState<string>("");

    const redeemAllTabRef = useRef<Window | null>(null);
    const [redeemAllRunning, setRedeemAllRunning] = useState<boolean>(false);

    const [createOpen, setCreateOpen] = useState<boolean>(false);
    const [cCardNumber, setCCardNumber] = useState<string>("");
    const [cSerialNumber, setCSerialNumber] = useState<string>("");
    const [cPin, setCPin] = useState<string>("");
    const [cType, setCType] = useState<string>("Celebrate");
    const [cBalance, setCBalance] = useState<string>("");
    const [cNeedsRedeem, setCNeedsRedeem] = useState<boolean>(false);

    const [editingId, setEditingId] = useState<string>("");
    const editingItem = useMemo(
        () => items.find((x) => x.id === editingId) || null,
        [items, editingId]
    );

    const [eCardNumber, setECardNumber] = useState<string>("");
    const [eSerialNumber, setESerialNumber] = useState<string>("");
    const [ePin, setEPin] = useState<string>("");
    const [eType, setEType] = useState<string>("Celebrate");
    const [eBalance, setEBalance] = useState<string>("");
    const [eNeedsRedeem, setENeedsRedeem] = useState<boolean>(false);

    const load = async () => {
        setErr("");
        const res = (await api.listAnycards()) as Anycard[];
        const sorted = [...res].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        setItems(sorted);
    };

    useEffect(() => {
        load().catch((e) => setErr(e.message));
    }, []);

    useEffect(() => {
        if (!redeemAllRunning) return;

        let cancelled = false;
        const tick = async () => {
            try {
                const [anycards, tasks] = await Promise.all([
                    api.listAnycards() as Promise<Anycard[]>,
                    api.listTasks() as Promise<any[]>,
                ]);

                if (cancelled) return;

                const sorted = [...anycards].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
                setItems(sorted);

                const hasNeedsRedeem = anycards.some((x) => x.needsRedeem);
                if (!hasNeedsRedeem) {
                    setRedeemAllRunning(false);
                    return;
                }

                const hasInProgressAnycardTask = tasks.some(
                    (t) => t && t.type === "getmybonus_anycard" && t.status === "IN_PROGRESS"
                );

                if (hasInProgressAnycardTask) return;

                const url = "https://getmybonus.ca?task_type=getmybonus_anycard";
                const tab = redeemAllTabRef.current;
                if (tab && !tab.closed) {
                    tab.location.href = url;
                } else {
                    // If the window reference is missing but the named tab is still open, this will reuse it.
                    // If it's not open, browsers may block new popups from timer callbacks.
                    const opened = window.open(url, REDEEM_ALL_WINDOW_NAME);
                    if (opened) {
                        redeemAllTabRef.current = opened;
                    } else {
                        setErr("Redeem All tab is closed (or blocked). Please click Redeem All again.");
                        setRedeemAllRunning(false);
                    }
                }
            } catch (e: any) {
                if (cancelled) return;
                setErr(e?.message || "Redeem All failed");
            }
        };

        tick();
        const id = window.setInterval(tick, 5000);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [redeemAllRunning]);

    useEffect(() => {
        if (!editingItem) return;
        setECardNumber(editingItem.cardNumber || "");
        setESerialNumber(editingItem.serialNumber || "");
        setEPin(editingItem.pin || "");
        setEType(editingItem.anycardType || "Celebrate");
        setEBalance(editingItem.balance || "");
        setENeedsRedeem(!!editingItem.needsRedeem);
    }, [editingItem]);

    const create = async () => {
        setErr("");
        try {
            await api.createAnycard({
                cardNumber: cCardNumber,
                serialNumber: cSerialNumber || null,
                pin: cPin || null,
                anycardType: cType,
                balance: cBalance || null,
                needsRedeem: cNeedsRedeem,
            });
            setCCardNumber("");
            setCSerialNumber("");
            setCPin("");
            setCBalance("");
            setCNeedsRedeem(false);
            setCreateOpen(false);
            await load();
        } catch (e: any) {
            setErr(e.message || "create failed");
        }
    };

    const save = async () => {
        if (!editingId) return;
        setErr("");
        try {
            await api.updateAnycard(editingId, {
                cardNumber: eCardNumber,
                serialNumber: eSerialNumber || null,
                pin: ePin || null,
                anycardType: eType,
                balance: eBalance || null,
                needsRedeem: eNeedsRedeem,
            });
            await load();
        } catch (e: any) {
            setErr(e.message || "save failed");
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this anycard?")) return;
        setErr("");
        try {
            await api.deleteAnycard(id);
            if (editingId === id) setEditingId("");
            await load();
        } catch (e: any) {
            setErr(e.message || "delete failed");
        }
    };

    const redeem = async (x: Anycard) => {
        setErr("");
        try {
            if (!x.serialNumber) throw new Error("serialNumber is required to redeem");
            await api.createTask({
                type: "getmybonus_anycard",
                data: {
                    anycardId: x.id,
                    anycardType: x.anycardType,
                    cardNumber: x.cardNumber,
                    serialNumber: x.serialNumber,
                },
            });
            await load();
        } catch (e: any) {
            setErr(e.message || "redeem failed");
        }
    };

    const REDEEM_ALL_WINDOW_NAME = "giftcard_redeem_all";

    const toggleRedeemAll = () => {
        setErr("");
        if (redeemAllRunning) {
            setRedeemAllRunning(false);
            return;
        }

        // Avoid using "noopener/noreferrer" here because some Chrome configurations return `null` even when a new tab is opened.
        const tab = window.open("https://getmybonus.ca?task_type=getmybonus_anycard", REDEEM_ALL_WINDOW_NAME);
        if (tab) redeemAllTabRef.current = tab;
        setRedeemAllRunning(true);
    };

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0 }}>Anycards</h3>
                <button onClick={() => setCreateOpen((x) => !x)} style={{ marginLeft: "auto" }}>
                    {createOpen ? "Close" : "New Anycard"}
                </button>
                <button onClick={toggleRedeemAll}>
                    {redeemAllRunning ? "Stop Redeem All" : "Redeem All"}
                </button>
            </div>

            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

            {createOpen ? (
                <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginTop: 12 }}>
                    <h4 style={{ marginTop: 0 }}>Create Anycard</h4>

                    <div style={{ display: "grid", gap: 10 }}>
                        <label>
                            Card Number *
                            <input value={cCardNumber} onChange={(e) => setCCardNumber(e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Serial Number
                            <input value={cSerialNumber} onChange={(e) => setCSerialNumber(e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            PIN
                            <input value={cPin} onChange={(e) => setCPin(e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Anycard Type *
                            <select value={cType} onChange={(e) => setCType(e.target.value)} style={{ width: "100%" }}>
                                <option value="Celebrate">Celebrate</option>
                            </select>
                        </label>

                        <label>
                            Balance
                            <input value={cBalance} onChange={(e) => setCBalance(e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            ) : null}

            <div style={{ height: 16 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, alignItems: "start" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                            <th style={{ padding: 8 }}>Card Number</th>
                            <th style={{ padding: 8 }}>Serial Number</th>
                            <th style={{ padding: 8 }}>Type</th>
                            <th style={{ padding: 8 }}>Balance</th>
                            <th style={{ padding: 8 }}>Needs Redeem</th>
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
                                    {x.serialNumber || "-"}
                                </td>
                                <td style={{ padding: 8, opacity: 0.85 }}>{x.anycardType}</td>
                                <td style={{ padding: 8 }}><strong>{x.balance || "-"}</strong></td>
                                <td style={{ padding: 8, opacity: 0.85 }}>{x.needsRedeem ? "Yes" : "No"}</td>
                                <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                    {x.updatedAt ? x.updatedAt.replace("T", " ") : "-"}
                                </td>
                                <td style={{ padding: 8, whiteSpace: "nowrap", textAlign: "right" }}>
                                    <button onClick={() => redeem(x)} style={{ marginRight: 8 }}>
                                        Redeem
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
                    <h4 style={{ marginTop: 0 }}>Edit Anycard</h4>
                    {!editingItem ? (
                        <div style={{ opacity: 0.7 }}>Select an anycard to edit.</div>
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
                                Serial Number
                                <input value={eSerialNumber} onChange={(e) => setESerialNumber(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                PIN
                                <input value={ePin} onChange={(e) => setEPin(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                Anycard Type *
                                <select value={eType} onChange={(e) => setEType(e.target.value)} style={{ width: "100%" }}>
                                    <option value="Celebrate">Celebrate</option>
                                </select>
                            </label>

                            <label>
                                Balance
                                <input value={eBalance} onChange={(e) => setEBalance(e.target.value)} style={{ width: "100%" }} />
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
