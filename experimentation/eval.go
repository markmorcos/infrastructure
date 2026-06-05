package main

import "encoding/json"

// fnv1a32 hashes s with 32-bit FNV-1a — the deterministic hash used for both
// experiment bucketing and flag rollout, so the same device always resolves the
// same way without storing any per-user state.
func fnv1a32(s string) uint32 {
	const (
		offset uint32 = 2166136261
		prime  uint32 = 16777619
	)
	h := offset
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= prime
	}
	return h
}

// inRollout reports whether a device falls within a [0,100] rollout for a given
// salt. A distinct salt per use (flag vs experiment) avoids correlated buckets.
func inRollout(salt, device string, rollout int) bool {
	if rollout >= 100 {
		return true
	}
	if rollout <= 0 {
		return false
	}
	return int(fnv1a32(device+":"+salt)%100) < rollout
}

// assignVariant deterministically maps a device to one variant by weight.
func assignVariant(exp Experiment, device string) string {
	total := 0
	for _, v := range exp.Variants {
		total += v.Weight
	}
	if total == 0 || len(exp.Variants) == 0 {
		return exp.Control
	}
	n := float64(fnv1a32(device+":"+exp.Key)%10000) / 10000.0
	cum := 0.0
	for _, v := range exp.Variants {
		cum += float64(v.Weight) / float64(total)
		if n < cum {
			return v.Key
		}
	}
	return exp.Variants[len(exp.Variants)-1].Key
}

// evalFeature returns the value a device should see for a feature in some
// environment: the configured value when enabled and inside the rollout,
// otherwise the feature's default.
func evalFeature(f Feature, v *FeatureValue, device string) json.RawMessage {
	if v == nil || !v.Enabled {
		return f.DefaultValue
	}
	if inRollout("flag:"+f.Key, device, v.Rollout) {
		return v.Value
	}
	return f.DefaultValue
}
