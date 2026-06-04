# experimentation

A small, self-hosted **feature-flag + experimentation platform** — multi-project,
multi-environment, typed flags with percentage rollout, and n-way (A/B, A/B/C, …)
experiments with frequentist results. One Go binary over Postgres, with a
server-rendered admin UI and an SDK API for clients.

The Datebloom ([datewithmark.com](https://datewithmark.com)) Sunset/Midnight/Linen
test is just a **seeded example project** here — nothing is hard-coded to it.

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
  "project": "datebloom",
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

- **Web UI** (`/`, admin token): create projects, environments, typed flags +
  per-env values/rollout, and experiments; view per-experiment results.
- **JSON API** (`/api/admin/...`, `Authorization: Bearer <ADMIN_TOKEN>`): same
  operations — projects, environments, features + values, experiments, results.

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

On first boot the `datebloom` project + `date_flow_variant` experiment are seeded
and the production SDK key is logged.

## Develop / test

```bash
cd experimentation
go test ./...          # assignment, rollout, flag eval, z-test, form parsing, auth
DATABASE_URL=postgres://localhost/exp?sslmode=disable ADMIN_TOKEN=dev PORT=8090 go run .
```
