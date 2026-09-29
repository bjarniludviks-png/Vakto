"use client";

// Fjarvistir & mæting — síðustu 30 dagar: vaktir sem enginn mætti á, seinkanir
// og veikindadagar per starfsmann. Smellur opnar tímaskrá starfsmannsins.

import Link from "next/link";
import { useLang } from "@/components/app/lang";
import type { Absence } from "@/lib/absence.server";

const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${+d}.${+m}.`; };

export function AbsenceCard({ data }: { data: Absence }) {
  const { t } = useLang();
  if (!data.live) return null;
  const tot = data.rows.reduce((a, r) => ({ missed: a.missed + r.missed, late: a.late + r.late, sick: a.sick + r.sick }), { missed: 0, late: 0, sick: 0 });
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ch"><div>
        <div className="ct">{t("Fjarvistir & mæting")}</div>
        <div className="cs">{dm(data.from)} – {dm(data.to)} · {tot.missed} {t("mætti ekki")} · {tot.late} {t("seinkanir")} · {tot.sick} {t("veikindadagar")}</div>
      </div></div>
      <div className="cb">
        <div className="tbl"><table>
          <thead><tr>
            <th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Vaktir")}</th>
            <th className="r">{t("Mætti ekki")}</th><th className="r">{t("Seint")}</th><th className="r">{t("Veikindi")}</th><th className="r">{t("Síðast fjarverandi")}</th>
          </tr></thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/timaskraning/${r.id}`} style={{ color: "inherit" }}>{r.name}</Link></td>
                <td>{r.dept}</td>
                <td className="r">{r.shifts}</td>
                <td className="r" style={r.missed ? { color: "var(--bad)", fontWeight: 650 } : undefined}>{r.missed}</td>
                <td className="r" style={r.late >= 3 ? { color: "var(--warn)", fontWeight: 650 } : undefined} title={r.late ? `${Math.round(r.lateMin / r.late)} ${t("mín. að meðaltali")}` : undefined}>{r.late}</td>
                <td className="r">{r.sick}</td>
                <td className={`r${r.lastMissed ? "" : " muted"}`}>{r.lastMissed ? dm(r.lastMissed) : "—"}</td>
              </tr>
            ))}
            {!data.rows.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 18 }}>{t("Engar birtar vaktir á tímabilinu")}</td></tr>}
          </tbody>
        </table></div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t("Mætti ekki = birt vakt án innstimplunar og ekki í samþykktu fríi. Seint = meira en 5 mín. eftir upphaf vaktar. Vaktstjórar fá tilkynningu 15 mín. eftir upphaf vaktar ef enginn hefur stimplað inn.")}</p>
      </div>
    </div>
  );
}
