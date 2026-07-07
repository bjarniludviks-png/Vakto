"use client";

// VAKTO super-admin screen (private — IS only): all tenant companies, usage,
// billing status and MRR, with manual billing control until Teya automates it.

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import type { AdminOverview, AdminCompany, BillingStatus } from "@/lib/vakto-admin.server";
import { setBillingStatus, extendTrial } from "./actions";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const niceDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
};
const relDate = (iso: string | null) => {
  if (!iso) return "aldrei";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "í dag";
  if (days === 1) return "í gær";
  if (days < 30) return `fyrir ${days} d.`;
  return niceDate(iso);
};

const STATUS_UI: Record<BillingStatus, { label: string; bg: string; fg: string }> = {
  paying: { label: "Borgar", bg: "var(--good-soft)", fg: "var(--good)" },
  trial: { label: "Prufa", bg: "var(--brand-soft)", fg: "var(--brand)" },
  trial_expired: { label: "Prufa útrunnin", bg: "var(--bad-soft)", fg: "var(--bad)" },
  unpaid: { label: "Borgar ekki", bg: "var(--bad-soft)", fg: "var(--bad)" },
  free: { label: "Frítt", bg: "var(--line2)", fg: "var(--ink2)" },
  none: { label: "Ekkert plan", bg: "var(--line2)", fg: "var(--ink3)" },
};

function StatusBadge({ s }: { s: BillingStatus }) {
  const u = STATUS_UI[s];
  return <span className="tag" style={{ background: u.bg, color: u.fg }}>{u.label}</span>;
}

export default function AdminScreen({ data }: { data: AdminOverview }) {
  const [busy, setBusy] = useState<string | null>(null);
  const t = data.totals;

  async function changeStatus(c: AdminCompany, status: string) {
    setBusy(c.id);
    const res = await setBillingStatus(c.id, status);
    setBusy(null);
    toast(res.ok ? `${c.name} — greiðslustaða uppfærð` : (res.error ?? "Tókst ekki"));
  }
  async function addTrial(c: AdminCompany) {
    setBusy(c.id);
    const res = await extendTrial(c.id, 14);
    setBusy(null);
    toast(res.ok ? `${c.name} — prufa framlengd um 14 daga` : (res.error ?? "Tókst ekki"));
  }

  return (
    <>
      <PageHeader title="VAKTO Admin" subtitle="Fyrirtæki, notendur, greiðslustaða og tekjur — allt kerfið" />

      {!data.ok ? (
        <div className="card"><div className="cb"><p className="muted" style={{ fontSize: 13.5 }}>Gögn fundust ekki — er Supabase tengt?</p></div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="lab">Fyrirtæki skráð</div><div className="val">{t.companies}</div></div>
            <div className="kpi"><div className="lab">Notendur alls</div><div className="val">{t.users}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.employees} starfsmenn</div></div>
            <div className="kpi"><div className="lab">Borga áskrift</div><div className="val" style={{ color: t.paying > 0 ? "var(--good)" : undefined }}>{t.paying}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.trials} í prufu · {t.expired} borga ekki</div></div>
            <div className="kpi"><div className="lab">MRR — mánaðartekjur</div><div className="val">{nf(t.mrr)} <small>kr</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{nf(t.mrr * 12)} kr/ár</div></div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch">
              <div><div className="ct">Öll fyrirtæki</div><div className="cs">greiðslustaða er handvirk þar til Teya-tengingin tekur við</div></div>
              <span className="badge">{t.companies}</span>
            </div>
            <div className="cb tbl" style={{ paddingTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Fyrirtæki</th><th>Stofnað</th><th className="r">Notendur</th><th className="r">Starfsm.</th>
                    <th>Síðasta virkni</th><th>Staða</th><th className="r">kr/mán</th><th style={{ width: 210 }}>Stjórna</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((c) => (
                    <tr key={c.id} style={busy === c.id ? { opacity: 0.5 } : undefined}>
                      <td>
                        <b>{c.name}</b>
                        <div className="muted" style={{ fontSize: 11.5 }}>{c.kennitala ?? "kt. óskráð"}{c.country !== "IS" ? ` · ${c.country}` : ""}</div>
                      </td>
                      <td>{niceDate(c.createdAt)}</td>
                      <td className="r">{c.users}</td>
                      <td className="r">{c.employees}</td>
                      <td>{relDate(c.lastActivity)}</td>
                      <td>
                        <StatusBadge s={c.billingStatus} />
                        {c.billingStatus === "trial" && c.trialEndsAt && (
                          <div className="muted" style={{ fontSize: 11 }}>til {niceDate(c.trialEndsAt)}</div>
                        )}
                      </td>
                      <td className="r" style={c.mrr > 0 ? { fontWeight: 650 } : undefined}>{c.mrr > 0 ? nf(c.mrr) : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select
                            value={c.manualStatus ?? "auto"}
                            disabled={busy === c.id}
                            onChange={(e) => changeStatus(c, e.target.value)}
                            style={{ fontSize: 12, padding: "5px 7px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)" }}
                          >
                            <option value="auto">Sjálfvirkt (prufa)</option>
                            <option value="paying">Borgar</option>
                            <option value="unpaid">Borgar ekki</option>
                            <option value="free">Frítt</option>
                          </select>
                          <button className="btn ghost sm" disabled={busy === c.id} onClick={() => addTrial(c)} title="Framlengja prufu um 14 daga">+14 d.</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.companies.length && (
                    <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>Engin fyrirtæki skráð enn.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, margin: 0 }}>
                Verðskrá: 9.990 kr/mán m/VSK (5 notendur innifaldir) + 990 kr per notanda umfram. MRR telur aðeins
                fyrirtæki merkt „Borgar“. {data.needsMigration ? "⚠️ Keyrðu migration 0027 til að geta vistað greiðslustöðu." : ""}
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
