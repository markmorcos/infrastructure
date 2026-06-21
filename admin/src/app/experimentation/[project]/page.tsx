"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ProjectDetail,
  Feature,
  FeatureValue,
  FeatureRule,
  Cohort,
  Environment,
  SdkKey,
  FEATURE_TYPES,
  STATUSES,
  STATUS_META,
  jsonStr,
  parseVariants,
} from "../types";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Label,
  Spinner,
  Callout,
} from "@/components/ui";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectKey = decodeURIComponent(params.project as string);

  const [data, setData] = useState<ProjectDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/experimentation/projects/${encodeURIComponent(projectKey)}`;

  const load = useCallback(async () => {
    const res = await fetch(base);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (!res.ok) {
      setError("failed to load project");
      return;
    }
    const d: ProjectDetail = await res.json();
    setData(d);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = async () => {
    await load();
  };

  if (notFound)
    return (
      <div style={{ padding: "80px 28px", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)", textAlign: "center" }}>
        <span className="msym" style={{ fontSize: 40, opacity: 0.5, display: "block", marginBottom: 12 }}>folder_off</span>
        project not found
        <div style={{ marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={() => router.push("/experimentation")}>
            back to projects
          </Button>
        </div>
      </div>
    );

  if (!data)
    return (
      <div style={loadingStyle}>
        <Spinner />
        loading…
      </div>
    );

  const { project, environments, sdkKeys, features, experiments, cohorts } = data;

  const rename = async () => {
    const name = prompt("new name", project.name);
    if (name === null) return;
    await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    reload();
  };

  const remove = async () => {
    if (!confirm(`Delete project ${project.key}? This clears all its data.`)) return;
    const res = await fetch(base, { method: "DELETE" });
    if (res.ok) router.push("/experimentation");
  };

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1080 }}>
      <button onClick={() => router.push("/experimentation")} className="cp-btn-ghost" style={{ height: 34, padding: "0 14px 0 10px", fontSize: 12, marginBottom: 20 }}>
        <span className="msym" style={{ fontSize: 17 }}>arrow_back</span>projects
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span className="msym" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>science</span>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>{project.name}</h2>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{project.key}</span>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={rename} className="h-[32px] px-3 text-[11px]">
          <span className="msym" style={{ fontSize: 15 }}>edit</span>rename
        </Button>
        <Button variant="soft" onClick={remove} className="h-[32px] px-3 text-[11px]">
          <span className="msym" style={{ fontSize: 15 }}>delete</span>delete
        </Button>
      </div>

      {error && (
        <Callout icon="error" className="mt-4">{error}</Callout>
      )}

      <Environments base={base} environments={environments} sdkKeys={sdkKeys} onChange={reload} />

      <Cohorts base={base} cohorts={cohorts ?? []} onChange={reload} />

      <Features base={base} features={features} environments={environments} cohorts={cohorts ?? []} onChange={reload} />

      <Experiments base={base} projectKey={project.key} experiments={experiments} />
    </div>
  );
}

// ---- Environments + SDK keys ----

function Environments({
  base,
  environments,
  sdkKeys,
  onChange,
}: {
  base: string;
  environments: Environment[];
  sdkKeys: SdkKey[];
  onChange: () => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = await fetch(`${base}/environments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), name: name.trim() }),
    });
    if (!res.ok) {
      setErr((await res.text()) || "could not create environment");
      return;
    }
    setKey("");
    setName("");
    onChange();
  };

  const rename = async (env: Environment) => {
    const n = prompt("new name", env.name);
    if (n === null) return;
    await fetch(`${base}/environments/${encodeURIComponent(env.key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    onChange();
  };

  const remove = async (env: Environment) => {
    if (!confirm(`Delete environment ${env.key}? This clears its events.`)) return;
    await fetch(`${base}/environments/${encodeURIComponent(env.key)}`, { method: "DELETE" });
    onChange();
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const keyFor = (envKey: string) => sdkKeys.find((k) => k.environment === envKey)?.key;

  return (
    <Section icon="dns" title="ENVIRONMENTS">
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {environments.length === 0 && <Empty icon="dns" text="no environments" />}
        {environments.map((env) => {
          const sk = keyFor(env.key);
          return (
            <div key={env.id} style={{ border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 11, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "var(--md-sys-color-surface-container)" }}>
                <span className="msym" style={{ fontSize: 16, color: "var(--md-sys-color-primary)" }}>lan</span>
                <span style={{ fontFamily: "var(--cp-mono)", fontSize: 13, fontWeight: 600 }}>{env.name}</span>
                <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>{env.key}</span>
                <div style={{ flex: 1 }} />
                <Button variant="ghost" onClick={() => rename(env)} className="h-[28px] w-[28px] p-0" title="rename">
                  <span className="msym" style={{ fontSize: 15 }}>edit</span>
                </Button>
                <Button variant="soft" onClick={() => remove(env)} className="h-[28px] w-[28px] p-0" title="delete">
                  <span className="msym" style={{ fontSize: 15 }}>delete</span>
                </Button>
              </div>
              <div style={{ padding: "11px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
                <KeyRow label="SDK KEY" value={sk ?? "—"} />
                <KeyRow label="CONFIG" value={`${origin}/api/experimentation/v1/config?key=${sk ?? "<key>"}&device=<id>`} />
                <KeyRow label="TRACK" value={`${origin}/api/experimentation/v1/track`} />
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={create} style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key (e.g. staging)" style={{ height: 40, flex: "1 1 140px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" style={{ height: 40, flex: "1 1 140px", minWidth: 0 }} />
        <Button type="submit" variant="tonal" disabled={!key.trim()} className="h-[40px] px-4 text-[12px]">
          <span className="msym" style={{ fontSize: 16 }}>add</span>add env
        </Button>
      </form>
      {err && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", marginTop: 8 }}>{err}</div>}
    </Section>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ fontFamily: "var(--cp-mono)", fontSize: 9.5, letterSpacing: ".06em", color: "var(--md-sys-color-outline)", width: 54, flexShrink: 0 }}>{label}</span>
      <code style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{value}</code>
      <Button variant="ghost" onClick={copy} className="h-[24px] w-[24px] p-0" title="copy">
        <span className="msym" style={{ fontSize: 13 }}>{copied ? "check" : "content_copy"}</span>
      </Button>
    </div>
  );
}

// ---- Cohorts ----

function Cohorts({
  base,
  cohorts,
  onChange,
}: {
  base: string;
  cohorts: Cohort[];
  onChange: () => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = await fetch(`${base}/cohorts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), name: name.trim() }),
    });
    if (!res.ok) {
      setErr((await res.text()) || "could not create cohort");
      return;
    }
    setKey("");
    setName("");
    onChange();
  };

  const remove = async (c: Cohort) => {
    if (!confirm(`Delete cohort ${c.key}? This removes its members and any targeting rules using it.`)) return;
    await fetch(`${base}/cohorts/${encodeURIComponent(c.key)}`, { method: "DELETE" });
    onChange();
  };

  return (
    <Section icon="groups" title="COHORTS">
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {cohorts.length === 0 && <Empty icon="groups" text="no cohorts" />}
        {cohorts.map((c) => (
          <CohortCard key={c.id} base={base} cohort={c} onChange={onChange} onDelete={() => remove(c)} />
        ))}
      </div>

      <form onSubmit={create} style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key (e.g. pilot)" style={{ height: 40, flex: "1 1 140px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" style={{ height: 40, flex: "1 1 140px", minWidth: 0 }} />
        <Button type="submit" variant="tonal" disabled={!key.trim()} className="h-[40px] px-4 text-[12px]">
          <span className="msym" style={{ fontSize: 16 }}>add</span>add cohort
        </Button>
      </form>
      {err && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", marginTop: 8 }}>{err}</div>}
    </Section>
  );
}

function CohortCard({
  base,
  cohort,
  onChange,
  onDelete,
}: {
  base: string;
  cohort: Cohort;
  onChange: () => void;
  onDelete: () => void;
}) {
  const [entity, setEntity] = useState("");
  const membersPath = `${base}/cohorts/${encodeURIComponent(cohort.key)}/members`;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const entity_id = entity.trim();
    if (!entity_id) return;
    await fetch(membersPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id }),
    });
    setEntity("");
    onChange();
  };

  const removeMember = async (entity_id: string) => {
    await fetch(membersPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id }),
    });
    onChange();
  };

  return (
    <div style={{ border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 11, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "var(--md-sys-color-surface-container)" }}>
        <span className="msym" style={{ fontSize: 16, color: "var(--md-sys-color-primary)" }}>groups</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 13, fontWeight: 600 }}>{cohort.name}</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>{cohort.key}</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)" }}>{cohort.members.length} members</span>
        <div style={{ flex: 1 }} />
        <Button variant="soft" onClick={onDelete} className="h-[28px] w-[28px] p-0" title="delete">
          <span className="msym" style={{ fontSize: 15 }}>delete</span>
        </Button>
      </div>
      <div style={{ padding: "11px 13px", display: "flex", flexDirection: "column", gap: 9 }}>
        {cohort.members.length === 0 && <Empty icon="person_off" text="no members" />}
        {cohort.members.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {cohort.members.map((m) => (
              <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 6px 0 10px", borderRadius: 9999, background: "var(--md-sys-color-surface-container-highest)", fontFamily: "var(--cp-mono)", fontSize: 11 }}>
                {m}
                <button type="button" onClick={() => removeMember(m)} title="remove" style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", cursor: "pointer", color: "var(--md-sys-color-on-surface-variant)", padding: 2 }}>
                  <span className="msym" style={{ fontSize: 14 }}>close</span>
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="entity id (e.g. lea)" style={{ height: 34, flex: "1 1 160px", minWidth: 0, fontFamily: "var(--cp-mono)", fontSize: 11.5 }} />
          <Button type="submit" variant="tonal" disabled={!entity.trim()} className="h-[34px] px-3 text-[11px]">
            <span className="msym" style={{ fontSize: 15 }}>person_add</span>add
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---- Features ----

function Features({
  base,
  features,
  environments,
  cohorts,
  onChange,
}: {
  base: string;
  features: Feature[];
  environments: Environment[];
  cohorts: Cohort[];
  onChange: () => void;
}) {
  const [key, setKey] = useState("");
  const [type, setType] = useState<string>("boolean");
  const [description, setDescription] = useState("");
  const [def, setDef] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const body: Record<string, unknown> = { key: key.trim(), type, description: description.trim() };
    const parsed = parseTyped(type, def);
    if (parsed.error) {
      setErr(parsed.error);
      return;
    }
    if (def.trim() !== "") body.default = parsed.value;
    const res = await fetch(`${base}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setErr((await res.text()) || "could not create feature");
      return;
    }
    setKey("");
    setDescription("");
    setDef("");
    onChange();
  };

  const remove = async (f: Feature) => {
    if (!confirm(`Delete feature ${f.key}?`)) return;
    await fetch(`${base}/features/${encodeURIComponent(f.key)}`, { method: "DELETE" });
    onChange();
  };

  return (
    <Section icon="flag" title="FEATURE FLAGS">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {features.length === 0 && <Empty icon="flag" text="no feature flags" />}
        {features.map((f) => (
          <FeatureCard
            key={f.id}
            base={base}
            feature={f}
            environments={environments}
            cohorts={cohorts}
            values={f.values ?? []}
            onChange={onChange}
            onDelete={() => remove(f)}
          />
        ))}
      </div>

      <form onSubmit={create} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
        <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 10 }}>NEW FLAG</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" style={{ height: 40, flex: "1 1 120px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
          <Select value={type} onChange={(e) => setType(e.target.value)} style={{ height: 40, flex: "0 1 120px" }}>
            {FEATURE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Input value={def} onChange={(e) => setDef(e.target.value)} placeholder={defPlaceholder(type)} style={{ height: 40, flex: "1 1 120px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" style={{ height: 40, flex: "1 1 200px", minWidth: 0 }} />
          <Button type="submit" variant="tonal" disabled={!key.trim()} className="h-[40px] px-4 text-[12px]">
            <span className="msym" style={{ fontSize: 16 }}>add</span>add flag
          </Button>
        </div>
        {err && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", marginTop: 8 }}>{err}</div>}
      </form>
    </Section>
  );
}

function FeatureCard({
  base,
  feature,
  environments,
  cohorts,
  values,
  onChange,
  onDelete,
}: {
  base: string;
  feature: Feature;
  environments: Environment[];
  cohorts: Cohort[];
  values: FeatureValue[];
  onChange: () => void;
  onDelete: () => void;
}) {
  const valueFor = (env: string) => values.find((v) => v.environment === env);

  return (
    <div style={{ border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 11, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "var(--md-sys-color-surface-container)" }}>
        <span className="msym" style={{ fontSize: 16, color: "var(--md-sys-color-primary)" }}>flag</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 13, fontWeight: 600 }}>{feature.key}</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 9.5, letterSpacing: ".05em", padding: "2px 7px", borderRadius: 5, background: "var(--md-sys-color-surface-container-highest)", color: "var(--md-sys-color-on-surface-variant)" }}>{feature.type}</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>default {jsonStr(feature.default)}</span>
        <div style={{ flex: 1 }} />
        <Button variant="soft" onClick={onDelete} className="h-[28px] w-[28px] p-0" title="delete">
          <span className="msym" style={{ fontSize: 15 }}>delete</span>
        </Button>
      </div>
      {feature.description && (
        <div style={{ padding: "8px 13px 0", fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>{feature.description}</div>
      )}
      <div style={{ padding: "11px 13px", display: "flex", flexDirection: "column", gap: 9 }}>
        {environments.length === 0 && <Empty icon="dns" text="no environments to configure" />}
        {environments.map((env) => (
          <div key={env.id} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <TargetingEditor base={base} feature={feature} env={env} cohorts={cohorts} />
            <FeatureValueRow base={base} feature={feature} env={env} value={valueFor(env.key)} onChange={onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Targeting (per-feature, per-environment ordered rules) ----

type RuleDraft = {
  mode: "cohort" | "entity";
  cohortId: string;
  entityId: string;
  enabled: boolean;
  value: string;
};

function TargetingEditor({
  base,
  feature,
  env,
  cohorts,
}: {
  base: string;
  feature: Feature;
  env: Environment;
  cohorts: Cohort[];
}) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rulesPath = `${base}/features/${encodeURIComponent(feature.key)}/rules/${encodeURIComponent(env.key)}`;

  const load = useCallback(async () => {
    const res = await fetch(rulesPath);
    if (!res.ok) {
      setLoaded(true);
      return;
    }
    const raw: FeatureRule[] = await res.json();
    setRules(
      raw.map((r) => ({
        mode: r.cohortId ? "cohort" : "entity",
        cohortId: r.cohortId ?? (cohorts[0]?.id ?? ""),
        entityId: r.entityId ?? "",
        enabled: r.enabled,
        value: r.value === null || r.value === undefined ? "" : jsonStr(r.value),
      }))
    );
    setLoaded(true);
  }, [rulesPath, cohorts]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  const addRule = () => {
    setRules((rs) => [
      ...rs,
      { mode: cohorts.length ? "cohort" : "entity", cohortId: cohorts[0]?.id ?? "", entityId: "", enabled: true, value: "" },
    ]);
  };

  const updateRule = (i: number, patch: Partial<RuleDraft>) => {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const removeRule = (i: number) => {
    setRules((rs) => rs.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    setRules((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    setErr(null);
    setSaved(false);
    const payload: Record<string, unknown>[] = [];
    for (const r of rules) {
      const out: Record<string, unknown> = { enabled: r.enabled };
      if (r.mode === "cohort") {
        if (!r.cohortId) {
          setErr("pick a cohort for every cohort rule");
          return;
        }
        out.cohortId = r.cohortId;
      } else {
        if (!r.entityId.trim()) {
          setErr("entity id required for every entity rule");
          return;
        }
        out.entityId = r.entityId.trim();
      }
      if (r.value.trim() !== "") {
        const parsed = parseTyped(feature.type, r.value);
        if (parsed.error) {
          setErr(parsed.error);
          return;
        }
        out.value = parsed.value;
      }
      payload.push(out);
    }
    let res: Response;
    try {
      res = await fetch(rulesPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: payload }),
      });
    } catch {
      setErr("could not save rules");
      return;
    }
    if (!res.ok) {
      setErr((await res.text()) || "could not save rules");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
    load();
  };

  const cohortName = (id: string) => cohorts.find((c) => c.id === id)?.key ?? id;

  return (
    <div style={{ border: "1px dashed var(--md-sys-color-outline-variant)", borderRadius: 9, padding: "8px 10px" }}>
      <button
        type="button"
        onClick={toggleOpen}
        style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: "transparent", cursor: "pointer", padding: 0, width: "100%", color: "var(--md-sys-color-on-surface-variant)" }}
      >
        <span className="msym" style={{ fontSize: 15, color: "var(--md-sys-color-primary)" }}>my_location</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, letterSpacing: ".05em" }}>TARGETING · {env.key}</span>
        {loaded && rules.length > 0 && (
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10, color: "var(--md-sys-color-on-surface-variant)" }}>{rules.length} rule{rules.length === 1 ? "" : "s"}</span>
        )}
        <div style={{ flex: 1 }} />
        <span className="msym" style={{ fontSize: 17 }}>{open ? "expand_less" : "expand_more"}</span>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 9 }}>
          {!loaded && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>loading…</div>}
          {loaded && rules.length === 0 && (
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)" }}>no rules — falls back to rollout below</div>
          )}
          {rules.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10, color: "var(--md-sys-color-outline)", width: 16, textAlign: "right" }}>{i + 1}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} className="h-[16px] w-[20px] p-0" title="up">
                  <span className="msym" style={{ fontSize: 13 }}>arrow_drop_up</span>
                </Button>
                <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === rules.length - 1} className="h-[16px] w-[20px] p-0" title="down">
                  <span className="msym" style={{ fontSize: 13 }}>arrow_drop_down</span>
                </Button>
              </div>
              <Select value={r.mode} onChange={(e) => updateRule(i, { mode: e.target.value as "cohort" | "entity" })} style={{ height: 32, flex: "0 1 90px", fontFamily: "var(--cp-mono)", fontSize: 11 }}>
                <option value="cohort">cohort</option>
                <option value="entity">entity</option>
              </Select>
              {r.mode === "cohort" ? (
                cohorts.length ? (
                  <Select value={r.cohortId} onChange={(e) => updateRule(i, { cohortId: e.target.value })} style={{ height: 32, flex: "1 1 120px", fontFamily: "var(--cp-mono)", fontSize: 11 }}>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{cohortName(c.id)}</option>
                    ))}
                  </Select>
                ) : (
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--cp-err)", flex: "1 1 120px" }}>create a cohort first</span>
                )
              ) : (
                <Input value={r.entityId} onChange={(e) => updateRule(i, { entityId: e.target.value })} placeholder="entity id" style={{ height: 32, flex: "1 1 120px", minWidth: 0, fontFamily: "var(--cp-mono)", fontSize: 11 }} />
              )}
              <Switch on={r.enabled} onClick={() => updateRule(i, { enabled: !r.enabled })} />
              <Input value={r.value} onChange={(e) => updateRule(i, { value: e.target.value })} placeholder={`value (${defPlaceholder(feature.type)})`} style={{ height: 32, flex: "1 1 90px", minWidth: 0, fontFamily: "var(--cp-mono)", fontSize: 11 }} />
              <Button variant="ghost" onClick={() => removeRule(i)} className="h-[32px] w-[28px] p-0" title="remove rule">
                <span className="msym" style={{ fontSize: 15 }}>delete</span>
              </Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="ghost" onClick={addRule} className="h-[30px] px-3 text-[11px]">
              <span className="msym" style={{ fontSize: 15 }}>add</span>add rule
            </Button>
            <Button variant="tonal" onClick={save} className="h-[30px] px-3 text-[11px]">save rules</Button>
            {saved && <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--cp-ok)" }}>saved</span>}
          </div>
          {err && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--cp-err)" }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

function FeatureValueRow({
  base,
  feature,
  env,
  value,
  onChange,
}: {
  base: string;
  feature: Feature;
  env: Environment;
  value: FeatureValue | undefined;
  onChange: () => void;
}) {
  const [enabled, setEnabled] = useState(value?.enabled ?? false);
  const [val, setVal] = useState(value ? jsonStr(value.value) : "");
  const [rollout, setRollout] = useState(value?.rollout ?? 100);
  const [err, setErr] = useState<string | null>(null);
  const set = value !== undefined;

  const valuesPath = `${base}/features/${encodeURIComponent(feature.key)}/values/${encodeURIComponent(env.key)}`;

  const save = async () => {
    setErr(null);
    const parsed = parseTyped(feature.type, val);
    if (parsed.error) {
      setErr(parsed.error);
      return;
    }
    const body: Record<string, unknown> = { enabled, rollout };
    if (val.trim() !== "") body.value = parsed.value;
    const res = await fetch(valuesPath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setErr((await res.text()) || "could not set value");
      return;
    }
    onChange();
  };

  const unset = async () => {
    await fetch(valuesPath, { method: "DELETE" });
    onChange();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, width: 80, flexShrink: 0, color: set ? "var(--md-sys-color-on-surface)" : "var(--md-sys-color-outline)" }}>{env.key}</span>
      <Switch on={enabled} onClick={() => setEnabled((v) => !v)} />
      {feature.type === "boolean" ? (
        <Select value={val || "false"} onChange={(e) => setVal(e.target.value)} style={{ height: 34, flex: "0 1 100px", fontFamily: "var(--cp-mono)", fontSize: 11.5 }}>
          <option value="true">true</option>
          <option value="false">false</option>
        </Select>
      ) : (
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={defPlaceholder(feature.type)} style={{ height: 34, flex: "1 1 110px", minWidth: 0, fontFamily: "var(--cp-mono)", fontSize: 11.5 }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Input type="number" min={0} max={100} value={rollout} onChange={(e) => setRollout(Number(e.target.value))} style={{ height: 34, width: 64, fontFamily: "var(--cp-mono)", fontSize: 11.5 }} />
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>%</span>
      </div>
      <Button variant="tonal" onClick={save} className="h-[34px] px-3 text-[11px]">set</Button>
      {set && (
        <Button variant="ghost" onClick={unset} className="h-[34px] px-[10px] text-[11px]" title="revert to default">unset</Button>
      )}
      {err && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--cp-err)", flexBasis: "100%" }}>{err}</div>}
    </div>
  );
}

// ---- Experiments ----

function Experiments({
  base,
  projectKey,
  experiments,
}: {
  base: string;
  projectKey: string;
  experiments: { id: string; key: string; name: string; status: string; metric: string; control: string; variants: { key: string; weight: number }[] }[];
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("");
  const [control, setControl] = useState("");
  const [status, setStatus] = useState("draft");
  const [variantsRaw, setVariantsRaw] = useState("control:1\nvariant:1");
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = await fetch(`${base}/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: key.trim(),
        name: name.trim(),
        status,
        metric: metric.trim(),
        control: control.trim(),
        variants: parseVariants(variantsRaw),
      }),
    });
    if (!res.ok) {
      setErr((await res.text()) || "could not create experiment");
      return;
    }
    const d = await res.json();
    router.push(`/experimentation/${encodeURIComponent(projectKey)}/experiments/${encodeURIComponent(d.key)}`);
  };

  return (
    <Section icon="experiment" title="EXPERIMENTS">
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {experiments.length === 0 && <Empty icon="experiment" text="no experiments" />}
        {experiments.map((exp) => {
          const meta = STATUS_META[exp.status] ?? STATUS_META.draft;
          return (
            <button
              key={exp.id}
              onClick={() => router.push(`/experimentation/${encodeURIComponent(projectKey)}/experiments/${encodeURIComponent(exp.key)}`)}
              className="cp-card cp-card-hover"
              style={{ padding: "12px 14px", textAlign: "left", display: "flex", alignItems: "center", gap: 11 }}
            >
              <span className="msym" style={{ fontSize: 17, color: "var(--md-sys-color-primary)" }}>experiment</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--cp-mono)", fontSize: 13, fontWeight: 600 }}>{exp.name || exp.key}</div>
                <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)", marginTop: 2 }}>
                  {exp.key} · metric {exp.metric} · {exp.variants.length} variants
                </div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 9999, background: meta.dim, color: meta.color, fontFamily: "var(--cp-mono)", fontSize: 10.5 }}>{exp.status}</span>
              <span className="msym" style={{ fontSize: 18, color: "var(--md-sys-color-outline)" }}>chevron_right</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={create} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
        <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 10 }}>NEW EXPERIMENT</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" style={{ height: 40, flex: "1 1 120px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" style={{ height: 40, flex: "1 1 120px", minWidth: 0 }} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 40, flex: "0 1 120px" }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="metric (e.g. purchase)" style={{ height: 40, flex: "1 1 140px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
          <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="control variant key" style={{ height: 40, flex: "1 1 140px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Label>VARIANTS (one per line, key:weight)</Label>
          <Textarea value={variantsRaw} onChange={(e) => setVariantsRaw(e.target.value)} rows={3} style={{ marginTop: 6, fontFamily: "var(--cp-mono)", fontSize: 12, resize: "vertical" }} />
        </div>
        <Button type="submit" variant="tonal" disabled={!key.trim()} className="h-[40px] px-4 text-[12px] mt-[10px]">
          <span className="msym" style={{ fontSize: 16 }}>add</span>create experiment
        </Button>
        {err && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", marginTop: 8 }}>{err}</div>}
      </form>
    </Section>
  );
}

// ---- shared helpers ----

// parseTyped turns a raw form string into a typed JSON value matching Go's
// valueFromForm. Returns an error string for invalid number/json.
function parseTyped(type: string, raw: string): { value: unknown; error?: string } {
  const t = raw.trim();
  switch (type) {
    case "boolean":
      return { value: t === "true" };
    case "string":
      return { value: t };
    case "number": {
      if (t === "") return { value: 0 };
      const n = Number(t);
      if (Number.isNaN(n)) return { value: null, error: "invalid number" };
      return { value: n };
    }
    default: {
      if (t === "") return { value: null };
      try {
        return { value: JSON.parse(t) };
      } catch {
        return { value: null, error: "invalid json" };
      }
    }
  }
}

function defPlaceholder(type: string): string {
  switch (type) {
    case "boolean":
      return "true / false";
    case "number":
      return "0";
    case "json":
      return '{"k":1}';
    default:
      return "value";
  }
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <Card pad={false} className="p-5 mt-4">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span className="msym" style={{ fontSize: 17, color: "var(--md-sys-color-on-surface-variant)" }}>{icon}</span>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)" }}>{title}</span>
      </div>
      {children}
    </Card>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0", fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
      <span className="msym" style={{ fontSize: 22, opacity: 0.5, display: "block", marginBottom: 8 }}>{icon}</span>
      {text}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: 38, height: 22, borderRadius: 9999, border: "none", cursor: "pointer", padding: 2, flexShrink: 0, background: on ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-container-highest)", display: "flex", justifyContent: on ? "flex-end" : "flex-start", alignItems: "center", transition: "background .18s" }}
    >
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: on ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-outline)" }} />
    </button>
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
