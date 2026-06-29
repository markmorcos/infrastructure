"use client";

import AuthScreen from "../auth/AuthScreen";

// OIDC (Zitadel) is the only login method. The email/password route
// (/api/auth/login) is retained as undocumented break-glass access in case OIDC
// is ever unavailable, but it is no longer exposed in the UI.
export default function LoginPage() {
  return (
    <AuthScreen
      title="Sign in"
      sub="Access your control plane."
      oidcHref="/api/auth/oidc/start"
      oidcOnly
    />
  );
}
