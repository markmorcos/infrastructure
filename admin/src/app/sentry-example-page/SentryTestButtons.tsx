"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";

// Manual verification UI for Sentry. Only reachable in dev or when
// NEXT_PUBLIC_SENTRY_DEBUG=1 (the page gates it server-side).
export function SentryTestButtons() {
  const [msg, setMsg] = React.useState("");

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24, background: "#0f1a18", color: "#e6efec" }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Sentry test (infrastructure)</h1>
      <p style={{ color: "#9fb3ad", fontSize: 14, margin: 0 }}>Trigger an error, then check the infrastructure project in Sentry.</p>
      <button
        onClick={() => {
          Sentry.captureException(new Error("Sentry frontend test (infrastructure)"));
          setMsg("Client error sent → check Sentry Issues.");
        }}
        style={{ padding: "12px 22px", borderRadius: 10, border: "none", background: "#2f9e8f", color: "#06201c", fontWeight: 600, cursor: "pointer" }}
      >
        Send client error
      </button>
      <button
        onClick={async () => {
          const res = await fetch("/api/sentry-example");
          setMsg(res.ok ? "Server error sent → check Sentry Issues." : "Server route returned " + res.status);
        }}
        style={{ padding: "12px 22px", borderRadius: 10, border: "1px solid #2f9e8f", background: "transparent", color: "#2f9e8f", fontWeight: 600, cursor: "pointer" }}
      >
        Send server error
      </button>
      {msg && <p style={{ fontSize: 14, color: "#7fe0d0" }}>{msg}</p>}
    </main>
  );
}
