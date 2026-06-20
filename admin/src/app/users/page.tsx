"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Input, Spinner, Chip } from "@/components/ui";

interface User {
  id: number;
  email: string;
  role: string;
  createdAt: string;
}

// Admin-only control plane: every user is an admin (customer CMS moved to the
// practa scope, so there's no editor tier here anymore).
export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const u = await fetch("/api/admin/users");
    if (u.ok) setUsers(await u.json());
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "could not create user");
      return;
    }
    setEmail("");
    setPassword("");
    load();
  }

  if (loading) {
    return (
      <div className="p-7">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-[14px] py-5 md:px-7 md:py-7" style={{ maxWidth: 900 }}>
      <Card className="mb-[22px]">
        <form onSubmit={create}>
          <div className="mb-3.5 text-[15px] font-medium">Add an admin</div>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input placeholder="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <div className="mt-2.5 text-[12.5px] text-[var(--cp-err)]">{err}</div>}
          <div className="mt-3.5">
            <Button type="submit" size="lg">create admin</Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} isSelf={String(me?.id) === String(u.id)} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function UserRow({ user, isSelf, onChanged }: { user: User; isSelf: boolean; onChanged: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error || "save failed");
      return;
    }
    setPw("");
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete ${user.email}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error || "delete failed");
      return;
    }
    onChanged();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{user.email}</span>
        <Chip tone="primary">{user.role}</Chip>
        {isSelf && <span className="font-[var(--cp-mono)] text-[10.5px] text-[var(--md-sys-color-on-surface-variant)]">you</span>}
        <div className="flex-1" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input size="sm" placeholder="reset password…" type="text" value={pw} onChange={(e) => setPw(e.target.value)} className="max-w-[220px]" />
        <Button size="sm" onClick={save} disabled={!pw || busy}>save</Button>
        <div className="flex-1" />
        {!isSelf && (
          <Button variant="ghost" size="sm" danger onClick={remove} disabled={busy}>delete</Button>
        )}
      </div>
      {msg && <div className="mt-2 text-[12px] text-[var(--cp-err)]">{msg}</div>}
    </Card>
  );
}
