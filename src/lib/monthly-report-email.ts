import "server-only";
import { template } from "@/lib/email";
import { nf, dec1 } from "@/lib/format";

// Mánaðarskýrsla eiganda — HTML (VAKTO-póstskelin í email.ts) + hreinn texti.
// Engin útreikningur hér: allar tölur koma tilbúnar úr monthly-report.server.ts (labor.ts).

export type MonthlyDeviation = { kind: "overtime" | "overPlan" | "sick"; name: string; hours?: number; kr?: number; days?: number };

export type MonthlyReportData = {
  company: string;
  month: { is: string; en: string };      // „september 2026“
  prevMonth: { is: string; en: string };
  target: number;
  pct: number | null;
  prevPct: number | null;
  tone: "good" | "warn" | "bad" | null;
  revenue: number;
  revenueEstimatedDays: number;           // dagar fylltir með vikudagsmeðaltali
  cost: number;
  prevCost: number;
  hours: number;
  planned: number;
  overtime: number;
  overtimePay: number;
  sickDays: number;
  sickRate: number | null;                // % af vinnudögum (veikindadagar ÷ (veikindadagar + unnir dagar))
  deviations: MonthlyDeviation[];
  open: { requests: number; unapproved: number; openPunches: number };
  commentary: { is: string; en: string } | null;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
const INK = "#1d1d1f", MUTED = "#6e6e73", FAINT = "#86868b", LINE = "#ececf0";
const TONE = { good: "#1f9d6b", warn: "#a8741a", bad: "#d8483a" } as const;

const pctTxt = (p: number | null) => (p == null ? "—" : `${dec1(p)} %`);
const krTxt = (n: number) => `${nf(n)} kr`;
/** 1312.5 → „1.312,5“ (dec1 + þúsundapunktar). */
const d1 = (n: number) => { const [i, f] = dec1(Math.abs(n)).split(","); return `${n < 0 ? "-" : ""}${nf(Number(i))},${f}`; };
const hTxt = (n: number) => `${d1(n)} klst`;
const enNum = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const hTxtEn = (n: number) => { const [i, f] = Math.abs(n).toFixed(1).split("."); return `${n < 0 ? "-" : ""}${enNum(Number(i))}.${f} h`; };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** „1,8 prósentustigum lægra en í ágúst“ — eða null þegar samanburð vantar. */
function vsPrev(d: MonthlyReportData): { is: string; en: string; better: boolean } | null {
  if (d.pct == null || d.prevPct == null) return null;
  const diff = Math.round((d.pct - d.prevPct) * 10) / 10;
  if (Math.abs(diff) < 0.05) return { is: `óbreytt frá ${d.prevMonth.is.split(" ")[0]}`, en: `unchanged from ${d.prevMonth.en.split(" ")[0]}`, better: true };
  const lower = diff < 0;
  return {
    is: `${dec1(Math.abs(diff))} prósentustigum ${lower ? "lægra" : "hærra"} en í ${d.prevMonth.is.split(" ")[0]} (${pctTxt(d.prevPct)})`,
    en: `${Math.abs(diff).toFixed(1)} pts ${lower ? "lower" : "higher"} than ${d.prevMonth.en.split(" ")[0]} (${d.prevPct.toFixed(1)} %)`,
    better: lower,
  };
}

function vsTarget(d: MonthlyReportData): { is: string; en: string } | null {
  if (d.pct == null) return null;
  const diff = Math.round((d.pct - d.target) * 10) / 10;
  if (diff <= 0) return { is: `innan markmiðs (${dec1(d.target)} %)`, en: `within target (${d.target.toFixed(1)} %)` };
  return { is: `${dec1(diff)} prósentustigum yfir markmiði (${dec1(d.target)} %)`, en: `${diff.toFixed(1)} pts above target (${d.target.toFixed(1)} %)` };
}

const devLine = (x: MonthlyDeviation): { is: string; en: string; v: string; vEn: string } => {
  if (x.kind === "overtime") return { is: "Mest yfirvinna", en: "Most overtime", v: `${hTxt(x.hours ?? 0)}${x.kr ? ` · ${krTxt(x.kr)}` : ""}`, vEn: `${hTxtEn(x.hours ?? 0)}` };
  if (x.kind === "overPlan") return { is: "Mest umfram vaktaplan", en: "Most hours over schedule", v: `+${hTxt(x.hours ?? 0)}`, vEn: `+${hTxtEn(x.hours ?? 0)}` };
  return { is: "Flestir veikindadagar", en: "Most sick days", v: `${x.days} ${x.days === 1 ? "dagur" : "dagar"}`, vEn: `${x.days} ${x.days === 1 ? "day" : "days"}` };
};

export function monthlyReportSubject(d: MonthlyReportData): string {
  return `${d.company} · Mánaðarskýrsla ${d.month.is}${d.pct != null ? ` · laun ${pctTxt(d.pct)} af veltu` : ""}`;
}

export function monthlyReportHtml(d: MonthlyReportData): string {
  const tone = d.tone ? TONE[d.tone] : INK;
  const prev = vsPrev(d), tgt = vsTarget(d);
  const sec = (t: string) => `<div style="font-size:15px;font-weight:600;color:${INK};margin:34px 0 4px">${t}</div>`;

  const hero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr>
      <td style="background:#f5f5f7;border-radius:16px;padding:22px 22px 20px">
        <div style="font-size:13px;font-weight:600;color:${MUTED};letter-spacing:.2px">Laun % af veltu</div>
        <div style="font-size:44px;line-height:1.1;font-weight:700;letter-spacing:-1px;color:${tone};padding-top:6px;font-variant-numeric:tabular-nums">${pctTxt(d.pct)}</div>
        ${d.pct == null
          ? `<div style="font-size:14px;color:${MUTED};padding-top:6px">Engin velta skráð í mánuðinum — skráðu veltu eða tengdu kassakerfi til að sjá hlutfallið.</div>`
          : `<div style="font-size:14px;line-height:1.55;color:${MUTED};padding-top:6px">${tgt ? `<span style="color:${tone};font-weight:600">${tgt.is}</span>` : ""}${prev ? `<br>${prev.is}` : ""}</div>`}
      </td></tr></table>`;

  const commentary = d.commentary
    ? `<div style="margin:22px 0 0;padding:14px 16px;border-left:3px solid #e9700f;background:#fdf6ef;border-radius:0 12px 12px 0;font-size:15px;line-height:1.6;color:${INK}">${esc(d.commentary.is)}</div>`
    : "";

  const rows: [string, string][] = [
    ["Velta", krTxt(d.revenue)],
    ["Launakostnaður með gjöldum", `${krTxt(d.cost)}${d.prevCost ? `<br><span style="font-size:12px;font-weight:400;color:${FAINT}">${d.prevMonth.is.split(" ")[0]}: ${krTxt(d.prevCost)}</span>` : ""}`],
    ["Unnir tímar / áætlaðir", `${hTxt(d.hours)} / ${hTxt(d.planned)}`],
    ["Yfirvinna", d.overtime > 0 ? `${hTxt(d.overtime)} · ${krTxt(d.overtimePay)}` : "Engin"],
    ["Veikindi", d.sickDays > 0 ? `${d.sickDays} ${d.sickDays === 1 ? "dagur" : "dagar"}${d.sickRate != null ? ` · ${dec1(d.sickRate)} %` : ""}` : "Engin skráð"],
  ];
  const table = (rs: [string, string][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0">${rs.map(([k, v], i) => `<tr>
      <td style="padding:12px 16px 12px 0;border-top:1px solid ${i === 0 ? LINE : "#f2f2f5"};font-size:15px;color:${MUTED};vertical-align:top">${k}</td>
      <td align="right" style="padding:12px 0;border-top:1px solid ${i === 0 ? LINE : "#f2f2f5"};font-size:15px;font-weight:600;color:${INK};font-variant-numeric:tabular-nums;white-space:nowrap">${v}</td></tr>`).join("")}</table>`;

  const devs = d.deviations.length
    ? sec("Helstu frávik") + table(d.deviations.map((x) => { const l = devLine(x); return [`${l.is}<br><span style="font-size:14px;font-weight:600;color:${INK}">${esc(x.name)}</span>`, l.v]; }))
    : "";

  const openRows: [string, string][] = [];
  if (d.open.requests) openRows.push(["Óafgreiddar beiðnir (frí og vaktaskipti)", String(d.open.requests)]);
  if (d.open.unapproved) openRows.push(["Ósamþykktar stimplanir í mánuðinum", String(d.open.unapproved)]);
  if (d.open.openPunches) openRows.push(["Stimplanir án útstimplunar", `<span style="color:${TONE.bad}">${d.open.openPunches}</span>`]);
  const open = sec("Opin mál") + (openRows.length ? table(openRows) : `<div style="font-size:14px;color:${MUTED};padding-top:6px">Ekkert opið — allt afgreitt.</div>`);

  const note = `<div style="font-size:12px;line-height:1.6;color:${FAINT};padding-top:22px">
      ${d.revenueEstimatedDays ? `Velta ${d.revenueEstimatedDays} ${d.revenueEstimatedDays === 1 ? "dags" : "daga"} er áætluð út frá meðalveltu vikudaga. ` : ""}Tölurnar eru reiknaðar á sama hátt og í Innsýn.
      Þú getur slökkt á þessum pósti í <a href="${APP_URL}/stillingar" style="color:${FAINT};text-decoration:underline">Stillingum</a>.
    </div>`;

  return template({
    preheader: `${d.company} · ${d.month.is}: laun ${pctTxt(d.pct)} af veltu, velta ${krTxt(d.revenue)}.`,
    heading: `Mánaðarskýrsla · ${d.month.is}`,
    body: `Yfirlit fyrir <b>${esc(d.company)}</b> í ${d.month.is.split(" ")[0]}.`,
    extraHtml: hero + commentary + table(rows) + devs + open + note,
    headingEn: `Monthly report · ${d.month.en}`,
    bodyEn: d.commentary
      ? `<b>${esc(d.company)}</b>: ${esc(d.commentary.en)}`
      : `<b>${esc(d.company)}</b>: labour cost was ${d.pct == null ? "not computable (no revenue recorded)" : `${d.pct.toFixed(1)} % of revenue`}${tgt && d.pct != null ? `, ${tgt.en}` : ""}${prev ? `; ${prev.en}` : ""}.`,
    rowsEn: [
      ["Revenue", `ISK ${enNum(d.revenue)}`],
      ["Labour cost incl. levies", `ISK ${enNum(d.cost)}`],
      ["Hours worked / scheduled", `${hTxtEn(d.hours)} / ${hTxtEn(d.planned)}`],
      ["Overtime", d.overtime > 0 ? `${hTxtEn(d.overtime)} · ISK ${enNum(d.overtimePay)}` : "None"],
      ["Sick days", String(d.sickDays)],
      ["Open items", String(d.open.requests + d.open.unapproved + d.open.openPunches)],
    ],
    ctaLabel: "Opna Innsýn",
    ctaLabelEn: "Open Insights",
    ctaHref: `${APP_URL}/innsyn`,
  });
}

export function monthlyReportText(d: MonthlyReportData): string {
  const prev = vsPrev(d), tgt = vsTarget(d);
  const L: string[] = [
    `Mánaðarskýrsla · ${d.month.is}`,
    d.company,
    "",
    `Laun % af veltu: ${pctTxt(d.pct)}${tgt ? ` — ${tgt.is}` : ""}`,
    ...(prev ? [prev.is] : []),
    ...(d.commentary ? ["", d.commentary.is] : []),
    "",
    `Velta: ${krTxt(d.revenue)}`,
    `Launakostnaður með gjöldum: ${krTxt(d.cost)}${d.prevCost ? ` (${d.prevMonth.is.split(" ")[0]}: ${krTxt(d.prevCost)})` : ""}`,
    `Unnir tímar / áætlaðir: ${hTxt(d.hours)} / ${hTxt(d.planned)}`,
    `Yfirvinna: ${d.overtime > 0 ? `${hTxt(d.overtime)} · ${krTxt(d.overtimePay)}` : "engin"}`,
    `Veikindi: ${d.sickDays} dagar${d.sickRate != null ? ` · ${dec1(d.sickRate)} %` : ""}`,
  ];
  if (d.deviations.length) {
    L.push("", "Helstu frávik:");
    for (const x of d.deviations) { const l = devLine(x); L.push(`- ${l.is}: ${x.name} — ${l.v}`); }
  }
  L.push("", "Opin mál:");
  if (!d.open.requests && !d.open.unapproved && !d.open.openPunches) L.push("- Ekkert opið");
  else {
    if (d.open.requests) L.push(`- Óafgreiddar beiðnir: ${d.open.requests}`);
    if (d.open.unapproved) L.push(`- Ósamþykktar stimplanir: ${d.open.unapproved}`);
    if (d.open.openPunches) L.push(`- Stimplanir án útstimplunar: ${d.open.openPunches}`);
  }
  L.push("", `Opna Innsýn: ${APP_URL}/innsyn`, "",
    `Monthly report · ${d.month.en} — labour ${d.pct == null ? "n/a" : `${d.pct.toFixed(1)} %`} of revenue, revenue ISK ${enNum(d.revenue)}, cost ISK ${enNum(d.cost)}.`,
    "", `Slökkva á þessum pósti / turn off: ${APP_URL}/stillingar`);
  return L.join("\n");
}
