import * as Sentry from "@sentry/nextjs";

// Server-side Sentry (Node runtime). DSN is public by design; committed so the
// build needs no secret. Only reports from production to keep dev noise out.
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://7cdfa51871858c7265bf96aaeded22d1@o4511597371195392.ingest.de.sentry.io/4511597394657360",
  enabled: process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",
  tracesSampleRate: 0.1,
});
