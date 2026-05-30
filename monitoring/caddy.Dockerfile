# The official caddy image ships no DNS providers, so build one in for the
# Cloudflare DNS-01 ACME challenge. Builds on arm64 (Pi) and amd64 alike.
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
