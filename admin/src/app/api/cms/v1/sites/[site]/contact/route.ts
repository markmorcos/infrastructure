import { NextRequest, NextResponse } from "next/server";
import { getSiteByKey } from "@/lib/cms/db";
import {
  insertContact,
  markContactEmailed,
  recentContactCount,
} from "@/lib/cms/contacts";
import { sendEmail } from "@/lib/email";

// Public contact-form intake for studio-rendered sites. The practa renderer
// proxies submissions here, injecting the trusted site key (derived from the
// request Host) and forwarding the visitor's IP / user-agent. Storage is the
// source of truth; the owner notification email is best-effort.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const RATE_WINDOW_SECONDS = 3600;
const RATE_MAX = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    // Honeypot: a hidden field real users never fill. Pretend success so bots
    // don't learn they were filtered, but store nothing.
    if (str(body.company)) return json({ ok: true }, 200);

    const site = await getSiteByKey(siteKey);
    if (!site) return json({ error: "not found" }, 404);

    const name = str(body.name);
    const email = str(body.email);
    const phone = str(body.phone);
    const message = str(body.message);
    const locale = str(body.locale);
    const consent = body.consent === true;

    const errors: string[] = [];
    if (!name || name.length > 200) errors.push("name");
    if (!email || email.length > 320 || !EMAIL_RE.test(email)) errors.push("email");
    if (phone.length > 50) errors.push("phone");
    if (!message || message.length > 5000) errors.push("message");
    if (!consent) errors.push("consent");
    if (errors.length) return json({ error: "validation", fields: errors }, 422);

    const ip = clientIp(req);
    if (ip && (await recentContactCount(site.id, ip, RATE_WINDOW_SECONDS)) >= RATE_MAX) {
      return json({ error: "rate limited" }, 429);
    }

    const id = await insertContact({
      siteId: site.id,
      name,
      email,
      phone,
      message,
      locale,
      ip,
      userAgent: req.headers.get("user-agent") ?? "",
    });

    // Best-effort owner notification. Recipient comes from site settings; if
    // unset (or Brevo unconfigured) the submission is still stored.
    const settings = site.settings as Record<string, unknown>;
    const recipient = str(settings.contactEmail) || str(settings.email);
    if (recipient) {
      const sent = await sendEmail({
        to: recipient,
        replyTo: { email, name },
        subject: `New contact via ${site.name || site.key}`,
        html:
          `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
          `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
          (phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : "") +
          `<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
      });
      if (sent) await markContactEmailed(id);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error(error);
    return json({ error: "internal error" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
