import * as Sentry from "@sentry/nextjs";

// Browser Sentry for the admin control plane: errors only. Performance tracing
// is off and tree-shaken via __SENTRY_TRACING__ in next.config to keep the
// client bundle small. Server-side tracing is unaffected. This file (vs the
// older sentry.client.config.ts) is the Turbopack-safe location Next loads.
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://7cdfa51871858c7265bf96aaeded22d1@o4511597371195392.ingest.de.sentry.io/4511597394657360",
  enabled: process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",
});

// Required by Next's client instrumentation hook. With client tracing disabled
// this tree-shakes to a noop; it just silences Sentry's setup notice.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
