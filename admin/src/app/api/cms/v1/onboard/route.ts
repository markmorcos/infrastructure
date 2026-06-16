import { NextRequest, NextResponse } from "next/server";
import { spawnSite } from "@/lib/cms/spawn";
import { signInviteToken } from "@/lib/cms/authz";
import {
  checkKey,
  validateOnboard,
  sendOnboardInvite,
  siteUrl,
} from "@/lib/cms/onboard";

// Public self-serve onboarding. The one public write path, so it is strictly
// validated and IP rate-limited. Spawns the site, then best-effort emails the
// owner an invite to set their password.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: CORS });

// In-memory per-IP sliding window. Admin runs single-replica, so this is enough
// to blunt abuse; persistent/cluster-wide limiting can come later.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (rateLimited(ip)) return json({ error: "rate limited" }, 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const validated = validateOnboard(body);
  if ("error" in validated) return json({ error: validated.error }, 422);
  const input = validated.input;

  const avail = await checkKey(input.key);
  if (!avail.available) return json({ error: `subdomain ${avail.reason}` }, 409);

  try {
    const result = await spawnSite(input);
    const inviteToken = result.isNewOwner
      ? signInviteToken(result.ownerUserId, input.ownerEmail)
      : undefined;
    await sendOnboardInvite({
      email: input.ownerEmail,
      name: input.name,
      key: input.key,
      inviteToken,
    });
    return json({ ok: true, siteUrl: siteUrl(input.key), email: input.ownerEmail }, 200);
  } catch (error) {
    console.error("onboard spawn failed", error);
    return json({ error: "could not create site" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
