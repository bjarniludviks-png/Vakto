// Client-side PDF for employment contracts. Renders the stored markdown-ish
// contract content (headings, **key:** value lines, signature lines) into a
// clean A4 document. jsPDF imported lazily — never hits the server bundle.

export async function downloadContractPdf(title: string, content: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > H - M) { doc.addPage(); y = M; }
  };
  const para = (text: string, size: number, style: "normal" | "bold" | "italic" = "normal", gapAfter = 6) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, W - M * 2) as string[];
    for (const ln of lines) {
      ensure(size * 1.35);
      doc.text(ln, M, y);
      y += size * 1.35;
    }
    y += gapAfter;
  };

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { y += 4; continue; }
    if (line.startsWith("# ")) { para(line.slice(2), 17, "bold", 10); continue; }
    if (line.startsWith("## ")) { ensure(40); y += 8; para(line.slice(3), 12.5, "bold", 4); continue; }
    const kv = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (kv) {
      ensure(16);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      doc.text(`${kv[1]}:`, M, y);
      doc.setFont("helvetica", "normal");
      doc.text(kv[2], M + doc.getTextWidth(`${kv[1]}: `) + 6, y);
      y += 16;
      continue;
    }
    if (line.startsWith("_") && line.endsWith("_")) { para(line.slice(1, -1), 10.5, "italic", 4); continue; }
    para(line, 10.5, "normal", 2);
  }

  // footer on every page
  const pages = doc.getNumberOfPages();
  const today = new Date();
  const stamp = `VAKTO · ${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(150);
    doc.text(stamp, M, H - 28);
    doc.text(`${i} / ${pages}`, W - M, H - 28, { align: "right" });
    doc.setTextColor(0);
  }
  doc.save(`${title.replace(/[^\wÀ-ÿ —-]+/g, "").trim() || "Radningarsamningur"}.pdf`);
}
