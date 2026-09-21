"use client";

// VAKTO super-admin screen (private — IS only): all tenant companies, usage,
// billing status and MRR, with manual billing control until Stripe/Teya
// automates it. Everything the owner does here is written to platform_audit.

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import type { AdminOverview, AdminCompany, BillingStatus, AdminCompanyDetail, PlatformAuditEntry } from "@/lib/vakto-admin.server";
import {
  setBillingStatus, extendTrial, impersonateUser, impersonateCompanyOwner, fetchCompanyDetail,
  saveAdminNote, sendLoginLink,
} from "./actions";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad = (n: number) => String(n).padStart(2, "0");
const niceDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
};
const niceDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
const ROLE_IS: Record<string, string> = { owner: "Stjórnandi", manager: "Vaktstjóri", employee: "Starfsmaður", contractor: "Verktaki" };
const ACTION_IS: Record<string, string> = {
  "billing.set": "Greiðslustaða",
  "trial.extend": "Prufa framlengd",
  suspend: "Aðgangi lokað",
  unsuspend: "Aðgangur opnaður",
  "impersonate.start": "Skráði inn sem",
  "impersonate.end": "Aftur í admin",
  "note.save": "Athugasemd",
  "login_link.send": "Innskráningarhlekkur",
};
const PLAN_IS: Record<string, string> = { vakto: "VAKTO", free: "Frítt (eldra)", pro: "Pro (eldra)", standard: "Standard", starter: "Starter" };
const planLabel = (p: string | null) => (p ? PLAN_IS[p] ?? p : "Ekkert plan");

function StatusBadge({ s }: { s: BillingStatus }) {
  const u = STATUS_UI[s];
  return <span className="tag" style={{ background: u.bg, color: u.fg }}>{u.label}</span>;
}

/** "5 d. eftir" / "rann út fyrir 3 d." — the trial clock in words. */
function TrialClock({ c }: { c: AdminCompany }) {
  if (c.billingStatus !== "trial" && c.billingStatus !== "trial_expired") return null;
  if (c.trialDaysLeft === null) return null;
  const d = c.trialDaysLeft;
  const urgent = d <= 7 && d >= 0;
  return (
    <div style={{ fontSize: 11, color: urgent ? "var(--warn)" : d < 0 ? "var(--bad)" : "var(--ink3)", fontWeight: urgent ? 650 : 500 }}>
      {d < 0 ? `rann út fyrir ${Math.abs(d)} d.` : d === 0 ? "rennur út í dag" : `${d} d. eftir · til ${niceDate(c.trialEndsAt)}`}
    </div>
  );
}

function AuditRows({ rows, showCompany }: { rows: PlatformAuditEntry[]; showCompany: boolean }) {
  if (!rows.length) return <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Engar færslur enn.</p>;
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            <th style={{ width: 120 }}>Hvenær</th><th>Aðgerð</th>{showCompany && <th>Fyrirtæki</th>}<th>Hverjum</th><th>Lýsing</th><th>Admin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{niceDateTime(a.at)}</td>
              <td><b>{ACTION_IS[a.action] ?? a.action}</b></td>
              {showCompany && <td>{a.companyName ?? "—"}</td>}
              <td className="muted" style={{ fontSize: 12 }}>{a.target ?? "—"}</td>
              <td className="muted" style={{ fontSize: 12, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>{a.detail ?? ""}</td>
              <td className="muted" style={{ fontSize: 11.5 }}>{a.adminEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminScreen({ data }: { data: AdminOverview }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // The open drill-down is an id — the company object is derived from the
  // list so it stays fresh after an action revalidates the page.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailFor = useMemo(() => (detailId ? data.companies.find((c) => c.id === detailId) ?? null : null), [detailId, data.companies]);
  const [detail, setDetail] = useState<AdminCompanyDetail | null>(null);
  const [now] = useState(() => Date.now());
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [linkResult, setLinkResult] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const t = data.totals;
  const conversion = t.companies > 0 ? Math.round((t.paying / t.companies) * 100) : 0;
  const isNew = (c: AdminCompany) => c.createdAt && now - new Date(c.createdAt).getTime() < 7 * 86400000;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/[-\s]/g, "");
    if (!needle) return data.companies;
    return data.companies.filter((c) =>
      c.name.toLowerCase().includes(q.trim().toLowerCase()) ||
      (c.kennitala ?? "").replace(/[-\s]/g, "").includes(needle));
  }, [q, data.companies]);

  const signups30d = useMemo(() => data.companies
    .filter((c) => c.createdAt && now - new Date(c.createdAt).getTime() < 30 * 86400000)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [data.companies, now]);

  async function openDetail(c: AdminCompany) {
    setDetailId(c.id);
    setDetail(null);
    setNote(c.adminNote ?? "");
    setLinkResult(null);
    setDetail(await fetchCompanyDetail(c.id));
  }
  async function refreshDetail(c: AdminCompany) {
    setDetail(await fetchCompanyDetail(c.id));
  }
  async function loginAs(c: AdminCompany, userId?: string, email?: string) {
    if (!window.confirm(`Skrá þig inn sem ${email ?? "eiganda " + c.name}? Appelsínugul rönd efst í kerfinu þeirra kemur þér aftur hingað. Aðgerðin er skráð í aðgerðaskrá.`)) return;
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
    if (res.ok && detailFor?.id === c.id) refreshDetail(c);
  }
  async function addTrial(c: AdminCompany) {
    setBusy(c.id);
    const res = await extendTrial(c.id, 14);
    setBusy(null);
    toast(res.ok ? `${c.name} — prufa framlengd um 14 daga` : (res.error ?? "Tókst ekki"));
    if (res.ok && detailFor?.id === c.id) refreshDetail(c);
  }
  async function saveNote(c: AdminCompany) {
    setNoteBusy(true);
    const res = await saveAdminNote(c.id, note);
    setNoteBusy(false);
    toast(res.ok ? "Athugasemd vistuð" : (res.error ?? "Tókst ekki"));
    if (res.ok) refreshDetail(c);
  }
  async function sendLink(c: AdminCompany, userId: string, email: string | null) {
    if (!window.confirm(`Senda innskráningarhlekk á ${email ?? "notandann"}? Hlekkurinn skráir viðkomandi inn og býður að velja nýtt lykilorð.`)) return;
    setBusy(c.id);
    const res = await sendLoginLink(c.id, userId);
    setBusy(null);
    if (res.ok && res.link) {
      setLinkResult({ email: res.email ?? email ?? "", link: res.link, emailed: !!res.emailed });
      toast(res.emailed ? `Hlekkur sendur á ${res.email}` : "Hlekkur tilbúinn — afritaðu hann");
      refreshDetail(c);
    } else toast(res.error ?? "Tókst ekki");
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast("Afritað"); } catch { toast("Gat ekki afritað — veldu textann"); }
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 13, padding: "8px 11px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", font: "inherit",
  };

  return (
    <>
      <PageHeader title="VAKTO Admin" subtitle="Fyrirtæki, notendur, greiðslustaða og tekjur — allt kerfið" />

      {!data.ok ? (
        <div className="card"><div className="cb"><p className="muted" style={{ fontSize: 13.5 }}>Gögn fundust ekki — er Supabase tengt?</p></div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="lab">Fyrirtæki skráð</div><div className="val">{t.companies}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.users} notendur · {t.employees} starfsmenn</div></div>
            <div className="kpi"><div className="lab">Prufur að renna út (7 d.)</div><div className="val" style={{ color: t.trialsEnding7d > 0 ? "var(--warn)" : undefined }}>{t.trialsEnding7d}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.trials} í prufu · {t.expired} útrunnin/borga ekki</div></div>
            <div className="kpi"><div className="lab">Borga áskrift</div><div className="val" style={{ color: t.paying > 0 ? "var(--good)" : undefined }}>{t.paying}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{conversion}% af fyrirtækjum</div></div>
            <div className="kpi"><div className="lab">MRR — mánaðartekjur</div><div className="val">{nf(t.mrr)} <small>kr</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{nf(t.mrr * 12)} kr/ár · greiðslur handvirkt þar til Stripe kemur</div></div>
          </div>

          {(data.needsMigration || data.needsPlatformMigration) && (
            <div className="card" style={{ marginTop: 16, borderColor: "var(--warn)" }}>
              <div className="cb" style={{ padding: "12px 18px" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--warn)" }}>
                  {data.needsMigration ? "Migration 0027 vantar (greiðslustaða vistast ekki). " : ""}
                  {data.needsPlatformMigration ? "Migration 0047 vantar (aðgerðaskrá og athugasemdir vistast ekki)." : ""}
                </p>
              </div>
            </div>
          )}

          {/* ---------- all companies ---------- */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch">
              <div><div className="ct">Öll fyrirtæki</div><div className="cs">Greiðslur handvirkt þar til Stripe kemur — staðan hér er það sem gildir</div></div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Leita — nafn eða kennitala"
                  aria-label="Leita að fyrirtæki"
                  style={{ ...inputStyle, width: 240 }}
                />
                <span className="badge">{filtered.length}{filtered.length !== t.companies ? ` af ${t.companies}` : ""}</span>
              </div>
            </div>
            <div className="cb tbl" style={{ paddingTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Fyrirtæki</th><th>Stofnað</th><th className="r">Notendur</th><th className="r">Starfsm.</th>
                    <th>Síðasta virkni</th><th>Plan · staða</th><th className="r">kr/mán</th><th>Athugasemd</th><th style={{ width: 210 }}>Stjórna</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
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
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span className="muted" style={{ fontSize: 11.5 }}>{planLabel(c.plan)}</span>
                          <StatusBadge s={c.billingStatus} />
                        </div>
                        <TrialClock c={c} />
                      </td>
                      <td className="r" style={c.mrr > 0 ? { fontWeight: 650 } : undefined}>{c.mrr > 0 ? nf(c.mrr) : "—"}</td>
                      <td className="muted" style={{ fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => openDetail(c)} title={c.adminNote ?? "Bæta við athugasemd"}>
                        {c.adminNote ?? <span style={{ color: "var(--ink3)" }}>—</span>}
                      </td>
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
                  {!filtered.length && (
                    <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 24 }}>{q ? "Ekkert fyrirtæki passar við leitina." : "Engin fyrirtæki skráð enn."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, margin: 0 }}>
                Verðskrá: 9.990 kr/mán m/VSK (5 notendur innifaldir) + 990 kr per notanda umfram. MRR telur aðeins
                fyrirtæki merkt „Borgar“. Engin sjálfvirk innheimta er tengd enn — greiðslustaðan er skráð hér handvirkt.
              </p>
            </div>
          </div>

          {/* ---------- signups last 30 days ---------- */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch">
              <div><div className="ct">Nýskráningar síðustu 30 daga</div><div className="cs">Sjáðu hverjir festust: engir notendur umfram eigandann, engin velta, engar stimplanir</div></div>
              <span className="badge">{signups30d.length}</span>
            </div>
            <div className="cb tbl" style={{ paddingTop: 8 }}>
              <table>
                <thead>
                  <tr><th>Fyrirtæki</th><th>Skráð</th><th className="r">Notendur</th><th>Velta skráð?</th><th>Stimplanir?</th><th>Staða</th></tr>
                </thead>
                <tbody>
                  {signups30d.map((c) => {
                    const stuck = c.users <= 1 && !c.hasPunches30d && !c.hasRevenue30d;
                    return (
                      <tr key={c.id}>
                        <td style={{ cursor: "pointer" }} onClick={() => openDetail(c)}>
                          <b>{c.name}</b>
                          {stuck && <span className="tag warn" style={{ marginLeft: 6, fontSize: 10.5 }}>Föst?</span>}
                        </td>
                        <td>{niceDate(c.createdAt)} <span className="muted" style={{ fontSize: 11.5 }}>({relDate(c.createdAt)})</span></td>
                        <td className="r">{c.users}</td>
                        <td>{c.hasRevenue30d ? <span className="tag good">Já</span> : <span className="tag mut">Nei</span>}</td>
                        <td>{c.hasPunches30d ? <span className="tag good">Já</span> : <span className="tag mut">Nei</span>}</td>
                        <td><StatusBadge s={c.billingStatus} /><TrialClock c={c} /></td>
                      </tr>
                    );
                  })}
                  {!signups30d.length && (
                    <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>Engar nýskráningar síðustu 30 daga.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- platform audit ---------- */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch">
              <div><div className="ct">Aðgerðaskrá</div><div className="cs">Allt sem þú gerir hér — síðustu 50 færslur</div></div>
              <span className="badge">{data.platformAudit.length}</span>
            </div>
            <div className="cb" style={{ paddingTop: 8 }}>
              {data.needsPlatformMigration
                ? <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aðgerðaskráin birtist þegar migration 0047 hefur verið keyrð.</p>
                : <AuditRows rows={data.platformAudit} showCompany />}
            </div>
          </div>

          {/* ---------- company drill-down ---------- */}
          {detailFor && (
            <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setDetailId(null)}>
              <div className="mbg" onClick={() => setDetailId(null)} />
              <div className="modal" style={{ maxWidth: 640 }}>
                <div className="mh">
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{detailFor.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{detailFor.kennitala ?? "kt. óskráð"} · stofnað {niceDate(detailFor.createdAt)} · <StatusBadge s={detailFor.billingStatus} /></div>
                  </div>
                  <button className="x" onClick={() => setDetailId(null)} aria-label="Loka">✕</button>
                </div>
                <div className="mb" style={{ maxHeight: "78vh", overflowY: "auto" }}>
                  {!detail ? (
                    <p className="muted" style={{ fontSize: 13 }}>Sæki gögn…</p>
                  ) : !detail.ok ? (
                    <p className="muted" style={{ fontSize: 13 }}>Gat ekki sótt gögn.</p>
                  ) : (
                    <>
                      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
                        <div className="kpi"><div className="lab">Starfsmenn</div><div className="val" style={{ fontSize: 20 }}>{detail.employeesActive}</div><div className="muted" style={{ fontSize: 11 }}>{detail.employeesInactive} óvirkir</div></div>
                        <div className="kpi"><div className="lab">Stimplanir 7 d.</div><div className="val" style={{ fontSize: 20 }}>{detail.punches7d}</div></div>
                        <div className="kpi"><div className="lab">Velta 30 d.</div><div className="val" style={{ fontSize: 20 }}>{nf(detail.revenue30d)}</div><div className="muted" style={{ fontSize: 11 }}>kr</div></div>
                        <div className="kpi"><div className="lab">Staðir</div><div className="val" style={{ fontSize: 20 }}>{detail.locations.length}</div><div className="muted" style={{ fontSize: 11 }}>{detail.locations.slice(0, 2).join(", ")}</div></div>
                      </div>

                      {/* payments — honest: manual until Stripe */}
                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Greiðslur</div>
                      <div style={{ border: "1px solid var(--line2)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px", fontSize: 12.5 }}>
                        <div><span className="muted">Plan:</span> {planLabel(detailFor.plan)}</div>
                        <div><span className="muted">Staða:</span> <StatusBadge s={detailFor.billingStatus} /></div>
                        <div><span className="muted">Prufa til:</span> {detailFor.trialEndsAt ? niceDate(detailFor.trialEndsAt) : "—"}{detailFor.trialDaysLeft !== null && detailFor.billingStatus === "trial" ? ` (${detailFor.trialDaysLeft} d. eftir)` : ""}</div>
                        <div><span className="muted">MRR:</span> {detailFor.mrr > 0 ? `${nf(detailFor.mrr)} kr/mán` : "0 kr — borgar ekki enn"}</div>
                        <div style={{ gridColumn: "1 / -1" }} className="muted">Greiðslur handvirkt þar til Stripe kemur — {detailFor.users} notendur = {nf(9990 + Math.max(0, detailFor.users - 5) * 990)} kr/mán ef borgar.</div>
                      </div>

                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Athugasemd</div>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Hver er tengiliðurinn, hvað var samið, hvenær á að rukka…"
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.45 }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, marginBottom: 14 }}>
                        <button className="btn sm" disabled={noteBusy || note.trim() === (detailFor.adminNote ?? "").trim()} onClick={() => saveNote(detailFor)}>{noteBusy ? "Vista…" : "Vista athugasemd"}</button>
                      </div>

                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Notendur · {detail.users.length}</div>
                      <div className="att" style={{ maxHeight: 240, overflowY: "auto", marginBottom: 8 }}>
                        {detail.users.map((u) => (
                          <div className="it" key={u.id} style={{ alignItems: "center" }}>
                            <div className="tx" style={{ minWidth: 0 }}>
                              <b style={{ fontSize: 13 }}>
                                {u.name ?? u.email ?? "—"}
                                <span className="tag mut" style={{ marginLeft: 6, fontSize: 10.5 }}>{u.role ? ROLE_IS[u.role] ?? u.role : "—"}</span>
                                {u.employeeLinked
                                  ? <span className="tag good" style={{ marginLeft: 4, fontSize: 10.5 }}>Starfsmaður tengdur</span>
                                  : <span className="tag warn" style={{ marginLeft: 4, fontSize: 10.5 }}>Enginn starfsmaður</span>}
                              </b>
                              <span className="muted" style={{ fontSize: 11.5, display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.email} · síðast inn: {u.lastSignInAt ? `${relDate(u.lastSignInAt)} (${niceDateTime(u.lastSignInAt)})` : "aldrei"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <button className="btn ghost sm" disabled={busy === detailFor.id} onClick={() => sendLink(detailFor, u.id, u.email)} title="Sendir tölvupóst með hlekk sem skráir notandann inn">Senda innskráningarhlekk</button>
                              <button className="btn ghost sm" disabled={busy === detailFor.id} onClick={() => loginAs(detailFor, u.id, u.email ?? undefined)}>Skrá inn sem</button>
                            </div>
                          </div>
                        ))}
                        {!detail.users.length && <p className="muted" style={{ fontSize: 12.5, padding: 8 }}>Engir notendur skráðir.</p>}
                      </div>
                      {linkResult && (
                        <div style={{ border: "1px solid var(--line)", background: "var(--line2)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12.5 }}>
                          <div style={{ marginBottom: 4 }}>
                            {linkResult.emailed ? `Hlekkur sendur á ${linkResult.email}. ` : `Tölvupóstur er ekki tengdur — sendu ${linkResult.email} hlekkinn sjálf(ur): `}
                            <span className="muted">Gildir einu sinni.</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input readOnly value={linkResult.link} onFocus={(e) => e.currentTarget.select()} style={{ ...inputStyle, flex: 1, fontSize: 11.5, minWidth: 0 }} />
                            <button className="btn ghost sm" onClick={() => copy(linkResult.link)}>Afrita</button>
                          </div>
                        </div>
                      )}

                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Mínar aðgerðir á þessu fyrirtæki</div>
                      <div style={{ border: "1px solid var(--line2)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 12 }}>
                        <AuditRows rows={detail.platformAudit} showCompany={false} />
                      </div>

                      <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>Aðgerðaskrá fyrirtækisins (nýjast)</div>
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
