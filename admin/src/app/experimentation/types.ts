// Shared types + small helpers for the experimentation admin console. These
// mirror the JSON shapes returned by /api/experimentation/* (see lib admin.ts).

export type Project = {
  id: string;
  key: string;
  name: string;
  createdAt: string;
};

export type Environment = {
  id: string;
  key: string;
  name: string;
};

export type SdkKey = {
  key: string;
  environment: string;
};

export type Feature = {
  id: string;
  key: string;
  type: string;
  description: string;
  default: unknown;
  values: FeatureValue[];
};

export type FeatureValue = {
  environment: string;
  enabled: boolean;
  value: unknown;
  rollout: number;
};

export type Variant = {
  key: string;
  weight: number;
};

export type Experiment = {
  id: string;
  key: string;
  name: string;
  status: string;
  metric: string;
  control: string;
  variants: Variant[];
};

export type Cohort = {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  members: string[];
};

export type FeatureRule = {
  cohortId: string | null;
  entityId: string | null;
  enabled: boolean;
  value: unknown;
};

export type ProjectDetail = {
  project: Project;
  environments: Environment[];
  sdkKeys: SdkKey[];
  features: Feature[];
  experiments: Experiment[];
  cohorts: Cohort[];
};

export type VariantResult = {
  variant: string;
  exposures: number;
  conversions: number;
  rate: number;
  isControl: boolean;
  upliftVsControl: number;
  z: number;
  pValue: number;
  significant: boolean;
};

export type Results = {
  experiment: string;
  metric: string;
  control: string;
  updatedAt: string;
  variants: VariantResult[];
};

export const FEATURE_TYPES = ["boolean", "string", "number", "json"] as const;
export const STATUSES = ["draft", "running", "stopped"] as const;

// jsonStr renders a parsed JSON value back to its compact source form, matching
// the Go UI's `str` helper (e.g. literal `true`, `"hello"`, `42`).
export function jsonStr(v: unknown): string {
  if (v === undefined) return "";
  return JSON.stringify(v);
}

export function pct(f: number): string {
  return `${(f * 100).toFixed(1)}%`;
}

export function signedPct(f: number): string {
  const sign = f >= 0 ? "+" : "";
  return `${sign}${(f * 100).toFixed(1)}%`;
}

// parseVariants parses a "key:weight" per-line textarea into variants, matching
// the Go UI's parseVariants (default weight 1, blank lines skipped).
export function parseVariants(raw: string): Variant[] {
  const out: Variant[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf(":");
    const key = (idx === -1 ? t : t.slice(0, idx)).trim();
    let weight = 1;
    if (idx !== -1) {
      const n = parseInt(t.slice(idx + 1).trim(), 10);
      if (!Number.isNaN(n)) weight = n;
    }
    out.push({ key, weight });
  }
  return out;
}

export const STATUS_META: Record<string, { color: string; dim: string }> = {
  draft: { color: "var(--md-sys-color-on-surface-variant)", dim: "var(--md-sys-color-surface-container-highest)" },
  running: { color: "var(--cp-ok)", dim: "var(--cp-ok-dim)" },
  stopped: { color: "var(--cp-warn)", dim: "var(--cp-warn-dim)" },
};
