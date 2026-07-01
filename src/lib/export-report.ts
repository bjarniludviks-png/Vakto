// Client-side Excel (.xlsx) + PDF export for the time report. Heavy deps are
// dynamically imported so they don't bloat the initial bundle.
import { dec1 } from "@/lib/format";
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

  // VAKTO logo footer on every page (three ascending bars + wordmark).
  const pages = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const by = ph - 10;
    doc.setFillColor(233, 112, 15);
    doc.rect(14, by - 3.5, 2, 3.5, "F");
    doc.rect(16.6, by - 5.5, 2, 5.5, "F");
    doc.rect(19.2, by - 7.5, 2, 7.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(233, 112, 15);
    doc.text("VAKTO", 23, by);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text("vakto.is", pw - 14, by, { align: "right" });
  }
  doc.save(`vakto-timaskyrsla-${from}_${to}.pdf`);
}
