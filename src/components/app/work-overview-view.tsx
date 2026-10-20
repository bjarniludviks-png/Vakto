"use client";

// Vinnuyfirlit — sameiginleg sýn (stjórnandi og starfsmaður): samtölur, dagar, launaliðir, staðfestingarskrá.

import { useLang } from "@/components/app/lang";
import { dec1, nf } from "@/lib/format";
import { WO_ACTION, WO_STATUS, type WoRow } from "@/lib/work-overview";

const DOW = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${+d}.${+m}.`; };
const stamp = (s: string) => { const d = new Date(s); return `${d.getUTCDate()}.${d.getUTCMonth() + 1}. kl. ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const LEAVE: Record<string, string> = { orlof: "Orlof", veikindi: "Veikindi", olaunad: "Launalaust" };
const TONE: Record<string, string> = { muted: "mut", info: "info", good: "good", warn: "warn", brand: "pr" };

export function WoStatusPill({ status }: { status: WoRow["status"] }) {
  const { t } = useLang();
  const s = WO_STATUS[status];
  return <span className={`db2-pill ${TONE[s.tone]}`}>{t(s.label)}</span>;
}

export function WorkOverviewView({ row }: { row: WoRow }) {
  const { t } = useLang();
  const s = row.snapshot, tt = s.totals, p = s.pay;
  const sign = (n: number) => (n > 0.05 ? "+" : n < -0.05 ? "−" : "");
  const line = (label: string, v: string, hint?: string, strong?: boolean) => (
    <div className="mr" style={strong ? { borderTop: "1px solid var(--line)", marginTop: 3, paddingTop: 7 } : undefined}>
      <span style={strong ? { fontWeight: 650 } : undefined}>{label}{hint ? <span className="muted" style={{ display: "block", fontSize: 11.5 }}>{hint}</span> : null}</span><b style={strong ? { fontSize: 15 } : undefined}>{v}</b>
    </div>
  );
  return (
    <div className="wo-view">
      <div className="wo-tiles">
        <div><span>{t("Á plani")}</span><b>{dec1(tt.planned)} {t("klst")}</b></div>
        <div><span>{t("Unnið")}</span><b>{dec1(tt.worked)} {t("klst")}</b></div>
        <div><span>{t("Frávik")}</span><b style={{ color: Math.abs(tt.diff) >= 0.05 ? "var(--warn)" : undefined }}>{sign(tt.diff)}{dec1(Math.abs(tt.diff))} {t("klst")}</b></div>
        <div><span>{t("wo:gross")}</span><b>{nf(p.gross)} kr</b></div>
      </div>
      {s.pendingPunches > 0 && <p className="muted" style={{ fontSize: 12, color: "var(--warn)" }}>{s.pendingPunches} {t("stimplanir biðu samþykktar og eru ekki með í yfirlitinu.")}</p>}

      <div className="db2-tblwrap" style={{ maxHeight: 320, overflow: "auto", marginTop: 12 }}>
        <table>
          <thead><tr><th>{t("Dagur")}</th><th>{t("Á plani")}</th><th>{t("Stimplanir")}</th><th className="r">{t("Hlé")}</th><th className="r">{t("Plan")}</th><th className="r">{t("Unnið")}</th></tr></thead>
          <tbody>
            {s.days.map((d) => {
              const dt = new Date(`${d.date}T12:00:00Z`);
              const off = Math.abs(d.worked - d.planned) >= 0.05;
              return (
                <tr key={d.date}>
                  <td>{t(DOW[dt.getUTCDay()])} {dm(d.date)}</td>
                  <td>{d.plannedText ?? "—"}{d.leave ? <span className="db2-pill warn" style={{ marginLeft: 6 }}>{t(LEAVE[d.leave] ?? d.leave)}</span> : null}</td>
                  <td>{d.punches.length ? d.punches.map((x) => `${x.in}–${x.out}`).join(", ") : "—"}</td>
                  <td className="r">{d.breakMin ? `${d.breakMin} ${t("mín")}` : ""}</td>
                  <td className="r">{dec1(d.planned)}</td>
                  <td className="r" style={off ? { color: "var(--warn)", fontWeight: 650 } : undefined}>{dec1(d.worked)}</td>
                </tr>
              );
            })}
            {!s.days.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 16 }}>{t("Engar vaktir eða vinnustundir á tímabilinu.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{tt.shifts} {t("vaktir")} · {t("hlé")} {tt.breakMin} {t("mín")} · {tt.sickDays} {t("veikindadagar")} · {tt.leaveDays} {t("aðrir frídagar")}</p>

      <div className="mini" style={{ marginTop: 12 }}>
        <div className="mh">{t("Launaliðir")}</div>
        {p.monthly ? line(t("Mánaðarlaun"), `${nf(p.dayPay)} kr`) : <>
          {line(`${t("Tímakaup")} · ${dec1(p.hours)} ${t("klst")} × ${nf(p.rate)} kr`, `${nf(p.dayPay)} kr`, `${t("wo:day")} ${dec1(p.dagvinnaH)} ${t("klst")}${p.yfirvinnaH ? ` · ${t("Yfirvinna")} ${dec1(p.yfirvinnaH)} ${t("klst")}` : ""}`)}
          {(p.premiums > 0 || p.alag.length > 0) && line(t("wo:alag"), `${nf(p.premiums)} kr`, p.alag.map((a) => `${String(Math.round(a.pct * 10) / 10).replace(".", ",")}%: ${dec1(a.h)} ${t("klst")}`).join(" · "))}
          {(p.overtime > 0 || p.yfirvinnaH > 0) && line(t("Yfirvinnuálag"), `${nf(p.overtime)} kr`, `${dec1(p.yfirvinnaH)} ${t("klst")}`)}
        </>}
        {p.uppbot > 0 && line(t("Desember-/orlofsuppbót"), `${nf(p.uppbot)} kr`)}
        {p.orlof > 0 && line(t("Orlof"), `${nf(p.orlof)} kr`)}
        {p.benefits > 0 && line(t("Hlunnindi og styrkir"), `${nf(p.benefits)} kr`)}
        {line(t("wo:gross"), `${nf(p.gross)} kr`, undefined, true)}
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>{t("Sami útreikningur og launakeyrslan. Frádráttur og útborgun koma á launaseðli.")}</p>

      {row.log.length > 0 && (
        <div className="mini" style={{ marginTop: 12 }}>
          <div className="mh">{t("Staðfestingarskrá")}</div>
          {row.log.map((l, i) => (
            <div className="mr" key={i}>
              <span>{t(WO_ACTION[l.action] ?? l.action)}{l.note ? <span className="muted" style={{ display: "block", fontSize: 11.5 }}>„{l.note}“</span> : null}</span>
              <b style={{ fontWeight: 500, fontSize: 12 }}>{l.name ?? "—"} · {stamp(l.at)}</b>
            </div>
          ))}
          {row.fingerprint && <div className="muted" style={{ fontSize: 10.5, wordBreak: "break-all", marginTop: 6 }}>SHA-256 {row.fingerprint}</div>}
        </div>
      )}
    </div>
  );
}
