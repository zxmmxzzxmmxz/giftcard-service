import React, { useEffect, useState } from "react";
import { api } from "../api";
import { AutomationTask } from "../types";

function previewJson(x: any, maxLen = 120): string {
    if (x === null || x === undefined) return "-";
    let s = "";
    try {
        s = JSON.stringify(x);
    } catch {
        s = String(x);
    }
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
}

export default function Tasks() {
    const [items, setItems] = useState<AutomationTask[]>([]);
    const [err, setErr] = useState<string>("");

    const load = async () => {
        setErr("");
        const res = (await api.listTasks()) as AutomationTask[];
        setItems(res);
    };

    useEffect(() => {
        load().catch((e) => setErr(e.message));
    }, []);

    const del = async (id: string) => {
        if (!confirm("Delete this task?")) return;
        setErr("");
        try {
            await api.deleteTask(id);
            await load();
        } catch (e: any) {
            setErr(e.message || "delete failed");
        }
    };

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0 }}>Tasks</h3>
                <button onClick={() => load()} style={{ marginLeft: "auto" }}>
                    Refresh
                </button>
            </div>

            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

            <div style={{ height: 12 }} />

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                        <th style={{ padding: 8 }}>ID</th>
                        <th style={{ padding: 8 }}>Type</th>
                        <th style={{ padding: 8 }}>Status</th>
                        <th style={{ padding: 8 }}>Data</th>
                        <th style={{ padding: 8 }}>Result</th>
                        <th style={{ padding: 8 }}>Updated</th>
                        <th style={{ padding: 8 }} />
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                {t.id}
                            </td>
                            <td style={{ padding: 8, opacity: 0.85 }}>{t.type}</td>
                            <td style={{ padding: 8 }}>
                                <strong>{t.status}</strong>
                                {t.lastError ? <div style={{ color: "crimson", fontSize: 12 }}>{t.lastError}</div> : null}
                            </td>
                            <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.85 }}>
                                {previewJson(t.data)}
                            </td>
                            <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.85 }}>
                                {previewJson(t.result)}
                            </td>
                            <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                {t.updatedAt ? t.updatedAt.replace("T", " ") : "-"}
                            </td>
                            <td style={{ padding: 8, whiteSpace: "nowrap", textAlign: "right" }}>
                                <button onClick={() => del(t.id)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

