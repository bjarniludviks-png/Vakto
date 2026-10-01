// Ráðningarsamningur sem PDF — útlit „C, yfirlit fyrst“ (valið sept. 2026):
// hlýr haus með samantekt á mannamáli og fjórum lykiltölum, síðan tölusettir kaflar
// (titill vinstra megin, reitir hægra megin), íslenska fyrst og enska grá undir.
// Letur: General Sans (VAKTO). Les geymdan texta (## kaflar, **heiti:** gildi,
// málsgreinar). Keyrir í vafra (niðurhal) OG á þjóni (undirritað eintak, esign.server.ts).
// jsPDF og letrið eru hlaðin inn með dynamic import.
import type { jsPDF } from "jspdf";

type RGB = [number, number, number];
const ORANGE: RGB = [233, 112, 15];
const INK: RGB = [23, 23, 28];
const INK2: RGB = [61, 58, 54];
const MUT: RGB = [138, 138, 148];
const WARM: RGB = [251, 246, 240];
const WARM_MUT: RGB = [138, 122, 104];
const RULE: RGB = [236, 233, 228];
const MISSING_BG: RGB = [253, 241, 226];
const MISSING_FG: RGB = [196, 98, 10];

export type Section = { title: string; rows: [string, string][]; paras: string[] };

/** Fields → rows: two short fields share a row, anything else stands alone (full width). */
export function pairFields<T extends [string, string]>(fields: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const a = fields[i], b = fields[i + 1];
    if (!isWideField(a[0], a[1]) && b && !isWideField(b[0], b[1])) { out.push([a, b]); i++; } else out.push([a]);
  }
  return out;
}

/** A field takes the full row when either language of its value (or label) is long. */
export function isWideField(label: string, value: string): boolean {
  const [vi, ve] = splitLang(value);
  const [li, le] = splitLang(label);
  return Math.max(vi.length, ve.length) > 34 || Math.max(li.length, le.length) > 40;
}

/** "Íslenska / English" → ["Íslenska", "English"]. Only a spaced " / " separates the
 *  languages, so "kr./klst." or "55/1980" stay intact. */
export function splitLang(s: string): [string, string] {
  const i = s.indexOf(" / ");
  return i < 0 ? [s, ""] : [s.slice(0, i).trim(), s.slice(i + 3).trim()];
}

export const isBlank = (v: string) => /^_{6,}$/.test(v.trim());

/** Prentuð/lesin útgáfa: tómir valkvæðir reitir („—“) falla út svo samningurinn sé
 *  hnitmiðaður; skyldureitir (líka auðir) standa alltaf. Kafli sem tæmist fær eina línu. */
export function visibleRows(rows: [string, string][]): [string, string][] {
  const keep = rows.filter(([, v]) => v.trim() !== "—" && v.trim() !== "");
  return rows.length && !keep.length ? [["Skráning / Record", "Ekkert skráð / None recorded"]] : keep;
}

export function parseContract(content: string): { title: string; sections: Section[] } {
  let title = "Ráðningarsamningur / Employment contract";
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("# ")) { title = line.slice(2); continue; }
    if (line.startsWith("## ")) { cur = { title: line.slice(3), rows: [], paras: [] }; sections.push(cur); continue; }
    // Stop at the plain-text signature block — we draw a proper one instead.
    if (/^_?Undirritun/.test(line)) break;
    if (/^(Vinnuveitandi|Starfsmaður)\s*:\s*_+/.test(line)) continue;
    const kv = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!cur) { cur = { title: "", rows: [], paras: [] }; sections.push(cur); }
    if (kv) cur.rows.push([kv[1], kv[2]]);
    else {
      // Merge wrapped source lines into one flowing paragraph per section.
      const txt = line.replace(/^_|_$/g, "");
      if (cur.paras.length) cur.paras[cur.paras.length - 1] += " " + txt;
      else cur.paras.push(txt);
    }
  }
  return { title, sections };
}

/** Setningin í bútum: nöfn vinnuveitanda og starfsmanns feitletruð (fyrsta tilvik hvors). */
export function boldNames(text: string, names: { employer: string; employee: string } | null): { t: string; b: boolean }[] {
  if (!names) return [{ t: text, b: false }];
  const out: { t: string; b: boolean }[] = [];
  let rest = text;
  for (const n of [names.employer, names.employee]) {
    const i = n ? rest.indexOf(n) : -1;
    if (i < 0) continue;
    if (i > 0) out.push({ t: rest.slice(0, i), b: false });
    out.push({ t: n, b: true });
    rest = rest.slice(i + n.length);
  }
  if (rest) out.push({ t: rest, b: false });
  return out;
}

export type ContractSummary = {
  sentence: [string, string] | null;             // IS, EN
  names: { employer: string; employee: string } | null; // feitletruð í setningunni
  tiles: { label: string; value: string }[];     // 4 lykiltölur (tómar = „—“)
};

/** Samantekt fyrir hausinn — lesin úr reitunum (sniðmát vmst-2021). Eldri samningar fá bara reiti sem finnast. */
export function contractSummary(sections: Section[]): ContractSummary {
  const find = (sec: string, label: string) => {
    for (const s of sections) {
      if (!splitLang(s.title)[0].startsWith(sec)) continue;
      const r = s.rows.find(([k]) => splitLang(k)[0].startsWith(label));
      if (r && !isBlank(r[1]) && r[1].trim() && r[1].trim() !== "—") return r[1].trim();
    }
    return "";
  };
  // Eldri snið (fyrir vmst-2021) nota önnur heiti — leitað í öllum köflum eftir fyrsta heiti sem passar.
  const any = (...labels: string[]) => {
    for (const label of labels) for (const s of sections) {
      const r = s.rows.find(([k]) => splitLang(k)[0].startsWith(label));
      if (r && !isBlank(r[1]) && r[1].trim() && r[1].trim() !== "—") return r[1].trim();
    }
    return "";
  };
  const is = (v: string) => splitLang(v)[0];
  const employer = find("Vinnuveitandi", "Nafn");
  const name = [find("Starfsmaður", "Skírnarnafn"), find("Starfsmaður", "Eftirnafn")].filter(Boolean).join(" ");
  const start = find("Ráðningartími", "Fyrsti starfsdagur");
  // Kennitala sýnd aðeins ef hún er 10 tölustafir (ekki fæðingardagur eða „—“).
  const kt = (v: string) => { const d = v.replace(/\D/g, ""); return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : ""; };
  const ktEr = kt(find("Vinnuveitandi", "Kennitala"));
  const ktEe = kt(find("Starfsmaður", "Kennitala"));
  const role = is(find("Starfssvið", "Starfsheiti") || any("Starfsheiti", "Staða"));
  const ratio = is(find("Vinnutími", "Starfshlutfall") || any("Starfshlutfall")).replace(/^(Fullt starf|Hlutastarf)\s*/, "");
  const arr = is(find("Vinnutími", "Fyrirkomulag")).toLowerCase();
  const pay = find("Laun", "Dagvinna") || any("Dagvinna", "Taxti", "Tímakaup");
  const monthly = find("Laun", "Laun kr.") || any("Mánaðarlaun");
  const agreement = find("Kjarasamningur", "Kjarasamningur") || any("Kjarasamningur", "Stéttarfélag");
  const sentence: [string, string] | null = employer && name
    ? [`${employer}${ktEr ? ` (kt. ${ktEr})` : ""} ræður ${name}${ktEe ? ` (kt. ${ktEe})` : ""} til starfa${start ? ` frá ${start}` : ""} á þeim kjörum sem hér fara á eftir.`,
       `${employer} employs ${name}${start ? ` from ${start}` : ""} on the terms set out below.`]
    : null;
  const names = sentence ? { employer, employee: name } : null;
  if (!role && !ratio && !arr && !pay && !monthly && !agreement) return { sentence, names, tiles: [] };
  return {
    sentence,
    names,
    tiles: [
      { label: "Starf · Role", value: role || "—" },
      { label: "Starfshlutfall · Ratio", value: [ratio, arr].filter(Boolean).join(" · ") || "—" },
      monthly ? { label: "Laun · Monthly", value: `${monthly}/mán.` } : { label: "Dagvinna · Hourly", value: pay ? `${pay}/klst.` : "—" },
      { label: "Kjarasamningur · Agreement", value: agreement || "—" },
    ],
  };
}

/** One recorded signature (contract_signatures, migration 0058). */
export type SignatureRecord = {
  role: "employer" | "employee"; name: string; email: string | null; method: string;
  signedAt: string; ip: string | null; userAgent: string | null; sha256: string;
};

const fmtUtc = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()} kl. ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} (UTC)`;
};
const METHOD: Record<string, string> = {
  session: "Innskráð lota í VAKTO / Signed-in VAKTO session",
  email_otp: "Kóði sendur á netfang / One-time code sent by email",
  manual: "Skráð handvirkt (pappír) / Recorded manually (paper)",
  taktikal_qes: "Rafræn skilríki, fullgild undirskrift (Taktikal) / Electronic ID, qualified signature (Taktikal)",
};

export async function downloadContractPdf(title: string, content: string, signatures: SignatureRecord[] = []) {
  const doc = await buildContractPdf(content, signatures);
  // ASCII-skráarnafn: íslenskir stafir brenglast í sumum símum („Ra%CC%81%C3%B0…“).
  const ascii = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ð/g, "d").replace(/Ð/g, "D").replace(/þ/g, "th").replace(/Þ/g, "Th").replace(/æ/g, "ae").replace(/Æ/g, "Ae")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  doc.save(`${ascii || "Radningarsamningur"}.pdf`);
}

/** `stampStrip`: Taktikal setur undirskriftarstimpla sína neðst á síðustu síðu (BottomLastPage) —
 *  þá er beltið haldið auðu, fóturinn færður upp og undirskriftarlínum skipt út fyrir tilvísun. */
export async function buildContractPdf(content: string, signatures: SignatureRecord[] = [], opts: { stampStrip?: boolean } = {}): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const fonts = await import("./fonts/general-sans");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("GS-Regular.ttf", fonts.regular); doc.addFont("GS-Regular.ttf", "GS", "normal");
  doc.addFileToVFS("GS-Medium.ttf", fonts.medium); doc.addFont("GS-Medium.ttf", "GS", "medium");
  doc.addFileToVFS("GS-Semibold.ttf", fonts.semibold); doc.addFont("GS-Semibold.ttf", "GS", "bold");
  doc.addFileToVFS("GS-Italic.ttf", fonts.italic); doc.addFont("GS-Italic.ttf", "GS", "italic");

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;
  const CW = W - M * 2;
  const BOTTOM = H - 58;
  const font = (style: "normal" | "medium" | "bold" | "italic", size: number, color: RGB) => {
    doc.setFont("GS", style); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const wrap = (text: string, width: number) => doc.splitTextToSize(text, width) as string[];
  const mark = (x: number, baseY: number, scale = 1) => {
    doc.setFillColor(...ORANGE);
    [6, 9, 12].forEach((h, i) => doc.roundedRect(x + i * 5 * scale, baseY - h * scale, 3.2 * scale, h * scale, 1, 1, "F"));
  };

  const parsed = parseContract(content);
  const [tIs, tEn] = splitLang(parsed.title);
  const summary = contractSummary(parsed.sections);
  const empName = summary.names?.employee ?? "";

  // ---- Hlýr haus: merki, titill, samantekt, fjórar lykiltölur ----
  let y = 0;
  {
    const inner = CW;
    // Íslenska setningin með feitletruðum nöfnum: orð fyrir orð, hvert með sínu letri.
    type Run = { t: string; b: boolean };
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
    const sIs = summary.sentence ? richWrap(boldNames(summary.sentence[0], summary.names), inner * 0.78) : [];
    font("italic", 9, WARM_MUT);
    const sEn = summary.sentence ? wrap(summary.sentence[1], inner * 0.78) : [];
    // Lykiltölur: gildið má fara í tvær línur (annars „…“); allir kassar jafnháir þeim hæsta.
    const gap = 8, tw = (CW - gap * 3) / 4;
    font("bold", 10.5, INK);
    const tileLines = summary.tiles.map((t) => {
      const ls = wrap(t.value, tw - 18);
      if (ls.length <= 2) return ls;
      let last = ls[1];
      while (last.length > 1 && doc.getTextWidth(`${last}…`) > tw - 18) last = last.slice(0, -1);
      return [ls[0], `${last.trimEnd()}…`];
    });
    const maxLines = Math.max(1, ...tileLines.map((l) => l.length));
    const tileH = summary.tiles.length ? 27 + maxLines * 12.5 : -4;
    const headH = 34 + 20 + 30 + 14 + (sIs.length ? sIs.length * 13.5 + sEn.length * 12 + 14 : 0) + tileH + 4 + 24;
    doc.setFillColor(...WARM); doc.rect(0, 0, W, headH, "F");
    y = 34;
    mark(M, y + 2);
    font("bold", 10.5, INK); doc.text("VAKTO", M + 20, y + 1.5);
    font("normal", 8, WARM_MUT); doc.text("vakto.is", W - M, y + 1.5, { align: "right" });
    y += 38;
    font("bold", 23, INK); doc.text(tIs || "Ráðningarsamningur", M, y);
    y += 15;
    if (tEn) { font("italic", 10, WARM_MUT); doc.text(tEn, M, y); }
    y += 20;
    if (sIs.length) {
      sIs.forEach((line) => {
        let x = M;
        for (const w of line) { font(w.b ? "bold" : "normal", 10, w.b ? INK : INK2); doc.text(w.t, x, y); x += doc.getTextWidth(w.t); }
        y += 13.5;
      });
      font("italic", 9, WARM_MUT); sEn.forEach((l) => { doc.text(l, M, y); y += 12; });
      y += 12;
    }
    summary.tiles.forEach((t, i) => {
      const x = M + i * (tw + gap);
      doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, tw, tileH, 6, 6, "F");
      font("normal", 7, WARM_MUT); doc.text(t.label, x + 9, y + 13);
      font("bold", 10.5, INK);
      (tileLines[i].length ? tileLines[i] : ["—"]).forEach((ln, k) => doc.text(ln, x + 9, y + 29 + k * 12.5));
    });
    y = headH + 22;
  }

  const ensure = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = 50; } };

  // ---- Kaflar: titill vinstra megin, reitir/málsgreinar hægra megin ----
  const LEFT = 128;               // breidd titildálks
  const RX = M + LEFT + 14;       // x hægri dálks
  const RW = W - M - RX;          // breidd hægri dálks
  const COLG = 16;

  type FieldLay = { lIs: string[]; lEn: string; vIs: string[]; vEn: string[]; blank: boolean; h: number };
  const layField = (label: string, value: string, w: number): FieldLay => {
    const [li, le] = splitLang(label);
    const blank = isBlank(value);
    const [vi, ve] = splitLang(blank ? "" : (value || "—"));
    font("medium", 7.3, MUT);
    const lIs = wrap(le ? `${li} · ${le}` : li, w);
    font("normal", 9.6, INK);
    const vIs = blank ? ["Vantar / Missing"] : wrap(vi, w);
    font("italic", 8.3, MUT);
    const vEn = ve ? wrap(ve, w) : [];
    const h = lIs.length * 9 + 3 + vIs.length * 12 + vEn.length * 10.5 + 7;
    return { lIs, lEn: "", vIs, vEn, blank, h };
  };
  const drawField = (x: number, top: number, w: number, l: FieldLay) => {
    let ty = top + 7;
    font("medium", 7.3, MUT);
    l.lIs.forEach((ln) => { doc.text(ln, x, ty); ty += 9; });
    ty += 3 + 2.5;
    if (l.blank) {
      doc.setFillColor(...MISSING_BG); doc.roundedRect(x - 3, ty - 9.5, Math.min(w, 96), 13, 3, 3, "F");
      font("medium", 8.8, MISSING_FG); doc.text(l.vIs[0], x, ty);
      return;
    }
    font("normal", 9.6, INK); l.vIs.forEach((ln) => { doc.text(ln, x, ty); ty += 12; });
    font("italic", 8.3, MUT); l.vEn.forEach((ln) => { doc.text(ln, x, ty - 1.5); ty += 10.5; });
  };

  const drawSection = (num: number | null, title: string, rows: [string, string][], paras: string[]) => {
    const [sIs, sEn] = splitLang(title);
    const groups = pairFields(rows).map((g) => g.length === 2
      ? { cells: g.map(([k, v]) => layField(k, v, (RW - COLG) / 2)), two: true }
      : { cells: [layField(g[0][0], g[0][1], RW)], two: false });
    const paraLays = paras.map((p) => {
      const [pi, pe] = splitLang(p);
      font("normal", 8.8, INK2); const a = wrap(pi, RW);
      font("italic", 8.2, MUT); const b = pe ? wrap(pe, RW) : [];
      return { a, b, h: a.length * 11.6 + b.length * 10.6 + (b.length ? 3 : 0) + 8 };
    });
    font("bold", 10, INK); const tLines = wrap(`${num != null ? `${num}. ` : ""}${sIs}`, LEFT);
    font("italic", 8.3, MUT); const eLines = sEn ? wrap(sEn, LEFT) : [];
    const titleH = tLines.length * 12.5 + eLines.length * 10.5;
    const firstH = Math.max(titleH, groups[0] ? Math.max(...groups[0].cells.map((c) => c.h)) : (paraLays[0]?.h ?? 0));
    ensure(firstH + 6);
    // hárlína á milli kafla
    doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(M, y - 9, W - M, y - 9);
    let ty = y + 8;
    font("bold", 10, INK); tLines.forEach((l) => { doc.text(l, M, ty); ty += 12.5; });
    font("italic", 8.3, MUT); eLines.forEach((l) => { doc.text(l, M, ty - 1.5); ty += 10.5; });
    const titleBottom = ty;
    const titlePage = doc.getNumberOfPages();
    for (const g of groups) {
      const h = Math.max(...g.cells.map((c) => c.h));
      ensure(h);
      if (g.two) { drawField(RX, y, (RW - COLG) / 2, g.cells[0]); drawField(RX + (RW - COLG) / 2 + COLG, y, (RW - COLG) / 2, g.cells[1]); }
      else drawField(RX, y, RW, g.cells[0]);
      y += h;
    }
    for (const pl of paraLays) {
      ensure(pl.h);
      let py = y + 8;
      font("normal", 8.8, INK2); pl.a.forEach((l) => { doc.text(l, RX, py); py += 11.6; });
      if (pl.b.length) py += 3;
      font("italic", 8.2, MUT); pl.b.forEach((l) => { doc.text(l, RX, py - 1.5); py += 10.6; });
      y += pl.h;
    }
    // Titilbotninn gildir aðeins ef kaflinn endaði á sömu síðu og hann byrjaði.
    y = (doc.getNumberOfPages() === titlePage ? Math.max(y, titleBottom) : y) + 14;
  };

  let n = 0;
  for (const sec of parsed.sections) {
    if (!sec.rows.length && !sec.paras.length) continue;
    n += 1;
    drawSection(sec.title ? n : null, sec.title, visibleRows(sec.rows), sec.paras);
  }

  // ---- Undirritun (kafli í sama stíl) ----
  {
    const emp = signatures.find((s) => s.role === "employer");
    const ee = signatures.find((s) => s.role === "employee");
    ensure(92);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.8); doc.line(M, y - 9, W - M, y - 9);
    font("bold", 10, INK); doc.text(`${n + 1}. Undirritun`, M, y + 8);
    font("italic", 8.3, MUT); doc.text("Signatures", M, y + 19);
    const colW = (RW - COLG) / 2;
    const sig = (x: number, s: SignatureRecord | undefined, labelIs: string, labelEn: string) => {
      if (s) {
        font("italic", 10.5, INK); doc.text(wrap(`Rafrænt: ${s.name}`, colW)[0], x, y + 30);
        font("normal", 7.6, MUT); doc.text(fmtUtc(s.signedAt), x, y + 41);
      }
      doc.setDrawColor(...INK); doc.setLineWidth(0.8); doc.line(x, y + 48, x + colW, y + 48);
      font("medium", 7.4, MUT); doc.text(`${labelIs} · ${labelEn}`, x, y + 59);
    };
    if (opts.stampStrip) {
      let ty = y + 8;
      font("normal", 9.6, INK);
      wrap("Undirritað með rafrænum skilríkjum (fullgild undirskrift). Undirskriftir beggja aðila birtast neðst á þessari síðu.", RW)
        .forEach((l) => { doc.text(l, RX, ty); ty += 12; });
      font("italic", 8.3, MUT);
      wrap("Signed with electronic ID (qualified signature). Both parties' signatures appear at the bottom of this page.", RW)
        .forEach((l) => { doc.text(l, RX - 0, ty - 1.5); ty += 10.5; });
      y = Math.max(ty, y + 22) + 14;
    } else {
      sig(RX, emp, "Undirskrift atvinnurekanda", "Employer");
      sig(RX + colW + COLG, ee, "Undirskrift starfsmanns", "Employee");
      y += 80;
    }
    // Stimplabelti Taktikal (~45 pt) + fótur fyrir ofan það verða að komast fyrir á síðustu síðu.
    if (opts.stampStrip && y > H - 100) { doc.addPage(); y = 50; }
  }

  // ---- Undirritunarskrá (audit trail) ----
  if (signatures.length) {
    y += 26;
    ensure(230);
    doc.setDrawColor(...ORANGE); doc.setLineWidth(1.4); doc.line(M, y - 20, W - M, y - 20);
    font("bold", 17, INK); doc.text("Undirritunarskrá", M, y);
    font("italic", 10, MUT); doc.text("Signature record", M, y + 15);
    y += 34;
    font("normal", 8.8, INK2);
    const intro = wrap("Samningurinn var undirritaður rafrænt í VAKTO. Fingrafar (SHA-256) er reiknað af samningstextanum eins og hann var sendur; ef einn stafur breytist verður fingrafarið annað.", CW);
    intro.forEach((l) => { doc.text(l, M, y); y += 11.6; });
    font("italic", 8.2, MUT);
    wrap("The contract was signed electronically in VAKTO. The SHA-256 fingerprint is computed from the contract text as sent; changing a single character changes it.", CW)
      .forEach((l) => { doc.text(l, M, y); y += 10.6; });
    y += 22;
    drawSection(null, "Fingrafar skjals / Document fingerprint", [["SHA-256", signatures[signatures.length - 1].sha256]], []);
    for (const s of signatures) {
      drawSection(null, s.role === "employer" ? "Vinnuveitandi / Employer" : "Starfsmaður / Employee", [
        ["Nafn / Name", s.name],
        ["Netfang / Email", s.email ?? "—"],
        ["Aðferð / Method", METHOD[s.method] ?? s.method],
        ["Tími / Time", fmtUtc(s.signedAt)],
        ["IP-tala / IP address", s.ip ?? "—"],
        ["Tæki / Device", s.userAgent ?? "—"],
      ], []);
    }
  }

  // ---- Fótur á hverri síðu ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const by = opts.stampStrip && i === pages ? H - 62 : H - 26;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7); doc.line(M, by - 12, W - M, by - 12);
    mark(M, by + 0.5, 0.8);
    font("bold", 8.5, INK); doc.text("VAKTO", M + 16, by);
    font("normal", 7.8, MUT);
    doc.text(`${tIs || "Ráðningarsamningur"}${empName ? ` · ${empName}` : ""}`, M + 52, by);
    doc.text(`vakto.is · ${i} / ${pages}`, W - M, by, { align: "right" });
  }
  return doc;
}
