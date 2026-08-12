// Client-side PDF for employment contracts — branded like the schedule/report
// PDFs (orange section bars, VAKTO mark, bordered form layout à la the classic
// Icelandic ráðningarsamningur forms). Parses the stored markdown-ish content
// (## sections, **key:** value lines, free paragraphs). jsPDF + autotable are
// imported lazily so they never hit the server bundle.
import type { jsPDF } from "jspdf";

const ORANGE: [number, number, number] = [233, 112, 15];
const INK: [number, number, number] = [17, 17, 17];
const MUT: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [225, 225, 228];

type Section = { title: string; rows: [string, string][]; paras: string[] };

function parseContract(content: string): { title: string; sections: Section[] } {
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

export async function downloadContractPdf(title: string, content: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

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

  doc.setFont("helvetica", "bold"); doc.setFontSize(21); doc.setTextColor(...INK);
  doc.text(tIs ?? "Ráðningarsamningur", M, topY + 42);
  if (tEn) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(11.5); doc.setTextColor(...MUT);
    doc.text(tEn, M, topY + 58);
  }
  doc.setDrawColor(...ORANGE); doc.setLineWidth(2.2);
  doc.line(M, topY + 70, W - M, topY + 70);

  let y = topY + 84;

  // ---- Sections as bordered form tables with orange section-header bars ----
  type Doc = jsPDF & { lastAutoTable?: { finalY: number } };
  const baseStyles = { fontSize: 10, cellPadding: { top: 7, bottom: 7, left: 9, right: 9 }, lineColor: LINE, lineWidth: 0.7, textColor: INK } as const;
  const headStyles = { fillColor: ORANGE, textColor: 255, fontStyle: "bold", fontSize: 10.5, cellPadding: { top: 7, bottom: 7, left: 9, right: 9 } } as const;
  for (const sec of parsed.sections) {
    if (!sec.rows.length && !sec.paras.length) continue;
    if (sec.rows.length) {
      // Two-column key/value form table; free paragraphs span both columns.
      const body: (string[] | { content: string; colSpan: number }[])[] = sec.rows.map(([k, v]) => [k, v || "—"]);
      for (const p of sec.paras) body.push([{ content: p, colSpan: 2 }]);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, bottom: 60 },
        head: sec.title ? [[{ content: sec.title, colSpan: 2 }]] : undefined,
        body,
        theme: "grid",
        styles: { ...baseStyles },
        headStyles: { ...headStyles },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 170, fillColor: [250, 248, 246] }, 1: { cellWidth: "auto" } },
      });
    } else {
      // Paragraph-only section (e.g. Annað/Other) — single wide column, since
      // autotable can't size columns that only ever appear inside a colSpan.
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, bottom: 60 },
        head: sec.title ? [[sec.title]] : undefined,
        body: sec.paras.map((p) => [p]),
        theme: "grid",
        styles: { ...baseStyles },
        headStyles: { ...headStyles },
      });
    }
    y = ((doc as Doc).lastAutoTable?.finalY ?? y) + 14;
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

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); drawFooter(doc, i, pages); }

  doc.save(`${title.replace(/[^\wÀ-ÿ —-]+/g, "").trim() || "Radningarsamningur"}.pdf`);
}
