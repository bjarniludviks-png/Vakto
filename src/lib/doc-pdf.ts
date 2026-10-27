// Launaseðill og tímaskrá sem PDF — sami stíll og ráðningarsamningurinn (contract-pdf.ts, „C“):
// hlýr haus með setningu á mannamáli og fjórum lykiltölum, tölusettir kaflar, General Sans,
// íslenska fyrst og enska grá undir. Bæði skjöl eru líka til þegar ekkert var unnið (0) —
// t.d. vottorð um að starfsmaður vann ekkert á tímabilinu.
// Keyrir í vafra; jsPDF og letrið hlaðin með dynamic import.
import type { jsPDF } from "jspdf";
import { drawVaktoLogo } from "@/lib/pdf-logo";
import { nf, dec1 } from "@/lib/format";
import { taxBeforeAllowance } from "@/lib/paysettings";
import { WO_ACTION, type WoSnapshot, type WoLogEntry } from "@/lib/work-overview";

type RGB = [number, number, number];
const INK: RGB = [23, 23, 28];
const INK2: RGB = [61, 58, 54];
const MUT: RGB = [138, 138, 148];
const WARM: RGB = [251, 246, 240];
const WARM_MUT: RGB = [138, 122, 104];
const RULE: RGB = [236, 233, 228];
const GOOD: RGB = [24, 140, 92];
const WARN: RGB = [196, 98, 10];
const NOTE_BG: RGB = [253, 245, 236];

/** Allt sem launaseðill þarf — tölur úr launaútreikningi VAKTO (computeFromPunches). */
export type PayslipDetail = {
  name: string; kennitala: string | null; title: string | null; union: string | null; bankAccount: string | null;
  company: string; companyKt: string | null;
  period: string; from: string; to: string;
  payType: "hourly" | "monthly"; rate: number;
  hours: number; dayPay: number; premiums: number; overtime: number; uppbot: number;
  gross: number; pension: number; unionFee: number; withholding: number; net: number;
  // 0081 — vantar á eldri gögnum
  orlof?: number; orlofToBank?: number; extraPension?: number; allowanceUsed?: number;
  benefits?: number; benefitsInKind?: number; benefitsFree?: number;
  pensionPct?: number; extraPensionPct?: number; unionFeePct?: number; orlofPct?: number;
  /** Frá áramótum, til og með þessu tímabili (vistaðar launakeyrslur ársins). */
  ytd?: PayslipYtd;
};
export type PayslipYtd = Partial<Record<"hours" | "dayPay" | "premiums" | "overtime" | "uppbot" | "orlof" | "benefits" | "gross" | "pension" | "extraPension" | "unionFee" | "withholding" | "net", number>>;
const pctTxt = (n?: number) => (n == null ? "" : ` (${String(Math.round(n * 100) / 100).replace(".", ",")}%)`);

type Doc = jsPDF;
type Tile = { label: string; value: string; tone?: "good" | "warn" };
type Run = { t: string; b: boolean };

const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ð/g, "d").replace(/Ð/g, "D")
  .replace(/þ/g, "th").replace(/Þ/g, "Th").replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const kt = (v: string | null | undefined) => { const d = (v ?? "").replace(/\D/g, ""); return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : ""; };
const isoNice = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}.${m}.${y}`; };
const DOW = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];

async function newDoc() {
  const { jsPDF } = await import("jspdf");
  const fonts = await import("./fonts/general-sans");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("GS-Regular.ttf", fonts.regular); doc.addFont("GS-Regular.ttf", "GS", "normal");
  doc.addFileToVFS("GS-Medium.ttf", fonts.medium); doc.addFont("GS-Medium.ttf", "GS", "medium");
  doc.addFileToVFS("GS-Semibold.ttf", fonts.semibold); doc.addFont("GS-Semibold.ttf", "GS", "bold");
  doc.addFileToVFS("GS-Italic.ttf", fonts.italic); doc.addFont("GS-Italic.ttf", "GS", "italic");
  return doc;
}

/** Sameiginlegt útlit: haus, kaflar, fótur. */
function kit(doc: Doc) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44, CW = W - M * 2, BOTTOM = H - 64;
  const LEFT = 128, RX = M + LEFT + 14, RW = W - M - RX;
  const font = (style: "normal" | "medium" | "bold" | "italic", size: number, color: RGB) => { doc.setFont("GS", style); doc.setFontSize(size); doc.setTextColor(...color); };
  const wrap = (text: string, width: number) => doc.splitTextToSize(text, width) as string[];
  const state = { y: 0 };

  const richWrap = (runs: Run[], width: number): Run[][] => {
    const words: Run[] = [];
    for (const r of runs) for (const w of r.t.split(/(\s+)/)) if (w) words.push({ t: w, b: r.b });
    const lines: Run[][] = [[]]; let lw = 0;
    for (const w of words) {
      font(w.b ? "bold" : "normal", 10, INK2);
      const ww = doc.getTextWidth(w.t);
      if (/^\s+$/.test(w.t)) { if (lines[lines.length - 1].length) { lines[lines.length - 1].push(w); lw += ww; } continue; }
      if (lw + ww > width && lines[lines.length - 1].length) {
        const cur = lines[lines.length - 1];
        while (cur.length && /^\s+$/.test(cur[cur.length - 1].t)) cur.pop();
        lines.push([]); lw = 0;
      }
      lines[lines.length - 1].push(w); lw += ww;
    }
    return lines.filter((l) => l.length);
  };

  /** Hlýr haus: merki, titill (IS + EN), setning með feitletruðum nöfnum, fjórar lykiltölur. */
  const header = (titleIs: string, titleEn: string, sentence: Run[], sentenceEn: string, tiles: Tile[]) => {
    const sIs = richWrap(sentence, CW * 0.8);
    font("italic", 9, WARM_MUT); const sEn = sentenceEn ? wrap(sentenceEn, CW * 0.8) : [];
    const gap = 8, tw = (CW - gap * 3) / 4, tileH = 40;
    const headH = 34 + 38 + 15 + 20 + sIs.length * 13.5 + sEn.length * 12 + 14 + tileH + 26;
    doc.setFillColor(...WARM); doc.rect(0, 0, W, headH, "F");
    let y = 34;
    drawVaktoLogo(doc, M, y + 1.5, 17);
    font("normal", 8, WARM_MUT); doc.text("vakto.is", W - M, y + 1.5, { align: "right" });
    y += 38;
    font("bold", 23, INK); doc.text(titleIs, M, y);
    y += 15; font("italic", 10, WARM_MUT); doc.text(titleEn, M, y);
    y += 20;
    sIs.forEach((line) => { let x = M; for (const w of line) { font(w.b ? "bold" : "normal", 10, w.b ? INK : INK2); doc.text(w.t, x, y); x += doc.getTextWidth(w.t); } y += 13.5; });
    font("italic", 9, WARM_MUT); sEn.forEach((l) => { doc.text(l, M, y); y += 12; });
    y += 12;
    tiles.forEach((t, i) => {
      const x = M + i * (tw + gap);
      doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, tw, tileH, 6, 6, "F");
      font("normal", 7, WARM_MUT); doc.text(t.label, x + 9, y + 13);
      font("bold", 11.5, t.tone === "good" ? GOOD : t.tone === "warn" ? WARN : INK);
      doc.text(wrap(t.value, tw - 18)[0] ?? "—", x + 9, y + 30);
    });
    state.y = headH + 26;
  };

  const ensure = (h: number) => { if (state.y + h > BOTTOM) { doc.addPage(); state.y = 50; return true; } return false; };

  /** Kafli: titill vinstra megin, efni hægra megin (callback teiknar og skilar hæð). */
  const section = (num: number, tIs: string, tEn: string, minH: number, draw: (x: number, y: number, w: number) => number) => {
    ensure(Math.max(minH, 40));
    doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(M, state.y - 9, W - M, state.y - 9);
    font("bold", 10, INK); doc.text(`${num}. ${tIs}`, M, state.y + 8);
    font("italic", 8.3, MUT); doc.text(tEn, M, state.y + 19);
    const h = draw(RX, state.y, RW);
    state.y += Math.max(h, 30) + 18;
  };

  /** Reitir tveir og tveir (heiti lítið, gildi undir). */
  const fields = (x: number, y: number, w: number, rows: [string, string][]) => {
    const colW = (w - 16) / 2; let yy = y;
    for (let i = 0; i < rows.length; i += 2) {
      let rowH = 0;
      rows.slice(i, i + 2).forEach(([k, v], j) => {
        const cx = x + j * (colW + 16);
        font("medium", 7.3, MUT); doc.text(k, cx, yy + 7);
        font("normal", 9.6, v ? INK : MUT); const lines = wrap(v || "—", colW);
        lines.forEach((l, n) => doc.text(l, cx, yy + 21 + n * 12));
        rowH = Math.max(rowH, 21 + lines.length * 12);
      });
      yy += rowH + 6;
    }
    return yy - y;
  };

  /** Upphæðalína: lýsing (+ grá skýring) vinstra megin, upphæð hægra megin. */
  /** ytdCols: tveir dálkar („Tímabil“ og „Frá áramótum“) — r.ytd fer í þann hægri. */
  const amountRows = (x: number, y: number, w: number, rows: { label: string; hint?: string; amount: string; ytd?: string; strong?: boolean; tone?: "good" | "neg" }[], ytdCols = false, head = true) => {
    let yy = y;
    const ax = ytdCols ? x + w - 110 : x + w;
    if (ytdCols && head) {
      font("medium", 7.3, MUT); doc.text("Tímabil", ax, yy + 6, { align: "right" }); doc.text("Frá áramótum", x + w, yy + 6, { align: "right" });
      yy += 14;
    }
    for (const r of rows) {
      if (r.strong) { doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(x, yy + 1, x + w, yy + 1); yy += 6; }
      font(r.strong ? "bold" : "normal", r.strong ? 10.5 : 9.6, INK); doc.text(r.label, x, yy + 10);
      font(r.strong ? "bold" : "medium", r.strong ? 10.5 : 9.6, r.tone === "good" ? GOOD : r.tone === "neg" ? INK2 : INK);
      doc.text(r.amount, ax, yy + 10, { align: "right" });
      if (ytdCols && r.ytd) { font(r.strong ? "bold" : "normal", r.strong ? 10.5 : 9.6, MUT); doc.text(r.ytd, x + w, yy + 10, { align: "right" }); }
      yy += 15;
      if (r.hint) { font("italic", 8, MUT); doc.text(r.hint, x, yy + 3); yy += 11; }
      yy += 4;
    }
    return yy - y;
  };

  /** Áberandi athugasemdarkassi (t.d. „engar vinnustundir á tímabilinu“). */
  const note = (x: number, y: number, w: number, is: string, en: string) => {
    font("medium", 9.6, WARN); const a = wrap(is, w - 24);
    font("italic", 8.3, WARM_MUT); const b = wrap(en, w - 24);
    const h = 16 + a.length * 12 + b.length * 10.5;
    doc.setFillColor(...NOTE_BG); doc.roundedRect(x, y, w, h, 6, 6, "F");
    let yy = y + 17;
    font("medium", 9.6, WARN); a.forEach((l) => { doc.text(l, x + 12, yy); yy += 12; });
    font("italic", 8.3, WARM_MUT); b.forEach((l) => { doc.text(l, x + 12, yy); yy += 10.5; });
    return h;
  };

  const footer = (label: string) => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      const by = H - 26;
      doc.setDrawColor(...RULE); doc.setLineWidth(0.7); doc.line(M, by - 12, W - M, by - 12);
      drawVaktoLogo(doc, M, by, 11);
      font("normal", 7.8, MUT); doc.text(label, M + 52, by);
      doc.text(`vakto.is · ${i} / ${pages}`, W - M, by, { align: "right" });
    }
  };

  return { W, H, M, CW, RX, RW, BOTTOM, font, wrap, state, header, section, fields, amountRows, note, ensure, footer };
}

const kr = (n: number) => `${nf(Math.round(n))} kr`;

/** Launaseðill. Sýnir AÐEINS raunverulegar tölur úr útreikningnum (engin gervi-skipting). */
export async function buildPayslipPdf(d: PayslipDetail): Promise<Doc> {
  const doc = await newDoc();
  const k = kit(doc);
  const unionFee = d.unionFee;
  const deductions = d.pension + (d.extraPension ?? 0) + unionFee + d.withholding + (d.orlofToBank ?? 0) + (d.benefitsInKind ?? 0);
  const empty = d.hours <= 0 && d.gross <= 0;
  const ktE = kt(d.kennitala), ktC = kt(d.companyKt);

  k.header("Launaseðill", "Payslip",
    [{ t: d.company || "Vinnuveitandi", b: true }, { t: `${ktC ? ` (kt. ${ktC})` : ""} — laun til `, b: false }, { t: d.name, b: true }, { t: `${ktE ? ` (kt. ${ktE})` : ""} fyrir tímabilið ${d.period}.`, b: false }],
    `${d.company} — pay for ${d.name} for the period ${isoNice(d.from)} – ${isoNice(d.to)}.`,
    [
      { label: "Tímar · Hours", value: `${dec1(d.hours)} klst.` },
      { label: "Brúttólaun · Gross", value: kr(d.gross) },
      { label: "Frádráttur · Deductions", value: deductions ? `−${kr(deductions)}` : kr(0) },
      { label: "Útborgað · Net pay", value: kr(d.net), tone: "good" },
    ]);

  k.section(1, "Starfsmaður", "Employee", 70, (x, y, w) => k.fields(x, y, w, [
    ["Nafn · Name", d.name], ["Kennitala · ID No.", ktE],
    ["Starf · Role", d.title ?? ""], ["Stéttarfélag · Union", d.union ?? ""],
    ["Bankareikningur · Bank account", d.bankAccount ?? ""], ["Tímabil · Period", `${isoNice(d.from)} – ${isoNice(d.to)}`],
  ]));

  // Frá áramótum (ef til) — annar dálkur við hverja upphæð, eins og á launaseðlum úr Payday/DK.
  const Y = d.ytd, yc = !!Y && !empty;
  const yv = (key: keyof PayslipYtd, neg = false) => (yc && Y?.[key] != null ? (neg && Y[key] ? `−${kr(Y[key]!)}` : kr(Y[key] ?? 0)) : undefined);
  type AR = { label: string; hint?: string; amount: string; ytd?: string; strong?: boolean; tone?: "good" | "neg" };

  k.section(2, "Laun", "Earnings", 90, (x, y, w) => {
    let h = 0;
    if (empty) h += k.note(x, y, w, "Engar vinnustundir eru skráðar á tímabilinu og engin laun voru greidd.", "No working hours were recorded in the period and no pay was issued.") + 10;
    const rows: AR[] = [];
    if (d.payType === "monthly") rows.push({ label: "Mánaðarlaun", hint: "Monthly salary", amount: kr(d.dayPay), ytd: yv("dayPay") });
    else rows.push({ label: "Tímakaup", hint: `${dec1(d.hours)} klst. × ${kr(d.rate)} · hourly pay${yc && Y?.hours != null ? ` · ${dec1(Y.hours)} klst. á árinu` : ""}`, amount: kr(d.dayPay), ytd: yv("dayPay") });
    if (d.premiums || Y?.premiums) rows.push({ label: "Álag (kvöld, helgar, stórhátíðir)", hint: "Shift premiums", amount: kr(d.premiums), ytd: yv("premiums") });
    if (d.overtime || Y?.overtime) rows.push({ label: "Yfirvinnuálag", hint: "Overtime premium", amount: kr(d.overtime), ytd: yv("overtime") });
    if (d.uppbot || Y?.uppbot) rows.push({ label: "Desember-/orlofsuppbót", hint: "Holiday bonus", amount: kr(d.uppbot), ytd: yv("uppbot") });
    if (d.orlof || Y?.orlof) rows.push({ label: `Orlof${pctTxt(d.orlofPct)}`, hint: "Holiday pay", amount: kr(d.orlof ?? 0), ytd: yv("orlof") });
    if (d.benefits || Y?.benefits) rows.push({ label: "Hlunnindi og styrkir", hint: "Benefits & allowances", amount: kr(d.benefits ?? 0), ytd: yv("benefits") });
    rows.push({ label: "Brúttólaun · Gross pay", amount: kr(d.gross), ytd: yv("gross"), strong: true });
    return h + k.amountRows(x, y + h, w, rows, yc);
  });

  // Sundurliðun staðgreiðslu: skattstofn → skattur í þrepum → persónuafsláttur (nýttur) → staðgreiðsla.
  const year = Number(d.from.slice(0, 4));
  const taxable = Math.max(0, d.gross - d.pension - (d.extraPension ?? 0));
  const taxBefore = Math.round(taxBeforeAllowance(taxable, year));
  const allowance = Math.max(0, taxBefore - d.withholding);
  const taxHint = taxable > 0
    ? `Skattstofn ${kr(taxable)} · skattur ${kr(taxBefore)} − persónuafsláttur ${kr(allowance)}`
    : "Income tax withheld";

  k.section(3, "Frádráttur", "Deductions", 90, (x, y, w) => k.amountRows(x, y, w, [
    { label: `Lífeyrissjóður${pctTxt(d.pensionPct ?? 4)}`, hint: "Pension fund", amount: d.pension ? `−${kr(d.pension)}` : kr(0), ytd: yv("pension", true), tone: "neg" as const },
    ...(d.extraPension || Y?.extraPension ? [{ label: `Viðbótarlífeyrissparnaður${pctTxt(d.extraPensionPct)}`, hint: "Private pension", amount: d.extraPension ? `−${kr(d.extraPension)}` : kr(0), ytd: yv("extraPension", true), tone: "neg" as const }] : []),
    { label: `Félagsgjald${pctTxt(d.unionFeePct)}`, hint: "Union fee", amount: unionFee ? `−${kr(unionFee)}` : kr(0), ytd: yv("unionFee", true), tone: "neg" as const },
    { label: "Staðgreiðsla", hint: taxHint, amount: d.withholding ? `−${kr(d.withholding)}` : kr(0), ytd: yv("withholding", true), tone: "neg" as const },
    ...(d.benefitsInKind ? [{ label: "Hlunnindi í fríðu (ekki greidd út)", hint: "Benefits in kind", amount: `−${kr(d.benefitsInKind)}`, tone: "neg" as const }] : []),
    ...(d.orlofToBank ? [{ label: "Orlof lagt inn á orlofsreikning", hint: "Holiday pay to holiday account", amount: `−${kr(d.orlofToBank)}`, tone: "neg" as const }] : []),
    { label: "Frádráttur samtals · Total deductions", amount: deductions ? `−${kr(deductions)}` : kr(0), ytd: yc && Y ? `−${kr((Y.pension ?? 0) + (Y.extraPension ?? 0) + (Y.unionFee ?? 0) + (Y.withholding ?? 0))}` : undefined, strong: true },
  ], yc, false));

  k.section(4, "Útborgað", "Net pay", 50, (x, y, w) => k.amountRows(x, y, w, [
    ...(d.benefitsFree ? [{ label: "Undanþegið staðgreiðslu (t.d. dagpeningar)", hint: "Tax-exempt allowances", amount: kr(d.benefitsFree) }] : []),
    { label: `Útborgað á reikning${d.bankAccount ? ` ${d.bankAccount}` : ""}`, hint: "Paid to account", amount: kr(d.net), ytd: yv("net"), strong: true, tone: "good" },
  ], yc, false));

  k.footer(`Launaseðill · ${d.name}`);
  return doc;
}

export async function downloadPayslipPdf(d: PayslipDetail) {
  const doc = await buildPayslipPdf(d);
  doc.save(`Launasedill_${ascii(d.name)}_${d.from}_${d.to}.pdf`);
}

export type TimesheetRow = { name: string; date: string; in: string; out: string | null; hours: number; approved: boolean };

/** Tímaskrá — eins starfsmanns (`employee`) eða alls fyrirtækisins. Líka til með 0 færslum. */
export async function buildTimesheetPdf(o: { rows: TimesheetRow[]; from: string; to: string; company?: string; employee?: string }): Promise<Doc> {
  const doc = await newDoc();
  const k = kit(doc);
  const rows = o.rows.slice().sort((a, b) => (a.date + a.in).localeCompare(b.date + b.in));
  const total = rows.reduce((a, r) => a + r.hours, 0);
  const approved = rows.filter((r) => r.approved).reduce((a, r) => a + r.hours, 0);
  const pending = rows.filter((r) => !r.approved).length;
  const per = `${isoNice(o.from)} – ${isoNice(o.to)}`;
  const single = !!o.employee;

  const sentence: Run[] = single
    ? [{ t: "Vinnustundir ", b: false }, { t: o.employee!, b: true }, ...(o.company ? [{ t: " hjá ", b: false }, { t: o.company, b: true }] : []), { t: ` á tímabilinu ${per}.`, b: false }]
    : [{ t: "Allar skráðar vinnustundir hjá ", b: false }, { t: o.company || "fyrirtækinu", b: true }, { t: ` á tímabilinu ${per}.`, b: false }];
  k.header(single ? "Tímaskráning" : "Tímaskýrsla", single ? "Timesheet" : "Time report", sentence,
    single ? `Hours worked by ${o.employee} in the period ${per}.` : `All recorded hours in the period ${per}.`,
    [
      { label: "Vaktir · Shifts", value: String(rows.length) },
      { label: "Klst. samtals · Hours", value: `${dec1(total)} klst.` },
      { label: "Samþykktar · Approved", value: `${dec1(approved)} klst.`, tone: "good" },
      { label: "Óafgreiddar · Pending", value: String(pending), tone: pending ? "warn" : undefined },
    ]);

  // Tafla í fullri breidd (fleiri dálkar en kaflaútlitið leyfir).
  const x0 = k.M, w = k.CW;
  const cols = single
    ? [{ h: "Dagsetning · Date", w: 0.26 }, { h: "Dagur", w: 0.12 }, { h: "Inn · In", w: 0.14 }, { h: "Út · Out", w: 0.14 }, { h: "Klst. · Hours", w: 0.14, r: true }, { h: "Staða · Status", w: 0.2, r: true }]
    : [{ h: "Starfsmaður · Employee", w: 0.3 }, { h: "Dagsetning", w: 0.17 }, { h: "Inn", w: 0.11 }, { h: "Út", w: 0.11 }, { h: "Klst.", w: 0.12, r: true }, { h: "Staða", w: 0.19, r: true }];
  const xs: number[] = []; let acc = x0; for (const c of cols) { xs.push(acc); acc += c.w * w; }
  const drawHead = () => {
    k.font("medium", 7.3, MUT);
    cols.forEach((c, i) => doc.text(c.h, c.r ? xs[i] + c.w * w - 4 : xs[i], k.state.y, c.r ? { align: "right" } : undefined));
    doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(x0, k.state.y + 7, x0 + w, k.state.y + 7);
    k.state.y += 20;
  };
  drawHead();
  if (!rows.length) {
    k.state.y += k.note(x0, k.state.y, w, single ? "Engar vinnustundir eru skráðar á tímabilinu — starfsmaðurinn vann ekki á þessu tímabili." : "Engar vinnustundir eru skráðar á tímabilinu.", "No working hours were recorded in this period.") + 14;
  }
  for (const r of rows) {
    if (k.ensure(18)) drawHead();
    const d = new Date(r.date + "T12:00:00");
    const cells = single
      ? [isoNice(r.date), DOW[d.getDay()] ?? "", r.in, r.out ?? "—", dec1(r.hours), r.approved ? "Samþykkt" : "Bíður"]
      : [r.name, isoNice(r.date), r.in, r.out ?? "—", dec1(r.hours), r.approved ? "Samþykkt" : "Bíður"];
    cells.forEach((v, i) => {
      const last = i === cells.length - 1;
      k.font(last ? "medium" : "normal", 9.2, last ? (r.approved ? GOOD : WARN) : INK);
      const c = cols[i];
      const txt = k.wrap(String(v), c.w * w - 8)[0] ?? "";
      doc.text(txt, c.r ? xs[i] + c.w * w - 4 : xs[i], k.state.y, c.r ? { align: "right" } : undefined);
    });
    doc.setDrawColor(...RULE); doc.setLineWidth(0.5); doc.line(x0, k.state.y + 6, x0 + w, k.state.y + 6);
    k.state.y += 18;
  }
  k.ensure(40);
  k.state.y += 6;
  k.font("bold", 10.5, INK); doc.text("Samtals · Total", x0, k.state.y);
  doc.text(`${dec1(total)} klst.`, xs[4] + cols[4].w * w - 4, k.state.y, { align: "right" });
  k.state.y += 26;
  k.font("italic", 7.8, MUT);
  doc.text("Úr stimpilklukku VAKTO. „Samþykkt“ = yfirfarið af stjórnanda. · From the VAKTO time clock; “approved” = reviewed by a manager.", x0, k.state.y);

  k.footer(single ? `Tímaskráning · ${o.employee}` : `Tímaskýrsla · ${o.company ?? ""}`);
  return doc;
}

export async function downloadTimesheetPdf(o: { rows: TimesheetRow[]; from: string; to: string; company?: string; employee?: string }) {
  const doc = await buildTimesheetPdf(o);
  doc.save(`${o.employee ? `Timaskraning_${ascii(o.employee)}` : `Timaskyrsla_${ascii(o.company ?? "VAKTO")}`}_${o.from}_${o.to}.pdf`);
}

const LEAVE_IS: Record<string, string> = { orlof: "Orlof", veikindi: "Veikindi", olaunad: "Launalaust" };
const hrs = (n: number) => `${dec1(n)} klst.`;
const stamp = (s: string) => { const d = new Date(s); return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()} kl. ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

/** Vinnuyfirlit (0084) — tímar per dag, launaliðir og staðfestingarskrá með fingrafari.
 * Tölurnar koma úr snapshot (sami útreikningur og launakeyrslan). Keyrir í vafra og á þjóni. */
export async function buildWorkOverviewPdf(s: WoSnapshot, log: WoLogEntry[], fingerprint: string | null): Promise<Doc> {
  const doc = await newDoc();
  const k = kit(doc);
  const per = `${isoNice(s.from)} – ${isoNice(s.to)}`;
  const ktE = kt(s.employee.kennitala), ktC = kt(s.company.kennitala);
  const t = s.totals, p = s.pay;

  k.header("Vinnuyfirlit", "Work overview",
    [{ t: "Unnar vinnustundir ", b: false }, { t: s.employee.name, b: true }, { t: `${ktE ? ` (kt. ${ktE})` : ""} hjá `, b: false }, { t: s.company.name || "vinnuveitanda", b: true }, { t: `${ktC ? ` (kt. ${ktC})` : ""} á tímabilinu ${per}.`, b: false }],
    `Hours worked by ${s.employee.name} in the period ${per}.`,
    [
      { label: "Á plani · Scheduled", value: hrs(t.planned) },
      { label: "Unnið · Worked", value: hrs(t.worked) },
      { label: "Frávik · Difference", value: `${t.diff > 0 ? "+" : t.diff < 0 ? "−" : ""}${hrs(Math.abs(t.diff))}`, tone: Math.abs(t.diff) >= 0.05 ? "warn" : undefined },
      { label: "Brúttólaun · Gross", value: kr(p.gross), tone: "good" },
    ]);

  k.section(1, "Starfsmaður", "Employee", 70, (x, y, w) => k.fields(x, y, w, [
    ["Nafn · Name", s.employee.name], ["Kennitala · ID No.", ktE],
    ["Starf · Role", s.employee.title ?? ""], ["Deild · Department", s.employee.dept ?? ""],
    ["Kjarasamningur · Agreement", s.employee.union ?? ""], ["Tímabil · Period", per],
  ]));

  // Dagatafla í fullri breidd.
  k.ensure(60);
  const x0 = k.M, w = k.CW;
  doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(x0, k.state.y - 9, x0 + w, k.state.y - 9);
  k.font("bold", 10, INK); doc.text("2. Dagar", x0, k.state.y + 8);
  k.font("italic", 8.3, MUT); doc.text("Days — vaktir á plani og samþykktar stimplanir", x0, k.state.y + 19);
  k.state.y += 38;
  const cols = [{ h: "Dagur · Day", w: 0.17 }, { h: "Á plani · Scheduled", w: 0.22 }, { h: "Stimplanir · Punches", w: 0.27 }, { h: "Hlé", w: 0.08, r: true }, { h: "Plan", w: 0.09, r: true }, { h: "Unnið", w: 0.09, r: true }, { h: "", w: 0.08, r: true }];
  const xs: number[] = []; let acc = x0; for (const c of cols) { xs.push(acc); acc += c.w * w; }
  const head = () => {
    k.font("medium", 7.3, MUT);
    cols.forEach((c, i) => doc.text(c.h, c.r ? xs[i] + c.w * w - 4 : xs[i], k.state.y, c.r ? { align: "right" } : undefined));
    doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(x0, k.state.y + 7, x0 + w, k.state.y + 7);
    k.state.y += 20;
  };
  head();
  if (!s.days.length) k.state.y += k.note(x0, k.state.y, w, "Engar vaktir eða vinnustundir á tímabilinu.", "No shifts or working hours in the period.") + 14;
  for (const d of s.days) {
    if (k.ensure(18)) head();
    const dt = new Date(`${d.date}T12:00:00Z`);
    const diff = d.worked - d.planned;
    const cells = [
      `${DOW[dt.getUTCDay()]} ${isoNice(d.date)}`,
      d.leave ? `${d.plannedText ? d.plannedText + " · " : ""}${LEAVE_IS[d.leave] ?? d.leave}` : (d.plannedText ?? "—"),
      d.punches.length ? d.punches.map((x) => `${x.in}–${x.out}`).join(", ") : "—",
      d.breakMin ? `${d.breakMin} mín` : "",
      dec1(d.planned), dec1(d.worked),
      Math.abs(diff) >= 0.05 ? `${diff > 0 ? "+" : "−"}${dec1(Math.abs(diff))}` : "",
    ];
    cells.forEach((v, i) => {
      const c = cols[i];
      k.font(i === 6 ? "medium" : "normal", 8.8, i === 6 || (d.leave && i === 1) ? WARN : INK);
      doc.text(k.wrap(String(v), c.w * w - 6)[0] ?? "", c.r ? xs[i] + c.w * w - 4 : xs[i], k.state.y, c.r ? { align: "right" } : undefined);
    });
    doc.setDrawColor(...RULE); doc.setLineWidth(0.5); doc.line(x0, k.state.y + 6, x0 + w, k.state.y + 6);
    k.state.y += 17;
  }
  k.ensure(30);
  k.state.y += 6;
  k.font("bold", 10, INK); doc.text("Samtals · Total", x0, k.state.y);
  doc.text(dec1(t.planned), xs[4] + cols[4].w * w - 4, k.state.y, { align: "right" });
  doc.text(dec1(t.worked), xs[5] + cols[5].w * w - 4, k.state.y, { align: "right" });
  k.state.y += 14;
  k.font("normal", 8.3, MUT);
  doc.text(`${t.shifts} vaktir · hlé ${t.breakMin} mín · ${t.sickDays} veikindadagar · ${t.leaveDays} aðrir frídagar`, x0, k.state.y);
  k.state.y += 28;

  k.section(3, "Launaliðir", "Pay items", 90, (x, y, ww) => {
    const rows: { label: string; hint?: string; amount: string; strong?: boolean; tone?: "good" | "neg" }[] = [];
    if (p.monthly) rows.push({ label: "Mánaðarlaun", hint: "Monthly salary", amount: kr(p.dayPay) });
    else {
      rows.push({ label: `Tímakaup — ${hrs(p.hours)} × ${kr(p.rate)}`, hint: `Dagvinna ${hrs(p.dagvinnaH)}${p.yfirvinnaH ? ` · yfirvinna ${hrs(p.yfirvinnaH)}` : ""}`, amount: kr(p.dayPay) });
      if (p.premiums || p.alag.length) rows.push({ label: "Álag (kvöld, nætur, helgar, stórhátíðir)", hint: p.alag.map((a) => `${String(Math.round(a.pct * 10) / 10).replace(".", ",")}%: ${hrs(a.h)}`).join(" · ") || "Shift premiums", amount: kr(p.premiums) });
      if (p.overtime || p.yfirvinnaH) rows.push({ label: "Yfirvinnuálag", hint: `${hrs(p.yfirvinnaH)} · overtime premium`, amount: kr(p.overtime) });
    }
    if (p.uppbot) rows.push({ label: "Desember-/orlofsuppbót", hint: "Holiday bonus", amount: kr(p.uppbot) });
    if (p.orlof) rows.push({ label: "Orlof", hint: "Holiday pay", amount: kr(p.orlof) });
    if (p.benefits) rows.push({ label: "Hlunnindi og styrkir", hint: "Benefits & allowances", amount: kr(p.benefits) });
    rows.push({ label: "Brúttólaun · Gross pay", amount: kr(p.gross), strong: true, tone: "good" });
    return k.amountRows(x, y, ww, rows);
  });

  k.section(4, "Staðfestingarskrá", "Approval log", 60, (x, y, ww) => {
    let yy = y;
    for (const l of log) {
      k.font("medium", 9.2, INK); doc.text(WO_ACTION[l.action] ?? l.action, x, yy + 9);
      k.font("normal", 8.6, INK2); doc.text(`${l.name ?? "—"} · ${stamp(l.at)}`, x + ww, yy + 9, { align: "right" });
      yy += 14;
      if (l.note) { k.font("italic", 8.3, MUT); for (const ln of k.wrap(`„${l.note}“`, ww)) { doc.text(ln, x, yy + 5); yy += 10.5; } yy += 2; }
      yy += 5;
    }
    if (fingerprint) {
      yy += 4;
      k.font("medium", 7.3, MUT); doc.text("Fingrafar skjals · Document fingerprint (SHA-256)", x, yy + 7);
      k.font("normal", 7.6, INK2); k.wrap(fingerprint, ww).forEach((ln, i) => doc.text(ln, x, yy + 19 + i * 10));
      yy += 32;
    }
    return yy - y;
  });

  if (s.pendingPunches) k.state.y += k.note(k.M, k.state.y, k.CW, `${s.pendingPunches} stimplanir biðu samþykktar þegar yfirlitið var búið til og eru ekki með.`, "Punches awaiting approval are not included.") + 10;
  k.ensure(30);
  k.font("italic", 7.8, MUT);
  k.wrap("Reiknað í VAKTO með sama útreikningi og launakeyrslan: samþykktar stimplanir, birtar vaktir og launareglur starfsmanns. Frádráttur og útborgun koma á launaseðli. Fingrafarið nær yfir allt efni yfirlitsins og staðfestingarskrána. · Calculated in VAKTO with the payroll engine.", k.CW).forEach((l, i) => doc.text(l, k.M, k.state.y + i * 10));
  k.footer(`Vinnuyfirlit · ${s.employee.name} · ${per}`);
  return doc;
}

export const workOverviewFileName = (s: WoSnapshot) => `Vinnuyfirlit_${ascii(s.employee.name)}_${s.from}_${s.to}.pdf`;
