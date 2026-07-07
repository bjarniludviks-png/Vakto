// Client-side Excel (.xlsx) + PDF export for the time report. Heavy deps are
// dynamically imported so they don't bloat the initial bundle.
import { dec1, nf } from "@/lib/format";
import type { TimeReportRow } from "@/app/(app)/timaskraning/actions";

const statusIs = (a: boolean) => (a ? "Samþykkt" : "Bíður");
const r2 = (n: number) => Math.round(n * 100) / 100;

function totals(rows: TimeReportRow[]) {
  const total = rows.reduce((a, r) => a + r.hours, 0);
  const approved = rows.filter((r) => r.approved).reduce((a, r) => a + r.hours, 0);
  return { total: r2(total), approved: r2(approved), pending: r2(total - approved), count: rows.length, pendingCount: rows.filter((r) => !r.approved).length };
}

export async function exportTimeReportXlsx(rows: TimeReportRow[], company: string, from: string, to: string) {
  const XLSX = await import("xlsx");
  const t = totals(rows);
  const aoa: (string | number)[][] = [
    [`Tímaskýrsla — ${company}`],
    [`Tímabil: ${from} – ${to}`],
    [],
    ["Starfsmaður", "Dagsetning", "Inn", "Út", "Klst", "Staða"],
    ...rows.map((r) => [r.name, r.date, r.in, r.out ?? "—", r.hours, statusIs(r.approved)]),
    [],
    ["Samtals klst", "", "", "", t.total, `${t.count} færslur`],
    ["Samþykktar klst", "", "", "", t.approved, ""],
    ["Óafgreiddar klst", "", "", "", t.pending, `${t.pendingCount} bíða`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 9 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tímaskýrsla");
  XLSX.writeFile(wb, `vakto-timaskyrsla-${from}_${to}.xlsx`);
}

export async function exportTimeReportPdf(rows: TimeReportRow[], company: string, from: string, to: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();
  const t = totals(rows);
  doc.setFontSize(15); doc.setTextColor(20); doc.text(`Tímaskýrsla — ${company}`, 14, 18);
  doc.setFontSize(10); doc.setTextColor(120); doc.text(`Tímabil: ${from} – ${to}`, 14, 25);
  autoTable(doc, {
    startY: 31,
    head: [["Starfsmaður", "Dagsetning", "Inn", "Út", "Klst", "Staða"]],
    body: rows.map((r) => [r.name, r.date, r.in, r.out ?? "—", dec1(r.hours), statusIs(r.approved)]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [233, 112, 15], textColor: 255 },
    columnStyles: { 4: { halign: "right" } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 5) {
        d.cell.styles.textColor = d.cell.raw === "Bíður" ? [200, 60, 40] : [30, 150, 80];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });
  // @ts-expect-error autotable augments the doc at runtime
  const y = (doc.lastAutoTable?.finalY ?? 40) + 9;
  doc.setFontSize(10); doc.setTextColor(30);
  doc.text(`Samtals: ${dec1(t.total)} klst   ·   Samþykktar: ${dec1(t.approved)} klst   ·   Óafgreiddar: ${dec1(t.pending)} klst (${t.pendingCount})`, 14, y);

  logoFooter(doc);
  doc.save(`vakto-timaskyrsla-${from}_${to}.pdf`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logoFooter(doc: any) {
  const pages = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const by = ph - 10;
    // Three ascending bars in the brand shades (matches the app logo).
    doc.setFillColor(245, 147, 49); doc.rect(14, by - 3.5, 2, 3.5, "F");   // --brand-2
    doc.setFillColor(233, 112, 15); doc.rect(16.6, by - 5.5, 2, 5.5, "F"); // --brand
    doc.setFillColor(207, 95, 12); doc.rect(19.2, by - 7.5, 2, 7.5, "F");  // --brand-deep
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(233, 112, 15);
    doc.text("VAKTO", 23, by);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text("vakto.is", pw - 14, by, { align: "right" });
  }
}

export type TableExport = { title: string; company: string; from: string; to: string; columns: string[]; numeric: number[]; rows: (string | number)[][] };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9áðéíóúýþæö]+/gi, "-").replace(/^-|-$/g, "");

/** Generic branded table → .xlsx (manager report library). */
export async function exportTableXlsx(d: TableExport) {
  const XLSX = await import("xlsx");
  const aoa: (string | number)[][] = [
    [`${d.title} — ${d.company}`],
    [`Tímabil: ${d.from} – ${d.to}`],
    [],
    d.columns,
    ...d.rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = d.columns.map((c, i) => ({ wch: Math.max(12, c.length + 2, i === 0 ? 24 : 0) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, d.title.slice(0, 31));
  XLSX.writeFile(wb, `vakto-${slug(d.title)}-${d.from}_${d.to}.xlsx`);
}

/** Generic branded table → PDF (manager report library). */
export async function exportTablePdf(d: TableExport) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF(d.columns.length > 6 ? "landscape" : "portrait");
  doc.setFontSize(15); doc.setTextColor(20); doc.text(`${d.title} — ${d.company}`, 14, 18);
  doc.setFontSize(10); doc.setTextColor(120); doc.text(`Tímabil: ${d.from} – ${d.to}`, 14, 25);
  const columnStyles: Record<number, { halign: "right" }> = {};
  for (const i of d.numeric) columnStyles[i] = { halign: "right" };
  autoTable(doc, {
    startY: 31,
    head: [d.columns],
    body: d.rows.map((r) => r.map((v) => (typeof v === "number" ? (Number.isInteger(v) ? nf(v) : dec1(v)) : v))),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [233, 112, 15], textColor: 255 },
    columnStyles,
  });
  logoFooter(doc);
  doc.save(`vakto-${slug(d.title)}-${d.from}_${d.to}.pdf`);
}

export type PayslipExport = { name: string; period: string; company?: string; hours: string; gross: string; withholding: string; pension: string; net: string };

/** Branded single-employee payslip (launaseðill) PDF. */
export async function exportPayslipPdf(d: PayslipExport) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();
  doc.setFontSize(15); doc.setTextColor(20); doc.text(`Launaseðill — ${d.name}`, 14, 18);
  doc.setFontSize(10); doc.setTextColor(120);
  doc.text(`${d.company ? d.company + " · " : ""}${d.period}`, 14, 25);
  autoTable(doc, {
    startY: 32,
    theme: "plain",
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: { 0: { textColor: [95, 100, 112] }, 1: { halign: "right", fontStyle: "bold" } },
    body: [
      ["Tímar", `${d.hours} klst`],
      ["Brúttólaun", `${d.gross} kr`],
      ["Staðgreiðsla", `-${d.withholding} kr`],
      ["Lífeyrir + félagsgjald", `-${d.pension} kr`],
    ],
  });
  // @ts-expect-error autotable augments the doc at runtime
  const y = (doc.lastAutoTable?.finalY ?? 60) + 4;
  doc.setDrawColor(230); doc.line(14, y, 196, y);
  doc.setFontSize(13); doc.setTextColor(20); doc.setFont("helvetica", "bold");
  doc.text("Útborgað", 14, y + 11);
  doc.setTextColor(30, 150, 80);
  doc.text(`${d.net} kr`, 196, y + 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  logoFooter(doc);
  doc.save(`vakto-launasedill-${d.name.replace(/\s+/g, "-")}.pdf`);
}
