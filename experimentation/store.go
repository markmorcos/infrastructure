package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
)

// Store is the Postgres-backed repository for the whole platform.
type Store struct {
	db *sql.DB
}

// errNotFound is returned when a lookup matches no row.
var errNotFound = errors.New("not found")

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func genSDKKey() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "sdk_" + hex.EncodeToString(b)
}

// ---- Projects ----

func (s *Store) CreateProject(ctx context.Context, key, name string) (Project, error) {
	p := Project{ID: newID(), Key: key, Name: name}
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO projects (id, key, name) VALUES ($1,$2,$3) RETURNING created_at`,
		p.ID, p.Key, p.Name).Scan(&p.CreatedAt)
	return p, err
}

func (s *Store) GetProject(ctx context.Context, key string) (Project, error) {
	var p Project
	err := s.db.QueryRowContext(ctx,
		`SELECT id, key, name, created_at FROM projects WHERE key = $1`, key).
		Scan(&p.ID, &p.Key, &p.Name, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return p, errNotFound
	}
	return p, err
}

func (s *Store) UpdateProject(ctx context.Context, id, name string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE projects SET name=$2 WHERE id=$1`, id, name)
	return err
}

// DeleteProject removes a project and everything under it. The schema cascades
// environments, sdk_keys, features, feature_values, experiments and variants;
// experiment_events have no foreign key, so they are cleared explicitly.
func (s *Store) DeleteProject(ctx context.Context, p Project) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM experiment_events WHERE project_id=$1`, p.ID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM projects WHERE id=$1`, p.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ListProjects(ctx context.Context) ([]Project, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, key, name, created_at FROM projects ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Key, &p.Name, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ---- Environments ----

func (s *Store) CreateEnvironment(ctx context.Context, projectID, key, name string) (Environment, error) {
	e := Environment{ID: newID(), ProjectID: projectID, Key: key, Name: name}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO environments (id, project_id, key, name) VALUES ($1,$2,$3,$4)`,
		e.ID, e.ProjectID, e.Key, e.Name)
	return e, err
}

func (s *Store) ListEnvironments(ctx context.Context, projectID string) ([]Environment, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, project_id, key, name FROM environments WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Environment
	for rows.Next() {
		var e Environment
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.Key, &e.Name); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) UpdateEnvironment(ctx context.Context, id, name string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE environments SET name=$2 WHERE id=$1`, id, name)
	return err
}

// DeleteEnvironment removes an environment along with its SDK keys and flag
// values (cascaded by the schema) and its recorded events (no foreign key).
func (s *Store) DeleteEnvironment(ctx context.Context, env Environment) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM experiment_events WHERE environment_id=$1`, env.ID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM environments WHERE id=$1`, env.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) GetEnvironment(ctx context.Context, projectID, key string) (Environment, error) {
	var e Environment
	err := s.db.QueryRowContext(ctx,
		`SELECT id, project_id, key, name FROM environments WHERE project_id = $1 AND key = $2`,
		projectID, key).Scan(&e.ID, &e.ProjectID, &e.Key, &e.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return e, errNotFound
	}
	return e, err
}

// ---- SDK keys ----

func (s *Store) CreateSDKKey(ctx context.Context, projectID, envID string) (string, error) {
	key := genSDKKey()
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sdk_keys (id, key, project_id, environment_id) VALUES ($1,$2,$3,$4)`,
		newID(), key, projectID, envID)
	return key, err
}

func (s *Store) ListSDKKeys(ctx context.Context, projectID string) ([]SDKKey, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT k.key, e.key
FROM sdk_keys k JOIN environments e ON e.id = k.environment_id
WHERE k.project_id = $1
ORDER BY k.created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SDKKey
	for rows.Next() {
		var k SDKKey
		if err := rows.Scan(&k.Key, &k.Environment); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// ResolvedKey is the project/environment a client SDK key maps to.
type ResolvedKey struct {
	ProjectID     string
	ProjectKey    string
	EnvironmentID string
	Environment   string
}

func (s *Store) ResolveSDKKey(ctx context.Context, key string) (ResolvedKey, error) {
	var r ResolvedKey
	err := s.db.QueryRowContext(ctx, `
SELECT k.project_id, p.key, k.environment_id, e.key
FROM sdk_keys k
JOIN projects p ON p.id = k.project_id
JOIN environments e ON e.id = k.environment_id
WHERE k.key = $1`, key).Scan(&r.ProjectID, &r.ProjectKey, &r.EnvironmentID, &r.Environment)
	if errors.Is(err, sql.ErrNoRows) {
		return r, errNotFound
	}
	return r, err
}

// ---- Features ----

func (s *Store) CreateFeature(ctx context.Context, projectID, key, typ, desc string, def json.RawMessage) (Feature, error) {
	f := Feature{ID: newID(), ProjectID: projectID, Key: key, Type: typ, Description: desc, DefaultValue: def}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO features (id, project_id, key, type, description, default_value)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		f.ID, f.ProjectID, f.Key, f.Type, f.Description, []byte(def))
	return f, err
}

func (s *Store) GetFeature(ctx context.Context, projectID, key string) (Feature, error) {
	var f Feature
	var def []byte
	err := s.db.QueryRowContext(ctx,
		`SELECT id, project_id, key, type, description, default_value
		 FROM features WHERE project_id = $1 AND key = $2`, projectID, key).
		Scan(&f.ID, &f.ProjectID, &f.Key, &f.Type, &f.Description, &def)
	if errors.Is(err, sql.ErrNoRows) {
		return f, errNotFound
	}
	f.DefaultValue = def
	return f, err
}

func (s *Store) ListFeatures(ctx context.Context, projectID string) ([]Feature, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, project_id, key, type, description, default_value
		 FROM features WHERE project_id = $1 ORDER BY key`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Feature
	for rows.Next() {
		var f Feature
		var def []byte
		if err := rows.Scan(&f.ID, &f.ProjectID, &f.Key, &f.Type, &f.Description, &def); err != nil {
			return nil, err
		}
		f.DefaultValue = def
		out = append(out, f)
	}
	return out, rows.Err()
}

// UpdateFeature edits a feature's description and default value. The type and
// key are immutable (changing the type would invalidate stored values).
func (s *Store) UpdateFeature(ctx context.Context, id, desc string, def json.RawMessage) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE features SET description=$2, default_value=$3 WHERE id=$1`,
		id, desc, []byte(def))
	return err
}

// DeleteFeature removes a feature and its per-environment values (cascaded).
func (s *Store) DeleteFeature(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM features WHERE id=$1`, id)
	return err
}

// DeleteFeatureValue unsets a feature in one environment, reverting it to the
// feature's default for that environment.
func (s *Store) DeleteFeatureValue(ctx context.Context, featureID, envID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM feature_values WHERE feature_id=$1 AND environment_id=$2`, featureID, envID)
	return err
}

func (s *Store) UpsertFeatureValue(ctx context.Context, featureID, envID string, enabled bool, value json.RawMessage, rollout int) error {
	_, err := s.db.ExecContext(ctx, `
INSERT INTO feature_values (id, feature_id, environment_id, enabled, value, rollout, updated_at)
VALUES ($1,$2,$3,$4,$5,$6, now())
ON CONFLICT (feature_id, environment_id)
DO UPDATE SET enabled = EXCLUDED.enabled, value = EXCLUDED.value, rollout = EXCLUDED.rollout, updated_at = now()`,
		newID(), featureID, envID, enabled, []byte(value), rollout)
	return err
}

// ListFeatureValues returns a feature's per-environment configuration.
func (s *Store) ListFeatureValues(ctx context.Context, featureID string) ([]FeatureValue, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT e.key, fv.enabled, fv.value, fv.rollout
FROM feature_values fv JOIN environments e ON e.id = fv.environment_id
WHERE fv.feature_id = $1
ORDER BY e.created_at`, featureID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FeatureValue
	for rows.Next() {
		var fv FeatureValue
		var val []byte
		if err := rows.Scan(&fv.Environment, &fv.Enabled, &val, &fv.Rollout); err != nil {
			return nil, err
		}
		fv.Value = val
		out = append(out, fv)
	}
	return out, rows.Err()
}

// FeatureEval pairs a feature with its (optional) value in one environment.
type FeatureEval struct {
	Feature Feature
	Value   *FeatureValue
}

// FeaturesForEval returns every feature in a project together with its value in
// the given environment (nil when unset), for the SDK config endpoint.
func (s *Store) FeaturesForEval(ctx context.Context, projectID, envID string) ([]FeatureEval, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT f.id, f.key, f.type, f.default_value,
       fv.enabled, fv.value, fv.rollout
FROM features f
LEFT JOIN feature_values fv ON fv.feature_id = f.id AND fv.environment_id = $2
WHERE f.project_id = $1
ORDER BY f.key`, projectID, envID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []FeatureEval
	for rows.Next() {
		var f Feature
		var def, val []byte
		var enabled sql.NullBool
		var rollout sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Key, &f.Type, &def, &enabled, &val, &rollout); err != nil {
			return nil, err
		}
		f.DefaultValue = def
		fe := FeatureEval{Feature: f}
		if enabled.Valid {
			fe.Value = &FeatureValue{Enabled: enabled.Bool, Value: val, Rollout: int(rollout.Int64)}
		}
		out = append(out, fe)
	}
	return out, rows.Err()
}

// ---- Experiments ----

func (s *Store) CreateExperiment(ctx context.Context, e Experiment) (Experiment, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return e, err
	}
	defer func() { _ = tx.Rollback() }()

	e.ID = newID()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO experiments (id, project_id, key, name, status, metric, control)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		e.ID, e.ProjectID, e.Key, e.Name, e.Status, e.Metric, e.Control); err != nil {
		return e, err
	}
	for i, v := range e.Variants {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO experiment_variants (id, experiment_id, key, weight, position)
			 VALUES ($1,$2,$3,$4,$5)`,
			newID(), e.ID, v.Key, v.Weight, i); err != nil {
			return e, err
		}
	}
	return e, tx.Commit()
}

// UpdateExperiment updates the experiment fields and replaces its variants.
func (s *Store) UpdateExperiment(ctx context.Context, e Experiment) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`UPDATE experiments SET name=$2, status=$3, metric=$4, control=$5 WHERE id=$1`,
		e.ID, e.Name, e.Status, e.Metric, e.Control); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM experiment_variants WHERE experiment_id=$1`, e.ID); err != nil {
		return err
	}
	for i, v := range e.Variants {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO experiment_variants (id, experiment_id, key, weight, position)
			 VALUES ($1,$2,$3,$4,$5)`,
			newID(), e.ID, v.Key, v.Weight, i); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// DeleteExperiment removes an experiment and its variants (cascaded). Its
// events are keyed by experiment_key, so they are cleared too — otherwise a new
// experiment reusing the key would inherit the old results.
func (s *Store) DeleteExperiment(ctx context.Context, e Experiment) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM experiment_events WHERE project_id=$1 AND experiment_key=$2`, e.ProjectID, e.Key); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM experiments WHERE id=$1`, e.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) loadVariants(ctx context.Context, experimentID string) ([]Variant, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT key, weight FROM experiment_variants WHERE experiment_id=$1 ORDER BY position`, experimentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Variant
	for rows.Next() {
		var v Variant
		if err := rows.Scan(&v.Key, &v.Weight); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) GetExperiment(ctx context.Context, projectID, key string) (Experiment, error) {
	var e Experiment
	err := s.db.QueryRowContext(ctx,
		`SELECT id, project_id, key, name, status, metric, control
		 FROM experiments WHERE project_id=$1 AND key=$2`, projectID, key).
		Scan(&e.ID, &e.ProjectID, &e.Key, &e.Name, &e.Status, &e.Metric, &e.Control)
	if errors.Is(err, sql.ErrNoRows) {
		return e, errNotFound
	}
	if err != nil {
		return e, err
	}
	e.Variants, err = s.loadVariants(ctx, e.ID)
	return e, err
}

func (s *Store) listExperiments(ctx context.Context, projectID string, onlyRunning bool) ([]Experiment, error) {
	q := `SELECT id, project_id, key, name, status, metric, control
	      FROM experiments WHERE project_id=$1`
	if onlyRunning {
		q += ` AND status='running'`
	}
	q += ` ORDER BY created_at`
	rows, err := s.db.QueryContext(ctx, q, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Experiment
	for rows.Next() {
		var e Experiment
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.Key, &e.Name, &e.Status, &e.Metric, &e.Control); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if out[i].Variants, err = s.loadVariants(ctx, out[i].ID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (s *Store) ListExperiments(ctx context.Context, projectID string) ([]Experiment, error) {
	return s.listExperiments(ctx, projectID, false)
}

func (s *Store) RunningExperiments(ctx context.Context, projectID string) ([]Experiment, error) {
	return s.listExperiments(ctx, projectID, true)
}

// ---- Events / results ----

func (s *Store) Track(ctx context.Context, projectID, envID, expKey, variant, device, event string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO experiment_events (project_id, environment_id, experiment_key, variant, device_id, event)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		projectID, envID, expKey, variant, device, event)
	return err
}

// Stats returns distinct-device exposure and conversion counts per variant. When
// envID is non-empty results are scoped to that environment, else across all.
func (s *Store) Stats(ctx context.Context, projectID, expKey, envID, metric string) (map[string]VariantStat, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT variant,
       COUNT(DISTINCT device_id) FILTER (WHERE event = 'exposure') AS exposures,
       COUNT(DISTINCT device_id) FILTER (WHERE event = $3)         AS conversions
FROM experiment_events
WHERE project_id = $1 AND experiment_key = $2
  AND ($4 = '' OR environment_id = $4)
GROUP BY variant`, projectID, expKey, metric, envID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]VariantStat)
	for rows.Next() {
		var vs VariantStat
		if err := rows.Scan(&vs.Variant, &vs.Exposures, &vs.Conversions); err != nil {
			return nil, err
		}
		out[vs.Variant] = vs
	}
	return out, rows.Err()
}
