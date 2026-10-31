"use client";

// Yfirferð frávika: allt sem þarf að laga á tímabilinu á einum stað, með tillögu að lausn —
// „Út kl. 16:00“ (gleymd útstimplun → áætluð lok vaktar) eða „Biðja um leiðréttingu“ (starfsmaður sendir réttan tíma).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { AsyncButton } from "@/components/app/async-button";
import { dec1 } from "@/lib/format";
import { getTimesheetIssues, adjustPunch, type TimesheetIssue } from "./actions";
import { AskCorrectionModal } from "./ask-correction";

const MONTHS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const nice = (s: string) => { const [, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS[m - 1]}`; };

export function IssuesPanel({ from, to, depts, search, onChanged }: { from: string; to: string; depts: string[]; search: string; onChanged: () => void }) {
  const { t } = useLang();
  const [issues, setIssues] = useState<TimesheetIssue[] | null>(null);
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<TimesheetIssue | null>(null);
  const [ver, setVer] = useState(0);
  useEffect(() => {
    let live = true;
    getTimesheetIssues(from, to).then((r) => { if (live) setIssues(r.ok ? r.issues : []); }).catch(() => { if (live) setIssues([]); });
    return () => { live = false; };
  }, [from, to, ver]);

  const shown = (issues ?? []).filter((i) => (depts.length === 0 || depts.includes(i.dept)) && (!search || i.name.toLowerCase().includes(search.toLowerCase())));
  if (!shown.length) return null;
  const closable = shown.filter((i) => i.fix.type === "close" && i.punchId);

  async function close(i: TimesheetIssue) {
    if (i.fix.type !== "close" || !i.punchId || !i.in) return false;
    const r = await adjustPunch(i.punchId, i.in, i.fix.out, { inDate: i.date, outDate: i.fix.outDate });
    if (!r.ok) toast(r.error ?? "Villa");
    return r.ok;
  }
  function refresh() { setVer((v) => v + 1); onChanged(); }
  const what = (i: TimesheetIssue) =>
    i.kind === "missed" ? `${t("áætluð vakt")} ${i.sched?.start}–${i.sched?.end}, ${t("engin stimplun")}`
      : i.kind === "open_long" ? `${t("inn kl.")} ${i.in}, ${t("ekki stimplað út")} (${dec1(i.hours)} ${t("klst")})`
        : `${i.in}–${i.out} (${dec1(i.hours)} ${t("klst")})`;

  return (
    <section className="db2-card iss">
      <div className="iss-h">
        <button type="button" className="iss-t" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <b>{t("Yfirfara frávik")}</b>
          <span className="db2-pill warn">{shown.length}</span>
          <span className="muted">{t("gleymdar útstimplanir, of langar stimplanir og vaktir án stimplunar — með tillögu að lausn")}</span>
          <span className="iss-chev">{open ? "▴" : "▾"}</span>
        </button>
        {closable.length > 1 && (
          <AsyncButton className="btn sm" onClick={async () => {
            let n = 0; for (const i of closable) if (await close(i)) n++;
            toast(`${n} ${t("stimplanir lagaðar á áætluð lok vaktar")}`); refresh();
          }}>{t("Laga allar gleymdar útstimplanir")} ({closable.length})</AsyncButton>
        )}
      </div>
      {open && (
        <div className="iss-list">
          {shown.map((i) => (
            <div className="iss-row" key={i.key}>
              <div className="iss-who">
                <Link href={`/timaskraning/${i.employeeId}`}><b>{i.name}</b></Link>
                <span className="muted">{nice(i.date)} · {what(i)}{i.sched && i.kind !== "missed" ? ` · ${t("áætl.")} ${i.sched.start}–${i.sched.end}` : ""}</span>
              </div>
              <div className="iss-act">
                <span className={`db2-pill ${i.kind === "missed" ? "warn" : "bad"}`}>{i.kind === "missed" ? t("Vantar stimplun") : i.kind === "open_long" ? t("Gleymd útstimplun") : t("Of löng stimplun")}</span>
                {i.fix.type === "close" && (
                  <AsyncButton className="btn sm" title={t("Setur útstimplun á lok áætlaðrar vaktar")} onClick={async () => { if (await close(i)) { toast(t("Tími leiðréttur")); refresh(); } }}>
                    {t("Út kl.")} {i.fix.out}
                  </AsyncButton>
                )}
                {i.hasAccount
                  ? <button className="btn ghost sm" onClick={() => setAsk(i)}>{t("Biðja um leiðréttingu")}</button>
                  : <span className="muted" style={{ fontSize: 12 }} title={t("Starfsmaðurinn er ekki með aðgang að VAKTO")}>{t("ekki með aðgang")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {ask && <AskCorrectionModal employeeId={ask.employeeId} first={ask.name.split(/\s+/)[0]} date={ask.date} detail={what(ask)} onClose={() => setAsk(null)} />}
    </section>
  );
}
