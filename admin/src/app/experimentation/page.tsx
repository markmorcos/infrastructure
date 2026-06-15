"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Project } from "./types";
import { Button, Card, Input, Label, Spinner, Callout } from "@/components/ui";

export default function ExperimentationProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/experimentation/projects");
    if (!res.ok) {
      setError("Failed to load projects");
      return;
    }
    setProjects(await res.json());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    setCreating(true);
    const res = await fetch("/api/experimentation/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), name: name.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      setFormErr((await res.text()) || "could not create project");
      return;
    }
    const d = await res.json();
    router.push(`/experimentation/${encodeURIComponent(d.project.key)}`);
  };

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(
      (p) =>
        !q ||
        p.key.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );
  }, [projects, query]);

  if (loading)
    return (
      <div style={loadingStyle}>
        <Spinner />
        loading projects…
      </div>
    );

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <span className="msym" style={{ fontSize: 26, color: "var(--md-sys-color-primary)" }}>science</span>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>
          experimentation
        </h2>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <Callout icon="error" className="mb-4">
          {error}
        </Callout>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]" style={{ gap: 16 }}>
        {/* LIST */}
        <div>
          <div className="order-1 w-full" style={{ ...searchBox, marginBottom: 14 }}>
            <span className="msym" style={{ fontSize: 19, color: "var(--md-sys-color-on-surface-variant)" }}>search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search projects…"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--md-sys-color-on-surface)", fontFamily: "var(--cp-mono)", fontSize: 12.5 }}
            />
          </div>

          {view.length === 0 ? (
            <Card pad={false} style={{ padding: "48px 0", textAlign: "center", fontFamily: "var(--cp-mono)", fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
              <span className="msym" style={{ fontSize: 36, opacity: 0.5, display: "block", marginBottom: 10 }}>science</span>
              no projects yet — create one
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
              {view.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/experimentation/${encodeURIComponent(p.key)}`)}
                  className="cp-card cp-card-hover"
                  style={{ padding: "16px 18px", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span className="msym" style={{ fontSize: 18, color: "var(--md-sys-color-primary)" }}>folder</span>
                    <span style={{ fontFamily: "var(--cp-mono)", fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    <span className="msym" style={{ fontSize: 18, color: "var(--md-sys-color-outline)" }}>chevron_right</span>
                  </div>
                  <div style={{ marginTop: 8, fontFamily: "var(--cp-mono)", fontSize: 11.5, color: "var(--md-sys-color-on-surface-variant)" }}>
                    {p.key}
                  </div>
                  <div style={{ marginTop: 4, fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-outline)" }}>
                    created {new Date(p.createdAt).toISOString().slice(0, 10)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CREATE */}
        <Card pad={false} className="p-5" style={{ height: "fit-content" }}>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 16 }}>
            {"// NEW PROJECT"}
          </div>
          <form onSubmit={create}>
            <div style={{ marginBottom: 16 }}>
              <Label>KEY</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="my-project"
                style={{ marginTop: 7, fontFamily: "var(--cp-mono)" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Label>NAME</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="(defaults to key)"
                style={{ marginTop: 7 }}
              />
            </div>
            <Button type="submit" icon="add" disabled={creating || !key.trim()} className="w-full h-[44px] text-[13px]">
              {creating ? "creating…" : "create project"}
            </Button>
            {formErr && (
              <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", marginTop: 10 }}>{formErr}</div>
            )}
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-outline)", marginTop: 10 }}>
              auto-creates a production environment + sdk key
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

const loadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "80px 28px",
  fontFamily: "var(--cp-mono)",
  fontSize: 13,
  color: "var(--md-sys-color-on-surface-variant)",
};
const searchBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  height: 38,
  padding: "0 14px",
  borderRadius: 9999,
  background: "var(--md-sys-color-surface-container-high)",
};
