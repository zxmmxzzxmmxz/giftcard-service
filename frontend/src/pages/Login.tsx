import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { setBasicAuth } from "../auth";

export default function Login() {
    const nav = useNavigate();
    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string>("");

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr("");

        setBasicAuth(username, password);

        try {
            await api.health();
            nav("/cards");
        } catch (ex: any) {
            setErr(ex.message || "Login failed");
        }
    };

    return (
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
            <h3>Login</h3>
            <p style={{ opacity: 0.8 }}>
                Uses Basic Auth to call backend APIs.
            </p>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Username
                    <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%" }} />
                </label>

                <label>
                    Password
                    <input
                        value={password}
                        type="password"
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: "100%" }}
                    />
                </label>

                {err ? <div style={{ color: "crimson" }}>{err}</div> : null}

                <button type="submit">Login</button>
            </form>
        </div>
    );
}
