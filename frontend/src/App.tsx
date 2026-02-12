import React, { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import { clearBasicAuth, getAuthHeader } from "./auth";
import Login from "./pages/Login";
import Templates from "./pages/Templates";
import Cards from "./pages/Cards";
import CardDetail from "./pages/CardDetail";
import Anycards from "./pages/Anycards";
import Tasks from "./pages/Tasks";
import WalmartGiftCards from "./pages/WalmartGiftCards";
import VanillaGiftCards from "./pages/VanillaGiftCards";

function RequireAuth({ children }: { children: React.ReactNode }) {
    const auth = getAuthHeader();
    if (!auth) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    const nav = useNavigate();
    const [health, setHealth] = useState<string>("");

    useEffect(() => {
        (async () => {
            try {
                const h = await api.health();
                setHealth(`${h.status} @ ${h.ts}`);
            } catch (e: any) {
                setHealth(e.message || "health check failed");
            }
        })();
    }, []);

    const onLogout = () => {
        clearBasicAuth();
        nav("/login");
    };

    return (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
            <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>Gift Cards</h2>
                <nav style={{ display: "flex", gap: 12 }}>
                    <Link to="/templates">Templates</Link>
                    <Link to="/cards">Cards</Link>
                    <Link to="/anycards">Anycards</Link>
                    <Link to="/walmart-giftcards">Walmart</Link>
                    <Link to="/vanilla-giftcards">Vanilla</Link>
                    <Link to="/tasks">Tasks</Link>
                </nav>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                    <small style={{ opacity: 0.7 }}>{health}</small>
                    <button onClick={onLogout}>Logout</button>
                </div>
            </header>

            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/templates"
                    element={
                        <RequireAuth>
                            <Templates />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/cards"
                    element={
                        <RequireAuth>
                            <Cards />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/cards/:id"
                    element={
                        <RequireAuth>
                            <CardDetail />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/anycards"
                    element={
                        <RequireAuth>
                            <Anycards />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/walmart-giftcards"
                    element={
                        <RequireAuth>
                            <WalmartGiftCards />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/vanilla-giftcards"
                    element={
                        <RequireAuth>
                            <VanillaGiftCards />
                        </RequireAuth>
                    }
                />
                <Route
                    path="/tasks"
                    element={
                        <RequireAuth>
                            <Tasks />
                        </RequireAuth>
                    }
                />
                <Route path="*" element={<Navigate to="/cards" replace />} />
            </Routes>
        </div>
    );
}
