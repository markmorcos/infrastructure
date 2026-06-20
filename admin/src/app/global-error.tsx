"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Root error boundary — replaces the whole document if the root layout itself
// throws, so it renders its own <html>/<body>. Reports the error to Sentry.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f1a18", color: "#e6efec" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <h1 style={{ fontSize: 26, margin: "0 0 10px" }}>Something went wrong</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#9fb3ad", margin: "0 0 22px" }}>
              An unexpected error occurred. It has been reported.
            </p>
            <button
              onClick={reset}
              style={{ padding: "12px 22px", borderRadius: 12, border: "none", background: "#2f9e8f", color: "#06201c", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
