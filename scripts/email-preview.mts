// Sýnishorn af öllum póstum VAKTO → HTML-gallerí + PDF (ekkert sent).
//   npx tsx scripts/email-preview.mts [út-mappa]
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

import Module from "module";
import os from "os";

// "server-only" fylgir Next.js; hér utan Next er því skipt út fyrir tóma einingu.
const stub = path.join(os.tmpdir(), "vakto-server-only-stub.js");
fs.writeFileSync(stub, "");
const M = Module as unknown as { _resolveFilename: (req: string, ...a: unknown[]) => string };
const orig = M._resolveFilename;
M._resolveFilename = function (req: string, ...a: unknown[]) { return req === "server-only" ? stub : orig.call(this, req, ...a); };

process.env.EMAIL_PREVIEW = "1";
const E = await import("../src/lib/email");
const out = process.argv[2] ?? "email-preview";
fs.mkdirSync(out, { recursive: true });

const names: string[] = [];
const run = async (name: string, f: () => Promise<unknown>) => { names.push(name); await f(); };
const app = "https://vakto.is";
await run("Velkomin (nýr eigandi)", () => E.sendWelcomeEmail("a@b.is", "Bjarni Lúðvíksson", "Kaffi Krónan"));
await run("Boð í VAKTO (starfsmaður)", () => E.sendInviteEmail("a@b.is", "Kaffi Krónan", "starfsmaður", `${app}/auth/callback?x=1`));
await run("Staðfestingarkóði við nýskráningu", () => E.sendVerificationCodeEmail("a@b.is", "482913"));
await run("Endursetja lykilorð", () => E.sendResetEmail("a@b.is", `${app}/nytt-lykilord?x=1`));
await run("Nýtt vaktaplan birt", () => E.sendSchedulePublishedEmail("a@b.is", "Dalya R.", "Kaffi Krónan"));
await run("Ertu enn að vinna?", () => E.sendStillWorkingEmail("a@b.is", "Dalya R."));
await run("Ráðningarsamningur til undirritunar", () => E.sendContractEmail("a@b.is", "Ha Vu", "Kaffi Krónan"));
await run("Kóði til að undirrita samning", () => E.sendContractCodeEmail("a@b.is", "715204", "Kaffi Krónan"));
await run("Samningur undirritaður (til vinnuveitanda)", () => E.sendContractSignedEmail("a@b.is", "Ha Vu"));
await run("Undirritaður samningur með PDF", () => E.sendSignedContractEmail("a@b.is", { employeeName: "Ha Vu", company: "Kaffi Krónan", pdfBase64: "", filename: "samningur.pdf", forEmployer: false }));
await run("Fríbeiðni samþykkt", () => E.sendLeaveDecisionEmail("a@b.is", "Dalya R.", true));
await run("Fríbeiðni hafnað", () => E.sendLeaveDecisionEmail("a@b.is", "Dalya R.", false));
await run("Prufan rennur út", () => E.sendTrialReminderEmail("a@b.is", "Kaffi Krónan", { daysLeft: 3, hasCard: true, total: 12387, note: "9.990 kr + VSK", noteEn: "ISK 9,990 + VAT" }));
await run("Kort vantar", () => E.sendCardMissingEmail("a@b.is", "Kaffi Krónan", "expired"));
await run("Kvittun", () => E.sendReceiptEmail("a@b.is", "Kaffi Krónan", { total: 12387, periodStart: "1.10.2026", periodEnd: "31.10.2026" }));
await run("Greiðsla tókst ekki", () => E.sendPaymentFailedEmail("a@b.is", "Kaffi Krónan", 12387));
await run("Aðgangi lokað", () => E.sendSuspendedEmail("a@b.is", "Kaffi Krónan"));
names.push("Sjálfvirk skýrsla (vika)");
((globalThis as { __emailPreview?: unknown[] }).__emailPreview ??= []).push({
  subject: "Kaffi Krónan · Vikuskýrsla 22.9.–28.9.",
  html: E.digestReportHtml({
    company: "Kaffi Krónan", label: "Vikuskýrsla 22.9.–28.9.",
    planned: "312,0 klst", worked: "321,1 klst", deviation: "+9,1 klst", deviationColor: "#d8483a", cost: "1.214.880 kr",
    unscheduled: "2: Moon M., Lóa", unscheduledWarn: true, open: "0", openWarn: false,
    people: [
      { name: "Lóa", plan: "48,0", got: "51,5", dev: "+3,5", devColor: "#d8483a", unscheduled: true },
      { name: "Mína Huong", plan: "48,0", got: "47,8", dev: "−0,2", devColor: "#1f9d6b", unscheduled: false },
      { name: "Jón G.", plan: "40,0", got: "40,0", dev: "+0,0", devColor: "#86868b", unscheduled: false },
      { name: "Moon M.", plan: "40,0", got: "44,1", dev: "+4,1", devColor: "#d8483a", unscheduled: true },
      { name: "Dalya R.", plan: "32,0", got: "31,7", dev: "−0,3", devColor: "#1f9d6b", unscheduled: false },
    ], more: 0,
  }),
});

const mails = (globalThis as { __emailPreview?: { subject: string; html: string }[] }).__emailPreview ?? [];
mails.forEach((m, i) => fs.writeFileSync(path.join(out, `${String(i + 1).padStart(2, "0")}.html`), m.html));
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const gallery = `<!doctype html><html lang="is"><head><meta charset="utf-8"><title>VAKTO póstar</title>
<style>body{margin:0;background:#e9e9ee;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1d1d1f}
header{padding:28px 32px 8px}h1{margin:0;font-size:26px}p.s{color:#6e6e73;margin:6px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:26px;padding:24px 32px 60px}
.m{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px -18px rgba(0,0,0,.35)}
.m h2{font-size:14px;margin:0;padding:12px 16px 2px}.m .sub{font-size:12px;color:#6e6e73;padding:0 16px 10px;border-bottom:1px solid #eee}
iframe{width:100%;height:900px;border:0;display:block}</style></head><body>
<header><h1>VAKTO póstar (${mails.length})</h1><p class="s">Sýnishorn með prufugögnum. Ekkert var sent.</p></header>
<div class="grid">${mails.map((m, i) => `<div class="m"><h2>${i + 1}. ${esc(names[i] ?? "")}</h2><div class="sub">Efni: ${esc(m.subject)}</div><iframe src="${String(i + 1).padStart(2, "0")}.html" loading="lazy"></iframe></div>`).join("")}</div></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), gallery);

// PDF: ein síða á hvern póst (eins og hann birtist á 640px breiðum skjá)
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 680, height: 1000 } });
const pdfs: Buffer[] = [];
const merged = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:680px auto;margin:0}body{margin:0}
.p{page-break-after:always;break-after:page}.t{font:600 13px -apple-system,sans-serif;padding:14px 20px;background:#1d1d1f;color:#fff}</style></head><body>
${mails.map((m, i) => `<div class="p"><div class="t">${i + 1}. ${esc(names[i] ?? "")} · Efni: ${esc(m.subject)}</div><iframe src="${String(i + 1).padStart(2, "0")}.html" style="width:680px;border:0;display:block" onload="this.style.height=this.contentDocument.documentElement.scrollHeight+'px'"></iframe></div>`).join("")}
</body></html>`;
fs.writeFileSync(path.join(out, "_print.html"), merged);
await pg.goto("file://" + path.resolve(out, "_print.html"), { waitUntil: "load" });
await pg.waitForTimeout(1500);
await pg.pdf({ path: path.join(out, "VAKTO-postar.pdf"), width: "680px", printBackground: true });
await br.close();
fs.rmSync(path.join(out, "_print.html"));
console.log("komið:", path.resolve(out, "index.html"), "og", path.resolve(out, "VAKTO-postar.pdf"), `(${mails.length} póstar)`);
void pdfs;
