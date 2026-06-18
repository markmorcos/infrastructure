"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  localeAll,
  type Asset,
  type Field,
  type Section,
  type Site,
} from "../../../types";
import {
  emptyListItem,
  fromEditor,
  toEditor,
  type EditorObject,
} from "./editor";
import { Button, Card, Input, Label, Select, Spinner, Textarea } from "@/components/ui";
import { Glyph, GLYPH_NAMES, hasGlyph } from "@/components/Glyph";

// Schema-driven content editor (/cms/[site]/sections/[key]). Renders the 8 field
// types from section.schema; locale tabs for localized sections; image fields
// pick from existing assets + inline upload. Saves a clean JSON PUT to the
// content endpoint. Ports cms/ui.go uiSection + cms/web/templates/section.html.

export default function SectionEditor() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const siteKey = decodeURIComponent(params.site as string);
  const sectionKey = decodeURIComponent(params.key as string);

  const [site, setSite] = useState<Site | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Editing state, plus the original stored draft (for readOnly round-trip).
  const [editor, setEditor] = useState<EditorObject>({});
  const [original, setOriginal] = useState<EditorObject>({});

  const locale = useMemo(() => {
    if (section && !section.localized) return localeAll;
    const q = search.get("locale");
    if (q) return q;
    return site?.defaultLocale ?? "";
  }, [section, search, site]);

  const loadMeta = useCallback(async () => {
    const [siteRes, secRes, assetsRes] = await Promise.all([
      fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}`),
      fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}/sections`),
      fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}/assets`),
    ]);
    if (!siteRes.ok) {
      setError("Site not found");
      return null;
    }
    const s: Site = await siteRes.json();
    setSite(s);
    if (assetsRes.ok) setAssets(await assetsRes.json());
    if (secRes.ok) {
      const sections: Section[] = await secRes.json();
      const sec = sections.find((x) => x.key === sectionKey) ?? null;
      setSection(sec);
      if (!sec) setError("Section not found");
      return { site: s, section: sec };
    }
    return { site: s, section: null };
  }, [siteKey, sectionKey]);

  const loadDraft = useCallback(
    async (sec: Section, loc: string) => {
      const res = await fetch(
        `/api/cms/sites/${encodeURIComponent(siteKey)}/sections/${encodeURIComponent(sec.key)}/content/${encodeURIComponent(loc)}`
      );
      if (!res.ok) {
        setError("Could not load content");
        return;
      }
      const d = await res.json();
      const draft = (d.draft ?? {}) as EditorObject;
      setOriginal(draft);
      setEditor(toEditor(sec.schema, draft));
    },
    [siteKey]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const meta = await loadMeta();
      if (!active || !meta || !meta.section) {
        setLoading(false);
        return;
      }
      const loc = meta.section.localized
        ? search.get("locale") || meta.site.defaultLocale
        : localeAll;
      await loadDraft(meta.section, loc);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // Reload when the locale query changes.
  }, [loadMeta, loadDraft, search]);

  const reloadAssets = useCallback(async () => {
    const res = await fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}/assets`);
    if (res.ok) setAssets(await res.json());
  }, [siteKey]);

  const save = async () => {
    if (!section) return;
    setSaving(true);
    setMsg(null);
    const payload = fromEditor(section.schema, editor, original);
    const res = await fetch(
      `/api/cms/sites/${encodeURIComponent(siteKey)}/sections/${encodeURIComponent(section.key)}/content/${encodeURIComponent(locale)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: "Saving failed — please try again" });
      return;
    }
    const d = await res.json();
    const draft = (d.draft ?? {}) as EditorObject;
    setOriginal(draft);
    setEditor(toEditor(section.schema, draft));
    setMsg({
      kind: "ok",
      text: "Saved. Changes only appear on the website after you click Publish.",
    });
  };

  const switchLocale = (loc: string) => {
    router.replace(
      `/cms/${encodeURIComponent(siteKey)}/sections/${encodeURIComponent(sectionKey)}?locale=${encodeURIComponent(loc)}`
    );
  };

  if (loading)
    return (
      <div style={loadingStyle}>
        <Spinner />
        loading…
      </div>
    );

  if (error || !site || !section)
    return (
      <div className="px-[14px] pt-6 md:px-7">
        <div style={callout("err")}>
          <span className="msym" style={{ fontSize: 16 }}>error</span>
          {error || "Not found"}
        </div>
      </div>
    );

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 880 }}>
      <Button variant="ghost" size="sm" onClick={() => router.push(`/cms/${encodeURIComponent(siteKey)}`)} className="pl-[10px]! pr-[14px]! mb-5">
        <span className="msym" style={{ fontSize: 17 }}>arrow_back</span>{site.name}
      </Button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>{section.title}</h2>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-outline)" }}>{section.key}</span>
      </div>

      {section.localized && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {site.locales.map((l) => {
            const active = l === locale;
            return (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 9999,
                  cursor: "pointer",
                  fontFamily: "var(--cp-mono)",
                  fontSize: 12,
                  border: "1px solid " + (active ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"),
                  background: active ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-low)",
                  color: active ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)",
                }}
              >
                {l.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {msg && (
        <div style={{ ...callout(msg.kind), marginTop: 16 }}>
          <span className="msym" style={{ fontSize: 16 }}>{msg.kind === "ok" ? "check_circle" : "error"}</span>
          {msg.text}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <FieldList
          fields={section.schema}
          value={editor}
          onChange={setEditor}
          assets={assets}
          site={site}
          onUploaded={reloadAssets}
        />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
        <Button variant="primary" size="lg" onClick={save} disabled={saving} className="h-[40px]!">
          <span className="msym" style={{ fontSize: 18, animation: saving ? "cpSpin 1s linear infinite" : "none" }}>
            {saving ? "autorenew" : "save"}
          </span>
          {saving ? "saving…" : "Save draft"}
        </Button>
      </div>
    </div>
  );
}

// ---- field rendering ----

function FieldList({
  fields,
  value,
  onChange,
  assets,
  site,
  onUploaded,
}: {
  fields: Field[];
  value: EditorObject;
  onChange: (v: EditorObject) => void;
  assets: Asset[];
  site: Site;
  onUploaded: () => void;
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  return (
    <>
      {fields.map((f) => (
        <FieldEditor
          key={f.key}
          field={f}
          value={value[f.key]}
          onChange={(v) => set(f.key, v)}
          assets={assets}
          site={site}
          onUploaded={onUploaded}
        />
      ))}
    </>
  );
}

// iconButtonStyle styles one swatch in the icon picker; highlighted when chosen.
const iconButtonStyle = (selected: boolean): React.CSSProperties => ({
  width: 42,
  height: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  cursor: "pointer",
  border: `1px solid ${selected ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant, #444)"}`,
  background: selected ? "color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)" : "transparent",
  color: selected ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface, #ddd)",
});

function FieldEditor({
  field,
  value,
  onChange,
  assets,
  site,
  onUploaded,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  assets: Asset[];
  site: Site;
  onUploaded: () => void;
}) {
  const label = (
    <Label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {field.label}
      {field.readOnly && (
        <span style={{ fontSize: 10, color: "var(--md-sys-color-outline)" }}>(fixed)</span>
      )}
    </Label>
  );

  switch (field.type) {
    case "text":
    case "image": {
      if (field.type === "image") {
        return (
          <div>
            {label}
            <ImageField
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              assets={assets}
              site={site}
              onUploaded={onUploaded}
              readOnly={field.readOnly}
            />
          </div>
        );
      }
      return (
        <div>
          {label}
          <Input
            style={{ marginTop: 6 }}
            value={typeof value === "string" ? value : ""}
            readOnly={field.readOnly}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    }
    case "select": {
      const options = field.options ?? [];
      const current = typeof value === "string" ? value : "";
      // Icon fields (every option is a known glyph) get a visual picker showing
      // the full renderer icon set, so the editor sees what they're choosing.
      const isIcon = options.length > 0 && options.every(hasGlyph);
      if (isIcon) {
        return (
          <div>
            {label}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              <button
                type="button"
                title="none"
                disabled={field.readOnly}
                onClick={() => onChange("")}
                style={iconButtonStyle(current === "")}
              >
                <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>none</span>
              </button>
              {GLYPH_NAMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  title={o}
                  disabled={field.readOnly}
                  onClick={() => onChange(o)}
                  style={iconButtonStyle(current === o)}
                >
                  <Glyph name={o} size={22} />
                </button>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div>
          {label}
          <Select
            style={{ marginTop: 6, appearance: "auto" }}
            value={current}
            disabled={field.readOnly}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— none —</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
            {current && !options.includes(current) && (
              <option value={current}>{current}</option>
            )}
          </Select>
        </div>
      );
    }
    case "textarea":
    case "stringlist":
    case "paragraphs":
      return (
        <div>
          {label}
          <Textarea
            style={{ marginTop: 6, height: 110, padding: "10px 14px", resize: "vertical", lineHeight: 1.5 }}
            value={typeof value === "string" ? value : ""}
            readOnly={field.readOnly}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.type === "stringlist" && (
            <div style={hint}>one entry per line</div>
          )}
          {field.type === "paragraphs" && (
            <div style={hint}>separate paragraphs with a blank line</div>
          )}
        </div>
      );
    case "object": {
      const obj = (typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as EditorObject)
        : {}) as EditorObject;
      return (
        <Card pad={false} className="p-4">
          {label}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
            <FieldList
              fields={field.fields ?? []}
              value={obj}
              onChange={onChange}
              assets={assets}
              site={site}
              onUploaded={onUploaded}
            />
          </div>
        </Card>
      );
    }
    case "list":
      return (
        <ListField
          field={field}
          value={Array.isArray(value) ? (value as EditorObject[]) : []}
          onChange={onChange}
          assets={assets}
          site={site}
          onUploaded={onUploaded}
        />
      );
    case "pairs":
      return (
        <PairsField
          field={field}
          value={Array.isArray(value) ? (value as [string, string][]) : []}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

function ListField({
  field,
  value,
  onChange,
  assets,
  site,
  onUploaded,
}: {
  field: Field;
  value: EditorObject[];
  onChange: (v: unknown) => void;
  assets: Asset[];
  site: Site;
  onUploaded: () => void;
}) {
  const subs = field.fields ?? [];
  const setItem = (i: number, item: EditorObject) => {
    const next = value.slice();
    next[i] = item;
    onChange(next);
  };
  const add = () => onChange([...value, emptyListItem(subs)]);
  const del = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <Label>{field.label}</Label>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
        {value.map((item, i) => (
          <Card key={i} pad={false} className="p-[14px]">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-outline)", flex: 1 }}>#{i + 1}</span>
              <Button variant="soft" onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} title="up">
                <span className="msym" style={{ fontSize: 16 }}>arrow_upward</span>
              </Button>
              <Button variant="soft" onClick={() => move(i, 1)} disabled={i === value.length - 1} className={iconBtn} title="down">
                <span className="msym" style={{ fontSize: 16 }}>arrow_downward</span>
              </Button>
              <Button variant="soft" onClick={() => del(i)} className={iconBtn} title="delete">
                <span className="msym" style={{ fontSize: 16 }}>delete</span>
              </Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FieldList
                fields={subs}
                value={item}
                onChange={(v) => setItem(i, v)}
                assets={assets}
                site={site}
                onUploaded={onUploaded}
              />
            </div>
          </Card>
        ))}
        <Button variant="ghost" size="sm" onClick={add} className="px-[14px]! self-start">
          <span className="msym" style={{ fontSize: 17 }}>add</span>add
        </Button>
      </div>
    </div>
  );
}

function PairsField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: [string, string][];
  onChange: (v: unknown) => void;
}) {
  const setPair = (i: number, idx: 0 | 1, v: string) => {
    const next = value.map((p) => [p[0], p[1]] as [string, string]);
    next[i][idx] = v;
    onChange(next);
  };
  const add = () => onChange([...value, ["", ""] as [string, string]]);
  const del = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <Label>{field.label}</Label>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((pair, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Input style={{ flex: "1 1 160px" }} placeholder="Label" value={pair[0]} onChange={(e) => setPair(i, 0, e.target.value)} />
            <Input style={{ flex: "1 1 160px" }} placeholder="Value" value={pair[1]} onChange={(e) => setPair(i, 1, e.target.value)} />
            <Button variant="soft" onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} title="up">
              <span className="msym" style={{ fontSize: 16 }}>arrow_upward</span>
            </Button>
            <Button variant="soft" onClick={() => move(i, 1)} disabled={i === value.length - 1} className={iconBtn} title="down">
              <span className="msym" style={{ fontSize: 16 }}>arrow_downward</span>
            </Button>
            <Button variant="soft" onClick={() => del(i)} className={iconBtn} title="delete">
              <span className="msym" style={{ fontSize: 16 }}>delete</span>
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={add} className="px-[14px]! self-start">
          <span className="msym" style={{ fontSize: 17 }}>add</span>add
        </Button>
      </div>
    </div>
  );
}

function ImageField({
  value,
  onChange,
  assets,
  site,
  onUploaded,
  readOnly,
}: {
  value: string;
  onChange: (v: unknown) => void;
  assets: Asset[];
  site: Site;
  onUploaded: () => void;
  readOnly?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/cms/sites/${encodeURIComponent(site.key)}/assets`,
      { method: "POST", body: fd }
    );
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "upload failed");
      return;
    }
    const asset: Asset = await res.json();
    onUploaded();
    onChange(asset.url); // assign the new image straight into the field
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 96, height: 96, borderRadius: 10, background: "var(--md-sys-color-surface-container)", border: "1px solid var(--md-sys-color-outline-variant)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : (
            <span className="msym" style={{ fontSize: 28, color: "var(--md-sys-color-outline)" }}>image</span>
          )}
        </div>
        <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Select
            value={value}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value)}
            style={{ appearance: "auto" }}
          >
            <option value="">— Default image —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.url}>{a.filename}</option>
            ))}
            {value && !assets.some((a) => a.url === value) && (
              <option value={value}>{value}</option>
            )}
          </Select>
          {!readOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
                style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}
              />
              {uploading && <Spinner />}
            </div>
          )}
          {err && <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)" }}>{err}</span>}
        </div>
      </div>
    </div>
  );
}

const iconBtn = "w-[30px]! h-[30px]! p-0!";
const hint: React.CSSProperties = {
  fontFamily: "var(--cp-mono)",
  fontSize: 10.5,
  color: "var(--md-sys-color-outline)",
  marginTop: 5,
};
const loadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "80px 28px",
  fontFamily: "var(--cp-mono)",
  fontSize: 13,
  color: "var(--md-sys-color-on-surface-variant)",
};

function callout(kind: "ok" | "err"): React.CSSProperties {
  const map = {
    ok: { bg: "var(--cp-ok-dim)", fg: "var(--cp-ok)", bd: "rgba(70,224,160,.22)" },
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
