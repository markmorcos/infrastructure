# syntax=docker/dockerfile:1

# Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (not ci) so a lockfile generated on another platform — missing
# that platform's optional deps, e.g. @emnapi/* on Linux — doesn't hard-fail the
# build. ci's strict in-sync check breaks on cross-platform locks.
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Persist Next's incremental build cache so unchanged routes aren't recompiled.
# Call `next build` directly (not `npm run build`, whose `clean` does `rm -rf
# .next` and fails on the mounted .next/cache — and a fresh container has
# nothing stale to clean anyway).
RUN --mount=type=cache,target=/app/.next/cache npx next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "start"]
