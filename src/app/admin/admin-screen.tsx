"use client";

// VAKTO super-admin screen (private — IS only): all tenant companies, usage,
// billing status and MRR, with manual billing control until Teya automates it.

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import type { AdminOverview, AdminCompany, BillingStatus, AdminCompanyDetail } from "@/lib/vakto-admin.server";
import { setBillingStatus, extendTrial, impersonateUser, impersonateCompanyOwner, fetchCompanyDetail } from "./actions";

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
  suspended: { label: "Lokað", bg: "#1a1a1f", fg: "#fff" },
  none: { label: "Ekkert plan", bg: "var(--line2)", fg: "var(--ink3)" },
};

function StatusBadge({ s }: { s: BillingStatus }) {
  const u = STATUS_UI[s];
  return <span className="tag" style={{ background: u.bg, color: u.fg }}>{u.label}</span>;
}

export default function AdminScreen({ data }: { data: AdminOverview }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<AdminCompany | null>(null);
  const [detail, setDetail] = useState<AdminCompanyDetail | null>(null);
  const t = data.totals;
  const newSignups30d = data.companies.filter((c) => c.createdAt && Date.now() - new Date(c.createdAt).getTime() < 30 * 86400000).length;
  const conversion = t.companies > 0 ? Math.round((t.paying / t.companies) * 100) : 0;
  const isNew = (c: AdminCompany) => c.createdAt && Date.now() - new Date(c.createdAt).getTime() < 7 * 86400000;

  async function openDetail(c: AdminCompany) {
    setDetailFor(c);
    setDetail(null);
    setDetail(await fetchCompanyDetail(c.id));
  }
  async function loginAs(c: AdminCompany, userId?: string, email?: string) {
    if (!window.confirm(`Skrá þig inn sem ${email ?? "eiganda " + c.name}? Þú skráist út úr admin um leið — skráðu þig aftur inn með þínu netfangi til að komast til baka. Aðgerðin er skráð í audit-log fyrirtækisins.`)) return;
    setBusy(c.id);
    const res = userId ? await impersonateUser(c.id, userId) : await impersonateCompanyOwner(c.id);
    setBusy(null);
    if (res.ok && res.link) {
      toast(`Skrái inn sem ${res.email} …`);
      window.location.assign(res.link);
    } else toast(res.error ?? "Tókst ekki");
  }

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
            <div className="kpi"><div className="lab">Borga áskrift</div><div className="val" style={{ color: t.paying > 0 ? "var(--good)" : undefined }}>{t.paying}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.trials} í prufu · {conversion}% umbreyting</div></div>
            <div className="kpi"><div className="lab">Nýskráningar 30 d.</div><div className="val" style={{ color: newSignups30d > 0 ? "var(--brand)" : undefined }}>{newSignups30d}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.expired} útrunnin/borga ekki</div></div>
            <div className="kpi"><div className="lab">MRR — mánaðartekjur</div><div className="val">{nf(t.mrr)} <small>kr</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{nf(t.mrr * 12)} kr/ár · Stripe síðar</div></div>
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
                      <td style={{ cursor: "pointer" }} onClick={() => openDetail(c)} title="Skoða fyrirtækið">
                        <b>{c.name}</b>
                        {isNew(c) && <span className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)", marginLeft: 6, fontSize: 10.5 }}>Ný</span>}
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
                            <option value="suspended">Lokað — enginn kemst inn</option>
                          </select>
                          <button className="btn ghost sm" disabled={busy === c.id} onClick={() => addTrial(c)} title="Framlengja prufu um 14 daga">+14 d.</button>
                          <button className="btn ghost sm" disabled={busy === c.id} onClick={() => openDetail(c)} title="Skoða gögn fyrirtækisins">Skoða</button>
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

          {detailFor && (
            <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setDetailFor(null)}>
              <div className="mbg" onClick={() => setDetailFor(null)} />
              <div className="modal" style={{ maxWidth: 560 }}>
                <div className="mh">
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{detailFor.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{detailFor.kennitala ?? "kt. óskráð"} · stofnað {niceDate(detailFor.createdAt)} · <StatusBadge s={detailFor.billingStatus} /></div>
                  </div>
                  <button className="x" onClick={() => setDetailFor(null)}>✕</button>
                </div>
                <div className="mb">
                  {!detail ? (
                    <p className="muted" style={{ fontSize: 13 }}>Sæki gögn…</p>
                  ) : !detail.ok ? (
                    <p className="muted" style={{ fontSize: 13 }}>Gat ekki sótt gögn.</p>
                  ) : (
                    <>
                      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 14 }}>
                        <div className="kpi"><div className="lab">Starfsmenn</div><div className="val" style={{ fontSize: 20 }}>{detail.employeesActive}</div><div className="muted" style={{ fontSize: 11 }}>{detail.employeesInactive} óvirkir</div></div>
                        <div className="kpi"><div className="lab">Stimplanir 7 d.</div><div className="val" style={{ fontSize: 20 }}>{detail.punches7d}</div></div>
                        <div className="kpi"><div className="lab">Velta 30 d.</div><div className="val" style={{ fontSize: 20 }}>{nf(detail.revenue30d)}</div><div className="muted" style={{ fontSize: 11 }}>kr</div></div>
                        <div className="kpi"><div className="lab">Staðir</div><div className="val" style={{ fontSize: 20 }}>{detail.locations.length}</div><div className="muted" style={{ fontSize: 11 }}>{detail.locations.slice(0, 2).join(", ")}</div></div>
                      </div>

                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Notendur · {detail.users.length}</div>
                      <div className="att" style={{ maxHeight: 180, overflowY: "auto", marginBottom: 14 }}>
                        {detail.users.map((u) => (
                          <div className="it" key={u.id}>
                            <div className="tx" style={{ minWidth: 0 }}>
                              <b style={{ fontSize: 13 }}>{u.name ?? u.email ?? "—"}</b>
                              <span className="muted" style={{ fontSize: 11.5, display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email} · {u.role ?? "—"}</span>
                            </div>
                            <button className="btn ghost sm" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={() => loginAs(detailFor, u.id, u.email ?? undefined)}>
                              Skrá inn sem
                            </button>
                          </div>
                        ))}
                        {!detail.users.length && <p className="muted" style={{ fontSize: 12.5, padding: 8 }}>Engir notendur skráðir.</p>}
                      </div>

                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Aðgerðaskrá (nýjast)</div>
                      <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--line2)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
                        {detail.audit.map((a, i) => (
                          <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: i < detail.audit.length - 1 ? "1px solid var(--line2)" : undefined }}>
                            <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{relDate(a.at)}</span>
                            {" · "}<b>{a.action}</b>{a.detail ? <span className="muted"> — {a.detail}</span> : null}
                          </div>
                        ))}
                        {!detail.audit.length && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Engar færslur.</p>}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn sm" onClick={() => loginAs(detailFor)}>Skrá inn sem eigandi</button>
                        <button className="btn ghost sm" onClick={() => addTrial(detailFor)}>Framlengja prufu +14 d.</button>
                        {detailFor.billingStatus === "suspended" ? (
                          <button className="btn ghost sm" style={{ color: "var(--good)" }} onClick={() => changeStatus(detailFor, "auto")}>Opna aðgang aftur</button>
                        ) : (
                          <button className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={() => { if (window.confirm(`Loka aðgangi ${detailFor.name}? Allir notendur fyrirtækisins lokast úti þar til opnað er aftur.`)) changeStatus(detailFor, "suspended"); }}>Loka aðgangi</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
