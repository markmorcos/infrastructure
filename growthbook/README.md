# GrowthBook

Self-hosted [GrowthBook](https://www.growthbook.io/) — feature flags + experiment
statistics — on the k3s homelab.

It is deployed with the **official GrowthBook Helm chart**, not `charts/infrastructure`.
The reusable chart is single-host / single-port and has no PVC; GrowthBook needs two
hosts (frontend + API) and a persistent uploads volume, all of which the official chart
provides out of the box. We supply only [`values.yaml`](./values.yaml).

| | |
| --- | --- |
| Chart | `oci://ghcr.io/growthbook/charts/growthbook` (pinned **4.4.0**, image `growthbook/growthbook:4.4.0`) |
| Namespace | `growthbook` |
| Frontend | `https://growthbook.morcos.tech` (→ service `growthbook-frontend:3000`) |
| API | `https://growthbook-api.morcos.tech` (→ service `growthbook-backend:3100`) |
| Datastore | **external** native MongoDB on the host — bundled subchart disabled |
| Uploads | `local-path` PVC `growthbook-backend-data` (5Gi) |

## Prerequisites (do these before `helm upgrade`)

### 1. MongoDB database + least-privilege user

GrowthBook stores orgs, metadata and cached experiment results in Mongo. Create a
dedicated `growthbook` database and a user with read/write **only** on it, on the
native Mongo 8.0 running on the host:

```js
// mongosh as MONGO_ROOT_USER (authSource=admin)
use growthbook
db.createUser({
  user: "growthbook",
  pwd:  "<generate-a-strong-password>",
  roles: [ { role: "readWrite", db: "growthbook" } ]
})
```

Connection string used by the pod (note `authSource=admin`):

```
mongodb://growthbook:<password>@mongo.morcos.lan:27017/growthbook?authSource=admin
```

> **Resolution caveat.** `mongo.morcos.lan` only resolves from inside the cluster if
> CoreDNS forwards the `.lan` zone to dnsmasq. If the backend pod logs show a DNS /
> `getaddrinfo ENOTFOUND` error on boot, fall back to one of:
> - add a CoreDNS forward for `morcos.lan` → the dnsmasq IP, **or**
> - add an `ExternalName` Service → `m720q` like `k8s/01-minio.yaml` and point the URI
>   host at it, **or**
> - use the node IP / `m720q` directly in the URI.

### 2. `growthbook` secret (out-of-band — never committed)

Matches the repo convention (`database-secrets`, `jwt-secret` are created out-of-band).
`encryption-key` is **immutable after first boot — generate once and never rotate**, or
existing encrypted values become unreadable.

```bash
kubectl create namespace growthbook --dry-run=client -o yaml | kubectl apply -f -

kubectl -n growthbook create secret generic growthbook \
  --from-literal=jwt-secret="$(openssl rand -hex 32)" \
  --from-literal=encryption-key="$(openssl rand -hex 32)" \
  --from-literal=mongodb-uri="mongodb://growthbook:<password>@mongo.morcos.lan:27017/growthbook?authSource=admin"
```

> If a secret-sealing tool (sealed-secrets / SOPS) is later adopted in this repo, seal
> this secret and commit the sealed form instead of applying it by hand. There is no
> sealing tool wired up today, so it is created out-of-band like the others.

### 3. DNS

Add two Cloudflare CNAMEs pointing at the DDNS anchor record (same pattern as every
other `*.morcos.tech` host):

```
growthbook      CNAME  <anchor>
growthbook-api  CNAME  <anchor>
```

## Deploy

```bash
helm upgrade --install growthbook \
  oci://ghcr.io/growthbook/charts/growthbook --version 4.4.0 \
  -n growthbook --create-namespace \
  -f growthbook/values.yaml

# Watch rollout + cert issuance
kubectl -n growthbook get pods,ingress,certificate -w
```

Render the manifests without applying (sanity check) with `helm template … --version 4.4.0 -f growthbook/values.yaml`.

## First run

1. Confirm the backend connected to Mongo: `kubectl -n growthbook logs deploy/growthbook-backend`.
2. Open `https://growthbook.morcos.tech` and create the first admin org / account.
3. Done when the UI is reachable over valid TLS, the backend is healthy, and Mongo is connected.

## Gotchas

- **`encryption-key` is immutable.** Rotating it makes previously encrypted data unreadable.
- **Image is pinned** to `4.4.0` via the chart's appVersion — no `:latest`. Bump by raising
  `--version` (and re-pin in this README) on the next upgrade.
- **Let's Encrypt prod rate limits.** Don't thrash the ingress while debugging certs. If you
  need to iterate, temporarily switch the issuer to a staging `ClusterIssuer`.
- **Open-core.** Self-host core (flags + frequentist experiment stats) is free and unlimited.
  CUPED, sequential testing, sticky bucketing and SSO are paid — not used here.
