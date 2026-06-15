"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Input, Select, Label, Spinner, Chip } from "@/components/ui";

interface User {
  id: number;
  email: string;
  role: string;
  ownedSites: string[];
  createdAt: string;
}
interface Site {
  key: string;
  name: string;
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("editor");
  const [ownedSites, setOwnedSites] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, s] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/cms/sites"),
    ]);
    if (u.ok) setUsers(await u.json());
    if (s.ok) setSites(await s.json());
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
      body: JSON.stringify({ email, password, role, ownedSites }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "could not create user");
      return;
    }
    setEmail("");
    setPassword("");
    setRole("editor");
    setOwnedSites([]);
    load();
  }

  const toggle = (arr: string[], k: string) =>
    arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k];

  if (loading) {
    return (
      <div className="p-7">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-[14px] py-5 md:px-7 md:py-7" style={{ maxWidth: 900 }}>
      {/* create */}
      <Card className="mb-[22px]">
        <form onSubmit={create}>
          <div className="mb-3.5 text-[15px] font-medium">Add a user</div>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input placeholder="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="md:max-w-[140px]">
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </Select>
          </div>
          {role === "editor" && (
            <div className="mt-3">
              <Label as="div" className="mb-[7px] block">SITES THIS EDITOR OWNS</Label>
              <div className="flex flex-wrap gap-2">
                {sites.map((s) => (
                  <Button
                    type="button"
                    key={s.key}
                    size="sm"
                    variant={ownedSites.includes(s.key) ? "tonal" : "soft"}
                    onClick={() => setOwnedSites((p) => toggle(p, s.key))}
                  >
                    {s.key}
                  </Button>
                ))}
                {sites.length === 0 && (
                  <span className="text-[12px] text-[var(--md-sys-color-on-surface-variant)]">no sites yet</span>
                )}
              </div>
            </div>
          )}
          {err && <div className="mt-2.5 text-[12.5px] text-[var(--cp-err)]">{err}</div>}
          <div className="mt-3.5">
            <Button type="submit" size="lg">create user</Button>
          </div>
        </form>
      </Card>

      {/* list */}
      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} sites={sites} isSelf={String(me?.id) === String(u.id)} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function UserRow({
  user,
  sites,
  isSelf,
  onChanged,
}: {
  user: User;
  sites: Site[];
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [owned, setOwned] = useState<string[]>(user.ownedSites);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const toggle = (k: string) =>
    setOwned((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const dirty =
    role !== user.role ||
    pw.length > 0 ||
    owned.slice().sort().join() !== user.ownedSites.slice().sort().join();

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, ownedSites: owned, password: pw || undefined }),
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
        <Chip tone={role === "admin" ? "primary" : "neutral"}>{role}</Chip>
        {isSelf && <span className="font-[var(--cp-mono)] text-[10.5px] text-[var(--md-sys-color-on-surface-variant)]">you</span>}
        <div className="flex-1" />
        <Select size="sm" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf} className="max-w-[120px]">
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </Select>
      </div>

      {role === "editor" && (
        <div className="mt-3">
          <Label as="div" className="mb-[7px] block">OWNED SITES</Label>
          <div className="flex flex-wrap gap-2">
            {sites.map((s) => (
              <Button
                type="button"
                key={s.key}
                size="sm"
                variant={owned.includes(s.key) ? "tonal" : "soft"}
                onClick={() => toggle(s.key)}
              >
                {s.key}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input size="sm" placeholder="reset password…" type="text" value={pw} onChange={(e) => setPw(e.target.value)} className="max-w-[220px]" />
        <Button size="sm" onClick={save} disabled={!dirty || busy}>save</Button>
        <div className="flex-1" />
        {!isSelf && (
          <Button variant="ghost" size="sm" danger onClick={remove} disabled={busy}>delete</Button>
        )}
      </div>
      {msg && <div className="mt-2 text-[12px] text-[var(--cp-err)]">{msg}</div>}
    </Card>
  );
}
