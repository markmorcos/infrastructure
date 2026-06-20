import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Tree-shake Sentry's performance/tracing code out of the CLIENT bundle only
  // (errors-only on the browser). The server build keeps tracing.
  webpack(config, { webpack, isServer }) {
    if (!isServer) {
      config.plugins.push(new webpack.DefinePlugin({ __SENTRY_TRACING__: false }));
    }
    return config;
  },
};

// No authToken → source-map upload is skipped (DSN-only setup). silent keeps
// the build log clean.
export default withSentryConfig(nextConfig, { silent: true });
