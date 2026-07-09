// Plain-language business insights — where you need more/fewer people, where
// overtime and cost are drifting, which departments run most efficiently.
// Deterministic rules over real data (AI phrasing can layer on later);
// recommendations only — nothing is applied automatically.

import { getDashboardPeriod } from "../maelabord/actions";
import { getPerfHistory } from "./perf.server";
import { getStaffingPattern } from "./staffing.server";
import { dec1, krCompact } from "@/lib/format";

export type Insight = {
  kind: "good" | "info" | "warn" | "bad";
  title: string;
  detail: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function getInsights(): Promise<{ insights: Insight[]; live: boolean }> {
  try {
    const to = new Date(); to.setHours(0, 0, 0, 0);
    const from = new Date(to); from.setDate(from.getDate() - 27);
    const [pd, history, staffing] = await Promise.all([
      getDashboardPeriod(iso(from), iso(to)),
      getPerfHistory(3),
      getStaffingPattern(iso(new Date(to.getTime() - 55 * 86400000)), iso(to)),
    ]);
    if (!pd.ok) return { insights: [], live: false };
    const out: Insight[] = [];

    // Overtime risk — who is drifting into overtime and what it costs.
    const overStaff = pd.staff.filter((s) => s.over);
    if (pd.overtimePay > 0 || overStaff.length > 0) {
      out.push({
        kind: "bad",
        title: `Yfirvinna er að myndast${overStaff.length ? ` hjá ${overStaff.length} starfsmönnum` : ""}`,
        detail: `${pd.overtimePay > 0 ? `${krCompact(pd.overtimePay)} umfram grunnlaun síðustu 4 vikur. ` : ""}Dreifðu tímunum á fleiri eða bættu við vakt á álagstímum — yfirvinnutími kostar tugum prósenta meira en venjulegur.`,
      });
    } else {
      out.push({
        kind: "good",
        title: "Engin yfirvinna síðustu 4 vikur",
        detail: "Tímarnir dreifast vel á hópinn. Haltu þessu — yfirvinna er dýrasti tíminn sem þú kaupir.",
      });
    }

    // Deviation: are actual hours drifting above plan?
    if (pd.planned > 0 && pd.deviation > pd.planned * 0.05) {
      out.push({
        kind: "warn",
        title: `Unnir tímar ${dec1(pd.deviation)} klst umfram plan`,
        detail: `Það er ~${Math.round((pd.deviation / pd.planned) * 100)}% meira en áætlað var (${krCompact(Math.max(0, pd.deviationCost))} aukalega). Skoðaðu hvaða vaktir teygjast — oft er það lokunin.`,
      });
    } else if (pd.planned > 0 && pd.deviation < -pd.planned * 0.05) {
      out.push({
        kind: "info",
        title: `Unnir tímar ${dec1(Math.abs(pd.deviation))} klst UNDIR plani`,
        detail: "Annaðhvort ertu að spara — eða vaktir mannast ekki. Athugaðu hvort einhverjar vaktir standi tómar.",
      });
    }

    // Labor% trend across the last months.
    const m = history.months.filter((x) => x.laborPct > 0);
    if (m.length >= 2) {
      const prev = m[m.length - 2], cur = m[m.length - 1];
      const d = cur.laborPct - prev.laborPct;
      if (d > 1.5) {
        out.push({
          kind: "warn",
          title: `Launahlutfallið hækkar: ${dec1(prev.laborPct)}% → ${dec1(cur.laborPct)}%`,
          detail: `Kostnaðurinn vex hraðar en veltan (${prev.label} → ${cur.label}). Berðu mönnunina saman við veltuna á rólegustu dögunum.`,
        });
      } else if (d < -1.5) {
        out.push({
          kind: "good",
          title: `Launahlutfallið lækkar: ${dec1(prev.laborPct)}% → ${dec1(cur.laborPct)}%`,
          detail: `Reksturinn er að verða skilvirkari (${prev.label} → ${cur.label}). Það sem þú breyttir — haltu því.`,
        });
      }
    }

    // Department efficiency: highest vs lowest cost share (needs 2+ depts).
    const depts = history.departments.filter((d) => d.cost > 0);
    if (depts.length >= 2) {
      const sorted = [...depts].sort((a, b) => b.cost - a.cost);
      const top = sorted[0], low = sorted[sorted.length - 1];
      out.push({
        kind: "info",
        title: `${top.name} ber ${dec1(top.share)}% af launakostnaðinum`,
        detail: `${top.name}: ${krCompact(top.cost)} (${dec1(top.hours)} klst) vs ${low.name}: ${krCompact(low.cost)}. Ef álagið réttlætir ekki muninn er hagræðingin þar.`,
      });
    }

    // Staffing pattern: which weekdays consistently need MORE or FEWER people
    // (8-week average of planned vs actual per weekday).
    if (staffing?.live) {
      const more = staffing.rows.filter((r) => r.rec === "more").map((r) => r.label);
      const fewer = staffing.rows.filter((r) => r.rec === "fewer").map((r) => r.label);
      if (more.length) {
        out.push({
          kind: "warn",
          title: `Vantar fólk: ${more.join(", ")}`,
          detail: "Unnir tímar fara ítrekað fram úr plani þessa daga — planið er of þunnt. Bættu vakt við eða færðu mönnun af rólegri dögum.",
        });
      }
      if (fewer.length) {
        out.push({
          kind: "info",
          title: `Líklega ofmannað: ${fewer.join(", ")}`,
          detail: "Unnir tímar eru ítrekað undir plani þessa daga. Prófaðu að fækka um eina vakt og fylgstu með frávikinu.",
        });
      }
    }

    return { insights: out.slice(0, 5), live: true };
  } catch {
    return { insights: [], live: false };
  }
}
