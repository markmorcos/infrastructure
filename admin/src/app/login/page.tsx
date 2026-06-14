"use client";

import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import AuthScreen from "../auth/AuthScreen";

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
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    const data = await res.json();
    if (res.ok) auth.setUser(data);
    else setError(data.error || "Login failed");
  };

  return (
    <AuthScreen
      title="Sign in"
      sub="Access your control plane."
      cta="sign in"
      loading={loading}
      error={error}
      email={email}
      password={password}
      setEmail={setEmail}
      setPassword={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
