import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

// No authToken → source-map upload is skipped (DSN-only setup). silent keeps
// the build log clean.
export default withSentryConfig(nextConfig, { silent: true });
