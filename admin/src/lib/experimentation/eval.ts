// Byte-exact port of the Go service's eval.go. The SDK contract (which variant
// a device sees, whether a flag is on) depends on these matching Go exactly, so
// the same device always resolves the same way across both implementations
// without storing any per-user state.
//
// Self-check (matches Go):
//   fnv1a32("")            === 2166136261
//   fnv1a32("a")           === 0xe40c292c  (3826002220)
//   fnv1a32("foobar")      === 0xbf9cf968  (3214735720)
//   inRollout(s, d, 100)   === true   (always, regardless of hash)
//   inRollout(s, d, 0)     === false  (always)
//   assignVariant with total weight 0 or no variants -> control
//   evalFeature: null/disabled value -> feature.default_value (RAW JSON, so a
//     boolean flag yields literal `true`, not the string "true").

// fnv1a32 hashes s with 32-bit FNV-1a over its UTF-8 BYTES. Go ranges over the
// bytes of a string, so we must encode to UTF-8 here rather than iterate code
// units. Math.imul gives a true 32-bit multiply; the `>>> 0` keeps everything
// in the unsigned 32-bit domain matching Go's uint32 wraparound.
export function fnv1a32(s: string): number {
  const bytes = new TextEncoder().encode(s);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ bytes[i]) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// inRollout reports whether a device falls within a [0,100] rollout for a given
// salt. A distinct salt per use (flag vs experiment) avoids correlated buckets.
export function inRollout(salt: string, device: string, rollout: number): boolean {
  if (rollout >= 100) {
    return true;
  }
  if (rollout <= 0) {
    return false;
  }
  return fnv1a32(device + ":" + salt) % 100 < rollout;
}

export type EvalVariant = { key: string; weight: number; position: number };

// assignVariant deterministically maps a device to one variant by weight,
// iterating variants in ascending position so the cumulative ranges line up
// with the order the Go service stored them.
export function assignVariant(
  expKey: string,
  variants: EvalVariant[],
  control: string,
  device: string
): string {
  let total = 0;
  for (const v of variants) {
    total += v.weight;
  }
  if (total === 0 || variants.length === 0) {
    return control;
  }
  const ordered = [...variants].sort((a, b) => a.position - b.position);
  const n = (fnv1a32(device + ":" + expKey) % 10000) / 10000.0;
  let cum = 0.0;
  for (const v of ordered) {
    cum += v.weight / total;
    if (n < cum) {
      return v.key;
    }
  }
  return ordered[ordered.length - 1].key;
}

export type EvalFeature = { key: string; default_value: unknown };
export type EvalFeatureValue = { enabled: boolean; value: unknown; rollout: number };

// evalFeature returns the value a device should see for a feature in some
// environment: the configured value when enabled and inside the rollout,
// otherwise the feature's default. Values are RAW JSON (already parsed by the
// pg JSONB codec), so a boolean flag yields literal `true`.
export function evalFeature(
  feature: EvalFeature,
  value: EvalFeatureValue | null,
  device: string
): unknown {
  if (value === null || !value.enabled) {
    return feature.default_value;
  }
  if (inRollout("flag:" + feature.key, device, value.rollout)) {
    return value.value;
  }
  return feature.default_value;
}

// EvalRule is one targeting rule: it matches a device by exact entity id or by
// cohort membership. value is what a matched-enabled rule yields (null means
// "no explicit value", which for a boolean flag is treated as `true`).
export type EvalRule = {
  cohortId: string | null;
  entityId: string | null;
  enabled: boolean;
  value: unknown;
};

// evalFeatureWithRules applies ordered targeting rules BEFORE the rollout. Rules
// are walked in order; the first one that matches the device (by entity id or
// cohort membership) decides the result:
//   * matched + enabled  -> rule.value if it set one, else `true` (boolean flag)
//   * matched + disabled -> the feature's default_value
// When NO rule matches, evaluation falls through to plain rollout evaluation
// (evalFeature), preserving back-compat for features without targeting.
export function evalFeatureWithRules(
  feature: EvalFeature,
  value: EvalFeatureValue | null,
  rules: EvalRule[],
  device: string,
  memberCohortIds: Set<string>
): unknown {
  for (const rule of rules) {
    const matches =
      (rule.entityId !== null && rule.entityId === device) ||
      (rule.cohortId !== null && memberCohortIds.has(rule.cohortId));
    if (!matches) continue;
    if (!rule.enabled) {
      return feature.default_value;
    }
    // An enabled rule yields its explicit value when set; for a boolean flag a
    // bare enabled rule (no value) means "on" -> `true`.
    return rule.value !== null && rule.value !== undefined ? rule.value : true;
  }
  return evalFeature(feature, value, device);
}
