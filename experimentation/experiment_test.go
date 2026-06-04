package main

import (
	"math"
	"strconv"
	"testing"
)

func TestAssignDeterministic(t *testing.T) {
	exp := defaultExperiments()["date_flow_variant"]
	first := exp.Assign("device-123")
	for i := 0; i < 100; i++ {
		if got := exp.Assign("device-123"); got != first {
			t.Fatalf("assignment not deterministic: %s != %s", got, first)
		}
	}
}

func TestAssignDistribution(t *testing.T) {
	exp := defaultExperiments()["date_flow_variant"]
	counts := map[string]int{}
	const n = 60000
	for i := 0; i < n; i++ {
		counts[exp.Assign("device-"+strconv.Itoa(i))]++
	}
	total := 0
	for _, v := range exp.Variants {
		total += v.Weight
	}
	for _, v := range exp.Variants {
		want := float64(v.Weight) / float64(total)
		got := float64(counts[v.Key]) / float64(n)
		if math.Abs(got-want) > 0.02 {
			t.Errorf("variant %s: got %.3f, want ~%.3f", v.Key, got, want)
		}
	}
}

func TestTwoProportionZ(t *testing.T) {
	// Clearly different proportions -> significant.
	if _, p := twoProportionZ(200, 1000, 100, 1000); p >= significanceThreshold {
		t.Errorf("expected significant, got p=%.4f", p)
	}
	// Identical proportions -> not significant.
	if _, p := twoProportionZ(100, 1000, 100, 1000); p < 0.99 {
		t.Errorf("expected p~1, got p=%.4f", p)
	}
	// Empty data -> safe defaults.
	if z, p := twoProportionZ(0, 0, 0, 0); z != 0 || p != 1 {
		t.Errorf("expected (0,1) for empty data, got (%.4f,%.4f)", z, p)
	}
}

func TestBuildResults(t *testing.T) {
	exp := defaultExperiments()["date_flow_variant"]
	stats := map[string]VariantStat{
		"sunset":   {Variant: "sunset", Exposures: 1000, Conversions: 100},
		"midnight": {Variant: "midnight", Exposures: 1000, Conversions: 200},
		"linen":    {Variant: "linen", Exposures: 1000, Conversions: 100},
	}
	res := buildResults(exp, exp.Metric, stats)
	if len(res.Variants) != 3 {
		t.Fatalf("expected 3 variants, got %d", len(res.Variants))
	}
	byKey := map[string]VariantResult{}
	for _, v := range res.Variants {
		byKey[v.Variant] = v
	}
	if !byKey["sunset"].IsControl {
		t.Error("sunset should be the control")
	}
	if math.Abs(byKey["midnight"].UpliftVsControl-1.0) > 1e-9 {
		t.Errorf("midnight uplift: got %.4f, want 1.0 (10%%->20%%)", byKey["midnight"].UpliftVsControl)
	}
	if !byKey["midnight"].Significant {
		t.Error("midnight (20%% vs 10%%, n=1000) should be significant")
	}
}
