package main

// Variant is one arm of an experiment and its assignment weight (relative).
type Variant struct {
	Key    string
	Weight int
}

// Experiment is a hard-coded experiment definition. Variants, weights and the
// conversion metric live in code for now; when this graduates to a real config
// store (or GrowthBook), only this map changes — the API stays the same.
type Experiment struct {
	Key      string
	Control  string
	Metric   string // the conversion event name, e.g. "date_confirmed"
	Variants []Variant
}

func defaultExperiments() map[string]Experiment {
	return map[string]Experiment{
		"date_flow_variant": {
			Key:     "date_flow_variant",
			Control: "sunset",
			Metric:  "date_confirmed",
			Variants: []Variant{
				{Key: "sunset", Weight: 33},
				{Key: "midnight", Weight: 33},
				{Key: "linen", Weight: 34},
			},
		},
	}
}

// fnv1a32 hashes s with 32-bit FNV-1a — the same hash family GrowthBook uses for
// deterministic bucketing, so assignments are stable and cheap to compute.
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

// Assign deterministically maps a device to a variant by weighted bucketing.
// The same device always lands in the same variant for a given experiment, so
// no per-user assignment state has to be stored.
func (e Experiment) Assign(device string) string {
	total := 0
	for _, v := range e.Variants {
		total += v.Weight
	}
	if total == 0 || len(e.Variants) == 0 {
		return e.Control
	}
	n := float64(fnv1a32(device+":"+e.Key)%10000) / 10000.0
	cum := 0.0
	for _, v := range e.Variants {
		cum += float64(v.Weight) / float64(total)
		if n < cum {
			return v.Key
		}
	}
	return e.Variants[len(e.Variants)-1].Key
}
