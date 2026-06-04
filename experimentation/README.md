# experimentation

A tiny, from-scratch A/B/C experimentation service — the lightweight stand-in for
GrowthBook for the **Datebloom** ([datewithmark.com](https://datewithmark.com))
Sunset / Midnight / Linen experiment.

It does three things: **assign** a variant deterministically, **track** events, and
report **results** with frequentist significance — over a single Postgres table,
behind a single host. One Go binary, deployed via `charts/infrastructure` like the
other apps.

| | |
| --- | --- |
| Host | `https://experimentation.morcos.tech` |
| Namespace | `experimentation` |
| Datastore | native Postgres (existing `database-secrets` → `DATABASE_URL`) |
| Image | `ghcr.io/markmorcos/infrastructure-experimentation` (distroless static) |

## Why not GrowthBook

GrowthBook needed external Mongo, an S3/MinIO upload hack, six secrets, and a chart
with two hosts + a PVC. This service needs **one Postgres table and one host** — and
it gives the one thing that actually mattered (significance) directly.

## API

CORS is open (`*`) so the browser app can call it cross-origin.

### `GET /api/assign?experiment=date_flow_variant&device=<id>`
Deterministic, weighted variant for a device. Pure read — no event is written.
```json
{ "experiment": "date_flow_variant", "variant": "midnight" }
```
Same `device` always maps to the same variant (32-bit FNV-1a hash of
`device:experiment`, bucketed by weight), so no assignment state is stored.

### `POST /api/track`
Record one exposure or conversion.
```json
{ "experiment": "date_flow_variant", "variant": "midnight", "device": "<id>", "event": "exposure" }
```
`event` is `"exposure"` (the denominator) or the conversion metric (`"date_confirmed"`).
Returns `204`.

### `GET /api/results?experiment=date_flow_variant`
Per-variant distinct-device counts, conversion rate, uplift vs control, and a pooled
**two-proportion z-test** (two-sided p, significant at p < 0.05) against the control
(`sunset`).

### `GET /`
Embedded single-page dashboard that polls `/api/results` every 10s.

## Experiment config

Hard-coded in [`experiment.go`](./experiment.go) for now (`date_flow_variant`:
`sunset`/`midnight`/`linen` at 33/33/34, metric `date_confirmed`, control `sunset`).
Changing variants/weights is a one-map edit; the API stays the same.

## Client integration (datewithmark.com)

Replace the hard-coded variant flag with two calls:

```js
const API = "https://experimentation.morcos.tech";
const EXPERIMENT = "date_flow_variant";
const device = getStableDeviceId(); // persisted UUID per device

// 1. assign + fire exposure once on load
const { variant } = await fetch(
  `${API}/api/assign?experiment=${EXPERIMENT}&device=${device}`
).then((r) => r.json());

fetch(`${API}/api/track`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ experiment: EXPERIMENT, variant, device, event: "exposure" }),
});

// render Sunset / Midnight / Linen off `variant`

// 2. on the confirm / add-to-calendar tap
fetch(`${API}/api/track`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ experiment: EXPERIMENT, variant, device, event: "date_confirmed" }),
});
```

## Deploy

In-repo app, same flow as `admin/`: push to `main` under `experimentation/**` (or run
the `deploy-experimentation` workflow) → builds the multi-arch image → `scripts/deploy.sh`
helm-installs the `charts/infrastructure` chart from [`deployment.yaml`](./deployment.yaml).

**Prereqs (out-of-band, like the other apps):**
- A `database-secrets` secret with key `DATABASE_URL` in the **`experimentation`** namespace,
  pointing at the native Postgres (e.g. `postgres://<user>:<pw>@m720q:5432/<db>?sslmode=disable`).
  The service auto-creates the `experiment_events` table on boot.
- Cloudflare CNAME `experimentation` → the DDNS anchor.

## Develop / test

```bash
cd experimentation
go test ./...                 # assignment distribution, z-test, handlers
DATABASE_URL=postgres://localhost/exp?sslmode=disable PORT=8090 go run .
```
