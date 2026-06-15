"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

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
      <div style={{ padding: 28 }}>
        <div className="cp-spinner" />
      </div>
    );
  }

  return (
    <div className="px-[14px] py-5 md:px-7 md:py-7" style={{ maxWidth: 900 }}>
      {/* create */}
      <form onSubmit={create} className="cp-card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>Add a user</div>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            className="cp-input"
            placeholder="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="cp-input"
            placeholder="password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select className="cp-input" value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </div>
        {role === "editor" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 7 }}>
              SITES THIS EDITOR OWNS
            </div>
            <div className="flex flex-wrap gap-2">
              {sites.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  onClick={() => setOwnedSites((p) => toggle(p, s.key))}
                  className={ownedSites.includes(s.key) ? "cp-btn-tonal" : "cp-btn-soft"}
                  style={{ height: 32, fontSize: 12 }}
                >
                  {s.key}
                </button>
              ))}
              {sites.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>no sites yet</span>
              )}
            </div>
          </div>
        )}
        {err && <div style={{ color: "var(--cp-err)", fontSize: 12.5, marginTop: 10 }}>{err}</div>}
        <div style={{ marginTop: 14 }}>
          <button type="submit" className="cp-btn-primary" style={{ height: 40, fontSize: 13 }}>
            create user
          </button>
        </div>
      </form>

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
    <div className="cp-card" style={{ padding: 16 }}>
      <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
        <span style={{ fontWeight: 500 }}>{user.email}</span>
        <span
          className="cp-chip"
          style={{
            fontFamily: "var(--cp-mono)",
            fontSize: 10.5,
            padding: "2px 8px",
            borderRadius: 6,
            background: role === "admin" ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-high)",
            color: role === "admin" ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)",
          }}
        >
          {role}
        </span>
        {isSelf && (
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)" }}>you</span>
        )}
        <div style={{ flex: 1 }} />
        <select className="cp-input" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf} style={{ height: 34, maxWidth: 120, fontSize: 12 }}>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </select>
      </div>

      {role === "editor" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 7 }}>
            OWNED SITES
          </div>
          <div className="flex flex-wrap gap-2">
            {sites.map((s) => (
              <button
                type="button"
                key={s.key}
                onClick={() => toggle(s.key)}
                className={owned.includes(s.key) ? "cp-btn-tonal" : "cp-btn-soft"}
                style={{ height: 30, fontSize: 12 }}
              >
                {s.key}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <input
          className="cp-input"
          placeholder="reset password…"
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          style={{ height: 34, maxWidth: 220, fontSize: 12 }}
        />
        <button onClick={save} disabled={!dirty || busy} className="cp-btn-primary" style={{ height: 34, fontSize: 12 }}>
          save
        </button>
        <div style={{ flex: 1 }} />
        {!isSelf && (
          <button onClick={remove} disabled={busy} className="cp-btn-ghost" style={{ height: 34, fontSize: 12, color: "var(--cp-err)" }}>
            delete
          </button>
        )}
      </div>
      {msg && <div style={{ color: "var(--cp-err)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
