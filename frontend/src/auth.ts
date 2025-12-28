const KEY = "gc_basic_auth";

export function setBasicAuth(username: string, password: string) {
    const token = btoa(`${username}:${password}`);
    localStorage.setItem(KEY, token);
}

export function clearBasicAuth() {
    localStorage.removeItem(KEY);
}

export function getAuthHeader(): string | null {
    const token = localStorage.getItem(KEY);
    if (!token) return null;
    return `Basic ${token}`;
}
