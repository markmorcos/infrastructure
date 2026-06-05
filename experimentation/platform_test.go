package main

import (
	"encoding/json"
	"math"
	"strconv"
	"testing"
)

func sampleExperiment() Experiment {
	return Experiment{
		Key: "date_flow_variant", Control: "sunset", Metric: "date_confirmed",
		Variants: []Variant{{"sunset", 33}, {"midnight", 33}, {"linen", 34}},
	}
}

func TestAssignDeterministicAndDistribution(t *testing.T) {
	exp := sampleExperiment()
	if a, b := assignVariant(exp, "dev-1"), assignVariant(exp, "dev-1"); a != b {
		t.Fatalf("not deterministic: %s != %s", a, b)
	}
	counts := map[string]int{}
	const n = 60000
	for i := 0; i < n; i++ {
		counts[assignVariant(exp, "dev-"+strconv.Itoa(i))]++
	}
	for _, v := range exp.Variants {
		got := float64(counts[v.Key]) / float64(n)
		want := float64(v.Weight) / 100.0
		if math.Abs(got-want) > 0.02 {
			t.Errorf("variant %s: got %.3f, want ~%.3f", v.Key, got, want)
		}
	}
}

func TestInRollout(t *testing.T) {
	if !inRollout("flag:x", "anyone", 100) {
		t.Error("rollout 100 should always be in")
	}
	if inRollout("flag:x", "anyone", 0) {
		t.Error("rollout 0 should always be out")
	}
	in := 0
	const n = 40000
	for i := 0; i < n; i++ {
		if inRollout("flag:x", "dev-"+strconv.Itoa(i), 50) {
			in++
		}
	}
	if frac := float64(in) / float64(n); math.Abs(frac-0.5) > 0.02 {
		t.Errorf("rollout 50 admitted %.3f, want ~0.5", frac)
	}
}

func TestEvalFeature(t *testing.T) {
	f := Feature{Key: "f", Type: featureBoolean, DefaultValue: json.RawMessage("false")}

	if got := string(evalFeature(f, nil, "d")); got != "false" {
		t.Errorf("nil value -> %s, want default false", got)
	}
	off := &FeatureValue{Enabled: false, Value: json.RawMessage("true"), Rollout: 100}
	if got := string(evalFeature(f, off, "d")); got != "false" {
		t.Errorf("disabled -> %s, want default false", got)
	}
	on := &FeatureValue{Enabled: true, Value: json.RawMessage("true"), Rollout: 100}
	if got := string(evalFeature(f, on, "d")); got != "true" {
		t.Errorf("enabled@100 -> %s, want true", got)
	}
	none := &FeatureValue{Enabled: true, Value: json.RawMessage("true"), Rollout: 0}
	if got := string(evalFeature(f, none, "d")); got != "false" {
		t.Errorf("enabled@0 -> %s, want default false", got)
	}
}

func TestTwoProportionZAndResults(t *testing.T) {
	if _, p := twoProportionZ(200, 1000, 100, 1000); p >= significanceThreshold {
		t.Errorf("expected significant, got p=%.4f", p)
	}
	if _, p := twoProportionZ(100, 1000, 100, 1000); p < 0.99 {
		t.Errorf("expected p~1, got p=%.4f", p)
	}

	exp := sampleExperiment()
	stats := map[string]VariantStat{
		"sunset":   {Exposures: 1000, Conversions: 100},
		"midnight": {Exposures: 1000, Conversions: 200},
		"linen":    {Exposures: 1000, Conversions: 100},
	}
	res := buildResults(exp, exp.Metric, stats)
	byKey := map[string]VariantResult{}
	for _, v := range res.Variants {
		byKey[v.Variant] = v
	}
	if !byKey["sunset"].IsControl {
		t.Error("sunset should be control")
	}
	if math.Abs(byKey["midnight"].UpliftVsControl-1.0) > 1e-9 {
		t.Errorf("midnight uplift %.4f, want 1.0", byKey["midnight"].UpliftVsControl)
	}
	if !byKey["midnight"].Significant {
		t.Error("midnight should be significant")
	}
	if byKey["linen"].Significant {
		t.Error("linen (equal to control) should not be significant")
	}
}

func TestValueFromForm(t *testing.T) {
	cases := []struct{ typ, in, want string }{
		{featureBoolean, "true", "true"},
		{featureBoolean, "", "false"},
		{featureString, "hello", `"hello"`},
		{featureNumber, "25", "25"},
		{featureJSON, `{"a":1}`, `{"a":1}`},
	}
	for _, c := range cases {
		got, err := valueFromForm(c.typ, c.in)
		if err != nil {
			t.Errorf("%s/%q: %v", c.typ, c.in, err)
			continue
		}
		if string(got) != c.want {
			t.Errorf("%s/%q -> %s, want %s", c.typ, c.in, got, c.want)
		}
	}
	if _, err := valueFromForm(featureNumber, "abc"); err == nil {
		t.Error("expected error for non-number")
	}
	if _, err := valueFromForm(featureJSON, "{bad"); err == nil {
		t.Error("expected error for bad json")
	}
}

func TestParseVariants(t *testing.T) {
	vs := parseVariants("sunset:33\nmidnight:33\n linen : 34 \n\n")
	if len(vs) != 3 {
		t.Fatalf("got %d variants, want 3", len(vs))
	}
	if vs[2].Key != "linen" || vs[2].Weight != 34 {
		t.Errorf("third variant = %+v", vs[2])
	}
}

func TestAuth(t *testing.T) {
	a := authConfig{token: "secret"}
	if !a.valid("secret") || a.valid("nope") || a.valid("") {
		t.Error("valid() incorrect")
	}
	empty := authConfig{}
	if empty.valid("") || empty.valid("anything") {
		t.Error("empty token must never validate")
	}
}
