"use client";

// Fyrirtækjalistinn: leit + staða-sía. Smellur á röð opnar síðu fyrirtækisins
// (notendur, kort, reikningar, „Skrá inn sem“). Flýtiaðgerðir skrifa í platform_audit.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import { PLANS, ESIGN_PRICE } from "@/lib/pricing";
import type { AdminOverview, AdminCompany } from "@/lib/vakto-admin.server";
import { setBillingStatus, extendTrial } from "../actions";
import { StatusBadge, TrialClock, niceDate, planLabel, relDate } from "../ui";

type Filter = "all" | "paying" | "trial" | "problem" | "other";
const FILTERS: [Filter, string][] = [["all", "Öll"], ["paying", "Borga"], ["trial", "Í prufu"], ["problem", "Útrunnið / ógreitt / uppsögn"], ["other", "Annað"]];
const inFilter = (c: AdminCompany, f: Filter) =>
  f === "all" ? true
    : f === "paying" ? c.billingStatus === "paying"
      : f === "trial" ? c.billingStatus === "trial"
        : f === "problem" ? c.billingStatus === "trial_expired" || c.billingStatus === "unpaid" || c.billingStatus === "canceled"
          : c.billingStatus === "free" || c.billingStatus === "suspended" || c.billingStatus === "none";

export default function CompaniesScreen({ data }: { data: AdminOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [now] = useState(() => Date.now());
  const isNew = (c: AdminCompany) => c.createdAt && now - new Date(c.createdAt).getTime() < 7 * 86400000;

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const digits = text.replace(/[-\s]/g, "");
    return data.companies
      .filter((c) => inFilter(c, filter))
      .filter((c) => !text || c.name.toLowerCase().includes(text) || (!!digits && (c.kennitala ?? "").replace(/[-\s]/g, "").includes(digits)))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [q, filter, data.companies]);

  async function changeStatus(c: AdminCompany, status: string) {
    if (status === "suspended" && !window.confirm(`Loka aðgangi ${c.name}? Allir notendur fyrirtækisins lokast úti þar til opnað er aftur.`)) return;
    setBusy(c.id);
    const res = await setBillingStatus(c.id, status);
    setBusy(null);
    toast(res.ok ? `${c.name} — greiðslustaða uppfærð` : (res.error ?? "Tókst ekki"));
    if (res.ok) router.refresh();
  }
  async function addTrial(c: AdminCompany) {
    setBusy(c.id);
    const res = await extendTrial(c.id, 14);
    setBusy(null);
    toast(res.ok ? `${c.name} — prufa framlengd um 14 daga` : (res.error ?? "Tókst ekki"));
    if (res.ok) router.refresh();
  }
  const open = (c: AdminCompany) => router.push(`/admin/fyrirtaeki/${c.id}`);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <PageHeader title="Fyrirtæki" subtitle="Öll fyrirtæki sem eru skráð í VAKTO — smelltu á fyrirtæki til að sjá notendur, kort og reikninga" />

      {(data.needsMigration || data.needsPlatformMigration) && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--warn)" }}>
          <div className="cb" style={{ padding: "12px 18px" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--warn)" }}>
              {data.needsMigration ? "Migration 0027 vantar (greiðslustaða vistast ekki). " : ""}
              {data.needsPlatformMigration ? "Migration 0047 vantar (aðgerðaskrá og athugasemdir vistast ekki)." : ""}
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ch" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="seg">
            {FILTERS.map(([f, label]) => (
              <button key={f} className={filter === f ? "on" : undefined} onClick={() => setFilter(f)}>
                {label} · {data.companies.filter((c) => inFilter(c, f)).length}
              </button>
            ))}
          </div>
          <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita — nafn eða kennitala" aria-label="Leita að fyrirtæki" style={{ width: 260 }} />
        </div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Fyrirtæki</th><th>Stofnað</th><th className="r">Notendur</th><th className="r">Starfsm.</th>
                <th>Síðasta virkni</th><th>Plan · staða</th><th className="r">kr/mán</th><th>Athugasemd</th><th style={{ width: 230 }}>Flýtiaðgerðir</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="adm-rowlink" onClick={() => open(c)} style={busy === c.id ? { opacity: 0.5 } : undefined}>
                  <td>
                    <b>{c.name}</b>
                    {isNew(c) && <span className="tag info" style={{ marginLeft: 6, fontSize: 10.5 }}>Ný</span>}
                    <div className="muted" style={{ fontSize: 11.5 }}>{c.kennitala ?? "kt. óskráð"}{c.country !== "IS" ? ` · ${c.country}` : ""}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{niceDate(c.createdAt)}</td>
                  <td className="r">{c.users}</td>
                  <td className="r">{c.employees}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{relDate(c.lastActivity)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
                      <span className="muted" style={{ fontSize: 11.5 }}>{planLabel(c.plan)}</span>
                      <StatusBadge s={c.billingStatus} />
                    </div>
                    <TrialClock c={c} />
                  </td>
                  <td className="r" style={c.mrr > 0 ? { fontWeight: 650 } : undefined}>{c.mrr > 0 ? nf(c.mrr) : "—"}</td>
                  <td className="muted" style={{ fontSize: 12, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.adminNote ?? undefined}>
                    {c.adminNote ?? "—"}
                  </td>
                  <td onClick={stop}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={c.manualStatus ?? "auto"}
                        disabled={busy === c.id}
                        onChange={(e) => changeStatus(c, e.target.value)}
                        aria-label={`Greiðslustaða ${c.name}`}
                        className="adm-input" style={{ fontSize: 12, padding: "5px 7px" }}
                      >
                        <option value="auto">Sjálfvirkt (prufa)</option>
                        <option value="paying">Borgar</option>
                        <option value="unpaid">Borgar ekki</option>
                        <option value="free">Frítt</option>
                        <option value="suspended">Lokað — enginn kemst inn</option>
                        {c.manualStatus === "canceled" && <option value="canceled" disabled>Sagði upp (eigandi)</option>}
                      </select>
                      <button className="btn ghost sm" disabled={busy === c.id} onClick={() => addTrial(c)} title="Framlengja prufu um 14 daga">+14 d.</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 24 }}>{q || filter !== "all" ? "Ekkert fyrirtæki passar við síuna." : "Engin fyrirtæki skráð enn."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, margin: 0 }}>
            Verðskrá (án VSK): {nf(PLANS.v2.base)} kr/mán með {PLANS.v2.included} virkum starfsmönnum + {nf(PLANS.v2.extra)} kr á hvern virkan umfram
            („virkur“ = vakt eða stimplun í mánuðinum) + {nf(ESIGN_PRICE)} kr á hverja fullgilda undirskrift. Eldri viðskiptavinir (v1):
            {" "}{nf(PLANS.v1.base)} + {nf(PLANS.v1.extra)} kr á notanda umfram {PLANS.v1.included}. MRR telur aðeins fyrirtæki merkt „Borgar“ og miðar við síðustu 30 daga.
          </p>
        </div>
      </div>
    </>
  );
}
