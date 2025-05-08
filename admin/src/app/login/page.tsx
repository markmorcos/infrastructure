"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "../auth/AuthProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/infrastructure/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    const data = await res.json();
    if (res.ok) {
      auth.setUser(data);
    } else {
      setError(data.error || "Login failed");
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: 24 }}>Login</h1>
      <form onSubmit={handleSubmit} className="deployment-form">
        <div className="form-group">
          <label>
            Email
            <br />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Password
            <br />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <div style={{ marginTop: 16 }}>
        Don&apos;t have an account? <Link href="/register">Register</Link>
      </div>
    </main>
  );
}
