// Resend transactional email. Best-effort: returns false (rather than throwing)
// when unconfigured — no RESEND_API_KEY / RESEND_SENDER_EMAIL — so callers can
// store-then-email and degrade gracefully if email isn't set up yet. The sender
// address must belong to a domain verified in the Resend account.
const RESEND_API = "https://api.resend.com/emails";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: { email: string; name?: string };
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.RESEND_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return false;
  const senderName = process.env.RESEND_SENDER_NAME ?? "Practa";

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        ...(replyTo ? { reply_to: replyTo.email } : {}),
        subject,
        html,
      }),
    });
    if (!res.ok) console.error("resend send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (error) {
    console.error("resend send error", error);
    return false;
  }
}
