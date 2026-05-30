# monitoring

Standalone uptime monitoring with [Uptime Kuma](https://github.com/louislam/uptime-kuma),
fronted by [Caddy](https://caddyserver.com/) for TLS.

## Where this runs (and why)

This stack runs on the **Raspberry Pi via plain Docker Compose — _not_ in the
k3s cluster.** A monitor must not depend on the thing it monitors: if Kuma
lived inside the cluster on the M720q, a cluster/node outage would take the
monitor down with it and you'd never get the alert. Running it on a separate
Pi keeps it alive to report "M720q / cluster / DBs are down."

This is why it's Docker Compose and not a Helm chart like the rest of the repo:
Helm is for workloads _inside_ the cluster; this is deliberately _outside_ it.

## Independence: no dependency on m720q's dnsmasq

The split-DNS resolver (`:53` / dnsmasq) lives on m720q. If the Pi resolved
names through it, the monitor would depend on the server again. It doesn't —
every name the Pi needs is resolved without touching m720q:

| What needs resolving                       | Route                                                        | Depends on m720q? |
| ------------------------------------------ | ------------------------------------------------------------ | ----------------- |
| Public sites (`*.morcos.tech`, etc.)       | public Cloudflare DNS                                        | No                |
| Internal services (Postgres/Mongo/Redis)   | **Tailscale MagicDNS** — target `m720q.<tailnet>.ts.net`     | No (local netmap) |
| The dashboard (`status.morcos.tech`)       | a **public** Cloudflare A record → the Pi's Tailscale IP     | No                |
| The TLS cert (DNS-01 challenge)            | Caddy → Cloudflare API over the internet                     | No                |

Two rules keep it that way:

1. **Do not use `*.morcos.lan` names in the Pi's monitors.** Use Tailscale
   names/IPs instead (e.g. `m720q.<tailnet>.ts.net:5432`). Then dnsmasq is
   irrelevant to the Pi, and if m720q dies you get a clean "connection
   refused" instead of a confusing DNS failure.
2. **Publish `status.morcos.tech` in _public_ Cloudflare DNS**, pointing at the
   Pi's `100.x` Tailscale IP — not in m720q's dnsmasq. It resolves everywhere
   (a private IP in a public record is harmless) but is only _reachable_ from
   inside the tailnet.

## Prerequisites on the Pi

- Ubuntu Server (24.04 LTS), joined to the tailnet (`tailscale up`).
- Docker + Docker Compose plugin.
- A Cloudflare API token scoped to **Zone → DNS → Edit** on the `morcos.tech`
  zone (and nothing else).
- **Pi 5 page-size gotcha:** a 16K-page kernel breaks Tailscale's Go binary.
  Run `getconf PAGESIZE`; if it returns `16384`, add `kernel=kernel8.img` to
  `/boot/firmware/config.txt` and reboot _before_ installing Tailscale.

## Setup

```bash
# 1. DNS: add a PUBLIC Cloudflare A record
#    status.morcos.tech  ->  <Pi Tailscale IP>   (e.g. 100.x.y.z)
#    (proxy OFF / DNS-only; it's a private IP, reachable only on the tailnet)

# 2. Secrets
cp .env.example .env
$EDITOR .env            # paste CF_API_TOKEN

# 3. Bring it up (builds the Caddy image with the Cloudflare DNS plugin)
docker compose up -d --build

# 4. Open https://status.morcos.tech from any tailnet device and create the
#    admin account immediately (first run is unauthenticated).
```

## Monitors to configure (in the Kuma UI)

Group into **Public** and **Internal** for a clean board. Suggested: 60s
interval, 2–3 retries before "down".

### Public — HTTP(s), expect 2xx/3xx

- `https://morcos.tech`
- `https://games.morcos.tech`
- `https://ma3ady.com`
- `https://preview.ma3ady.com`
- `https://app.ma3ady.com`
- `https://preview-app.ma3ady.com`
- `https://pile.bio`
- `https://rdr.cx`
- `https://eventlane.io`
- `https://admin.eventlane.io`
- `https://secrets.morcos.tech`
- `https://stminaconnect.com`
- `https://headlamp.morcos.tech`
- `https://minio.morcos.tech`
- `https://cdn.morcos.tech`
- `https://api.eventlane.io` — **set accepted status codes `200-499`** (it
  returns 403 on `/` but the backend is up).

Add a keyword check on a page or two to catch "200 but broken."

### Internal — TCP port, via Tailscale (NOT `*.morcos.lan`)

Target the M720q's Tailscale name (or IP). Replace `<tailnet>` with your
tailnet, or use the `100.x` address directly.

- `m720q.<tailnet>.ts.net:5432` — PostgreSQL
- `m720q.<tailnet>.ts.net:27017` — MongoDB
- `m720q.<tailnet>.ts.net:6379` — Redis

## Notifications

Add a notifier in **Settings → Notifications** and attach it to every monitor.
The alert path must leave your network so it doesn't depend on your own infra:

- **Telegram** (easiest/free) — create a bot via @BotFather, get the chat ID.
- **Email** via your existing Resend SMTP.
- **ntfy** — push to your phone.

## Backups

All Kuma state (config + history) lives in the `kuma-data` volume (SQLite).
Fold it into your off-site backup, e.g.:

```bash
docker run --rm -v monitoring_kuma-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/kuma-data-$(date +%F).tar.gz -C /data .
```

## Alternative exposure: `tailscale serve`

If you'd rather drop Caddy + Cloudflare entirely, `tailscale serve --bg https /
http://localhost:3001` gives `https://<pi>.<tailnet>.ts.net` with an auto real
cert, fully independent of both m720q and Cloudflare (persists across reboots).
You lose the `status.morcos.tech` name. To switch: publish Kuma's port locally
and run `tailscale serve` instead of the Caddy service.
