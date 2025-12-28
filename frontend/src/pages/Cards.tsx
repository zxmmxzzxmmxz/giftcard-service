import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate  } from "react-router-dom";
import { api } from "../api";
import { Card, Template } from "../types";

export default function Cards() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [err, setErr] = useState<string>("");

    const [templateId, setTemplateId] = useState<string>("");
    const [query, setQuery] = useState<string>("");

    // create card
    const [createTemplateId, setCreateTemplateId] = useState<string>("");
    const [displayName, setDisplayName] = useState<string>("");
    const [data, setData] = useState<Record<string, string>>({});

    const currentTemplate = useMemo(
        () => templates.find((t) => t.id === createTemplateId) || null,
        [templates, createTemplateId]
    );

    const templateMap = useMemo(() => {
        const m = new Map<string, Template>();
        for (const t of templates) m.set(t.id, t);
        return m;
    }, [templates]);

    const loadTemplates = async () => {
        const res = (await api.listTemplates()) as Template[];
        setTemplates(res);
        if (!createTemplateId && res.length) setCreateTemplateId(res[0].id);
    };

    const loadCards = async () => {
        const res = (await api.listCards({
            templateId: templateId || undefined,
            query: query || undefined,
            // includeArchived: false, // 默认不传就是 false（可选）
        })) as Card[];

        const sorted = [...res].sort((a, b) => {
            // createdAt 可能为空（老数据），空的放最后
            const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
            const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
            return tb - ta; // 倒序：最新在前
        });

        setCards(sorted);
    };


    useEffect(() => {
        setErr("");
        Promise.all([loadTemplates(), loadCards()]).catch((e) => setErr(e.message));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSearch = async () => {
        setErr("");
        try {
            await loadCards();
        } catch (e: any) {
            setErr(e.message || "load failed");
        }
    };

    const onCreate = async () => {
        setErr("");
        try {
            if (!createTemplateId) throw new Error("Choose a template first");
            await api.createCard({
                templateId: createTemplateId,
                displayName,
                data,
            });
            setDisplayName("");
            setData((d) => ({ ...d, cardNumber: "" }));
            await loadCards();
        } catch (e: any) {
            setErr(e.message || "create failed");
        }
    };

    const updateData = (k: string, v: string) => {
        setData((d) => ({ ...d, [k]: v }));
    };

    const nav = useNavigate();

    return (
        <div>
            <h3>Cards</h3>
            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                <label>
                    Filter by template
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ width: "100%" }}>
                        <option value="">(All)</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Search (displayName)
                    <input value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%" }} />
                </label>

                <button onClick={onSearch}>Search</button>
            </div>

            <div style={{ height: 16 }} />

            <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ marginTop: 0 }}>Create Card</h4>

                <label>
                    Template
                    <select
                        value={createTemplateId}
                        onChange={(e) => {
                            setCreateTemplateId(e.target.value);
                            setData({});
                        }}
                        style={{ width: "100%" }}
                    >
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div style={{ height: 8 }} />

                <label>
                    Display name (optional)
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: "100%" }} />
                </label>

                <div style={{ height: 10 }} />

                {currentTemplate ? (
                    <div style={{ display: "grid", gap: 10 }}>
                        {currentTemplate.fields.map((f) => (
                            <label key={f.key}>
                                {f.label} {f.required ? "*" : ""}
                                <input
                                    value={data[f.key] || ""}
                                    type={f.type === "SECRET" ? "password" : "text"}
                                    onChange={(e) => updateData(f.key, e.target.value)}
                                    style={{ width: "100%" }}
                                />
                            </label>
                        ))}
                    </div>
                ) : (
                    <div style={{ opacity: 0.7 }}>No template selected.</div>
                )}

                <div style={{ height: 10 }} />
                <button onClick={onCreate}>Create Card</button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                        <th style={{ padding: 8 }}>ID</th>
                        <th style={{ padding: 8 }}>Display Name</th>
                        <th style={{ padding: 8 }}>Balance</th>
                        <th style={{ padding: 8 }}>Template</th>
                        <th style={{ padding: 8 }}>Time</th>
                    </tr>

                    </thead>

                    <tbody>
                    {cards.map((c) => (
                        <tr
                            key={c.id}
                            onClick={() => nav(`/cards/${c.id}`)}
                            style={{
                                cursor: "pointer",
                                borderBottom: "1px solid #eee",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                        >
                            <td style={{ padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                {c.id}
                            </td>

                            <td style={{ padding: 8, opacity: 0.85 }}>
                                {c.displayName || "(no display name)"}
                            </td>

                            <td style={{ padding: 8 }}>
                                <strong>{(c.data && (c.data["balance"] ?? c.data["Balance"])) || "-"}</strong>
                            </td>

                            <td style={{ padding: 8, opacity: 0.8 }}>
                                {templateMap.get(c.templateId)?.name ?? "(Unknown template)"}
                            </td>
                            <td style={{ padding: 8, opacity: 0.8, whiteSpace: "nowrap" }}>
                                {c.createdAt ? c.createdAt.replace("T", " ") : "-"}
                            </td>

                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
