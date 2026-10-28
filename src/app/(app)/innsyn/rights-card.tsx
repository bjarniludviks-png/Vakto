"use client";

// Réttindi starfsfólks — heildaryfirlit: orlofsréttur og eftirstöðvar, veikindi og veikindi barna á
// síðustu 12 mánuðum á móti rétti skv. kjarasamningi, og næsta breyting á rétti. Smellur opnar spjaldið.

import Link from "next/link";
import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import type { EmployeeRights } from "@/lib/rights.server";

const dm = (iso: string) => { const [y, m, d] = iso.split("-"); return `${+d}.${+m}.${y}`; };
const pct = (n: number) => String(n).replace(".", ",");

export function RightsCard({ rows }: { rows: EmployeeRights[] }) {
  const { t } = useLang();
  if (!rows.length) return null;
  const missing = rows.filter((r) => r.hireSuspect === "missing");
  const same = rows.filter((r) => r.hireSuspect === "same-as-created");
  const flagged = rows.filter((r) => r.sick.over || r.child.over || r.orlof.pctBehind).length;
  const sorted = [...rows].sort((a, b) =>
    Number(b.sick.over || b.child.over || b.orlof.pctBehind) - Number(a.sick.over || a.child.over || a.orlof.pctBehind)
    || b.sick.used - a.sick.used || a.name.localeCompare(b.name, "is"));
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ch"><div>
        <div className="ct">{t("Réttindi starfsfólks")}</div>
        <div className="cs">{t("orlof, veikindi og veikindi barna á síðustu 12 mánuðum skv. kjarasamningi")}{flagged ? ` · ${flagged} ${t("þarf að skoða")}` : ""}</div>
      </div></div>
      <div className="cb">
        {(missing.length > 0 || same.length > 0) && (
          <div className="rc-hire" style={{ border: "1px solid var(--line)", borderLeft: "3px solid var(--warn)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, lineHeight: 1.55 }}>
            <b>{t("Athugaðu ráðningardaga")}</b> — {t("réttindi telja frá ráðningardegi, svo rangur dagur vanmetur orlof og veikindarétt.")}
            {missing.length > 0 && <div>{t("Vantar ráðningardag")}: {missing.map((r, i) => <span key={r.id}>{i ? ", " : ""}<Link href={`/starfsfolk/${r.id}`} style={{ color: "inherit", textDecoration: "underline" }}>{r.name}</Link></span>)}</div>}
            {same.length > 0 && <div>{t("Sami dagur og skráning í VAKTO — er það rétt?")}: {same.map((r, i) => <span key={r.id}>{i ? ", " : ""}<Link href={`/starfsfolk/${r.id}`} style={{ color: "inherit", textDecoration: "underline" }}>{r.name}</Link></span>)}</div>}
            <div className="muted">{t("Leiðrétt á spjaldinu → Persónulegt → Ráðningardagur. Fyrri starfstími sem telst með er skráður undir „Starfsaldur sem telst með“.")}</div>
          </div>
        )}
        <div className="tbl"><table>
          <thead><tr>
            <th>{t("Starfsmaður")}</th><th>{t("Deild")}</th>
            <th className="r">{t("Orlofsréttur")}</th><th className="r">{t("Orlof eftir")}</th>
            <th className="r">{t("Veikindi")}</th><th className="r">{t("Veikindi barna")}</th><th>{t("Næsta breyting")}</th>
          </tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/starfsfolk/${r.id}`} style={{ color: "inherit" }}>{r.name}</Link>{!r.agreement && <span className="tag mut" style={{ marginLeft: 6 }} title={t("Réttindi skv. kjarasamningi eru ekki komin inn fyrir þetta félag")}>{r.union || t("ekkert félag")}</span>}</td>
                <td>{r.dept || "—"}</td>
                <td className="r" style={r.orlof.pctBehind ? { color: "var(--warn)", fontWeight: 650 } : undefined} title={r.orlof.pctBehind ? `${t("Skráð")} ${pct(r.orlof.pctSet)} %` : undefined}>
                  {r.orlof.right ? `${r.orlof.right.now.days} ${t("d.")} · ${pct(r.orlof.right.now.pct)} %` : `${pct(r.orlof.pctSet)} %`}
                </td>
                <td className="r">{r.orlof.balance?.tracksDays ? `${dec1(r.orlof.balance.remainingDays)} ${t("d.")}` : "—"}</td>
                <td className="r" style={r.sick.over ? { color: "var(--bad)", fontWeight: 650 } : r.sick.near ? { color: "var(--warn)", fontWeight: 650 } : undefined}>
                  {r.sick.used}{r.sick.right ? ` / ${r.sick.right.days}` : ""}
                </td>
                <td className="r" style={r.child.over ? { color: "var(--bad)", fontWeight: 650 } : undefined}>{r.child.used} / {r.child.days}</td>
                <td className="muted" style={{ fontSize: 12 }}>{r.nextChange ? `${dm(r.nextChange.date)} · ${t(r.nextChange.text)}` : !r.hireDate ? t("ráðningardag vantar") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t("Veikindi = skráðir veikindadagar (virkir dagar) síðustu 12 mánuði á móti rétti. Rautt = umfram rétt, gult = 80 % eða orlofsprósenta lægri en rétturinn. Skráðu veikindi á spjaldi starfsmanns → Frí.")}</p>
      </div>
    </div>
  );
}
