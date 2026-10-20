import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile.server";

// „Fáðu kynningu á vinnustaðinn" (forsíðan): beiðnin fer í tölvupósti til eigandans. Enginn gagnagrunnur.
// Bot-vörn: Turnstile (ef stillt) + gildra (falið svið) + hámark per IP.
export const runtime = "nodejs";
const TO = "bjarni@vakto.is";
const MAX_PER_HOUR = 4;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_HOUR;
}

export async function POST(req: Request) {
  let p: { name?: string; company?: string; contact?: string; message?: string; website?: string; token?: string; lang?: string } = {};
  try { p = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const en = p.lang === "en";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  if (limited(ip)) return NextResponse.json({ ok: false, error: en ? "Too many requests — try again later or email hallo@vakto.is." : "Of margar beiðnir — reyndu aftur síðar eða sendu póst á hallo@vakto.is." }, { status: 429 });
  if (p.website) return NextResponse.json({ ok: true }); // gildra: aðeins vélmenni fylla falda sviðið
  const name = String(p.name ?? "").trim().slice(0, 120);
  const company = String(p.company ?? "").trim().slice(0, 160);
  const contact = String(p.contact ?? "").trim().slice(0, 160);
  const message = String(p.message ?? "").trim().slice(0, 2000);
  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact);
  const isPhone = /^\+?[\d\s-]{7,}$/.test(contact);
  if (!name || !company || (!isEmail && !isPhone)) return NextResponse.json({ ok: false, error: en ? "Fill in name, company and a phone number or email." : "Fylltu út nafn, fyrirtæki og síma eða netfang." }, { status: 400 });
  if (!(await verifyTurnstile(p.token))) return NextResponse.json({ ok: false, error: en ? "The bot check failed — reload the page and try again." : "Bot-vörnin samþykkti ekki beiðnina — endurhladdu síðuna og reyndu aftur." }, { status: 400 });
  const r = await sendEmail({
    to: TO,
    replyTo: isEmail ? contact : undefined,
    subject: `Beiðni um kynningu: ${company}`,
    html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.55">
<p><b>${esc(name)}</b> hjá <b>${esc(company)}</b> vill fá kynningu á VAKTO á vinnustaðinn.</p>
<p>${isEmail ? `Netfang: <a href="mailto:${esc(contact)}">${esc(contact)}</a>` : `Sími: <a href="tel:${esc(contact.replace(/\s/g, ""))}">${esc(contact)}</a>`}</p>
${message ? `<p style="white-space:pre-wrap;border-left:3px solid #e9700f;padding-left:10px">${esc(message)}</p>` : ""}
<p style="color:#888;font-size:12px">Sent af forsíðu vakto.is (${en ? "enska" : "íslenska"}).</p></div>`,
  });
  if (!r.ok) {
    console.error("[kynning] email", r.error);
    return NextResponse.json({ ok: false, error: en ? "Could not send — email hallo@vakto.is instead." : "Tókst ekki að senda — sendu póst á hallo@vakto.is." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
