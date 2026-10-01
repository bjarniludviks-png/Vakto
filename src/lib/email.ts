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

export async function sendEmail(input: { to: string; subject: string; html: string; attachments?: { filename: string; content: string }[] }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (process.env.EMAIL_PREVIEW === "1") {
    ((globalThis as { __emailPreview?: unknown[] }).__emailPreview ??= []).push(input);
    return { ok: true, skipped: true };
  }
  if (!KEY) {
    console.log(`[email] skipped (no RESEND_API_KEY): "${input.subject}" → ${input.to}`);
    return { ok: true, skipped: true };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [input.to], reply_to: REPLY_TO, subject: input.subject, html: input.html, ...(input.attachments?.length ? { attachments: input.attachments } : {}) }),
    });
    if (!r.ok) return { ok: false, error: `${r.status} ${await r.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email error" };
  }
}

/* ============================================================
   VAKTO-póstskelin (okt. 2026) — sama útlit og vakto.is: ljós grunnur, eitt hvítt spjald,
   stór fyrirsögn, appelsínugulur pilluhnappur. Íslenska fyrst, stuttur enskur kafli fyrir neðan.
   Aðeins inline-stílar og töflur (Apple Mail, Gmail, Outlook). Valkvætt: kóði, upplýsingalínur, auka-HTML.
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
  /** Stór kóði í kassa (staðfestingarkóðar). */
  code?: string;
  /** Upplýsingalínur (merki, gildi) undir textanum — t.d. upphæð og tímabil. */
  rows?: [string, string][];
  rowsEn?: [string, string][];
  /** Auka-HTML í spjaldið (t.d. tafla í sjálfvirkum skýrslum). */
  extraHtml?: string;
};

const BRAND = "#e9700f";
const INK = "#1d1d1f";
const TEXT = "#424245";
const MUTED = "#6e6e73";
const FAINT = "#86868b";
const LINE = "#ececf0";
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const logo = (size = 1) => {
  const w = Math.round(5 * size), g = Math.round(3 * size);
  const bar = (h: number, pad: number) => `<td valign="bottom" style="padding-right:${pad}px"><div style="width:${w}px;height:${Math.round(h * size)}px;border-radius:2px;background:${BRAND}"></div></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;vertical-align:middle"><tr>${bar(9, g)}${bar(14, g)}${bar(19, 0)}</tr></table>` +
    `<span style="font-size:${Math.round(16 * size)}px;font-weight:700;letter-spacing:${(1.6 * size).toFixed(1)}px;color:${INK};vertical-align:middle;padding-left:${Math.round(8 * size)}px">VAKTO</span>`;
};

const pill = (label: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${BRAND}">
     <a href="${href}" style="display:inline-block;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:20px;padding:15px 30px;border-radius:999px">${label}</a>
   </td></tr></table>`;

const codeBox = (code: string) => {
  const pretty = code.length === 6 ? `${code.slice(0, 3)}&nbsp;${code.slice(3)}` : code;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 6px"><tr>
    <td align="center" style="background:#f5f5f7;border-radius:16px;padding:22px 12px;font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:38px;font-weight:700;letter-spacing:10px;color:${INK}">${pretty}</td>
  </tr></table>`;
};

const rowsTable = (rows: [string, string][], small = false) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:${small ? "14px 0 0" : "26px 0 0"}">${rows.map(([k, v], i) =>
    `<tr>
      <td style="padding:${small ? "8px" : "13px"} 16px ${small ? "8px" : "13px"} 0;border-top:1px solid ${i === 0 ? LINE : "#f2f2f5"};font-size:${small ? 13 : 15}px;color:${MUTED};white-space:nowrap;vertical-align:top">${k}</td>
      <td align="right" style="padding:${small ? "8px" : "13px"} 0;border-top:1px solid ${i === 0 ? LINE : "#f2f2f5"};font-size:${small ? 13 : 15}px;font-weight:600;color:${INK};font-variant-numeric:tabular-nums">${v}</td>
    </tr>`).join("")}</table>`;

function template(o: Bilingual): string {
  return `<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<style>
  @media (max-width:540px){ .vk-card{padding:32px 24px 30px!important} .vk-h1{font-size:26px!important} .vk-en{padding:22px 24px 0!important} .vk-pad{padding-left:4px!important;padding-right:4px!important} }
  a{color:${BRAND}}
</style></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:${FONT};color:${INK};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${o.preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7">
  <tr><td align="center" class="vk-pad" style="padding:40px 16px 48px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <tr><td style="padding:0 6px 22px"><a href="${APP_URL}" style="text-decoration:none">${logo()}</a></td></tr>

      <tr><td class="vk-card" style="background:#ffffff;border-radius:22px;padding:44px 44px 42px;border:1px solid ${LINE}">
        <h1 class="vk-h1" style="margin:0 0 14px;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-.6px;color:${INK}">${o.heading}</h1>
        <div style="font-size:16px;line-height:1.6;color:${TEXT}">${o.body}</div>
        ${o.code ? codeBox(o.code) : ""}
        ${o.rows?.length ? rowsTable(o.rows) : ""}
        ${o.extraHtml ?? ""}
        ${o.ctaLabel && o.ctaHref ? `<div style="padding-top:32px">${pill(o.ctaLabel, o.ctaHref)}</div>` : ""}
      </td></tr>

      <tr><td class="vk-en" style="padding:26px 44px 0">
        <div style="font-size:15px;font-weight:600;color:${INK};margin-bottom:6px">${o.headingEn}</div>
        <div style="font-size:14px;line-height:1.6;color:${MUTED}">${o.bodyEn}</div>
        ${o.rowsEn?.length ? rowsTable(o.rowsEn, true) : ""}
        ${o.ctaLabelEn && o.ctaHref ? `<div style="padding-top:12px"><a href="${o.ctaHref}" style="font-size:14px;font-weight:600;color:${BRAND};text-decoration:none">${o.ctaLabelEn}</a></div>` : ""}
      </td></tr>

      <tr><td style="padding:40px 44px 0;border:0">
        <div style="border-top:1px solid #e3e3e8;padding-top:22px;font-size:12px;line-height:1.7;color:${FAINT}">
          ${logo(0.8)}<br>
          <span style="display:inline-block;padding-top:8px">Vaktaplan, stimpilklukka og laun á einum stað.</span><br>
          BGL Ventures ehf. · kt. 490806-0400 ·
          <a href="${APP_URL}" style="color:${FAINT};text-decoration:underline">vakto.is</a> ·
          <a href="mailto:${REPLY_TO}" style="color:${FAINT};text-decoration:underline">${REPLY_TO}</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table></body></html>`;
}

/** Sjálfvirkar skýrslur (dag/viku/mánaðar) — tölur í línum og tafla per starfsmann. */
export function digestReportHtml(o: {
  company: string; label: string;
  planned: string; worked: string; deviation: string; deviationColor: string; cost: string;
  unscheduled: string; unscheduledWarn: boolean; open: string; openWarn: boolean;
  people: { name: string; plan: string; got: string; dev: string; devColor: string; unscheduled: boolean }[];
  more: number;
}): string {
  const th = `padding:0 0 8px;font-size:12px;font-weight:600;color:${FAINT};border-bottom:1px solid ${LINE}`;
  const td = `padding:10px 0;border-bottom:1px solid #f2f2f5;font-size:14px;font-variant-numeric:tabular-nums`;
  const people = o.people.length ? `
    <div style="font-size:15px;font-weight:600;color:${INK};margin:34px 0 10px">Tímar per starfsmann</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="${th}">Nafn</td><td align="right" style="${th}">Áætlað</td><td align="right" style="${th}">Unnið</td><td align="right" style="${th}">Frávik</td></tr>
      ${o.people.map((p) => `<tr>
        <td style="${td};color:${INK}">${p.name}${p.unscheduled ? ` <span style="font-size:12px;color:#a8741a">utan plans</span>` : ""}</td>
        <td align="right" style="${td};color:${MUTED}">${p.plan}</td>
        <td align="right" style="${td};font-weight:600;color:${INK}">${p.got}</td>
        <td align="right" style="${td};font-weight:600;color:${p.devColor}">${p.dev}</td></tr>`).join("")}
      ${o.more ? `<tr><td colspan="4" style="${td};color:${FAINT}">+ ${o.more} til viðbótar</td></tr>` : ""}
    </table>` : "";
  return template({
    preheader: `${o.company} · ${o.label}: ${o.worked} unnið, frávik ${o.deviation}`,
    heading: `${o.label}`,
    body: `Yfirlit fyrir <b>${o.company}</b>, reiknað úr vaktaplaninu og stimplunum.`,
    rows: [
      ["Áætlaðir tímar (vaktaplan)", o.planned],
      ["Unnir tímar", o.worked],
      ["Frávik", `<span style="color:${o.deviationColor}">${o.deviation}</span>`],
      ["Launakostnaður með gjöldum", o.cost],
      ["Stimplanir utan plans", o.unscheduledWarn ? `<span style="color:#a8741a">${o.unscheduled}</span>` : o.unscheduled],
      ["Opnar stimplanir", o.openWarn ? `<span style="color:#d8483a">${o.open}</span>` : o.open],
    ],
    extraHtml: people,
    headingEn: "Automatic VAKTO report",
    bodyEn: "Generated automatically from the schedule and clock-ins. See charts and details in Insights.",
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
      body: `Aðgangurinn fyrir <b>${company}</b> er tilbúinn. Settu upp fyrsta vaktaplanið, bættu við starfsfólki og fylgstu með launum sem hlutfalli af veltu í rauntíma.`,
      headingEn: "Welcome to VAKTO",
      bodyEn: `Your account for <b>${company}</b> is ready. Build your first schedule, add your team and follow labor cost as a share of revenue in real time.`,
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
      body: `<b>${company}</b> bauð þér aðgang að VAKTO sem <b>${roleLabel}</b>. Þar sérðu vaktirnar þínar, stimplar þig inn og út, sækir um frí og spjallar við teymið, í símanum eða tölvunni. Smelltu á hnappinn til að virkja aðganginn og velja lykilorð.`,
      headingEn: "You've been invited to VAKTO",
      bodyEn: `<b>${company}</b> invited you to VAKTO (${roleLabel}). See your shifts, clock in and out, request time off and chat with your team, on your phone or computer. Click to activate your account and choose a password.`,
      ctaLabel: "Virkja aðganginn minn",
      ctaLabelEn: "Activate my account",
      ctaHref: link,
    }),
  });
}

/** 6 stafa staðfestingarkóði við nýskráningu (gildir í 15 mín). */
export async function sendVerificationCodeEmail(to: string, code: string) {
  return sendEmail({
    to,
    subject: `${code} er staðfestingarkóðinn þinn / your VAKTO code`,
    html: template({
      preheader: `Staðfestingarkóði: ${code}`,
      heading: "Staðfestu netfangið þitt",
      body: "Sláðu þennan kóða inn í nýskráningarglugganum. Hann gildir í 15 mínútur. Ef þú varst ekki að stofna aðgang í VAKTO máttu hunsa póstinn.",
      code,
      headingEn: "Confirm your email",
      bodyEn: "Enter this code in the signup window. It is valid for 15 minutes. If you weren't creating a VAKTO account, you can ignore this email.",
    }),
  });
}

export async function sendResetEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: "Endursetja lykilorð / Reset your password",
    html: template({
      preheader: "Endursetja lykilorð í VAKTO.",
      heading: "Endursetja lykilorðið þitt",
      body: "Beðið var um að endursetja lykilorðið þitt í VAKTO. Smelltu á hnappinn til að velja nýtt. Ef þú baðst ekki um þetta máttu hunsa póstinn. Lykilorðið þitt helst óbreytt.",
      headingEn: "Reset your password",
      bodyEn: "A password reset was requested for your VAKTO account. Click to choose a new one. If this wasn't you, ignore this email. Your password stays unchanged.",
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
    subject: "Nýtt vaktaplan / New schedule",
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
    subject: "Ertu enn að vinna? / Still working?",
    html: template({
      preheader: "Opin stimplun í meira en 12 klst.",
      heading: `Ertu enn að vinna${first ? ", " + first : ""}?`,
      body: "Þú hefur verið <b>stimplað/ur inn í meira en 12 klukkustundir</b>. Ef þú gleymdir að stimpla þig út geturðu lagað það í Mitt svæði eða beðið vaktstjórann um leiðréttingu.",
      headingEn: "Still on the clock?",
      bodyEn: "You've been <b>clocked in for more than 12 hours</b>. If you forgot to clock out, fix it in My area or ask your manager for a correction.",
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
    subject: "Ráðningarsamningur til undirritunar / Contract to sign",
    html: template({
      preheader: `${company} sendi þér ráðningarsamning.`,
      heading: `Samningurinn þinn er tilbúinn${first ? ", " + first : ""}`,
      body: `<b>${company}</b> sendi þér ráðningarsamning. Opnaðu Mitt svæði, lestu hann yfir og undirritaðu rafrænt. Það tekur mínútu.`,
      headingEn: "Your contract is ready",
      bodyEn: `<b>${company}</b> sent you an employment contract. Open My area, read it through and sign electronically. It takes a minute.`,
      ctaLabel: "Lesa og samþykkja",
      ctaLabelEn: "Read and sign",
      ctaHref: `${APP_URL}/mitt-svaedi`,
    }),
  });
}

export async function sendContractSignedEmail(to: string, employeeName: string) {
  return sendEmail({
    to,
    subject: `${employeeName} undirritaði samninginn / signed the contract`,
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
    subject: approved ? "Fríbeiðnin samþykkt / Time off approved" : "Fríbeiðnin afgreidd / Time off request decided",
    html: template({
      preheader: approved ? "Fríbeiðnin þín var samþykkt." : "Fríbeiðninni þinni var hafnað.",
      heading: approved ? `Samþykkt${first ? ", " + first : ""}!` : "Beiðninni var hafnað",
      body: approved
        ? "Fríbeiðnin þín var <b>samþykkt</b>. Vaktaplanið tekur mið af fríinu. Sjáðu stöðuna í Mitt svæði."
        : "Fríbeiðninni þinni var <b>hafnað</b> að þessu sinni. Talaðu við vaktstjórann þinn ef þú vilt ræða það, eða sendu nýja beiðni fyrir annað tímabil.",
      headingEn: approved ? "Time off approved" : "Request declined",
      bodyEn: approved
        ? "Your time-off request was <b>approved</b>. The schedule reflects it. See the details in My area."
        : "Your time-off request was <b>declined</b> this time. Talk to your manager, or submit a new request for different dates.",
      ctaLabel: "Opna Mitt svæði",
      ctaLabelEn: "Open My area",
      ctaHref: `${APP_URL}/mitt-svaedi`,
    }),
  });
}

/* ---------- áskrift & greiðslur (Straumur) ---------- */
const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kr.`;

export async function sendTrialReminderEmail(to: string, company: string, o: { daysLeft: number; hasCard: boolean; total: number; note: string; noteEn: string }) {
  const when = o.daysLeft <= 0 ? "í dag" : o.daysLeft === 1 ? "á morgun" : `eftir ${o.daysLeft} daga`;
  return sendEmail({
    to,
    subject: `Prufan hjá ${company} rennur út ${when}`,
    html: template({
      preheader: "Áskriftin heldur áfram sjálfkrafa ef kort er skráð.",
      heading: `Prufan rennur út ${when}`,
      body: o.hasCard
        ? `14 daga prufan fyrir <b>${company}</b> er að ljúka. Áskriftin heldur áfram sjálfkrafa: fyrsta mánaðargjaldið, <b>${kr(o.total)}</b> með VSK (${o.note}), verður tekið af skráða kortinu á gjalddaga. Þú getur sagt upp hvenær sem er í Stillingum → Áskrift.`
        : `14 daga prufan fyrir <b>${company}</b> er að ljúka og ekkert kort er skráð. Skráðu kort í Stillingum → Áskrift til að halda áfram; annars lokast aðgangurinn 14 dögum eftir lok prufu. Mánaðargjaldið yrði <b>${kr(o.total)}</b> með VSK (${o.note}).`,
      headingEn: `Your trial ends ${o.daysLeft <= 0 ? "today" : o.daysLeft === 1 ? "tomorrow" : `in ${o.daysLeft} days`}`,
      bodyEn: o.hasCard
        ? `The 14-day trial for <b>${company}</b> is ending. Your subscription continues automatically: the first monthly charge, <b>${kr(o.total)}</b> incl. VAT (${o.noteEn}), will be taken from the card on file. Cancel any time in Settings → Subscription.`
        : `The 14-day trial for <b>${company}</b> is ending and no card is on file. Add a card in Settings → Subscription to continue; otherwise access closes 14 days after the trial ends.`,
      rows: [["Fyrirtæki", company], ["Prufan rennur út", when.charAt(0).toUpperCase() + when.slice(1)], ["Mánaðargjald með VSK", kr(o.total)], ["Kort skráð", o.hasCard ? "Já" : "Nei"]],
      ctaLabel: "Opna Áskrift", ctaLabelEn: "Open Subscription", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendCardMissingEmail(to: string, company: string, why: "expired" | "disabled") {
  return sendEmail({
    to,
    subject: why === "disabled" ? `Kortið hjá ${company} er ekki lengur virkt` : `Prufan hjá ${company} er búin. Skráðu kort`,
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
    subject: `Kvittun: VAKTO áskrift ${company}, ${kr(o.total)}`,
    html: template({
      preheader: "Mánaðargjaldið var tekið af skráða kortinu.",
      heading: "Takk fyrir greiðsluna",
      body: `Mánaðargjald VAKTO fyrir <b>${company}</b> var tekið af skráða kortinu. Reikninginn finnurðu í Stillingum → Áskrift.`,
      rows: [["Upphæð með VSK", kr(o.total)], ["Tímabil", `${o.periodStart} – ${o.periodEnd}`], ["Seljandi", "BGL Ventures ehf., kt. 490806-0400"]],
      headingEn: "Thank you",
      bodyEn: `The VAKTO monthly fee for <b>${company}</b>, ${o.periodStart} – ${o.periodEnd}, <b>${kr(o.total)}</b> incl. VAT, was charged to the card on file. Invoices are in Settings → Subscription.`,
      ctaLabel: "Sjá reikninga", ctaLabelEn: "View invoices", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendPaymentFailedEmail(to: string, company: string, total: number) {
  return sendEmail({
    to,
    subject: `Greiðsla tókst ekki: VAKTO áskrift ${company}`,
    html: template({
      preheader: "Við reynum aftur næstu daga. Athugaðu kortið.",
      heading: "Greiðslan tókst ekki",
      body: `Ekki tókst að taka <b>${kr(total)}</b> af skráða kortinu fyrir <b>${company}</b>. Við reynum aftur næstu þrjá daga. Ef kortið er útrunnið eða lokað, skráðu nýtt kort í Stillingum → Áskrift. Aðgangurinn lokast ef greiðsla berst ekki innan 14 daga.`,
      headingEn: "Payment failed",
      bodyEn: `We could not charge <b>${kr(total)}</b> to the card on file for <b>${company}</b>. We will retry over the next three days. If the card has expired or been blocked, add a new one in Settings → Subscription.`,
      rows: [["Upphæð með VSK", kr(total)], ["Næsta tilraun", "Á morgun"], ["Lokað ef ekki greitt", "Eftir 14 daga"]],
      ctaLabel: "Skoða kort", ctaLabelEn: "Check card", ctaHref: `${APP_URL}/stillingar?tab=askrift`,
    }),
  });
}

export async function sendSuspendedEmail(to: string, company: string) {
  return sendEmail({
    to,
    subject: `Aðgangi ${company} að VAKTO hefur verið lokað`,
    html: template({
      preheader: "Skráðu kort til að opna aftur. Gögnin eru geymd.",
      heading: "Aðganginum hefur verið lokað",
      body: `Greiðsla fyrir <b>${company}</b> hefur ekki borist og aðganginum hefur verið lokað tímabundið. Gögnin þín eru geymd í 90 daga. Skráðu kort eða hafðu samband á hallo@vakto.is og við opnum strax aftur.`,
      headingEn: "Access has been suspended",
      bodyEn: `Payment for <b>${company}</b> has not been received and access is temporarily suspended. Your data is kept for 90 days. Add a card or contact hallo@vakto.is and we will reopen right away.`,
      ctaLabel: "Hafa samband", ctaLabelEn: "Contact us", ctaHref: "mailto:hallo@vakto.is",
    }),
  });
}

/** 6 stafa kóði til að staðfesta rafræna undirritun ráðningarsamnings (0058). */
export async function sendContractCodeEmail(to: string, code: string, company: string) {
  return sendEmail({
    to,
    subject: `${code} er kóðinn til að undirrita samninginn / code to sign your contract`,
    html: template({
      preheader: `Undirritunarkóði: ${code}`,
      heading: "Staðfestu undirritunina",
      body: `Sláðu þennan kóða inn til að undirrita ráðningarsamninginn við <b>${company}</b>. Hann gildir í 10 mínútur. Ef þú baðst ekki um kóðann skaltu ekki nota hann og láta vinnuveitandann vita.`,
      code,
      headingEn: "Confirm your signature",
      bodyEn: `Enter this code to sign your employment contract with <b>${company}</b>. It is valid for 10 minutes. If you didn't request it, don't use it and tell your employer.`,
    }),
  });
}

/** Undirritað eintak (PDF með undirritunarskrá) til beggja aðila. */
export async function sendSignedContractEmail(to: string, o: { employeeName: string; company: string; pdfBase64: string; filename: string; forEmployer: boolean }) {
  return sendEmail({
    to,
    subject: o.forEmployer
      ? `${o.employeeName} undirritaði ráðningarsamninginn / signed the contract`
      : `Undirritaður ráðningarsamningur við ${o.company} / your signed contract`,
    html: template({
      preheader: "Undirritað eintak fylgir sem PDF.",
      heading: "Samningurinn er undirritaður",
      body: o.forEmployer
        ? `<b>${o.employeeName}</b> undirritaði ráðningarsamninginn rafrænt. Undirritað eintak með undirritunarskrá (tími, IP, tæki og fingrafar skjals) fylgir sem PDF og er í skjalasafni starfsmannsins.`
        : `Þú undirritaðir ráðningarsamninginn við <b>${o.company}</b>. Undirritað eintak fylgir sem PDF. Geymdu það. Það er líka í skjalasafninu þínu í VAKTO.`,
      headingEn: "The contract is signed",
      bodyEn: o.forEmployer
        ? `<b>${o.employeeName}</b> signed the employment contract electronically. The signed copy with its signature record (time, IP, device and document fingerprint) is attached and saved in the employee's documents.`
        : `You signed your employment contract with <b>${o.company}</b>. The signed copy is attached. Keep it. It is also in your documents in VAKTO.`,
    }),
    attachments: [{ filename: o.filename, content: o.pdfBase64 }],
  });
}
