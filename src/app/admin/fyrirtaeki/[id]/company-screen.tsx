"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import { invoiceFor } from "@/lib/pricing";
import type { AdminCompany, AdminCompanyDetail, AdminCompanyBilling } from "@/lib/vakto-admin.server";
import { setBillingStatus, extendTrial, impersonateUser, impersonateCompanyOwner, saveAdminNote, sendLoginLink } from "../../actions";
import { AuditRows, CARD_BRANDS, INVOICE_IS, ROLE_IS, StatusBadge, niceDate, niceDateTime, planLabel, relDate } from "../../ui";

const ROLE_ORDER = ["owner", "manager", "employee", "contractor", "kiosk"];

export default function CompanyScreen({ company: c, detail, billing }: { company: AdminCompany; detail: AdminCompanyDetail; billing: AdminCompanyBilling }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(c.adminNote ?? "");
  const [linkResult, setLinkResult] = useState<{ email: string; link: string; emailed: boolean } | null>(null);

  async function run<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>, okMsg?: string): Promise<T | null> {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return null; }
    if (okMsg) toast(okMsg);
    router.refresh();
    return res;
  }
  async function loginAs(userId?: string, email?: string | null) {
    if (!window.confirm(`Skrá þig inn sem ${email ?? "eiganda " + c.name}? Appelsínugul rönd efst í kerfinu þeirra kemur þér aftur hingað. Aðgerðin er skráð í aðgerðaskrá — líka hjá fyrirtækinu.`)) return;
    setBusy(true);
    const res = userId ? await impersonateUser(c.id, userId) : await impersonateCompanyOwner(c.id);
    setBusy(false);
    if (res.ok && res.link) { toast(`Skrái inn sem ${res.email} …`); window.location.assign(res.link); }
    else toast(res.error ?? "Tókst ekki");
  }
  async function sendLink(userId: string, email: string | null) {
    if (!window.confirm(`Senda innskráningarhlekk á ${email ?? "notandann"}? Hlekkurinn skráir viðkomandi inn og býður að velja nýtt lykilorð.`)) return;
    const res = await run(() => sendLoginLink(c.id, userId));
    if (res?.link) {
      setLinkResult({ email: res.email ?? email ?? "", link: res.link, emailed: !!res.emailed });
      toast(res.emailed ? `Hlekkur sendur á ${res.email}` : "Hlekkur tilbúinn — afritaðu hann");
    }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast("Afritað"); } catch { toast("Gat ekki afritað — veldu textann"); }
  }

  const users = [...detail.users].sort((a, b) => ROLE_ORDER.indexOf(a.role ?? "employee") - ROLE_ORDER.indexOf(b.role ?? "employee"));
  const admins = users.filter((u) => u.role === "owner" || u.role === "manager").length;
  const est = (() => { const a = invoiceFor(c.pricePlan, c.pricePlan === "v1" ? c.users : c.activeEmployees30d, c.esigns30d); return a.total - a.vat; })();
  const card = billing.cards.find((p) => p.status === "active") ?? null;
  const oldCards = billing.cards.filter((p) => p !== card);

  return (
    <>
      <Link className="adm-back" href="/admin/fyrirtaeki">← Öll fyrirtæki</Link>
      <div className="ph">
        <div>
          <h1 className="h1">{c.name}</h1>
          <div className="phsub" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge s={c.billingStatus} />
            <span>{c.kennitala ? `kt. ${c.kennitala}` : "kt. óskráð"} · stofnað {niceDate(c.createdAt)} · síðast virkt {relDate(c.lastActivity)}</span>
          </div>
        </div>
        <div className="phact">
          <button className="btn" disabled={busy} onClick={() => loginAs()}>Skrá inn sem eigandi</button>
        </div>
      </div>

      {!detail.ok ? (
        <div className="card"><div className="cb"><p className="muted" style={{ fontSize: 13.5 }}>Gat ekki sótt gögn fyrirtækisins.</p></div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="lab">Notendur</div><div className="val">{detail.users.length}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{admins} með stjórnendaaðgang</div></div>
            <div className="kpi"><div className="lab">Starfsmenn</div><div className="val">{detail.employeesActive}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{detail.employeesInactive} óvirkir · {c.activeEmployees30d} virkir 30 d.</div></div>
            <div className="kpi"><div className="lab">Stimplanir 7 d.</div><div className="val">{detail.punches7d}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{detail.locations.length} {detail.locations.length === 1 ? "staður" : "staðir"}{detail.locations.length ? ` · ${detail.locations.slice(0, 2).join(", ")}` : ""}</div></div>
            <div className="kpi"><div className="lab">Velta skráð 30 d.</div><div className="val">{nf(detail.revenue30d)} <small>kr</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>úr Inventra eða handvirkt</div></div>
          </div>

          <div className="adm-grid e2">
            <div className="card">
              <div className="ch"><div><div className="ct">Áskrift</div><div className="cs">Plan, prufa og það sem fyrirtækið greiðir</div></div></div>
              <div className="cb">
                <dl className="adm-kv">
                  <dt>Plan</dt><dd>{planLabel(c.plan)} · verðskrá {c.pricePlan === "v1" ? "v1 (eldra verð)" : "v2"}</dd>
                  <dt>Greiðslutíðni</dt><dd>{billing.interval === "year" ? "Árlega" : "Mánaðarlega"}{billing.anchor ? ` · fyrsti gjalddagi ${niceDate(billing.anchor)}` : ""}</dd>
                  <dt>Prufa til</dt><dd>{c.trialEndsAt ? niceDate(c.trialEndsAt) : "—"}{c.trialDaysLeft !== null && c.billingStatus === "trial" ? ` (${c.trialDaysLeft} d. eftir)` : ""}</dd>
                  <dt>MRR</dt><dd>{c.mrr > 0 ? `${nf(c.mrr)} kr/mán án VSK` : `0 kr — áætlað ${nf(est)} kr/mán ef borgar`}</dd>
                  <dt>Notkun 30 d.</dt><dd>{c.activeEmployees30d} virkir starfsmenn · {c.esigns30d} undirskriftir</dd>
                  <dt>Samtals greitt</dt><dd>{nf(billing.paidTotal)} kr með VSK</dd>
                  <dt>Skilmálar</dt><dd>{billing.termsAcceptedAt ? `Samþykktir ${niceDate(billing.termsAcceptedAt)}` : "Ekki skráð"}</dd>
                </dl>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
                  <select
                    value={c.manualStatus ?? "auto"} disabled={busy} aria-label="Greiðslustaða" className="adm-input"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "suspended" && !window.confirm(`Loka aðgangi ${c.name}? Allir notendur fyrirtækisins lokast úti þar til opnað er aftur.`)) return;
                      run(() => setBillingStatus(c.id, v), "Greiðslustaða uppfærð");
                    }}
                  >
                    <option value="auto">Sjálfvirkt (prufa)</option>
                    <option value="paying">Borgar</option>
                    <option value="unpaid">Borgar ekki</option>
                    <option value="free">Frítt</option>
                    <option value="suspended">Lokað — enginn kemst inn</option>
                    {c.manualStatus === "canceled" && <option value="canceled" disabled>Sagði upp (eigandi)</option>}
                  </select>
                  <button className="btn ghost sm" disabled={busy} onClick={() => run(() => extendTrial(c.id, 14), "Prufa framlengd um 14 daga")}>Framlengja prufu +14 d.</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="ch"><div><div className="ct">Kort og tengiliður</div><div className="cs">Kort er geymt hjá Straumi — hér sést aðeins tegund og síðustu fjórir stafir</div></div></div>
              <div className="cb">
                <p style={{ fontSize: 13, margin: "0 0 10px" }}>Greiðsluleið: <b>{billing.paymentMethod === "krafa" ? `Krafa í heimabanka (kt. ${billing.kennitala ?? "vantar"})` : billing.paymentMethod === "card" ? "Kort" : "Ekki valin (krafa eftir prufu)"}</b></p>
                {card ? (
                  <div className="adm-card-chip">
                    <div className="logo">{(card.brand ?? "KORT").slice(0, 4).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="num">•••• •••• •••• {card.last4 ?? "····"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{CARD_BRANDS[(card.brand ?? "").toUpperCase()] ?? card.brand ?? "Kort"} · gildir til {card.expiry ?? "—"} · skráð {niceDate(card.createdAt)}</div>
                    </div>
                    <span className="tag good">Virkt</span>
                  </div>
                ) : (
                  <div className="adm-card-chip">
                    <div className="logo">—</div>
                    <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Ekkert kort á skrá</b><div className="muted" style={{ fontSize: 12 }}>{billing.cardRequired ? "Kort er skylda — fyrirtækið kemst ekki inn fyrr en það er skráð" : "Kort er ekki skylda hjá þessu fyrirtæki"}</div></div>
                  </div>
                )}
                {oldCards.length > 0 && <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Eldri kort: {oldCards.map((p) => `•••• ${p.last4 ?? "····"} (${p.status === "disabled" ? "óvirkt" : p.status})`).join(", ")}</p>}
                <dl className="adm-kv" style={{ marginTop: 18 }}>
                  <dt>Netfang</dt><dd>{billing.contact.email ? <a href={`mailto:${billing.contact.email}`} style={{ color: "var(--brand)" }}>{billing.contact.email}</a> : "—"}</dd>
                  <dt>Sími</dt><dd>{billing.contact.phone ?? "—"}</dd>
                  <dt>Heimilisfang</dt><dd>{billing.contact.address ?? "—"}</dd>
                  <dt>Undirritun</dt><dd>{billing.esignProvider === "taktikal" ? "Taktikal — rafræn skilríki" : "Innbyggð (kóði í tölvupósti)"}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch"><div><div className="ct">Notendur</div><div className="cs">Stjórnendur efst. „Skrá inn sem“ opnar kerfið þeirra með þeirra augum</div></div><span className="badge">{users.length}</span></div>
            <div className="cb tbl" style={{ paddingTop: 8 }}>
              <table>
                <thead><tr><th>Nafn</th><th>Netfang</th><th>Hlutverk</th><th>Síðast inn</th><th>Stofnað</th><th style={{ width: 270 }} /></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.name ?? "—"}</b>{!u.employeeLinked && <span className="tag warn" style={{ marginLeft: 6, fontSize: 10.5 }} title="Enginn starfsmannaprófíll er tengdur þessum notanda">Enginn starfsmaður</span>}</td>
                      <td className="muted">{u.email ?? "—"}</td>
                      <td><span className={`tag ${u.role === "owner" ? "info" : u.role === "manager" ? "good" : "mut"}`}>{u.role ? ROLE_IS[u.role] ?? u.role : "—"}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>{u.lastSignInAt ? <span title={niceDateTime(u.lastSignInAt)}>{relDate(u.lastSignInAt)}</span> : <span className="muted">aldrei</span>}</td>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{niceDate(u.createdAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button className="btn ghost sm" disabled={busy} onClick={() => sendLink(u.id, u.email)} title="Sendir tölvupóst með hlekk sem skráir notandann inn">Senda innskráningarhlekk</button>
                          <button className="btn ghost sm" disabled={busy} onClick={() => loginAs(u.id, u.email)}>Skrá inn sem</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>Engir notendur skráðir.</td></tr>}
                </tbody>
              </table>
            </div>
            {linkResult && (
              <div className="cb" style={{ borderTop: "1px solid var(--line2)", fontSize: 12.5 }}>
                <div style={{ marginBottom: 6 }}>
                  {linkResult.emailed ? `Hlekkur sendur á ${linkResult.email}. ` : `Tölvupóstur er ekki tengdur — sendu ${linkResult.email} hlekkinn sjálf(ur). `}
                  <span className="muted">Gildir einu sinni.</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input readOnly value={linkResult.link} onFocus={(e) => e.currentTarget.select()} className="adm-input" style={{ flex: 1, fontSize: 11.5, minWidth: 0 }} />
                  <button className="btn ghost sm" onClick={() => copy(linkResult.link)}>Afrita</button>
                </div>
              </div>
            )}
          </div>

          <div className="adm-grid c2">
            <div className="card">
              <div className="ch"><div><div className="ct">Reikningar</div><div className="cs">Tekið af korti eða innheimt með kröfu í heimabanka</div></div><span className="badge">{billing.invoices.length}</span></div>
              <div className="cb tbl" style={{ paddingTop: 8 }}>
                <table>
                  <thead><tr><th>Tímabil</th><th className="r">Án VSK</th><th className="r">Samtals</th><th>Staða</th><th>Greitt</th></tr></thead>
                  <tbody>
                    {billing.invoices.map((i) => (
                      <tr key={i.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{niceDate(i.periodStart)} – {niceDate(i.periodEnd)}</td>
                        <td className="r">{nf(i.total - i.vat)}</td>
                        <td className="r"><b>{nf(i.total)}</b></td>
                        <td><span className={`tag ${INVOICE_IS[i.status]?.cls ?? "mut"}`} title={i.lastError ?? undefined}>{INVOICE_IS[i.status]?.label ?? i.status}</span>{i.status === "failed" && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{i.attempts} tilraunir</span>}{i.method === "krafa" && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }} title={i.paydayError ?? undefined}>krafa{i.paydayNumber ? ` #${i.paydayNumber}` : ""}{i.paydayError ? " · villa" : ""}</span>}</td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{i.paidAt ? niceDate(i.paidAt) : i.dueDate ? `eindagi ${niceDate(i.dueDate)}` : "—"}</td>
                      </tr>
                    ))}
                    {!billing.invoices.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>Engir reikningar enn.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="ch"><div><div className="ct">Athugasemd</div><div className="cs">Sést aðeins hjá VAKTO-teyminu</div></div></div>
              <div className="cb">
                <textarea
                  value={note} onChange={(e) => setNote(e.target.value)} rows={6}
                  placeholder="Hver er tengiliðurinn, hvað var samið, hvenær á að rukka…"
                  className="adm-input" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.45 }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btn sm" disabled={busy || note.trim() === (c.adminNote ?? "").trim()} onClick={() => run(() => saveAdminNote(c.id, note), "Athugasemd vistuð")}>Vista athugasemd</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch"><div><div className="ct">Aðgerðir VAKTO á þessu fyrirtæki</div><div className="cs">Allt sem teymið hefur gert hér — síðustu 10 færslur</div></div></div>
            <div className="cb" style={{ paddingTop: 8 }}><AuditRows rows={detail.platformAudit} showCompany={false} /></div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch"><div><div className="ct">Aðgerðaskrá fyrirtækisins</div><div className="cs">Það nýjasta sem notendur þeirra hafa gert í kerfinu</div></div></div>
            <div className="cb" style={{ paddingTop: 6 }}>
              <div className="adm-list">
                {detail.audit.map((a, i) => (
                  <div key={i}>
                    <div className="gr"><b>{a.action}</b><small>{a.detail ?? ""}</small></div>
                    <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{relDate(a.at)}</span>
                  </div>
                ))}
                {!detail.audit.length && <p className="muted" style={{ fontSize: 13, padding: "10px 0" }}>Engar færslur.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
