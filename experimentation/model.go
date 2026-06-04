package main

import (
	"encoding/json"
	"time"
)

// Project is the tenant boundary. Everything else belongs to a project.
type Project struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// Environment scopes flag values and SDK keys within a project (e.g. production).
type Environment struct {
	ID        string `json:"id"`
	ProjectID string `json:"-"`
	Key       string `json:"key"`
	Name      string `json:"name"`
}

// SDKKey is the per-project+environment client credential. A client presents it
// to /api/v1/config and /api/v1/track; it identifies which config to serve.
type SDKKey struct {
	Key         string `json:"key"`
	Environment string `json:"environment"`
}

// Feature is a typed flag. The concrete value is set per environment in
// FeatureValue; DefaultValue is returned when the flag is off or a device falls
// outside the rollout.
type Feature struct {
	ID           string          `json:"id"`
	ProjectID    string          `json:"-"`
	Key          string          `json:"key"`
	Type         string          `json:"type"` // boolean | string | number | json
	Description  string          `json:"description"`
	DefaultValue json.RawMessage `json:"default"`
}

// FeatureValue is a feature's per-environment configuration.
type FeatureValue struct {
	Environment string          `json:"environment"`
	Enabled     bool            `json:"enabled"`
	Value       json.RawMessage `json:"value"`
	Rollout     int             `json:"rollout"` // 0..100, percent of devices that get Value
}

// Experiment is an n-way test (A/B, A/B/C, …). Variants carry relative weights.
type Experiment struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"-"`
	Key       string    `json:"key"`
	Name      string    `json:"name"`
	Status    string    `json:"status"` // draft | running | stopped
	Metric    string    `json:"metric"`
	Control   string    `json:"control"`
	Variants  []Variant `json:"variants"`
}

// Variant is one arm of an experiment.
type Variant struct {
	Key    string `json:"key"`
	Weight int    `json:"weight"`
}

const (
	featureBoolean = "boolean"
	featureString  = "string"
	featureNumber  = "number"
	featureJSON    = "json"

	statusDraft   = "draft"
	statusRunning = "running"
	statusStopped = "stopped"
)
