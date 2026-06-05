package main

import (
	"context"
	"errors"
	"log"
)

// seed creates the example datewithmark project (the datewithmark.com
// Sunset/Midnight/Linen experiment) on first boot, so there is something to look
// at. It is idempotent: it does nothing once the project exists.
func (s *Server) seed(ctx context.Context) error {
	_, err := s.store.GetProject(ctx, "datewithmark")
	if err == nil {
		return nil
	}
	if !errors.Is(err, errNotFound) {
		return err
	}

	p, _, sdkKey, err := s.provisionProject(ctx, "datewithmark", "Date with Mark")
	if err != nil {
		return err
	}
	exp := Experiment{
		ProjectID: p.ID,
		Key:       "date_flow_variant",
		Name:      "Date flow variant",
		Status:    statusRunning,
		Metric:    "date_confirmed",
		Control:   "sunset",
		Variants: []Variant{
			{Key: "sunset", Weight: 33},
			{Key: "midnight", Weight: 33},
			{Key: "linen", Weight: 34},
		},
	}
	if _, err := s.store.CreateExperiment(ctx, exp); err != nil {
		return err
	}
	log.Printf("seeded datewithmark project; production SDK key: %s", sdkKey)
	return nil
}
