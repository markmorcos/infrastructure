"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ProjectDetail,
  Feature,
  FeatureValue,
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

  const { project, environments, sdkKeys, features, experiments } = data;

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

      <Features base={base} features={features} environments={environments} onChange={reload} />

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

// ---- Features ----

function Features({
  base,
  features,
  environments,
  onChange,
}: {
  base: string;
  features: Feature[];
  environments: Environment[];
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
  values,
  onChange,
  onDelete,
}: {
  base: string;
  feature: Feature;
  environments: Environment[];
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
          <FeatureValueRow
            key={env.id}
            base={base}
            feature={feature}
            env={env}
            value={valueFor(env.key)}
            onChange={onChange}
          />
        ))}
      </div>
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
