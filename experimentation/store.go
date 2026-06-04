package main

import (
	"context"
	"database/sql"
)

// Store is the Postgres-backed event log. A single append-only table is enough:
// every exposure and conversion is one row; results are computed at query time.
type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS experiment_events (
	id          BIGSERIAL PRIMARY KEY,
	experiment  TEXT NOT NULL,
	variant     TEXT NOT NULL,
	device_id   TEXT NOT NULL,
	event       TEXT NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS experiment_events_lookup
	ON experiment_events (experiment, event, variant);
`

// Migrate creates the events table and index if they do not exist.
func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, schema)
	return err
}

// Track appends a single event (an exposure or a conversion).
func (s *Store) Track(ctx context.Context, experiment, variant, device, event string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO experiment_events (experiment, variant, device_id, event)
		 VALUES ($1, $2, $3, $4)`,
		experiment, variant, device, event)
	return err
}

// VariantStat holds distinct-device counts for one variant.
type VariantStat struct {
	Variant     string
	Exposures   int
	Conversions int
}

// Stats returns, per variant, the number of distinct devices that were exposed
// and the number of distinct devices that fired the conversion metric. Counting
// distinct devices deduplicates repeated events from the same user.
func (s *Store) Stats(ctx context.Context, experiment, metric string) (map[string]VariantStat, error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT variant,
       COUNT(DISTINCT device_id) FILTER (WHERE event = 'exposure') AS exposures,
       COUNT(DISTINCT device_id) FILTER (WHERE event = $2)         AS conversions
FROM experiment_events
WHERE experiment = $1
GROUP BY variant`, experiment, metric)
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
