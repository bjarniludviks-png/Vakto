import "server-only";

// Transactional email via Resend (REST API — no SDK dependency). Sends are a
// no-op (logged) until RESEND_API_KEY + EMAIL_FROM are set, so the app works
// before email is connected. All emails are bilingual: Icelandic first, a
// compact English section below (standard practice for Icelandic workplaces).

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "VAKTO <no-reply@vakto.is>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "help@vakto.is";
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
      body: JSON.stringify({ from: FROM, to: [input.to], reply_to: REPLY_TO, subject: input.subject, html: input.html }),
    });
    if (!r.ok) return { ok: false, error: `${r.status} ${await r.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email error" };
  }
}

/* ============================================================
   The VAKTO email shell — brand bars logo (email-safe table cells),
   dark-on-light card, orange CTA, Icelandic first + English below.
   Inline styles only; tested layout patterns for Apple Mail/Gmail/Outlook.
   ============================================================ */

type Bilingual = {
  preheader: string;
  heading: string;
  body: string; // IS, may contain <b>/<a>
  headingEn: string;
  bodyEn: string;
  ctaLabel?: string;
  ctaLabelEn?: string;
  ctaHref?: string;
};

function template(o: Bilingual): string {
  const brand = "#e9700f";
  const bars = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;vertical-align:middle"><tr>
      <td style="width:7px"></td>
      <td valign="bottom" style="padding-right:3px"><div style="width:7px;height:12px;border-radius:3px;background:#ffd9ae"></div></td>
      <td valign="bottom" style="padding-right:3px"><div style="width:7px;height:19px;border-radius:3px;background:#ffedd9"></div></td>
      <td valign="bottom"><div style="width:7px;height:26px;border-radius:3px;background:#ffffff"></div></td>
    </tr></table>`;
  const btn = (label: string | undefined, href: string | undefined, small = false) =>
    label && href
      ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${brand}">
           <a href="${href}" style="display:inline-block;color:#fff;text-decoration:none;font-weight:700;font-size:${small ? "13px" : "15px"};padding:${small ? "10px 18px" : "13px 26px"};border-radius:12px;letter-spacing:-.2px">${label}</a>
         </td></tr></table>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1f">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 12px">
  <tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%">

      <!-- header card -->
      <tr><td style="background:linear-gradient(115deg,${brand},#f59331);border-radius:18px 18px 0 0;padding:22px 30px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle">${bars}<span style="color:#fff;font-size:21px;font-weight:800;letter-spacing:2px;vertical-align:middle;padding-left:11px">VAKTO</span></td>
          <td align="right" valign="middle"><span style="color:rgba(255,255,255,.85);font-size:11px;letter-spacing:.14em;font-weight:600">VAKTAPLAN&nbsp;·&nbsp;LAUN</span></td>
        </tr></table>
      </td></tr>

      <!-- body card -->
      <tr><td style="background:#ffffff;padding:34px 34px 10px">
        <h1 style="margin:0 0 12px;font-size:23px;font-weight:750;letter-spacing:-.4px;line-height:1.25">${o.heading}</h1>
        <div style="font-size:15px;line-height:1.65;color:#3a3d47">${o.body}</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:22px 34px 30px">${btn(o.ctaLabel, o.ctaHref)}</td></tr>

      <!-- english section -->
      <tr><td style="background:#fbfbfc;border-top:1px solid #eef0f3;padding:24px 34px 26px">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:.14em;color:#9296a6;margin-bottom:8px">ENGLISH</div>
        <div style="font-size:14px;font-weight:700;letter-spacing:-.2px;margin-bottom:6px">${o.headingEn}</div>
        <div style="font-size:13.5px;line-height:1.6;color:#5f6470">${o.bodyEn}</div>
        ${o.ctaLabelEn && o.ctaHref ? `<div style="padding-top:14px">${btn(o.ctaLabelEn, o.ctaHref, true)}</div>` : ""}
      </td></tr>

      <!-- footer -->
      <tr><td style="background:#ffffff;border-radius:0 0 18px 18px;border-top:1px solid #eef0f3;padding:18px 34px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:12px;color:#9296a6;line-height:1.6">
            VAKTO · Vaktaplan, mæting og laun á einum stað<br>
            <a href="${APP_URL}" style="color:${brand};text-decoration:none;font-weight:600">vakto.is</a>
            &nbsp;·&nbsp; <a href="mailto:${REPLY_TO}" style="color:#9296a6;text-decoration:none">${REPLY_TO}</a>
          </td>
        </tr></table>
      </td></tr>

    </table>
  </td></tr>
</table></body></html>`;
}

/** Branded shell for automatic reports (digest emails) — same VAKTO design. */
export function brandedReportHtml(o: { preheader: string; heading: string; innerHtml: string }): string {
  return template({
    preheader: o.preheader,
    heading: o.heading,
    body: o.innerHtml,
    headingEn: "Automatic VAKTO report",
    bodyEn: "This report was generated automatically by VAKTO. See details and charts in Insights on vakto.is.",
    ctaLabel: "Opna Innsýn",
    ctaLabelEn: "Open Insights",
    ctaHref: `${APP_URL}/innsyn`,
  });
}

/* ---------- the emails ---------- */

export async function sendWelcomeEmail(to: string, name: string, company: string) {
  const first = (name || "").split(/\s+/)[0] || "";
  return sendEmail({
    to,
    subject: "Velkomin í VAKTO / Welcome to VAKTO",
    html: template({
      preheader: "Aðgangurinn þinn að VAKTO er tilbúinn.",
      heading: `Velkomin${first ? ", " + first : ""}!`,
      body: `Aðgangurinn fyrir <b>${company}</b> er tilbúinn. Settu upp fyrsta vaktaplanið, bættu við starfsfólki og sjáðu laun sem hlutfall af veltu í rauntíma.`,
      headingEn: "Welcome to VAKTO",
      bodyEn: `Your account for <b>${company}</b> is ready. Build your first schedule, add your team, and watch labor cost as a share of revenue — live.`,
      ctaLabel: "Opna VAKTO",
      ctaLabelEn: "Open VAKTO",
      ctaHref: `${APP_URL}/maelabord`,
    }),
  });
}

export async function sendInviteEmail(to: string, company: string, roleLabel: string, link: string) {
  return sendEmail({
    to,
    subject: `${company} bauð þér í VAKTO / You're invited to VAKTO`,
    html: template({
      preheader: `${company} bauð þér aðgang að VAKTO.`,
      heading: "Þér var boðið í VAKTO",
      body: `<b>${company}</b> bauð þér aðgang að VAKTO sem <b>${roleLabel}</b>. Þar sérðu vaktirnar þínar, stimplar þig inn og út, sækir um frí og spjallar við teymið — í símanum eða tölvunni. Smelltu á hnappinn til að virkja aðganginn og velja lykilorð.`,
      headingEn: "You've been invited to VAKTO",
      bodyEn: `<b>${company}</b> invited you to VAKTO (${roleLabel}). See your shifts, clock in and out, request time off and chat with your team — on your phone or computer. Click to activate your account and choose a password.`,
      ctaLabel: "Virkja aðganginn minn",
      ctaLabelEn: "Activate my account",
      ctaHref: link,
    }),
  });
}

/** 6 stafa staðfestingarkóði við nýskráningu (gildir í 15 mín). */
export async function sendVerificationCodeEmail(to: string, code: string) {
  const pretty = `${code.slice(0, 3)} ${code.slice(3)}`;
  const box = `<div style="margin:18px 0 6px;font-size:34px;font-weight:700;letter-spacing:10px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#1a1a1f">${pretty}</div>`;
  return sendEmail({
    to,
    subject: `${code} er staðfestingarkóðinn þinn / your VAKTO code`,
    html: template({
      preheader: `Staðfestingarkóði: ${code}`,
      heading: "Staðfestu netfangið þitt",
      body: `Sláðu þennan kóða inn í nýskráningarglugganum. Hann gildir í 15 mínútur.${box}Ef þú varst ekki að stofna aðgang í VAKTO máttu hunsa póstinn.`,
      headingEn: "Confirm your email",
      bodyEn: `Enter this code in the signup window. It is valid for 15 minutes.${box}If you weren't creating a VAKTO account, ignore this email.`,
      ctaLabel: "Opna nýskráningu",
      ctaLabelEn: "Open signup",
      ctaHref: `${APP_URL}/nyskraning`,
    }),
  });
}

export async function sendResetEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: "Endursetja lykilorð / Reset your password — VAKTO",
    html: template({
      preheader: "Endursetja lykilorð í VAKTO.",
      heading: "Endursetja lykilorðið þitt",
      body: "Beðið var um að endursetja lykilorðið þitt í VAKTO. Smelltu á hnappinn til að velja nýtt. Ef þú baðst ekki um þetta máttu hunsa póstinn — lykilorðið þitt helst óbreytt.",
      headingEn: "Reset your password",
      bodyEn: "A password reset was requested for your VAKTO account. Click to choose a new one. If this wasn't you, ignore this email — your password stays unchanged.",
      ctaLabel: "Velja nýtt lykilorð",
      ctaLabelEn: "Choose a new password",
      ctaHref: link,
    }),
  });
}

export async function sendSchedulePublishedEmail(to: string, name: string, company: string) {
  const first = (name || "").split(/\s+/)[0] || "";
  return sendEmail({
    to,
    subject: "Nýtt vaktaplan / New schedule — VAKTO",
    html: template({
      preheader: `${company} birti nýtt vaktaplan.`,
      heading: `Vaktaplanið þitt er komið${first ? ", " + first : ""}`,
      body: `<b>${company}</b> birti nýtt vaktaplan. Opnaðu Mitt svæði til að sjá vaktirnar þínar.`,
      headingEn: "Your new schedule is out",
      bodyEn: `<b>${company}</b> published a new schedule. Open My area to see your shifts.`,
      ctaLabel: "Sjá vaktirnar mínar",
      ctaLabelEn: "See my shifts",
      ctaHref: `${APP_URL}/mitt-svaedi`,
    }),
  });
}

export async function sendStillWorkingEmail(to: string, name: string) {
  const first = (name || "").split(/\s+/)[0] || "";
  return sendEmail({
    to,
    subject: "Ertu enn að vinna? / Still working? — VAKTO",
    html: template({
      preheader: "Opin stimplun í meira en 12 klst.",
      heading: `Ertu enn að vinna${first ? ", " + first : ""}?`,
      body: "Þú hefur verið <b>stimplað/ur inn í meira en 12 klukkustundir</b>. Ef þú gleymdir að stimpla þig út skaltu laga það í Mitt svæði — eða biðja vaktstjórann um leiðréttingu.",
      headingEn: "Still on the clock?",
      bodyEn: "You've been <b>clocked in for more than 12 hours</b>. If you forgot to clock out, fix it in My area — or ask your manager for a correction.",
      ctaLabel: "Opna Mitt svæði",
      ctaLabelEn: "Open My area",
      ctaHref: `${APP_URL}/mitt-svaedi`,
    }),
  });
}

export async function sendContractEmail(to: string, name: string, company: string) {
  const first = (name || "").split(/\s+/)[0] || "";
  return sendEmail({
    to,
    subject: "Ráðningarsamningur til undirritunar / Contract to sign — VAKTO",
    html: template({
      preheader: `${company} sendi þér ráðningarsamning.`,
      heading: `Samningurinn þinn er tilbúinn${first ? ", " + first : ""}`,
      body: `<b>${company}</b> sendi þér ráðningarsamning. Opnaðu Mitt svæði, lestu hann yfir og samþykktu rafrænt — það tekur mínútu.`,
      headingEn: "Your contract is ready",
      bodyEn: `<b>${company}</b> sent you an employment contract. Open My area, read it through and sign electronically — it takes a minute.`,
      ctaLabel: "Lesa og samþykkja",
      ctaLabelEn: "Read and sign",
      ctaHref: `${APP_URL}/mitt-svaedi`,
    }),
  });
}

export async function sendContractSignedEmail(to: string, employeeName: string) {
  return sendEmail({
    to,
    subject: `${employeeName} undirritaði samninginn / signed the contract — VAKTO`,
    html: template({
      preheader: `${employeeName} samþykkti ráðningarsamninginn rafrænt.`,
      heading: "Samningur undirritaður",
      body: `<b>${employeeName}</b> samþykkti ráðningarsamninginn rafrænt í VAKTO. Undirritað eintak með tímastimpli er í skjalasafni starfsmannsins.`,
      headingEn: "Contract signed",
      bodyEn: `<b>${employeeName}</b> signed the employment contract electronically in VAKTO. The signed, timestamped copy is in the employee's documents.`,
      ctaLabel: "Opna starfsmannaspjald",
      ctaLabelEn: "Open employee profile",
      ctaHref: `${APP_URL}/starfsfolk`,
    }),
  });
}

export async function sendLeaveDecisionEmail(to: string, name: string, approved: boolean) {
  const first = (name || "").split(/\s+/)[0] || "";
  return sendEmail({
    to,
    subject: approved ? "Fríbeiðnin samþykkt / Time off approved — VAKTO" : "Fríbeiðnin afgreidd / Time off request decided — VAKTO",
    html: template({
      preheader: approved ? "Fríbeiðnin þín var samþykkt." : "Fríbeiðninni þinni var hafnað.",
      heading: approved ? `Samþykkt${first ? ", " + first : ""}!` : "Beiðninni var hafnað",
      body: approved
        ? "Fríbeiðnin þín var <b>samþykkt</b>. Vaktaplanið tekur mið af fríinu — sjáðu stöðuna í Mitt svæði."
        : "Fríbeiðninni þinni var <b>hafnað</b> að þessu sinni. Talaðu við vaktstjórann þinn ef þú vilt ræða það — eða sendu nýja beiðni fyrir annað tímabil.",
      headingEn: approved ? "Time off approved" : "Request declined",
      bodyEn: approved
        ? "Your time-off request was <b>approved</b>. The schedule reflects it — see the details in My area."
        : "Your time-off request was <b>declined</b> this time. Talk to your manager, or submit a new request for different dates.",
      ctaLabel: "Opna Mitt svæði",
      ctaLabelEn: "Open My area",
      ctaHref: `${APP_URL}/mitt-svaedi`,
    }),
  });
}

/* ---------- áskrift & greiðslur (Straumur) ---------- */
const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kr.`;

export async function sendTrialReminderEmail(to: string, company: string, o: { daysLeft: number; hasCard: boolean; total: number; users: number }) {
  const when = o.daysLeft <= 0 ? "í dag" : o.daysLeft === 1 ? "á morgun" : `eftir ${o.daysLeft} daga`;
  return sendEmail({
    to,
    subject: `Prufan hjá ${company} rennur út ${when}`,
    html: template({
      preheader: "Áskriftin heldur áfram sjálfkrafa ef kort er skráð.",
      heading: `Prufan rennur út ${when}`,
      body: o.hasCard
        ? `14 daga prufan fyrir <b>${company}</b> er að ljúka. Áskriftin heldur áfram sjálfkrafa: fyrsta mánaðargjaldið, <b>${kr(o.total)}</b> með VSK fyrir ${o.users} notendur, verður tekið af skráða kortinu á gjalddaga. Þú getur sagt upp hvenær sem er í Stillingum → Áskrift.`
        : `14 daga prufan fyrir <b>${company}</b> er að ljúka og ekkert kort er skráð. Skráðu kort í Stillingum → Áskrift til að halda áfram; annars lokast aðgangurinn 14 dögum eftir lok prufu. Mánaðargjaldið yrði <b>${kr(o.total)}</b> með VSK fyrir ${o.users} notendur.`,
      headingEn: `Your trial ends ${o.daysLeft <= 0 ? "today" : o.daysLeft === 1 ? "tomorrow" : `in ${o.daysLeft} days`}`,
      bodyEn: o.hasCard
        ? `The 14-day trial for <b>${company}</b> is ending. Your subscription continues automatically: the first monthly charge, <b>${kr(o.total)}</b> incl. VAT for ${o.users} users, will be taken from the card on file. Cancel any time in Settings → Subscription.`
        : `The 14-day trial for <b>${company}</b> is ending and no card is on file. Add a card in Settings → Subscription to continue; otherwise access closes 14 days after the trial ends.`,
      ctaLabel: "Opna Áskrift", ctaLabelEn: "Open Subscription", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendCardMissingEmail(to: string, company: string, why: "expired" | "disabled") {
  return sendEmail({
    to,
    subject: why === "disabled" ? `Kortið hjá ${company} er ekki lengur virkt` : `Prufan hjá ${company} er búin — skráðu kort`,
    html: template({
      preheader: "Skráðu kort til að halda VAKTO opnu.",
      heading: why === "disabled" ? "Kortið er ekki lengur virkt" : "Prufan er búin",
      body: `${why === "disabled" ? "Skráða kortið fyrir" : "14 daga prufan fyrir"} <b>${company}</b> ${why === "disabled" ? "er ekki lengur gilt" : "er lokið og ekkert kort er skráð"}. Skráðu kort í Stillingum → Áskrift svo áskriftin haldi áfram. Aðgangurinn lokast 14 dögum síðar ef ekkert kort er skráð, en gögnin þín eru geymd.`,
      headingEn: why === "disabled" ? "Your card is no longer valid" : "Your trial has ended",
      bodyEn: `Add a card in Settings → Subscription to keep <b>${company}</b> running. Access closes 14 days later if no card is on file; your data is kept.`,
      ctaLabel: "Skrá kort", ctaLabelEn: "Add a card", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendReceiptEmail(to: string, company: string, o: { total: number; periodStart: string; periodEnd: string }) {
  return sendEmail({
    to,
    subject: `Kvittun: VAKTO áskrift ${company} — ${kr(o.total)}`,
    html: template({
      preheader: "Mánaðargjaldið var tekið af skráða kortinu.",
      heading: "Takk fyrir",
      body: `Mánaðargjald VAKTO fyrir <b>${company}</b>, tímabilið ${o.periodStart} – ${o.periodEnd}, <b>${kr(o.total)}</b> með VSK, var tekið af skráða kortinu. Reikninginn finnurðu í Stillingum → Áskrift. VAKTO ehf., kt. 490806-0400.`,
      headingEn: "Thank you",
      bodyEn: `The VAKTO monthly fee for <b>${company}</b>, ${o.periodStart} – ${o.periodEnd}, <b>${kr(o.total)}</b> incl. VAT, was charged to the card on file. Invoices are in Settings → Subscription.`,
      ctaLabel: "Sjá reikninga", ctaLabelEn: "View invoices", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendPaymentFailedEmail(to: string, company: string, total: number) {
  return sendEmail({
    to,
    subject: `Greiðsla tókst ekki — VAKTO áskrift ${company}`,
    html: template({
      preheader: "Við reynum aftur næstu daga. Athugaðu kortið.",
      heading: "Greiðslan tókst ekki",
      body: `Ekki tókst að taka <b>${kr(total)}</b> af skráða kortinu fyrir <b>${company}</b>. Við reynum aftur næstu þrjá daga. Ef kortið er útrunnið eða lokað, skráðu nýtt kort í Stillingum → Áskrift. Aðgangurinn lokast ef greiðsla berst ekki innan 14 daga.`,
      headingEn: "Payment failed",
      bodyEn: `We could not charge <b>${kr(total)}</b> to the card on file for <b>${company}</b>. We will retry over the next three days. If the card has expired or been blocked, add a new one in Settings → Subscription.`,
      ctaLabel: "Skoða kort", ctaLabelEn: "Check card", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendSuspendedEmail(to: string, company: string) {
  return sendEmail({
    to,
    subject: `Aðgangi ${company} að VAKTO hefur verið lokað`,
    html: template({
      preheader: "Skráðu kort til að opna aftur — gögnin eru geymd.",
      heading: "Aðganginum hefur verið lokað",
      body: `Greiðsla fyrir <b>${company}</b> hefur ekki borist og aðganginum hefur verið lokað tímabundið. Gögnin þín eru geymd í 90 daga. Skráðu kort eða hafðu samband á hallo@vakto.is og við opnum strax aftur.`,
      headingEn: "Access has been suspended",
      bodyEn: `Payment for <b>${company}</b> has not been received and access is temporarily suspended. Your data is kept for 90 days. Add a card or contact hallo@vakto.is and we will reopen right away.`,
      ctaLabel: "Hafa samband", ctaLabelEn: "Contact us", ctaHref: "mailto:hallo@vakto.is",
    }),
  });
}
