// Brevo transactional email. Best-effort: returns false (rather than throwing)
// when unconfigured — no BREVO_API_KEY / BREVO_SENDER_EMAIL — so callers can
// store-then-email and degrade gracefully if email isn't set up yet. The sender
// address must be a verified sender/domain in the Brevo account.
const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: { email: string; name?: string };
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return false;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Practa";

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        ...(replyTo ? { replyTo } : {}),
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) console.error("brevo send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (error) {
    console.error("brevo send error", error);
    return false;
  }
}
