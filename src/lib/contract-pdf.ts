// PDF for employment contracts — branded like the schedule/report PDFs (orange
// section bars, VAKTO mark, bordered form layout à la the classic Icelandic
// ráðningarsamningur forms). Parses the stored markdown-ish content (## sections,
// **key:** value lines, free paragraphs). Runs in the browser (download) AND on
// the server (signed copy emailed to both parties, lib/esign.server.ts).
// jsPDF + autotable are imported lazily.
import type { jsPDF } from "jspdf";

const ORANGE: [number, number, number] = [233, 112, 15];
const INK: [number, number, number] = [17, 17, 17];
const MUT: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [225, 225, 228];

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
  return Math.max(vi.length, ve.length) > 40 || Math.max(li.length, le.length) > 44;
}

/** "Íslenska / English" → ["Íslenska", "English"]. Only a spaced " / " separates the
 *  languages, so "kr./klst." or "55/1980" stay intact. */
export function splitLang(s: string): [string, string] {
  const i = s.indexOf(" / ");
  return i < 0 ? [s, ""] : [s.slice(0, i).trim(), s.slice(i + 3).trim()];
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

// Branded footer: VAKTO mark + wordmark + tagline, with a page counter.
function drawFooter(doc: jsPDF, pageNum: number, pageCount: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const by = H - 24;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.7);
  doc.line(48, by - 13, W - 48, by - 13);
  const bx = 48;
  doc.setFillColor(...ORANGE);
  [6, 9, 12].forEach((h, i) => doc.roundedRect(bx + i * 5, by - h, 3.2, h, 1, 1, "F"));
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
  const wmX = bx + 21;
  doc.text("VAKTO", wmX, by - 1);
  const wmW = doc.getTextWidth("VAKTO");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUT);
  doc.text("Vaktaskipulag & launakostnaður · vakto.is", wmX + wmW + 9, by - 1);
  if (pageCount > 1) doc.text(`${pageNum} / ${pageCount}`, W - 48, by - 1, { align: "right" });
  doc.setTextColor(0);
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
};

export async function downloadContractPdf(title: string, content: string, signatures: SignatureRecord[] = []) {
  const doc = await buildContractPdf(content, signatures);
  doc.save(`${title.replace(/[^\wÀ-ÿ —-]+/g, "").trim() || "Radningarsamningur"}.pdf`);
}

export async function buildContractPdf(content: string, signatures: SignatureRecord[] = []): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;

  const parsed = parseContract(content);
  const [tIs, tEn] = parsed.title.split(" / ");

  // ---- Header: logo mark + wordmark, bilingual document title, orange rule ----
  const topY = 52;
  doc.setFillColor(...ORANGE);
  [9, 13.5, 18].forEach((h, i) => doc.roundedRect(M + i * 7.5, topY - h, 4.8, h, 1.4, 1.4, "F"));
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...INK);
  doc.text("VAKTO", M + 31, topY - 2);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUT);
  doc.text("vakto.is", W - M, topY - 2, { align: "right" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(...INK);
  doc.text(tIs ?? "Ráðningarsamningur", M, topY + 36);
  if (tEn) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10.5); doc.setTextColor(...MUT);
    doc.text(tEn, M, topY + 51);
  }
  doc.setDrawColor(...ORANGE); doc.setLineWidth(2);
  doc.line(M, topY + 60, W - M, topY + 60);

  let y = topY + 72;

  // ---- Sections as a compact bilingual form grid (like the VMST form) ----
  // Each field is a bordered cell: small label (IS bold · EN italic grey) above the
  // value. Short fields pair up two per row; long ones take the full width.
  type Doc = jsPDF & { lastAutoTable?: { finalY: number } };
  const headStyles = { fillColor: ORANGE, textColor: 255, fontStyle: "bold", fontSize: 10.5, cellPadding: { top: 7, bottom: 7, left: 9, right: 9 } } as const;
  const CW = W - M * 2;
  const PAD = 6;
  const LBL = 7.3, VAL = 9.6, LBL_LH = 8.8, VAL_LH = 11.6;
  const ensure = (h: number) => { if (y + h > H - 58) { doc.addPage(); y = 48; } };

  type Lay = { lbl: [string[], string[]]; val: [string[], string[]]; blank: boolean; h: number };
  const layout = (label: string, value: string, w: number): Lay => {
    const inner = w - PAD * 2;
    const [lIs, lEn] = splitLang(label);
    doc.setFont("helvetica", "bold"); doc.setFontSize(LBL);
    const lisLines = doc.splitTextToSize(lIs, inner) as string[];
    doc.setFont("helvetica", "italic");
    const lenLines = lEn ? doc.splitTextToSize(lEn, inner) as string[] : [];
    const blank = /^_{6,}$/.test(value.trim());
    const v = blank ? "" : (value || "—");
    const [vIs, vEn] = splitLang(v);
    doc.setFont("helvetica", "normal"); doc.setFontSize(VAL);
    const visLines = vIs ? doc.splitTextToSize(vIs, inner) as string[] : [];
    doc.setFont("helvetica", "italic"); doc.setFontSize(VAL - 1);
    const venLines = vEn ? doc.splitTextToSize(vEn, inner) as string[] : [];
    const h = PAD + (lisLines.length + lenLines.length) * LBL_LH + 3 + Math.max(1, visLines.length + venLines.length) * VAL_LH + PAD - 2;
    return { lbl: [lisLines, lenLines], val: [visLines, venLines], blank, h };
  };
  const drawCell = (x: number, w: number, h: number, l: Lay) => {
    if (l.blank) { doc.setFillColor(253, 244, 231); doc.rect(x, y, w, h, "F"); }
    doc.setDrawColor(...LINE); doc.setLineWidth(0.7); doc.rect(x, y, w, h);
    let ty = y + PAD + LBL_LH - 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(LBL); doc.setTextColor(70, 70, 76);
    for (const ln of l.lbl[0]) { doc.text(ln, x + PAD, ty); ty += LBL_LH; }
    doc.setFont("helvetica", "italic"); doc.setTextColor(...MUT);
    for (const ln of l.lbl[1]) { doc.text(ln, x + PAD, ty); ty += LBL_LH; }
    ty += 3 + VAL_LH - LBL_LH;
    doc.setFont("helvetica", "normal"); doc.setFontSize(VAL); doc.setTextColor(...INK);
    for (const ln of l.val[0]) { doc.text(ln, x + PAD, ty); ty += VAL_LH; }
    doc.setFont("helvetica", "italic"); doc.setFontSize(VAL - 1); doc.setTextColor(...MUT);
    for (const ln of l.val[1]) { doc.text(ln, x + PAD, ty); ty += VAL_LH; }
  };
  const sectionBar = (title: string, nextH: number) => {
    ensure(17 + nextH);
    const [tIs2, tEn2] = splitLang(title);
    doc.setFillColor(...ORANGE); doc.rect(M, y, CW, 17, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255);
    doc.text(tIs2, M + PAD, y + 11.8);
    if (tEn2) {
      const wIs = doc.getTextWidth(tIs2);
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(255, 226, 200);
      doc.text(`/ ${tEn2}`, M + PAD + wIs + 5, y + 11.8);
    }
    y += 17;
  };

  for (const sec of parsed.sections) {
    if (!sec.rows.length && !sec.paras.length) continue;
    // Pack fields into rows: two per row when both are short.
    const rows = pairFields(sec.rows);
    const lays = rows.map((r) => r.length === 2
      ? r.map(([k, v]) => layout(k, v, CW / 2))
      : [layout(r[0][0], r[0][1], CW)]);
    const paraLays = sec.paras.map((p) => {
      const [pIs, pEn] = splitLang(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.4);
      const a = doc.splitTextToSize(pIs, CW - PAD * 2) as string[];
      doc.setFont("helvetica", "italic");
      const b = pEn ? doc.splitTextToSize(pEn, CW - PAD * 2) as string[] : [];
      return { a, b, h: PAD * 2 + (a.length + b.length) * 10.4 + (b.length ? 3 : 0) };
    });
    const firstH = lays[0] ? Math.max(...lays[0].map((l) => l.h)) : (paraLays[0]?.h ?? 0);
    if (sec.title) sectionBar(sec.title, firstH);
    lays.forEach((cells) => {
      const h = Math.max(...cells.map((l) => l.h));
      ensure(h);
      if (cells.length === 2) { drawCell(M, CW / 2, h, cells[0]); drawCell(M + CW / 2, CW / 2, h, cells[1]); }
      else drawCell(M, CW, h, cells[0]);
      y += h;
    });
    for (const pl of paraLays) {
      ensure(pl.h);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.7); doc.rect(M, y, CW, pl.h);
      let ty = y + PAD + 7.5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.4); doc.setTextColor(...INK);
      for (const ln of pl.a) { doc.text(ln, M + PAD, ty); ty += 10.4; }
      if (pl.b.length) ty += 3;
      doc.setFont("helvetica", "italic"); doc.setTextColor(...MUT);
      for (const ln of pl.b) { doc.text(ln, M + PAD, ty); ty += 10.4; }
      y += pl.h;
    }
    y += 10;
  }

  // ---- Signature block (like the official forms, two columns) ----
  const need = 150;
  if (y + need > H - 60) { doc.addPage(); y = M; }
  y += 10;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
  doc.text("Undirritun / Signatures", M, y);
  doc.setDrawColor(...ORANGE); doc.setLineWidth(1.2);
  doc.line(M, y + 5, M + 150, y + 5);
  y += 34;

  const colW = (W - M * 2 - 40) / 2;
  const sigLine = (x: number, yy: number, w: number, labelIs: string, labelEn: string) => {
    doc.setDrawColor(120); doc.setLineWidth(0.8);
    doc.line(x, yy, x + w, yy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUT);
    doc.text(`${labelIs} / ${labelEn}`, x, yy + 12);
  };
  // Row 1: place + date
  sigLine(M, y + 18, colW, "Staður", "Place");
  sigLine(M + colW + 40, y + 18, colW, "Dagsetning", "Date");
  // Row 2: signatures
  sigLine(M, y + 70, colW, "Undirskrift vinnuveitanda", "Employer's signature");
  sigLine(M + colW + 40, y + 70, colW, "Undirskrift starfsmanns", "Employee's signature");
  // Electronic signatures are written onto the lines; details on the record page.
  const emp = signatures.find((s) => s.role === "employer");
  const ee = signatures.find((s) => s.role === "employee");
  doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...INK);
  if (emp) doc.text(`Rafrænt: ${emp.name}`, M, y + 64);
  if (ee) doc.text(`Rafrænt: ${ee.name}`, M + colW + 40, y + 64);
  const last = ee ?? emp;
  if (last) {
    doc.setFont("helvetica", "normal");
    doc.text("Rafræn undirritun í VAKTO", M, y + 12);
    doc.text(fmtUtc(last.signedAt).replace(" (UTC)", " UTC"), M + colW + 40, y + 12);
  }

  // ---- Signature record (audit trail) ----
  if (signatures.length) {
    doc.addPage();
    let ay = 60;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...INK);
    doc.text("Undirritunarskrá / Signature record", M, ay);
    doc.setDrawColor(...ORANGE); doc.setLineWidth(1.6); doc.line(M, ay + 8, W - M, ay + 8);
    ay += 26;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUT);
    const intro = doc.splitTextToSize(
      "Samningurinn var undirritaður rafrænt í VAKTO. Fingrafar (SHA-256) er reiknað af samningstextanum eins og hann var sendur; " +
      "ef einn stafur breytist verður fingrafarið annað. / The contract was signed electronically in VAKTO. The SHA-256 fingerprint is " +
      "computed from the contract text as sent; changing a single character changes it.", W - M * 2);
    doc.text(intro, M, ay); ay += intro.length * 11 + 8;
    autoTable(doc, {
      startY: ay, margin: { left: M, right: M, bottom: 60 }, theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 6, lineColor: LINE, lineWidth: 0.7, textColor: INK, overflow: "linebreak" },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 150, fillColor: [250, 248, 246] } },
      body: [["Fingrafar skjals / Document SHA-256", signatures[signatures.length - 1].sha256]],
    });
    ay = ((doc as Doc).lastAutoTable?.finalY ?? ay) + 14;
    for (const s of signatures) {
      autoTable(doc, {
        startY: ay, margin: { left: M, right: M, bottom: 60 }, theme: "grid",
        head: [[{ content: s.role === "employer" ? "Vinnuveitandi / Employer" : "Starfsmaður / Employee", colSpan: 2 }]],
        styles: { fontSize: 8.5, cellPadding: 6, lineColor: LINE, lineWidth: 0.7, textColor: INK, overflow: "linebreak" },
        headStyles: { ...headStyles, fontSize: 9.5 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 150, fillColor: [250, 248, 246] } },
        body: [
          ["Nafn / Name", s.name],
          ["Netfang / Email", s.email ?? "—"],
          ["Aðferð / Method", METHOD[s.method] ?? s.method],
          ["Tími / Time", fmtUtc(s.signedAt)],
          ["IP-tala / IP address", s.ip ?? "—"],
          ["Tæki / Device", s.userAgent ?? "—"],
          ["Fingrafar / SHA-256", s.sha256],
        ],
      });
      ay = ((doc as Doc).lastAutoTable?.finalY ?? ay) + 14;
    }
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); drawFooter(doc, i, pages); }

  return doc;
}
