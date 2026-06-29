// Client-side PDF generation for the schedule (day / week / month views).
// jsPDF + autotable are imported lazily so they never hit the server bundle.
import type { jsPDF } from "jspdf";
import { dec1 } from "@/lib/format";

export type PdfShift = { first: string; full: string; dept: string; time: string; hours: number };

export type PdfInput = {
  view: "Vika" | "Dagur" | "Mánuður";
  company: string;
  title: string;
  subtitle: string;
  generated: string; // "Búið til 29.6.2026 14:03"
  // Week/Day: ordered ISO dates + parallel column labels. Month: all ISO dates in the month.
  dates: string[];
  dayLabels: string[];
  byDate: Record<string, PdfShift[]>;
  monthName?: string;
  weekdayLabels: string[]; // ["Mán","Þri",…"Sun"] (translated)
};

const ORANGE: [number, number, number] = [233, 112, 15];
const INK: [number, number, number] = [17, 17, 17];
const MUT: [number, number, number] = [110, 110, 110];

function fileSafe(s: string) {
  return s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "vaktaplan";
}

export async function buildSchedulePdf(opts: PdfInput): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const landscape = opts.view !== "Dagur";
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });

  // Header band
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...ORANGE);
  doc.text(opts.company, 40, 44);
  doc.setTextColor(...INK); doc.setFontSize(13);
  doc.text(opts.title, 40, 64);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUT);
  doc.text(opts.subtitle, 40, 80);
  doc.text(opts.generated, 40, 93);

  const startY = 108;
  if (opts.view === "Dagur") dayTable(doc, autoTable, opts, startY);
  else if (opts.view === "Vika") weekTable(doc, autoTable, opts, startY);
  else monthTable(doc, autoTable, opts, startY);

  // Branded footer on every page.
  const pages = (doc as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    (doc as { setPage: (n: number) => void }).setPage(i);
    drawFooter(doc, i, pages);
  }

  const fname = `vaktaplan-${fileSafe(opts.company)}-${fileSafe(opts.subtitle)}.pdf`;
  doc.save(fname);
  return fname;
}

// Branded footer: VAKTO mark + wordmark + tagline, with a page counter.
function drawFooter(doc: jsPDF, pageNum: number, pageCount: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const by = H - 24; // baseline
  doc.setDrawColor(228, 228, 232); doc.setLineWidth(0.7);
  doc.line(40, by - 13, W - 40, by - 13);
  // ascending-bars logo mark
  const bx = 40;
  doc.setFillColor(...ORANGE);
  [6, 9, 12].forEach((h, i) => doc.roundedRect(bx + i * 5, by - h, 3.2, h, 1, 1, "F"));
  // wordmark + tagline
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...ORANGE);
  const wmX = bx + 21;
  doc.text("VAKTO", wmX, by - 1);
  const wmW = doc.getTextWidth("VAKTO");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUT);
  doc.text("Vaktaskipulag & launakostnaður · vakto.is", wmX + wmW + 9, by - 1);
  // page counter
  if (pageCount > 1) doc.text(`${pageNum} / ${pageCount}`, W - 40, by - 1, { align: "right" });
}

type AutoTable = (doc: unknown, opts: Record<string, unknown>) => void;

const headStyle = { fillColor: ORANGE, textColor: 255, fontStyle: "bold", fontSize: 9 };
const footStyle = { fillColor: [245, 245, 247] as [number, number, number], textColor: INK, fontStyle: "bold", fontSize: 9 };

function dayTable(doc: unknown, autoTable: AutoTable, o: PdfInput, startY: number) {
  const iso = o.dates[0];
  const rows = (o.byDate[iso] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const total = rows.reduce((a, r) => a + r.hours, 0);
  autoTable(doc, {
    startY,
    margin: { bottom: 46 },
    head: [["Starfsmaður", "Deild", "Tími", "Klst"]],
    body: rows.length
      ? rows.map((r) => [r.full, r.dept || "—", r.time, dec1(r.hours)])
      : [["Engar vaktir þennan dag.", "", "", ""]],
    foot: rows.length ? [["Samtals", "", `${rows.length} vaktir`, dec1(total)]] : undefined,
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: headStyle,
    footStyles: footStyle,
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });
}

function weekTable(doc: unknown, autoTable: AutoTable, o: PdfInput, startY: number) {
  // distinct employees across the week, keyed by full name
  const emap = new Map<string, { first: string; full: string; dept: string; cells: Record<string, string>; total: number }>();
  for (const iso of o.dates) {
    for (const s of o.byDate[iso] ?? []) {
      const e = emap.get(s.full) ?? { first: s.first, full: s.full, dept: s.dept, cells: {}, total: 0 };
      e.cells[iso] = s.time;
      e.total += s.hours;
      emap.set(s.full, e);
    }
  }
  const emps = [...emap.values()].sort((a, b) => (a.dept || "").localeCompare(b.dept || "") || a.full.localeCompare(b.full));
  const dayTotals = o.dates.map((iso) => (o.byDate[iso] ?? []).reduce((a, s) => a + s.hours, 0));
  const grand = dayTotals.reduce((a, b) => a + b, 0);

  autoTable(doc, {
    startY,
    margin: { bottom: 46 },
    head: [["Starfsmaður", ...o.dayLabels, "Klst"]],
    body: emps.length
      ? emps.map((e) => [e.full, ...o.dates.map((iso) => e.cells[iso] ?? "·"), dec1(e.total)])
      : [["Engar vaktir í vikunni.", ...o.dates.map(() => ""), ""]],
    foot: emps.length ? [["Samtals (klst)", ...dayTotals.map((h) => (h ? dec1(h) : "·")), dec1(grand)]] : undefined,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 4, halign: "center", valign: "middle", overflow: "linebreak" },
    headStyles: { ...headStyle, halign: "center" },
    footStyles: { ...footStyle, halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 110 }, [o.dates.length + 1]: { halign: "right" } },
  });
}

function monthTable(doc: unknown, autoTable: AutoTable, o: PdfInput, startY: number) {
  // Build a Mon-start calendar from the ISO dates of the month.
  const days = o.dates.map((iso) => ({ iso, d: Number(iso.slice(8, 10)), wd: (new Date(iso + "T00:00:00").getDay() + 6) % 7 }));
  const first = days[0];
  const lead = first ? first.wd : 0;
  const cells: ({ d: number; lines: string[]; more: number } | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (const day of days) {
    const sh = (o.byDate[day.iso] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
    const lines = sh.slice(0, 6).map((s) => `${s.first} ${s.time}`);
    cells.push({ d: day.d, lines, more: Math.max(0, sh.length - 6) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const body: string[][] = [];
  for (let w = 0; w < cells.length / 7; w++) {
    const row = cells.slice(w * 7, w * 7 + 7).map((c) => {
      if (!c) return "";
      const parts = [String(c.d), ...c.lines];
      if (c.more) parts.push(`+${c.more} fleiri`);
      return parts.join("\n");
    });
    body.push(row);
  }

  autoTable(doc, {
    startY,
    margin: { bottom: 46 },
    head: [o.weekdayLabels],
    body,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 4, valign: "top", overflow: "linebreak", minCellHeight: 64, lineColor: [225, 225, 228], lineWidth: 0.5 },
    headStyles: { ...headStyle, halign: "center" },
    columnStyles: Object.fromEntries(o.weekdayLabels.map((_, i) => [i, { cellWidth: (doc as { internal: { pageSize: { getWidth: () => number } } }).internal.pageSize.getWidth() - 80 < 700 ? "auto" : "auto" }])),
  });
}
