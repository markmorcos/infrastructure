# CMS

Small self-hosted CMS for the morcos.tech websites: multi-site, schema-driven
section forms for non-technical editors, draft/publish with a GitHub rebuild
hook, and image uploads to MinIO. One Go binary over Postgres — same shape as
`experimentation/`.

- Editor UI: https://cms.morcos.tech (shared admin token)
- Public content API: `GET /api/v1/sites/{site}/content?locale=de` (published;
  `&draft=1` previews drafts with the admin token)
- Admin API: `/api/admin/...` (Bearer / `X-Admin-Token`)

## How content flows

1. Section schemas are **owned by code** (`seed.go`) and upserted on every
   boot. When a site's content type changes (e.g. `Dict` in the Lea repo),
   update the matching section schema here in the same change.
2. Editors save **drafts** per section/locale. **Veröffentlichen** copies all
   drafts to published in one transaction, snapshots the result into
   `publishes`, and fires a `repository_dispatch` (`sites.dispatch_event`) at
   `sites.github_repo` so the site's CI rebuilds with the new content.
3. Sites fetch published content at **build time** and fall back to their
   checked-in content when the CMS is unreachable.

## Configuration (env)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres (secret `database-secrets`, namespace `cms`) |
| `ADMIN_TOKEN` | shared editor/admin token (secret `cms-secrets`) |
| `GITHUB_TOKEN` | fine-grained PAT for `repository_dispatch` (secret `cms-secrets`) |
| `S3_ENDPOINT` | MinIO host, e.g. `m720q:9000` (`S3_SECURE=true` for TLS) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO credentials (secret `cms-secrets`) |
| `S3_BUCKET` | bucket, default `cms` (auto-created with anonymous read) |
| `S3_PUBLIC_BASE_URL` | public CDN base, default `https://cdn.morcos.tech` |

`GITHUB_TOKEN` is a **fine-grained PAT** scoped to the dispatched repos (for
now `markmorcos/Lea`) with *Contents: Read and write*. Fine-grained PATs
expire (max 1 year) — when publish stops triggering rebuilds, rotate the token
and update the `cms-secrets` secret. Add new repos to the PAT's repository
list when onboarding new sites.

## One-off provisioning

```sh
kubectl create namespace cms
kubectl -n cms create secret generic database-secrets --from-literal=DATABASE_URL='postgres://…/cms'
kubectl -n cms create secret generic cms-secrets \
  --from-literal=ADMIN_TOKEN='…' \
  --from-literal=GITHUB_TOKEN='github_pat_…' \
  --from-literal=S3_ACCESS_KEY='…' --from-literal=S3_SECRET_KEY='…'
```

GitHub repo secret `CMS_DEPLOYMENT_TOKEN` (JWT for `scripts/deploy.sh`) must
exist like the other apps' deployment tokens.

Initial content for Lea is imported once from the Lea repo:

```sh
cd ~/Projects/Lea && CMS_URL=https://cms.morcos.tech CMS_ADMIN_TOKEN=… node scripts/export-content.mjs
```

## Local development

```sh
docker run -d --name cms-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=cms -p 5432:5432 postgres:17-alpine
DATABASE_URL='postgres://postgres:pg@localhost:5432/cms?sslmode=disable' ADMIN_TOKEN=dev go run .
```

S3 vars are optional locally — without them the CMS runs with uploads
disabled. `go test ./...` covers the dict assembly/explode/form-decode logic.
