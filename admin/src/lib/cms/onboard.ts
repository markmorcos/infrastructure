import { validKey, getSiteByKey } from "./admin";
import { sendEmail } from "@/lib/email";

// Shared bits for the public self-serve onboarding endpoints (/api/cms/v1/onboard).

// Subdomains the renderer reserves (mirrors practa src/lib/host.ts RESERVED) plus
// the apex label itself.
const RESERVED = new Set(["www", "admin", "api", "app", "cdn", "preview", "practa"]);

const BASE_DOMAIN = process.env.PRACTA_BASE_DOMAIN ?? "practa.co";
const ADMIN_URL = process.env.ADMIN_PUBLIC_URL ?? "https://admin.morcos.tech";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface KeyCheck {
  available: boolean;
  reason?: string;
}

// checkKey validates a desired subdomain key: shape, reserved words, uniqueness.
export async function checkKey(key: string): Promise<KeyCheck> {
  if (!key) return { available: false, reason: "required" };
  if (!validKey(key)) return { available: false, reason: "invalid" };
  if (RESERVED.has(key)) return { available: false, reason: "reserved" };
  if (await getSiteByKey(key)) return { available: false, reason: "taken" };
  return { available: true };
}

export interface OnboardInput {
  key: string;
  name: string;
  ownerEmail: string;
  brandColor?: string;
  calcomUrl?: string;
}

// validateOnboard returns a cleaned input or an error string (does not check key
// availability — call checkKey for that).
export function validateOnboard(
  body: Record<string, unknown>
): { input: OnboardInput } | { error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const key = str(body.key).toLowerCase();
  const name = str(body.name);
  const ownerEmail = str(body.ownerEmail || body.email);
  const brandColor = str(body.brandColor);
  const calcomUrl = str(body.calcomUrl);

  if (!name || name.length > 120) return { error: "name is required" };
  if (!EMAIL_RE.test(ownerEmail) || ownerEmail.length > 320) return { error: "a valid email is required" };
  if (!validKey(key)) return { error: "invalid subdomain" };
  if (brandColor && !HEX_RE.test(brandColor)) return { error: "brand color must be a 6-digit hex" };
  if (calcomUrl && !/^https?:\/\/\S+$/.test(calcomUrl)) return { error: "cal.com link must be a full URL" };

  return { input: { key, name, ownerEmail, brandColor: brandColor || undefined, calcomUrl: calcomUrl || undefined } };
}

export function siteUrl(key: string): string {
  return `https://${key}.${BASE_DOMAIN}`;
}

// sendOnboardInvite emails a new owner a set-password link; for an existing
// account it just points them at sign-in. Best-effort (Resend may be unset).
export async function sendOnboardInvite(opts: {
  email: string;
  name: string;
  key: string;
  inviteToken?: string;
}): Promise<void> {
  const url = siteUrl(opts.key);
  const link = opts.inviteToken
    ? `${ADMIN_URL}/set-password?token=${encodeURIComponent(opts.inviteToken)}`
    : `${ADMIN_URL}/login`;
  const action = opts.inviteToken ? "Set your password" : "Sign in";
  await sendEmail({
    to: opts.email,
    subject: `Your site ${opts.name} is live`,
    html:
      `<p>Your website is live at <a href="${url}">${url.replace("https://", "")}</a>.</p>` +
      `<p>${opts.inviteToken ? "Choose a password to start editing it:" : "Sign in to manage it:"}</p>` +
      `<p><a href="${link}">${action}</a></p>` +
      `<p>It currently shows placeholder text — edit it, Preview your changes, then Publish.</p>`,
  });
}
