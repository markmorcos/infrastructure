"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Input, Label, Select, Spinner, Callout } from "@/components/ui";
import type { Project, Site } from "./types";

// UNASSIGNED is the sentinel value for the "(Unassigned / global)" option in
// project selectors — it maps to project_id = NULL on the wire.
const UNASSIGNED = "";

// CMS sites list (/cms). Sections are code-owned, so there is no create-section
// UI here. A single site links straight through to its dashboard, mirroring
// cms/ui.go uiSites.

export default function CmsSitesPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  // New sites are English-only by default; de/ar are opt-in.
  const [newLocales, setNewLocales] = useState<string[]>(["en"]);
  const [newRepo, setNewRepo] = useState("");
  const [newDispatch, setNewDispatch] = useState("");
  // Chosen project for the new site: "" = unassigned/global, else a project id.
  const [newProject, setNewProject] = useState<string>(UNASSIGNED);
  // Inline "+ New project" affordance state.
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/cms/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

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
      router.replace(siteHref(data[0]));
      return;
    }
    setSites(data);
  }, [router, isAdmin]);

  useEffect(() => {
    Promise.all([load(), isAdmin ? loadProjects() : Promise.resolve()]).finally(
      () => setLoading(false)
    );
  }, [load, loadProjects, isAdmin]);

  // addProject creates a project inline (auto-slugged from the name) and selects
  // it for the new site.
  const addProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setProjectBusy(true);
    setError(null);
    const res = await fetch("/api/cms/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setProjectBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "could not create project");
      return;
    }
    const p: Project = await res.json();
    setProjects((prev) =>
      [...prev, p].sort((a, b) => a.key.localeCompare(b.key))
    );
    setNewProject(p.id);
    setNewProjectName("");
    setAddingProject(false);
  };

  const create = async () => {
    setError(null);
    // English first (the default locale), then any opted-in extras in a stable order.
    const locales = ["en", "de", "ar"].filter((l) => newLocales.includes(l));
    const res = await fetch("/api/cms/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: newKey.trim(),
        name: newName.trim(),
        locales: locales.length ? locales : ["en"],
        defaultLocale: "en",
        githubRepo: newRepo.trim(),
        dispatchEvent: newDispatch.trim(),
        projectId: newProject || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "could not create site");
      return;
    }
    setNewKey("");
    setNewName("");
    setNewLocales(["en"]);
    setNewRepo("");
    setNewDispatch("");
    setNewProject(UNASSIGNED);
    setCreating(false);
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  // moveSite reassigns a site to another project (or unassigns it). Refreshes
  // the list on success; surfaces a key-collision (409) error inline.
  const moveSite = async (s: Site, projectId: string) => {
    setError(null);
    const res = await fetch(
      `/api/cms/sites/${encodeURIComponent(s.key)}${
        s.projectKey ? `?project=${encodeURIComponent(s.projectKey)}` : ""
      }`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId || null }),
      }
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "could not move site");
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  // Group sites by project: a group per project (label = project key) plus an
  // "Unassigned" group for global (null-project) sites. Projects sort first,
  // alphabetically; "Unassigned" always last.
  const groups = useMemo(() => {
    const byKey = new Map<string, Site[]>();
    for (const s of sites) {
      const k = s.projectKey ?? "";
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(s);
    }
    const projectKeys = [...byKey.keys()].filter((k) => k !== "").sort();
    const ordered: { label: string; sites: Site[] }[] = projectKeys.map((k) => ({
      label: k,
      sites: byKey.get(k)!,
    }));
    if (byKey.has("")) ordered.push({ label: "Unassigned", sites: byKey.get("")! });
    return ordered;
  }, [sites]);
  // Only show group headers when there's more than one group (keeps the common
  // single-namespace case clean).
  const showGroupHeaders = groups.length > 1;

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
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="my-site" className="mt-1.5" />
            </div>
            <div>
              <Label>NAME</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Site" className="mt-1.5" />
            </div>
          </div>
          <div className="mt-4">
            <Label as="div" className="mb-2 block">LANGUAGES</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="tonal">EN · default</Button>
              {["de", "ar"].map((l) => (
                <Button
                  key={l}
                  type="button"
                  size="sm"
                  variant={newLocales.includes(l) ? "tonal" : "soft"}
                  onClick={() =>
                    setNewLocales((p) =>
                      p.includes(l) ? p.filter((x) => x !== l) : [...p, l]
                    )
                  }
                >
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>GITHUB REPO</Label>
              <Input value={newRepo} onChange={(e) => setNewRepo(e.target.value)} placeholder="owner/repo" className="mt-1.5" />
            </div>
            <div>
              <Label>DISPATCH EVENT</Label>
              <Input value={newDispatch} onChange={(e) => setNewDispatch(e.target.value)} placeholder="deploy-my-site" className="mt-1.5" />
            </div>
          </div>
          <div className="mt-1.5 font-[var(--cp-mono)] text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
            optional — wires Publish to trigger the site&apos;s rebuild (can be set later in Settings)
          </div>
          <div className="mt-4">
            <Label as="div" className="mb-1.5 block">PROJECT</Label>
            {addingProject ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project name"
                  className="max-w-[260px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProject();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={addProject}
                  disabled={!newProjectName.trim() || projectBusy}
                  icon="check"
                >
                  {projectBusy ? "creating…" : "create project"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingProject(false);
                    setNewProjectName("");
                  }}
                >
                  cancel
                </Button>
                {newProjectName.trim() && (
                  <span className="font-[var(--cp-mono)] text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                    key: {slugifyClient(newProjectName)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="max-w-[260px]"
                >
                  <option value={UNASSIGNED}>(Unassigned / global)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="soft"
                  icon="add"
                  onClick={() => setAddingProject(true)}
                >
                  new project
                </Button>
              </div>
            )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {groups.map((g) => (
            <div key={g.label}>
              {showGroupHeaders && (
                <Label as="div" className="mb-3 block">{`// ${g.label.toUpperCase()}`}</Label>
              )}
              <div className="grid grid-cols-1 gap-[14px] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                {g.sites.map((s) => (
                  <div key={s.id} className="cp-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <button
                      onClick={() => router.push(siteHref(s))}
                      className="cp-card-hover"
                      style={{ padding: "18px 18px 16px", textAlign: "left", background: "transparent", border: "none", borderRadius: 0 }}
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
                    {isAdmin && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 14px",
                          borderTop: "1px solid var(--md-sys-color-outline-variant)",
                        }}
                      >
                        <span className="msym" style={{ fontSize: 15, color: "var(--md-sys-color-on-surface-variant)" }}>drive_file_move</span>
                        <Select
                          size="sm"
                          value={s.projectId ?? UNASSIGNED}
                          onChange={(e) => moveSite(s, e.target.value)}
                          className="flex-1"
                          title="move to project"
                        >
                          <option value={UNASSIGNED}>(Unassigned / global)</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.key})
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// siteHref builds the dashboard link for a site, carrying ?project=<key> when
// the site belongs to a project so its per-project key resolves correctly.
function siteHref(s: Site): string {
  const base = `/cms/${encodeURIComponent(s.key)}`;
  return s.projectKey
    ? `${base}?project=${encodeURIComponent(s.projectKey)}`
    : base;
}

// slugifyClient previews the auto-slug key the server will derive from a project
// name (keep in sync with admin.ts slugify).
function slugifyClient(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
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
