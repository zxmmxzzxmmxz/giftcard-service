import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { FieldDefinition, Template } from "../types";

/* ---------- helpers ---------- */

const emptyField = (): FieldDefinition => ({
    key: "",
    label: "",
    type: "TEXT",
    required: false,
    sensitive: false,
});

function cloneFields(fields: FieldDefinition[]): FieldDefinition[] {
    return fields.map((f) => ({ ...f }));
}

/* ---------- FieldEditor (MUST be outside Templates) ---------- */

function FieldEditor({
                         fields,
                         setFields,
                         onRemove,
                     }: {
    fields: FieldDefinition[];
    setFields: React.Dispatch<React.SetStateAction<FieldDefinition[]>>;
    onRemove: (idx: number) => void;
}) {
    return (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {fields.map((f, idx) => {
                const k = (f.key || "").trim().toLowerCase();
                const isSystemRequired = k === "balance" || k === "cardnumber";



                return (
                    <div key={idx} style={{ border: "1px solid #eee", padding: 10, borderRadius: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                            <label>
                                key
                                <input
                                    value={f.key}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFields((arr) =>
                                            arr.map((x, i) => (i === idx ? { ...x, key: v } : x))
                                        );
                                    }}
                                    style={{ width: "100%" }}
                                />
                            </label>

                            <label>
                                label
                                <input
                                    value={f.label}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFields((arr) =>
                                            arr.map((x, i) => (i === idx ? { ...x, label: v } : x))
                                        );
                                    }}
                                    style={{ width: "100%" }}
                                />
                            </label>

                            <label>
                                type
                                <select
                                    value={f.type}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFields((arr) =>
                                            arr.map((x, i) => (i === idx ? { ...x, type: v } : x))
                                        );
                                    }}
                                    style={{ width: "100%" }}
                                >
                                    <option value="TEXT">TEXT</option>
                                    <option value="TEXTAREA">TEXTAREA</option>
                                    <option value="NUMBER">NUMBER</option>
                                    <option value="SECRET">SECRET</option>
                                    <option value="DATE">DATE</option>
                                    <option value="URL">URL</option>
                                </select>
                            </label>
                        </div>

                        <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={f.required}
                                    onChange={(e) => {
                                        const v = e.target.checked;
                                        setFields((arr) =>
                                            arr.map((x, i) => (i === idx ? { ...x, required: v } : x))
                                        );
                                    }}
                                />{" "}
                                required
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={f.sensitive}
                                    onChange={(e) => {
                                        const v = e.target.checked;
                                        setFields((arr) =>
                                            arr.map((x, i) => (i === idx ? { ...x, sensitive: v } : x))
                                        );
                                    }}
                                />{" "}
                                sensitive
                            </label>

                            <button
                                onClick={() => onRemove(idx)}
                                disabled={isSystemRequired}
                                title={isSystemRequired ? "系统必填字段，不能删除" : ""}
                                style={{ marginLeft: "auto", opacity: isSystemRequired ? 0.5 : 1 }}
                            >
                                Remove
                            </button>

                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ---------- main page ---------- */

export default function Templates() {
    const [items, setItems] = useState<Template[]>([]);
    const [err, setErr] = useState<string>("");

    // Create form
    const [cName, setCName] = useState("");
    const [cBrand, setCBrand] = useState("");
    const [cFields, setCFields] = useState<FieldDefinition[]>([
        { key: "cardNumber", label: "卡号", type: "TEXT", required: true, sensitive: false },
        { key: "pin", label: "PIN", type: "SECRET", required: true, sensitive: true },
    ]);

    // Edit form
    const [editingId, setEditingId] = useState<string>("");

    const editingTemplate = useMemo(
        () => items.find((t) => t.id === editingId) || null,
        [items, editingId]
    );

    const [eName, setEName] = useState("");
    const [eBrand, setEBrand] = useState("");
    const [eFields, setEFields] = useState<FieldDefinition[]>([]);

    const load = async () => {
        setErr("");
        const res = (await api.listTemplates()) as Template[];
        setItems(res);
    };

    useEffect(() => {
        load().catch((e) => setErr(e.message));
    }, []);

    useEffect(() => {
        if (!editingTemplate) return;
        setEName(editingTemplate.name || "");
        setEBrand(editingTemplate.brand || "");
        setEFields(cloneFields(editingTemplate.fields || []));
    }, [editingTemplate]);

    const validateFields = (fields: FieldDefinition[]) => {
        const keys = new Set<string>();
        for (const f of fields) {
            if (!f.key.trim()) throw new Error("Field key cannot be empty");
            if (!f.label.trim()) throw new Error("Field label cannot be empty");
            if (keys.has(f.key)) throw new Error(`Duplicate field key: ${f.key}`);
            keys.add(f.key);
        }
    };

    const addCreateField = () => setCFields((x) => [...x, emptyField()]);
    const removeCreateField = (idx: number) =>
        setCFields((x) => x.filter((_, i) => i !== idx));

    const create = async () => {
        setErr("");
        try {
            validateFields(cFields);
            await api.createTemplate({ name: cName, brand: cBrand, fields: cFields });
            setCName("");
            setCBrand("");
            await load();
        } catch (e: any) {
            setErr(e.message || "create failed");
        }
    };

    const addEditField = () => setEFields((x) => [...x, emptyField()]);
    const removeEditField = (idx: number) =>
        setEFields((x) => x.filter((_, i) => i !== idx));

    const save = async () => {
        if (!editingId) return;
        setErr("");
        try {
            validateFields(eFields);
            await api.updateTemplate(editingId, {
                name: eName,
                brand: eBrand,
                fields: eFields,
            });
            await load();
            setEditingId(editingId);
        } catch (e: any) {
            setErr(e.message || "save failed");
        }
    };

    const duplicate = async () => {
        if (!editingTemplate) return;
        setErr("");
        try {
            const payload = {
                name: `${editingTemplate.name} (copy)`,
                brand: editingTemplate.brand,
                fields: cloneFields(editingTemplate.fields),
            };
            validateFields(payload.fields);
            const created = await api.createTemplate(payload);
            await load();
            setEditingId(created.id);
        } catch (e: any) {
            setErr(e.message || "duplicate failed");
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this template?")) return;
        try {
            await api.deleteTemplate(id);
            if (editingId === id) setEditingId("");
            await load();
        } catch (e: any) {
            setErr(e.message || "delete failed");
        }
    };

    return (
        <div>
            <h3>Templates</h3>
            {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Left */}
                <div>
                    <div style={{ display: "grid", gap: 10 }}>
                        {items.map((t) => (
                            <div
                                key={t.id}
                                style={{
                                    border: "1px solid #ddd",
                                    padding: 12,
                                    borderRadius: 8,
                                    background: t.id === editingId ? "#f7f7f7" : "white",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <div>
                                        <strong>{t.name}</strong>{" "}
                                        <span style={{ opacity: 0.7 }}>{t.brand || ""}</span>
                                        <div style={{ opacity: 0.7, fontSize: 12 }}>{t.id}</div>
                                    </div>

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={() => setEditingId(t.id)}>Edit</button>
                                        <button onClick={() => del(t.id)}>Delete</button>
                                    </div>
                                </div>

                                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                                    Fields:{" "}
                                    {t.fields
                                        .map((f) => `${f.key}(${f.type}${f.sensitive ? ",敏感" : ""})`)
                                        .join(", ")}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right */}
                <div>
                    {/* Create */}
                    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
                        <h4 style={{ marginTop: 0 }}>Create Template</h4>

                        <div style={{ display: "grid", gap: 8 }}>
                            <label>
                                Name
                                <input value={cName} onChange={(e) => setCName(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <label>
                                Brand (optional)
                                <input value={cBrand} onChange={(e) => setCBrand(e.target.value)} style={{ width: "100%" }} />
                            </label>

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <strong>Fields</strong>
                                    <button onClick={addCreateField}>+ Add field</button>
                                </div>

                                <FieldEditor fields={cFields} setFields={setCFields} onRemove={removeCreateField} />
                            </div>

                            <button onClick={create}>Create</button>
                        </div>
                    </div>

                    {/* Edit */}
                    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
                        <h4 style={{ marginTop: 0 }}>Edit Template</h4>

                        {!editingTemplate ? (
                            <div style={{ opacity: 0.7 }}>Select a template on the left to edit.</div>
                        ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ opacity: 0.7, fontSize: 12 }}>Editing: {editingTemplate.id}</div>

                                <label>
                                    Name
                                    <input value={eName} onChange={(e) => setEName(e.target.value)} style={{ width: "100%" }} />
                                </label>

                                <label>
                                    Brand (optional)
                                    <input value={eBrand} onChange={(e) => setEBrand(e.target.value)} style={{ width: "100%" }} />
                                </label>

                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <strong>Fields</strong>
                                        <button onClick={addEditField}>+ Add field</button>
                                    </div>

                                    <FieldEditor fields={eFields} setFields={setEFields} onRemove={removeEditField} />
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={save}>Save</button>
                                    <button onClick={duplicate}>Duplicate</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
