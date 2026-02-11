import { getAuthHeader } from "./auth";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers || {});
    headers.set("Content-Type", "application/json");

    const auth = getAuthHeader();
    if (auth) headers.set("Authorization", auth);

    const res = await fetch(path, { ...init, headers });

    // ✅ read body ONCE
    const raw = await res.text(); // may be empty
    const hasBody = raw && raw.trim().length > 0;

    // Try parse JSON if present
    let parsed: any = null;
    if (hasBody) {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = null;
        }
    }

    if (res.status === 401) {
        throw new Error("Unauthorized: please login again.");
    }

    if (!res.ok) {
        const msg =
            (parsed && typeof parsed === "object" && parsed.message) ? parsed.message : `${res.status} ${res.statusText}`;
        throw new Error(msg);
    }

    // ✅ handle empty body for 200/204
    if (!hasBody) return undefined as T;

    // If server returned JSON, use parsed; otherwise return raw as any
    return (parsed ?? raw) as T;
}

export const api = {
    health: () => request<{ status: string; ts: string }>("/api/health"),

    listTemplates: () => request<any[]>("/api/templates"),
    getTemplate: (id: string) => request<any>(`/api/templates/${id}`),
    createTemplate: (payload: any) =>
        request<any>("/api/templates", { method: "POST", body: JSON.stringify(payload) }),
    updateTemplate: (id: string, payload: any) =>
        request<any>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteTemplate: (id: string) =>
        request<void>(`/api/templates/${id}`, { method: "DELETE" }),

    listCards: (params?: { templateId?: string; query?: string; includeArchived?: boolean }) => {
        const q = new URLSearchParams();
        if (params?.templateId) q.set("templateId", params.templateId);
        if (params?.query) q.set("query", params.query);
        if (params?.includeArchived) q.set("includeArchived", "true");
        const suffix = q.toString() ? `?${q.toString()}` : "";
        return request<any[]>(`/api/cards${suffix}`);
    },
    getCard: (id: string) => request<any>(`/api/cards/${id}`),
    createCard: (payload: any) =>
        request<any>("/api/cards", { method: "POST", body: JSON.stringify(payload) }),
    updateCard: (id: string, payload: any) =>
        request<any>(`/api/cards/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteCard: (id: string) =>
        request<void>(`/api/cards/${id}`, { method: "DELETE" }),

    listAnycards: (params?: { anycardType?: string; cardNumber?: string }) => {
        const q = new URLSearchParams();
        if (params?.anycardType) q.set("anycardType", params.anycardType);
        if (params?.cardNumber) q.set("cardNumber", params.cardNumber);
        const suffix = q.toString() ? `?${q.toString()}` : "";
        return request<any[]>(`/api/anycards${suffix}`);
    },
    getAnycard: (id: string) => request<any>(`/api/anycards/${id}`),
    createAnycard: (payload: any) =>
        request<any>("/api/anycards", { method: "POST", body: JSON.stringify(payload) }),
    updateAnycard: (id: string, payload: any) =>
        request<any>(`/api/anycards/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteAnycard: (id: string) =>
        request<void>(`/api/anycards/${id}`, { method: "DELETE" }),

    createTask: (payload: any) =>
        request<any>("/api/tasks/create", { method: "POST", body: JSON.stringify(payload) }),

    listTasks: () => request<any[]>("/api/tasks"),
    deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};
