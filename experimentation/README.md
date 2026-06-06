# experimentation

A small, self-hosted **feature-flag + experimentation platform** — multi-project,
multi-environment, typed flags with percentage rollout, and n-way (A/B, A/B/C, …)
experiments with frequentist results. One Go binary over Postgres, with a
server-rendered admin UI and an SDK API for clients.

The Date with Mark ([datewithmark.com](https://datewithmark.com)) Sunset/Midnight/Linen
test is just a **seeded example project** (`datewithmark`) here — nothing is hard-coded to it.

| | |
| --- | --- |
| Host | `https://experimentation.morcos.tech` |
| Namespace | `experimentation` |
| Datastore | native Postgres (`database-secrets` → `DATABASE_URL`) |
| Admin auth | shared `ADMIN_TOKEN` (gates UI + `/api/admin`) |
| Image | `ghcr.io/markmorcos/infrastructure-experimentation` (distroless static) |

## Concepts

- **Project** — tenant boundary.
- **Environment** — per project (a `production` env + client SDK key are created
  automatically). Flag values and SDK keys are per-environment.
- **SDK key** — per project+environment client credential; how a client connects.
- **Feature** — typed flag (`boolean`/`string`/`number`/`json`), per-environment
  value with on/off and a **% rollout** (deterministic per device). Default value
  is returned when off or outside the rollout. *(Attribute targeting is a planned
  later phase; `/api/v1/config` already accepts `attrs`.)*
- **Experiment** — N weighted variants, a conversion metric, a control, and a
  status (`draft`/`running`/`stopped`). Assignment is a deterministic FNV-1a hash
  of `device:experiment` — no per-user state stored.

## SDK API (public, CORS-open)

Clients authenticate with an **SDK key**, not the admin token.

### `GET /api/v1/config?key=<sdkKey>&device=<id>`
One payload: every evaluated flag + a variant assignment per running experiment.
```json
{
  "project": "datewithmark",
  "environment": "production",
  "features": { "new_booking_flow": true, "cta_label": "Ask out" },
  "experiments": { "date_flow_variant": { "variant": "midnight" } }
}
```

### `POST /api/v1/track`
```json
{ "key": "<sdkKey>", "device": "<id>", "experiment": "date_flow_variant", "variant": "midnight", "event": "exposure" }
```
`event` is `"exposure"` (denominator) or the conversion metric (e.g. `date_confirmed`). Returns `204`.

### Client integration (e.g. datewithmark.com)
```js
const API = "https://experimentation.morcos.tech";
const device = getStableDeviceId();
const cfg = await fetch(`${API}/api/v1/config?key=${SDK_KEY}&device=${device}`).then(r => r.json());

const variant = cfg.experiments.date_flow_variant.variant;   // render Sunset/Midnight/Linen
const post = (event) => fetch(`${API}/api/v1/track`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: SDK_KEY, device, experiment: "date_flow_variant", variant, event }),
});
post("exposure");                 // on load
// post("date_confirmed");        // on the confirm / add-to-calendar tap
```

## Management

- **Web UI** (`/`, admin token): full CRUD — create, **rename and delete**
  projects, environments, typed flags (+ per-env values/rollout, which can be
  unset back to default) and experiments; view per-experiment results.
- **JSON API** (`/api/admin/...`, `Authorization: Bearer <ADMIN_TOKEN>`): the
  same operations. Create with `POST`, edit with `PATCH`/`PUT`, remove with
  `DELETE`:
  - `PATCH`/`DELETE /api/admin/projects/{project}`
  - `PATCH`/`DELETE /api/admin/projects/{project}/environments/{env}`
  - `PATCH`/`DELETE /api/admin/projects/{project}/features/{feature}`
  - `DELETE /api/admin/projects/{project}/features/{feature}/values/{env}` (unset)
  - `DELETE /api/admin/projects/{project}/experiments/{exp}`

Deletes cascade to everything beneath the resource (a project removes its
environments, SDK keys, flags, experiments and recorded events); deleting an
experiment or environment also clears its events so a reused key starts clean.

Results use a pooled **two-proportion z-test** of each non-control variant vs the
control (significant at p < 0.05), over distinct devices.

## Deploy

In-repo app, same flow as `admin/`: push to `main` under `experimentation/**` (or
run the `deploy-experimentation` workflow) → multi-arch image build → `scripts/deploy.sh`
helm-installs `charts/infrastructure` from [`deployment.yaml`](./deployment.yaml).

**Prereqs (out-of-band, in the `experimentation` namespace):**
- `database-secrets` with key `DATABASE_URL` → native Postgres
  (e.g. `postgres://<user>:<pw>@m720q:5432/<db>?sslmode=disable`). The schema is
  auto-created on boot.
- `experimentation-secrets` with key `ADMIN_TOKEN` (e.g. `openssl rand -hex 32`).
- Cloudflare CNAME `experimentation` → the DDNS anchor.

On first boot the `datewithmark` project + `date_flow_variant` experiment are seeded
and the production SDK key is logged.

## Develop / test

```bash
cd experimentation
go test ./...                 # unit: assignment, rollout, flag eval, z-test, forms, auth, templates, routes
go test -tags e2e ./...       # end-to-end: full CRUD + SDK happy path against a real Postgres
DATABASE_URL=postgres://localhost/exp?sslmode=disable ADMIN_TOKEN=dev PORT=8090 go run .
```

The `e2e` suite boots a throwaway Postgres itself (locating the installed
`initdb`/`postgres`; dropping to the `postgres` system user when run as root) and
drives the admin JSON API, the server-rendered UI forms and the public SDK
endpoints through create → use → update → delete for every resource. It skips
when no Postgres binaries are found; point it at an existing database instead
with `TEST_DATABASE_URL=postgres://… go test -tags e2e ./...`.
