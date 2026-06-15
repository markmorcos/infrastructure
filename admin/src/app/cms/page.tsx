"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Input, Label, Spinner, Callout } from "@/components/ui";
import type { Site } from "./types";

// CMS sites list (/cms). Sections are code-owned, so there is no create-section
// UI here. A single site links straight through to its dashboard, mirroring
// cms/ui.go uiSites.

export default function CmsSitesPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/cms/sites");
    if (!res.ok) {
      setError("Failed to load sites");
      return;
    }
    const data: Site[] = await res.json();
    // Editors with a single site go straight to its dashboard; admins always see
    // the list so they can create and manage other sites.
    if (!isAdmin && data.length === 1) {
      router.replace(`/cms/${encodeURIComponent(data[0].key)}`);
      return;
    }
    setSites(data);
  }, [router, isAdmin]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const create = async () => {
    setError(null);
    const res = await fetch("/api/cms/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), name: newName.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "could not create site");
      return;
    }
    setNewKey("");
    setNewName("");
    setCreating(false);
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  if (loading)
    return (
      <div className="flex items-center gap-2.5 px-7 py-20 font-[var(--cp-mono)] text-[13px] text-[var(--md-sys-color-on-surface-variant)]">
        <Spinner />
        loading sites…
      </div>
    );

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <span className="msym" style={{ fontSize: 26, color: "var(--md-sys-color-primary)" }}>web</span>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>
          Websites
        </h2>
        <div style={{ flex: 1 }} />
        {isAdmin && (
          <Button onClick={() => setCreating((v) => !v)} icon={creating ? "close" : "add"}>
            {creating ? "cancel" : "new site"}
          </Button>
        )}
      </div>

      {error && (
        <Callout tone="err" icon="error" className="mb-4">
          {error}
        </Callout>
      )}

      {creating && (
        <Card pad={false} className="mb-5 p-5">
          <Label as="div" className="mb-3 block">{"// NEW SITE"}</Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>KEY</Label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="lea" className="mt-1.5" />
            </div>
            <div>
              <Label>NAME</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Lea Pfaffeneder" className="mt-1.5" />
            </div>
          </div>
          <div className="mt-3.5">
            <Button onClick={create} disabled={!newKey.trim()} icon="check">create</Button>
          </div>
        </Card>
      )}

      {sites.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 0", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>
          <span className="msym" style={{ fontSize: 40, opacity: 0.5 }}>web_asset_off</span>
          <div style={{ marginTop: 12, fontSize: 13 }}>no sites yet</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/cms/${encodeURIComponent(s.key)}`)}
              className="cp-card cp-card-hover"
              style={{ padding: "18px 18px 16px", textAlign: "left" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="msym fill" style={{ fontSize: 20, color: "var(--md-sys-color-primary)" }}>language</span>
                <span style={{ fontFamily: "var(--cp-mono)", fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                <span className="msym" style={{ fontSize: 15 }}>key</span>
                {s.key}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {s.locales.map((l) => (
                  <span key={l} style={chip(l === s.defaultLocale)}>{l.toUpperCase()}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function chip(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 10px",
    borderRadius: 7,
    fontFamily: "var(--cp-mono)",
    fontSize: 10.5,
    background: primary ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container)",
    color: primary ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)",
    border: "1px solid " + (primary ? "transparent" : "var(--md-sys-color-outline-variant)"),
  };
}
