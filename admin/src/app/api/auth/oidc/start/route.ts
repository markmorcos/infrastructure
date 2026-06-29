import { NextResponse } from "next/server";
import { serialize } from "cookie";
import {
  OIDC_ENABLED,
  OIDC_AUTHORIZE,
  OIDC_CLIENT_ID,
  OIDC_REDIRECT_URI,
  makePkce,
  randomState,
} from "@/lib/oidc";

export const runtime = "nodejs";

// Begin the PKCE Authorization Code flow: stash the verifier + state in short-lived
// cookies and redirect to Zitadel's authorize endpoint.
export async function GET() {
  if (!OIDC_ENABLED) {
    return NextResponse.json({ error: "oidc disabled" }, { status: 404 });
  }
  const { verifier, challenge } = makePkce();
  const state = randomState();

  const url = new URL(OIDC_AUTHORIZE);
  url.searchParams.set("client_id", OIDC_CLIENT_ID);
  url.searchParams.set("redirect_uri", OIDC_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  const opts = {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  res.headers.append("Set-Cookie", serialize("oidc_verifier", verifier, opts));
  res.headers.append("Set-Cookie", serialize("oidc_state", state, opts));
  return res;
}
