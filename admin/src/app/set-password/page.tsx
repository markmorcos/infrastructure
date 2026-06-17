"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { useAuth } from "../auth/AuthProvider";

function SetPasswordForm() {
  const router = useRouter();
  const auth = useAuth();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This link is missing its token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      // Update auth state so the gate doesn't bounce us back to /login.
      auth.setUser({ id: String(data.id), email: data.email, role: data.role });
      router.push("/cms");
    } else {
      setError(data?.error || "Could not set password.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-8" style={{ background: "var(--md-sys-color-surface)" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 360 }}>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-.4px" }}>Set your password</h2>
        <p style={{ margin: "8px 0 30px", fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
          Welcome — choose a password to access your site.
        </p>

        <Label>PASSWORD</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="h-[46px]!" style={{ margin: "8px 0 18px" }} />

        <Label>CONFIRM PASSWORD</Label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required className="h-[46px]!" style={{ margin: "8px 0 26px" }} />

        {error && (
          <div style={{ marginBottom: 16, fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--cp-err)", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="msym" style={{ fontSize: 15 }}>error</span>{error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full h-[48px]! text-[14px]!">
          {loading ? "…" : "set password"}
        </Button>
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
