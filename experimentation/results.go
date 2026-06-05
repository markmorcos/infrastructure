package main

import (
	"math"
	"time"
)

// VariantStat holds distinct-device counts for one variant.
type VariantStat struct {
	Variant     string
	Exposures   int
	Conversions int
}

// VariantResult is the computed outcome for one variant.
type VariantResult struct {
	Variant         string  `json:"variant"`
	Exposures       int     `json:"exposures"`
	Conversions     int     `json:"conversions"`
	Rate            float64 `json:"rate"`
	IsControl       bool    `json:"isControl"`
	UpliftVsControl float64 `json:"upliftVsControl"`
	Z               float64 `json:"z"`
	PValue          float64 `json:"pValue"`
	Significant     bool    `json:"significant"`
}

// Results is the full results payload for an experiment.
type Results struct {
	Experiment string          `json:"experiment"`
	Metric     string          `json:"metric"`
	Control    string          `json:"control"`
	UpdatedAt  time.Time       `json:"updatedAt"`
	Variants   []VariantResult `json:"variants"`
}

const significanceThreshold = 0.05

func conversionRate(conv, exposed int) float64 {
	if exposed == 0 {
		return 0
	}
	return float64(conv) / float64(exposed)
}

// twoProportionZ runs a pooled two-proportion z-test of variant A against
// control B, returning the z statistic and two-sided p-value.
func twoProportionZ(convA, expA, convB, expB int) (float64, float64) {
	if expA == 0 || expB == 0 {
		return 0, 1
	}
	pA := float64(convA) / float64(expA)
	pB := float64(convB) / float64(expB)
	pPool := float64(convA+convB) / float64(expA+expB)
	se := math.Sqrt(pPool * (1 - pPool) * (1/float64(expA) + 1/float64(expB)))
	if se == 0 {
		return 0, 1
	}
	z := (pA - pB) / se
	p := math.Erfc(math.Abs(z) / math.Sqrt2)
	return z, p
}

// buildResults turns raw per-variant counts into rates + significance, testing
// every non-control variant against the control (so it works for n-way tests).
func buildResults(exp Experiment, metric string, stats map[string]VariantStat) Results {
	ctrl := stats[exp.Control]
	ctrlRate := conversionRate(ctrl.Conversions, ctrl.Exposures)

	res := Results{
		Experiment: exp.Key,
		Metric:     metric,
		Control:    exp.Control,
		UpdatedAt:  time.Now().UTC(),
		Variants:   make([]VariantResult, 0, len(exp.Variants)),
	}
	for _, v := range exp.Variants {
		st := stats[v.Key]
		vr := VariantResult{
			Variant:     v.Key,
			Exposures:   st.Exposures,
			Conversions: st.Conversions,
			Rate:        conversionRate(st.Conversions, st.Exposures),
			IsControl:   v.Key == exp.Control,
		}
		if !vr.IsControl {
			if ctrlRate > 0 {
				vr.UpliftVsControl = (vr.Rate - ctrlRate) / ctrlRate
			}
			z, p := twoProportionZ(st.Conversions, st.Exposures, ctrl.Conversions, ctrl.Exposures)
			vr.Z, vr.PValue, vr.Significant = z, p, p < significanceThreshold
		}
		res.Variants = append(res.Variants, vr)
	}
	return res
}
