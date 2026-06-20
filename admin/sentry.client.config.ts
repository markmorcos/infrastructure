import * as Sentry from "@sentry/nextjs";

// Browser Sentry for the admin control plane: errors only. Performance tracing
// is off and tree-shaken via __SENTRY_TRACING__ in next.config to keep the
// client bundle small. Server-side tracing is unaffected.
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://7cdfa51871858c7265bf96aaeded22d1@o4511597371195392.ingest.de.sentry.io/4511597394657360",
  enabled: process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",
});
