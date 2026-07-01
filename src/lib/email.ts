import "server-only";

// Transactional email via Resend (REST API — no SDK dependency). Sends are a
// no-op (logged) until RESEND_API_KEY + EMAIL_FROM are set, so the app works
// before email is connected. Add a verified vakto.is domain in Resend, then set
// RESEND_API_KEY and EMAIL_FROM (e.g. "VAKTO <noreply@vakto.is>") in the env.

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "VAKTO <noreply@vakto.is>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";

export function emailConfigured(): boolean {
  return !!KEY;
}

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!KEY) {
    console.log(`[email] skipped (no RESEND_API_KEY): "${input.subject}" → ${input.to}`);
    return { ok: true, skipped: true };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [input.to], subject: input.subject, html: input.html }),
    });
    if (!r.ok) return { ok: false, error: `${r.status} ${await r.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email error" };
  }
}

/** Branded VAKTO email shell (inline styles for email-client compatibility). */
function template(opts: { heading: string; body: string; ctaLabel?: string; ctaHref?: string; preheader?: string }): string {
  const brand = "#e9700f";
  const btn = opts.ctaLabel && opts.ctaHref
    ? `<tr><td style="padding:8px 0 4px"><a href="${opts.ctaHref}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px">${opts.ctaLabel}</a></td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f4f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1f">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <tr><td style="background:${brand};padding:20px 26px">
        <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px">▉▉▉ VAKTO</span>
      </td></tr>
      <tr><td style="padding:28px 30px 8px">
        <h1 style="margin:0 0 10px;font-size:21px;font-weight:700;letter-spacing:-.3px">${opts.heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#3a3d47">${opts.body}</div>
      </td></tr>
      <tr><td style="padding:6px 30px 26px"><table role="presentation" cellpadding="0" cellspacing="0">${btn}</table></td></tr>
      <tr><td style="padding:16px 30px;border-top:1px solid #eceef2;font-size:12px;color:#9296a6">
        VAKTO · Vaktaplan, mæting, laun og arðsemi á einum stað · <a href="${APP_URL}" style="color:${brand};text-decoration:none">vakto.is</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

export async function sendWelcomeEmail(to: string, name: string, company: string) {
  const first = (name || "").split(/\s+/)[0] || "";
  return sendEmail({
    to,
    subject: "Velkomin í VAKTO",
    html: template({
      heading: `Velkomin${first ? ", " + first : ""}!`,
      preheader: "Aðgangurinn þinn að VAKTO er tilbúinn.",
      body: `Aðgangurinn fyrir <b>${company}</b> er tilbúinn. Settu upp fyrsta vaktaplanið, bættu við starfsfólki og sjáðu laun sem hlutfall af veltu í rauntíma.`,
      ctaLabel: "Opna VAKTO",
      ctaHref: `${APP_URL}/maelabord`,
    }),
  });
}

export async function sendInviteEmail(to: string, company: string, roleLabel: string, link: string) {
  return sendEmail({
    to,
    subject: `${company} bauð þér í VAKTO`,
    html: template({
      heading: "Þér var boðið í VAKTO",
      preheader: `${company} bauð þér aðgang.`,
      body: `<b>${company}</b> bauð þér aðgang að VAKTO sem <b>${roleLabel}</b>. Smelltu til að virkja aðganginn þinn og setja lykilorð.`,
      ctaLabel: "Virkja aðgang",
      ctaHref: link,
    }),
  });
}
