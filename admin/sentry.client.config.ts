import * as Sentry from "@sentry/nextjs";

// Browser Sentry for the admin control plane.
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://7cdfa51871858c7265bf96aaeded22d1@o4511597371195392.ingest.de.sentry.io/4511597394657360",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
});
