"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Asset } from "../../types";

// Assets page (/cms/[site]/assets). Upload form (disabled with a notice if S3 is
// unconfigured) + a list with thumbnail, filename, size and delete. Ports
// cms/ui.go uiAssets and cms/web/templates/assets.html.

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetsPage() {
  const params = useParams();
  const router = useRouter();
  const siteKey = decodeURIComponent(params.site as string);
  const fileRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadsEnabled, setUploadsEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}/assets`);
    if (!res.ok) {
      setError("Failed to load images");
      return;
    }
    setAssets(await res.json());
    // Detect upload availability via a status flag exposed on the site object.
    const cfg = await fetch(
      `/api/cms/sites/${encodeURIComponent(siteKey)}/assets/config`
    ).catch(() => null);
    if (cfg && cfg.ok) {
      const d = await cfg.json();
      setUploadsEnabled(!!d.uploadsEnabled);
    }
  }, [siteKey]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const upload = async (file: File) => {
    setError(null);
    setOk(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/cms/sites/${encodeURIComponent(siteKey)}/assets`,
      { method: "POST", body: fd }
    );
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "upload failed");
      return;
    }
    setOk("Image uploaded. Remember to click Publish to put it on the website.");
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const remove = async (a: Asset) => {
    if (!confirm(`Delete image ${a.filename}?`)) return;
    const res = await fetch(
      `/api/cms/sites/${encodeURIComponent(siteKey)}/assets/${encodeURIComponent(a.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) load();
  };

  if (loading)
    return (
      <div style={loadingStyle}>
        <span className="cp-spinner" />
        loading images…
      </div>
    );

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1000 }}>
      <button onClick={() => router.push(`/cms/${encodeURIComponent(siteKey)}`)} className="cp-btn-ghost" style={{ height: 34, padding: "0 14px 0 10px", fontSize: 12, marginBottom: 20 }}>
        <span className="msym" style={{ fontSize: 17 }}>arrow_back</span>{siteKey}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span className="msym fill" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>image</span>
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600 }}>Images</h2>
      </div>

      {error && (
        <div style={{ ...callout("err"), marginBottom: 14 }}>
          <span className="msym" style={{ fontSize: 16 }}>error</span>{error}
        </div>
      )}
      {ok && (
        <div style={{ ...callout("ok"), marginBottom: 14 }}>
          <span className="msym" style={{ fontSize: 16 }}>check_circle</span>{ok}
        </div>
      )}

      <div className="cp-card" style={{ padding: 20, marginBottom: 22 }}>
        <div className="cp-label" style={{ marginBottom: 12 }}>{"// UPLOAD"}</div>
        {uploadsEnabled ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
              disabled={uploading}
              style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}
            />
            {uploading && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                <span className="cp-spinner" />uploading…
              </span>
            )}
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-outline)" }}>
              JPG, PNG, WebP, SVG · max 10 MB
            </span>
          </div>
        ) : (
          <div style={callout("warn")}>
            <span className="msym" style={{ fontSize: 16 }}>cloud_off</span>
            Uploads are not configured (S3_* env missing).
          </div>
        )}
      </div>

      {assets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>
          <span className="msym" style={{ fontSize: 40, opacity: 0.5 }}>hide_image</span>
          <div style={{ marginTop: 12, fontSize: 13 }}>no images yet</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-[14px] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {assets.map((a) => (
            <div key={a.id} className="cp-card" style={{ overflow: "hidden" }}>
              <div style={{ height: 140, background: "var(--md-sys-color-surface-container)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.filename}>
                  {a.filename}
                </div>
                <div style={{ display: "flex", alignItems: "center", marginTop: 8, gap: 8 }}>
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)", flex: 1 }}>
                    {fmtSize(a.sizeBytes)}
                  </span>
                  <button onClick={() => remove(a)} className="cp-btn-soft" style={{ width: 30, height: 30, padding: 0 }} title="delete">
                    <span className="msym" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
