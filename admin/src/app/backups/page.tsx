"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Spinner, Chip, Callout } from "@/components/ui";

interface BackupItem {
  kind: "postgres" | "mongo" | "redis" | "minio";
  label: string;
  key: string;
  ts: string;
  size: number;
  objects?: number;
  restorable: boolean;
}

const KINDS: { kind: BackupItem["kind"]; title: string; icon: string }[] = [
  { kind: "postgres", title: "POSTGRES", icon: "database" },
  { kind: "mongo", title: "MONGO", icon: "database" },
  { kind: "minio", title: "MINIO (buckets)", icon: "folder" },
  { kind: "redis", title: "REDIS (cache)", icon: "bolt" },
];

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function BackupsPage() {
  const [items, setItems] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [restore, setRestore] = useState<{ key: string; job: string; phase: string; log: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const res = await fetch("/api/admin/backups");
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "could not load backups");
      setLoading(false);
      return;
    }
    setItems(await res.json());
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function poll(job: string, key: string) {
    const t = setInterval(async () => {
      const r = await fetch(`/api/admin/backups/restore/${job}`);
      if (!r.ok) return;
      const s = await r.json();
      setRestore({ key, job, phase: s.phase, log: s.log });
      if (s.phase !== "running") clearInterval(t);
    }, 2500);
  }

  async function doRestore(it: BackupItem) {
    setConfirming(null);
    setErr("");
    setRestore({ key: it.key, job: "", phase: "starting", log: "" });
    const res = await fetch("/api/admin/backups/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: it.kind, key: it.key, name: it.label, confirm: true }),
    });
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "restore failed to start");
      setRestore(null);
      return;
    }
    const { job } = await res.json();
    setRestore({ key: it.key, job, phase: "running", log: "" });
    poll(job, it.key);
  }

  if (loading) {
    return (
      <div className="p-7">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-[14px] py-5 md:px-7 md:py-7" style={{ maxWidth: 900 }}>
      <Callout tone="info" icon="info" className="mb-5">
        Off-box backups in Cloudflare R2. Restoring <strong>overwrites live data</strong> with the
        selected snapshot — it spawns an in-cluster Job.
      </Callout>

      {err && <Callout tone="err" icon="error" className="mb-4">{err}</Callout>}

      {restore && (
        <Card className="mb-5">
          <div className="flex items-center gap-2">
            <span className="font-[var(--cp-mono)] text-[12px] text-[var(--md-sys-color-on-surface-variant)]">
              restoring {restore.key}
            </span>
            <Chip tone={restore.phase === "succeeded" ? "ok" : restore.phase === "failed" ? "err" : "warn"}>
              {restore.phase}
            </Chip>
            {restore.phase === "running" && <Spinner className="w-[14px] h-[14px]" />}
            <div className="flex-1" />
            {restore.phase !== "running" && restore.phase !== "starting" && (
              <Button size="sm" variant="ghost" onClick={() => setRestore(null)}>dismiss</Button>
            )}
          </div>
          {restore.log && (
            <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-[var(--md-sys-color-surface-container-high)] p-3 font-[var(--cp-mono)] text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
              {restore.log}
            </pre>
          )}
        </Card>
      )}

      {KINDS.map(({ kind, title }) => {
        const group = items.filter((i) => i.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} className="mb-6">
            <div className="mb-2.5 font-[var(--cp-mono)] text-[11px] tracking-[0.1em] text-[var(--md-sys-color-on-surface-variant)]">{`// ${title}`}</div>
            <Card pad={false} className="divide-y divide-[var(--md-sys-color-outline-variant)]">
              {group.map((it) => (
                <div key={it.key} className="flex flex-wrap items-center gap-3 p-3.5">
                  <span className="font-[var(--cp-mono)] text-[13px] font-semibold">{it.label}</span>
                  <span className="font-[var(--cp-mono)] text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                    {fmtTime(it.ts)} · {fmtSize(it.size)}
                    {it.objects != null ? ` · ${it.objects} objects` : ""}
                  </span>
                  <div className="flex-1" />
                  {it.restorable ? (
                    confirming === it.key ? (
                      <div className="flex items-center gap-2">
                        <span className="font-[var(--cp-mono)] text-[11px] text-[var(--cp-err)]">overwrite live {it.kind}?</span>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>cancel</Button>
                        <Button size="sm" danger variant="ghost" onClick={() => doRestore(it)}>confirm restore</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="soft" onClick={() => setConfirming(it.key)}>
                        <span className="msym text-[15px]">restore</span>restore
                      </Button>
                    )
                  ) : (
                    <span className="font-[var(--cp-mono)] text-[10.5px] text-[var(--md-sys-color-on-surface-variant)]">snapshot only</span>
                  )}
                </div>
              ))}
            </Card>
          </div>
        );
      })}

      {items.length === 0 && (
        <Card className="text-center" style={{ padding: "44px 20px" }}>
          <span className="msym" style={{ fontSize: 38, opacity: 0.5 }}>cloud_off</span>
          <div className="mt-3 font-[var(--cp-mono)] text-[13px] text-[var(--md-sys-color-on-surface-variant)]">
            no backups found in R2 yet — the nightly job runs at 03:17 UTC
          </div>
        </Card>
      )}
    </div>
  );
}
