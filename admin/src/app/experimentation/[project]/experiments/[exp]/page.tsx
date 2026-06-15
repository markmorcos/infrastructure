"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Experiment,
  Results,
  STATUSES,
  STATUS_META,
  pct,
  signedPct,
  parseVariants,
} from "../../../types";
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Label,
  Spinner,
} from "@/components/ui";

function variantLines(variants: { key: string; weight: number }[]): string {
  return variants.map((v) => `${v.key}:${v.weight}`).join("\n");
}

export default function ExperimentPage() {
  const params = useParams();
  const router = useRouter();
  const projectKey = decodeURIComponent(params.project as string);
  const expKey = decodeURIComponent(params.exp as string);

  const base = `/api/experimentation/projects/${encodeURIComponent(projectKey)}`;
  const expBase = `${base}/experiments/${encodeURIComponent(expKey)}`;

  const [exp, setExp] = useState<Experiment | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [notFound, setNotFound] = useState(false);

  // edit form
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [metric, setMetric] = useState("");
  const [control, setControl] = useState("");
  const [variantsRaw, setVariantsRaw] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The experiment fields come from the project detail (the admin API has no
    // single-experiment GET, matching Go); results have a dedicated endpoint.
    const [detailRes, resultsRes] = await Promise.all([
      fetch(base),
      fetch(`${expBase}/results`),
    ]);
    if (detailRes.status === 404) {
      setNotFound(true);
      return;
    }
    if (detailRes.ok) {
      const d = await detailRes.json();
      const e: Experiment | undefined = (d.experiments as Experiment[]).find(
        (x) => x.key === expKey
      );
      if (!e) {
        setNotFound(true);
        return;
      }
      setExp(e);
      setName(e.name);
      setStatus(e.status);
      setMetric(e.metric);
      setControl(e.control);
      setVariantsRaw(variantLines(e.variants));
    }
    if (resultsRes.ok) setResults(await resultsRes.json());
  }, [base, expBase, expKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound)
    return (
      <div style={{ padding: "80px 28px", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)", textAlign: "center" }}>
        <span className="msym" style={{ fontSize: 40, opacity: 0.5, display: "block", marginBottom: 12 }}>science_off</span>
        experiment not found
        <div style={{ marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/experimentation/${encodeURIComponent(projectKey)}`)}>
            back to project
          </Button>
        </div>
      </div>
    );

  if (!exp)
    return (
      <div style={loadingStyle}>
        <Spinner />
        loading…
      </div>
    );

  const save = async () => {
    setSaveMsg(null);
    setSaveErr(null);
    const res = await fetch(expBase, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        status,
        metric: metric.trim(),
        control: control.trim(),
        variants: parseVariants(variantsRaw),
      }),
    });
    if (!res.ok) {
      setSaveErr((await res.text()) || "could not update experiment");
      return;
    }
    setSaveMsg("saved");
    load();
  };

  const remove = async () => {
    if (!confirm(`Delete experiment ${exp.key}? This clears its events.`)) return;
    const res = await fetch(expBase, { method: "DELETE" });
    if (res.ok) router.push(`/experimentation/${encodeURIComponent(projectKey)}`);
  };

  const meta = STATUS_META[exp.status] ?? STATUS_META.draft;

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1080 }}>
      <button onClick={() => router.push(`/experimentation/${encodeURIComponent(projectKey)}`)} className="cp-btn-ghost" style={{ height: 34, padding: "0 14px 0 10px", fontSize: 12, marginBottom: 20 }}>
        <span className="msym" style={{ fontSize: 17 }}>arrow_back</span>{projectKey}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span className="msym" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>experiment</span>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>{exp.name || exp.key}</h2>
        <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{exp.key}</span>
        <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 9999, background: meta.dim, color: meta.color, fontFamily: "var(--cp-mono)", fontSize: 10.5 }}>{exp.status}</span>
        <div style={{ flex: 1 }} />
        <Button variant="soft" onClick={remove} className="h-[32px] px-3 text-[11px]">
          <span className="msym" style={{ fontSize: 15 }}>delete</span>delete
        </Button>
      </div>

      {/* RESULTS */}
      <Card pad={false} className="p-5 mt-5">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span className="msym" style={{ fontSize: 17, color: "var(--md-sys-color-on-surface-variant)" }}>insights</span>
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)" }}>
            RESULTS · metric {exp.metric} · control {exp.control}
          </span>
        </div>
        {!results || results.variants.length === 0 ? (
          <Empty icon="bar_chart" text="no data yet" />
        ) : (
          <ResultsTable results={results} />
        )}
      </Card>

      {/* EDIT */}
      <Card pad={false} className="p-5 mt-4">
        <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 16 }}>{"// EDIT"}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" style={{ height: 40, flex: "1 1 140px", minWidth: 0 }} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 40, flex: "0 1 130px" }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="metric" style={{ height: 40, flex: "1 1 140px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
          <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="control variant key" style={{ height: 40, flex: "1 1 140px", minWidth: 0, fontFamily: "var(--cp-mono)" }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Label>VARIANTS (one per line, key:weight)</Label>
          <Textarea value={variantsRaw} onChange={(e) => setVariantsRaw(e.target.value)} rows={4} style={{ marginTop: 6, fontFamily: "var(--cp-mono)", fontSize: 12, resize: "vertical" }} />
        </div>
        <Button onClick={save} className="h-[44px] px-5 text-[13px] mt-3">save changes</Button>
        {saveMsg && <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-ok)", marginLeft: 12 }}>{saveMsg}</span>}
        {saveErr && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", marginTop: 8 }}>{saveErr}</div>}
      </Card>
    </div>
  );
}

function ResultsTable({ results }: { results: Results }) {
  const cols = "1.4fr 1fr 1fr 1fr 1fr 1fr 110px";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", fontFamily: "var(--cp-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--md-sys-color-on-surface-variant)" }}>
          <span>VARIANT</span>
          <span style={{ textAlign: "right" }}>EXPOSURES</span>
          <span style={{ textAlign: "right" }}>CONVERSIONS</span>
          <span style={{ textAlign: "right" }}>RATE</span>
          <span style={{ textAlign: "right" }}>UPLIFT</span>
          <span style={{ textAlign: "right" }}>P-VALUE</span>
          <span style={{ textAlign: "right" }}>SIGNIFICANCE</span>
        </div>
        {results.variants.map((v) => (
          <div key={v.variant} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "12px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", alignItems: "center", fontFamily: "var(--cp-mono)", fontSize: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.variant}</span>
              {v.isControl && (
                <span style={{ fontSize: 9, letterSpacing: ".05em", padding: "2px 6px", borderRadius: 5, background: "var(--md-sys-color-surface-container-highest)", color: "var(--md-sys-color-on-surface-variant)" }}>CONTROL</span>
              )}
            </span>
            <span style={{ textAlign: "right" }}>{v.exposures}</span>
            <span style={{ textAlign: "right" }}>{v.conversions}</span>
            <span style={{ textAlign: "right" }}>{pct(v.rate)}</span>
            <span style={{ textAlign: "right", color: v.isControl ? "var(--md-sys-color-outline)" : v.upliftVsControl >= 0 ? "var(--cp-ok)" : "var(--cp-err)" }}>
              {v.isControl ? "—" : signedPct(v.upliftVsControl)}
            </span>
            <span style={{ textAlign: "right", color: "var(--md-sys-color-on-surface-variant)" }}>
              {v.isControl ? "—" : v.pValue.toFixed(4)}
            </span>
            <span style={{ textAlign: "right" }}>
              {v.isControl ? (
                <span style={{ color: "var(--md-sys-color-outline)" }}>—</span>
              ) : v.significant ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 9999, background: "var(--cp-ok-dim)", color: "var(--cp-ok)", fontSize: 10.5 }}>
                  <span className="msym" style={{ fontSize: 13 }}>verified</span>significant
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 9999, background: "var(--md-sys-color-surface-container-highest)", color: "var(--md-sys-color-on-surface-variant)", fontSize: 10.5 }}>
                  not sig.
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0", fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
      <span className="msym" style={{ fontSize: 26, opacity: 0.5, display: "block", marginBottom: 8 }}>{icon}</span>
      {text}
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
