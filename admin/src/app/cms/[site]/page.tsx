"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { localeAll, type Section, type Site } from "../types";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";
import { useAuth } from "../../auth/AuthProvider";

// Site dashboard (/cms/[site]). Sections grouped by page_group, per-locale edit
// links with a dirty dot when draft != published, a Publish button + "last
// published" status, and a link to assets. Ports cms/ui.go uiSite.

interface SectionsResponse {
  site: Site;
  sections: Section[];
  dirty: Record<string, Record<string, boolean>>;
  lastPublished: string | null;
}

export default function SiteDashboard() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const siteKey = decodeURIComponent(params.site as string);

  const [site, setSite] = useState<Site | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [dirty, setDirty] = useState<Record<string, Record<string, boolean>>>({});
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [siteRes, secRes] = await Promise.all([
      fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}`),
      fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}/sections`),
    ]);
    if (!siteRes.ok) {
      setError("Site not found");
      return;
    }
    const s: Site = await siteRes.json();
    setSite(s);
    if (secRes.ok) setSections(await secRes.json());
    // Dirty flags + last-published come from per-section publish state; we
    // compute them client-side by reading each section's draft vs published
    // through the content endpoint would be costly, so instead the API exposes
    // them via the sections payload. Fall back to publish status endpoint.
    const statusRes = await fetch(
      `/api/cms/sites/${encodeURIComponent(siteKey)}/status`
    ).catch(() => null);
    if (statusRes && statusRes.ok) {
      const st: SectionsResponse = await statusRes.json();
      setDirty(st.dirty ?? {});
      setLastPublished(st.lastPublished ?? null);
    }
  }, [siteKey]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const groups = useMemo(() => {
    const byName = new Map<string, Section[]>();
    const order: string[] = [];
    for (const sec of sections) {
      if (!byName.has(sec.pageGroup)) {
        byName.set(sec.pageGroup, []);
        order.push(sec.pageGroup);
      }
      byName.get(sec.pageGroup)!.push(sec);
    }
    return order.map((name) => ({ name, sections: byName.get(name)! }));
  }, [sections]);

  const anyDirty = useMemo(
    () =>
      Object.values(dirty).some((locs) => Object.values(locs).some(Boolean)),
    [dirty]
  );

  const publish = async () => {
    setPublishing(true);
    setMsg(null);
    const res = await fetch(
      `/api/cms/sites/${encodeURIComponent(siteKey)}/publish`,
      { method: "POST" }
    );
    setPublishing(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: "Publishing failed — please try again" });
      return;
    }
    const d = await res.json();
    if (!d.dispatched) {
      setMsg({
        kind: "warn",
        text: "Content published, but the website rebuild could not be triggered — please let Mark know.",
      });
    } else {
      setMsg({
        kind: "ok",
        text: "Published! The website is rebuilding and will be up to date in about 3 minutes.",
      });
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  if (loading)
    return (
      <div style={loadingStyle}>
        <Spinner />
        loading…
      </div>
    );

  if (error || !site)
    return (
      <div className="px-[14px] pt-6 md:px-7">
        <div style={callout("err")}>
          <span className="msym" style={{ fontSize: 16 }}>error</span>
          {error || "Site not found"}
        </div>
      </div>
    );

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1080 }}>
      <Button variant="ghost" size="sm" onClick={() => router.push("/cms")} className="pl-[10px]! pr-[14px]! mb-5">
        <span className="msym" style={{ fontSize: 17 }}>arrow_back</span>websites
      </Button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span className="msym fill" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>language</span>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>
          {site.name}
        </h2>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{site.key}</span>
        <div className="hidden flex-1 md:block" />
        {isAdmin && (
          <Button
            variant="soft"
            size="md"
            onClick={() => setShowSettings((v) => !v)}
            className="px-[14px]! text-[12px]!"
            title="site settings"
          >
            <span className="msym" style={{ fontSize: 17 }}>settings</span>settings
          </Button>
        )}
        <Button
          variant="soft"
          size="md"
          onClick={() => router.push(`/cms/${encodeURIComponent(site.key)}/assets`)}
          className="px-[14px]! text-[12px]!"
        >
          <span className="msym" style={{ fontSize: 17 }}>image</span>images
        </Button>
        <Button variant="primary" size="md" onClick={publish} disabled={publishing} className="px-4!">
          <span className="msym" style={{ fontSize: 18, animation: publishing ? "cpSpin 1s linear infinite" : "none" }}>
            {publishing ? "autorenew" : "rocket_launch"}
          </span>
          {publishing ? "publishing…" : "Publish"}
        </Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11.5, color: "var(--md-sys-color-on-surface-variant)" }}>
          {lastPublished
            ? `last published ${new Date(lastPublished).toLocaleString()}`
            : "never published"}
        </span>
        {anyDirty && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--cp-mono)", fontSize: 11.5, color: "var(--cp-warn)" }}>
            <span style={dot("var(--cp-warn)")} />unpublished changes
          </span>
        )}
      </div>

      {msg && (
        <div style={{ ...callout(msg.kind), marginTop: 16 }}>
          <span className="msym" style={{ fontSize: 16 }}>
            {msg.kind === "ok" ? "check_circle" : msg.kind === "warn" ? "warning" : "error"}
          </span>
          {msg.text}
        </div>
      )}

      {isAdmin && showSettings && (
        <SiteSettings
          site={site}
          onSaved={() => {
            setShowSettings(false);
            setLoading(true);
            load().finally(() => setLoading(false));
          }}
        />
      )}

      <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Label as="div">{"// SECTIONS"}</Label>
        <div style={{ flex: 1 }} />
        <Button variant="soft" size="sm" onClick={() => router.push(`/cms/${encodeURIComponent(site.key)}/sections/new`)}>
          <span className="msym text-[16px]">add</span>new section
        </Button>
      </div>

      {sections.length === 0 ? (
        <Card className="mt-3 text-center" style={{ padding: "44px 20px" }}>
          <span className="msym" style={{ fontSize: 38, opacity: 0.5, color: "var(--md-sys-color-on-surface-variant)" }}>dashboard_customize</span>
          <div style={{ marginTop: 12, fontFamily: "var(--cp-mono)", fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            No content yet — add a section to define what you can edit.
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => router.push(`/cms/${encodeURIComponent(site.key)}/sections/new`)}>
              <span className="msym text-[18px]">add</span>add your first section
            </Button>
          </div>
        </Card>
      ) : (
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 22 }}>
        {groups.map((g) => (
          <div key={g.name}>
            <Label as="div" style={{ marginBottom: 10 }}>{`// ${g.name.toUpperCase()}`}</Label>
            <Card pad={false} style={{ overflow: "hidden" }}>
              {g.sections.map((sec, i) => (
                <div
                  key={sec.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 18px",
                    borderTop: i === 0 ? "none" : "1px solid var(--md-sys-color-outline-variant)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 14, fontWeight: 600, minWidth: 0, flex: "1 1 180px" }}>
                    {sec.title}
                  </span>
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-outline)" }}>{sec.key}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {sec.localized
                      ? site.locales.map((l) => (
                          <LocaleLink
                            key={l}
                            site={site.key}
                            sectionKey={sec.key}
                            locale={l}
                            label={l.toUpperCase()}
                            dirty={!!dirty[sec.id]?.[l]}
                          />
                        ))
                      : (
                          <LocaleLink
                            site={site.key}
                            sectionKey={sec.key}
                            locale={localeAll}
                            label="Edit"
                            dirty={!!dirty[sec.id]?.[localeAll]}
                          />
                        )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/cms/${encodeURIComponent(site.key)}/sections/${encodeURIComponent(sec.key)}/schema`)}
                    className="px-2.5!"
                    title="edit fields"
                  >
                    <span className="msym text-[16px]">tune</span>
                  </Button>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function settingStr(settings: Record<string, unknown> | undefined, key: string): string {
  const v = settings?.[key];
  return typeof v === "string" ? v : "";
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function SiteSettings({ site, onSaved }: { site: Site; onSaved: () => void }) {
  const [name, setName] = useState(site.name);
  const [repo, setRepo] = useState(site.githubRepo);
  const [dispatch, setDispatch] = useState(site.dispatchEvent);
  const [contactEmail, setContactEmail] = useState(settingStr(site.settings, "contactEmail"));
  const [brandColor, setBrandColor] = useState(settingStr(site.settings, "brandColor"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const emailInvalid = contactEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
  const colorInvalid = brandColor.trim() !== "" && !HEX_RE.test(brandColor.trim());

  async function save() {
    if (emailInvalid || colorInvalid) {
      setErr(emailInvalid ? "enter a valid contact email" : "brand color must be a 6-digit hex (e.g. #243831)");
      return;
    }
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/cms/sites/${encodeURIComponent(site.key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        githubRepo: repo,
        dispatchEvent: dispatch,
        settings: {
          contactEmail: contactEmail.trim(),
          brandColor: brandColor.trim(),
        },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "could not save settings");
      return;
    }
    onSaved();
  }

  return (
    <Card className="mt-4">
      <Label as="div" className="mb-3 block">{"// SETTINGS"}</Label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>NAME</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <div className="hidden md:block" />
        <div>
          <Label>GITHUB REPO</Label>
          <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" className="mt-1.5" />
        </div>
        <div>
          <Label>DISPATCH EVENT</Label>
          <Input value={dispatch} onChange={(e) => setDispatch(e.target.value)} placeholder="deploy-my-site" className="mt-1.5" />
        </div>
        <div>
          <Label>CONTACT EMAIL</Label>
          <Input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="owner@example.com"
            type="email"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>BRAND COLOR</Label>
          <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#243831" className="mt-1.5" />
        </div>
      </div>
      <div className="mt-1.5 font-[var(--cp-mono)] text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
        Contact email receives contact-form submissions; brand color seeds the site theme. Publish fires a GitHub repository_dispatch (event = dispatch event) at this repo to rebuild the site.
      </div>
      {err && <div className="mt-2 text-[12px] text-[var(--cp-err)]">{err}</div>}
      <div className="mt-3.5">
        <Button size="md" onClick={save} disabled={busy} icon="check">save settings</Button>
      </div>
    </Card>
  );
}

function LocaleLink({
  site,
  sectionKey,
  locale,
  label,
  dirty,
}: {
  site: string;
  sectionKey: string;
  locale: string;
  label: string;
  dirty: boolean;
}) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={() =>
        router.push(
          `/cms/${encodeURIComponent(site)}/sections/${encodeURIComponent(sectionKey)}?locale=${encodeURIComponent(locale)}`
        )
      }
      className="h-[30px]! px-[11px]! text-[11.5px]!"
    >
      {dirty && <span style={dot("var(--cp-warn)")} />}
      {label}
      <span className="msym" style={{ fontSize: 15 }}>edit</span>
    </Button>
  );
}

function dot(color: string): React.CSSProperties {
  return { width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 };
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

function callout(kind: "ok" | "warn" | "err"): React.CSSProperties {
  const map = {
    ok: { bg: "var(--cp-ok-dim)", fg: "var(--cp-ok)", bd: "rgba(70,224,160,.22)" },
    warn: { bg: "var(--cp-warn-dim)", fg: "var(--cp-warn)", bd: "rgba(245,183,61,.22)" },
    err: { bg: "var(--cp-err-dim)", fg: "var(--cp-err)", bd: "rgba(255,122,107,.22)" },
  }[kind];
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "11px 14px",
    borderRadius: 12,
    background: map.bg,
    border: "1px solid " + map.bd,
    color: map.fg,
    fontFamily: "var(--cp-mono)",
    fontSize: 12.5,
  };
}
