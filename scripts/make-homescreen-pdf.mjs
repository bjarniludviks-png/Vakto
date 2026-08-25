// Generates the trilingual "VAKTO á heimaskjáinn" instruction PDF (IS/EN/VI).
// Run: node scripts/make-homescreen-pdf.mjs [out.pdf]
import { jsPDF } from "jspdf";

const out = process.argv[2] || "VAKTO-heimaskjar-leidbeiningar.pdf";
const ORANGE = [233, 112, 15];
const INK = [26, 26, 31];
const MUT = [95, 100, 112];
const LINE = [230, 230, 233];

const L = [
  {
    title: "Settu VAKTO á heimaskjáinn",
    sub: "Þá virkar VAKTO eins og app í símanum þínum — með tilkynningum um ný skilaboð, nýtt vaktaplan og svör við beiðnum.",
    ios: ["Opnaðu vakto.is í Safari og skráðu þig inn", "Ýttu á Deila-hnappinn (ferningur með ör upp)", "Veldu „Add to Home Screen“ / „Bæta á heimaskjá“ og ýttu á Add", "Opnaðu VAKTO ALLTAF með nýja íkoninum — annars leyfir iPhone ekki tilkynningar"],
    android: ["Opnaðu vakto.is í Chrome og skráðu þig inn", "Ýttu á ⋮ valmyndina efst í hægra horni", "Veldu „Add to Home screen“ / „Setja á heimaskjá“ og staðfestu"],
    notif: ["Opnaðu appið af heimaskjánum", "Farðu í Mitt svæði", "Ýttu á „Virkja tilkynningar“ og veldu Leyfa/Allow"],
    iosH: "iPhone (Safari)", andH: "Android (Chrome)", notifH: "Kveikja á tilkynningum", langName: "ÍSLENSKA",
  },
  {
    title: "Add VAKTO to your home screen",
    sub: "VAKTO then works like an app on your phone — with notifications for new messages, new schedules and request updates.",
    ios: ["Open vakto.is in Safari and sign in", "Tap the Share button (square with an arrow)", "Choose \"Add to Home Screen\" and tap Add", "ALWAYS open VAKTO from the new icon — otherwise iPhone blocks notifications"],
    android: ["Open vakto.is in Chrome and sign in", "Tap the ⋮ menu in the top-right corner", "Choose \"Add to Home screen\" and confirm"],
    notif: ["Open the app from your home screen", "Go to My area", "Tap \"Enable notifications\" and choose Allow"],
    iosH: "iPhone (Safari)", andH: "Android (Chrome)", notifH: "Turn on notifications", langName: "ENGLISH",
  },
  {
    title: "Thêm VAKTO vào màn hình chính",
    sub: "VAKTO sẽ hoạt động như một ứng dụng trên điện thoại — với thông báo về tin nhắn mới, lịch làm việc mới và phản hồi yêu cầu.",
    ios: ["Mở vakto.is trong Safari và đăng nhập", "Nhấn nút Chia sẻ (hình vuông có mũi tên)", "Chọn \"Add to Home Screen\" và nhấn Add", "LUÔN mở VAKTO từ biểu tượng mới — nếu không iPhone sẽ chặn thông báo"],
    android: ["Mở vakto.is trong Chrome và đăng nhập", "Nhấn menu ⋮ ở góc trên bên phải", "Chọn \"Add to Home screen\" và xác nhận"],
    notif: ["Mở ứng dụng từ màn hình chính", "Vào Khu vực của tôi (My area)", "Nhấn \"Enable notifications\" và chọn Allow"],
    iosH: "iPhone (Safari)", andH: "Android (Chrome)", notifH: "Bật thông báo", langName: "TIẾNG VIỆT",
  },
];

const doc = new jsPDF({ unit: "mm", format: "a4" });
const SCRATCH = "/private/tmp/claude-501/-Users-bjarniludviksson-vakto/05183ff4-7839-4e1f-a397-d8eae2a2cf4c/scratchpad";
import { readFileSync } from "node:fs";
for (const [file, style] of [["Roboto-400.ttf", "normal"], ["Roboto-700.ttf", "bold"]]) {
  doc.addFileToVFS(file, readFileSync(SCRATCH + "/" + file).toString("base64"));
  doc.addFont(file, "Roboto", style);
}
const W = 210, M = 18;

function header(langName) {
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, W, 26, "F");
  // brand bars
  doc.setFillColor(255, 217, 174); doc.roundedRect(M, 12.5, 2.4, 7, 1, 1, "F");
  doc.setFillColor(255, 237, 217); doc.roundedRect(M + 3.6, 9.5, 2.4, 10, 1, 1, "F");
  doc.setFillColor(255, 255, 255); doc.roundedRect(M + 7.2, 6.5, 2.4, 13, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Roboto", "bold"); doc.setFontSize(17);
  doc.text("VAKTO", M + 13, 17.5);
  doc.setFontSize(9); doc.setFont("Roboto", "bold");
  doc.text(langName, W - M, 16.5, { align: "right" });
}

function section(y, title, steps, numbered = true) {
  doc.setFillColor(...ORANGE);
  doc.roundedRect(M, y, 2, 6, 1, 1, "F");
  doc.setTextColor(...INK);
  doc.setFont("Roboto", "bold"); doc.setFontSize(12.5);
  doc.text(title, M + 5, y + 4.8);
  let yy = y + 12;
  doc.setFont("Roboto", "normal"); doc.setFontSize(10.5);
  steps.forEach((s, i) => {
    if (numbered) {
      doc.setFillColor(253, 241, 230);
      doc.circle(M + 3, yy - 1.2, 3.4, "F");
      doc.setTextColor(...ORANGE); doc.setFont("Roboto", "bold"); doc.setFontSize(9.5);
      doc.text(String(i + 1), M + 3, yy + 0.1, { align: "center" });
    }
    doc.setTextColor(...INK); doc.setFont("Roboto", "normal"); doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(s, W - M * 2 - 12);
    doc.text(lines, M + 9, yy);
    yy += lines.length * 4.9 + 3.4;
  });
  return yy + 3;
}

L.forEach((l, idx) => {
  if (idx > 0) doc.addPage();
  header(l.langName);
  doc.setTextColor(...INK);
  doc.setFont("Roboto", "bold"); doc.setFontSize(19);
  doc.text(l.title, M, 40);
  doc.setFont("Roboto", "normal"); doc.setFontSize(11); doc.setTextColor(...MUT);
  doc.text(doc.splitTextToSize(l.sub, W - M * 2), M, 47.5);
  let y = 62;
  y = section(y, l.iosH, l.ios);
  doc.setDrawColor(...LINE); doc.line(M, y - 1, W - M, y - 1); y += 5;
  y = section(y, l.andH, l.android);
  doc.setDrawColor(...LINE); doc.line(M, y - 1, W - M, y - 1); y += 5;
  y = section(y, l.notifH, l.notif);
  // footer
  doc.setFontSize(9.5); doc.setTextColor(...MUT);
  doc.text("vakto.is  ·  help@vakto.is", M, 285);
});

doc.save ? null : null;
import { writeFileSync } from "node:fs";
writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
console.log("PDF written:", out);
