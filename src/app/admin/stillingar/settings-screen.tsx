"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import type { PlatformAuditEntry, PlatformIdentity, TeamOverview } from "@/lib/vakto-admin.server";
import { inviteTeamMember, removeTeamMember, setTeamRole, saveMyName } from "../actions";
import { AuditRows, niceDate, relDate } from "../ui";

export default function SettingsScreen({ me, team, audit }: { me: PlatformIdentity; team: TeamOverview; audit: PlatformAuditEntry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(me.name ?? "");
  const [dark, setDark] = useState(false);
  const [inv, setInv] = useState({ email: "", name: "", role: "staff" });
  const [link, setLink] = useState<{ email: string; link: string } | null>(null);
  const isOwner = me.role === "owner";

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    requestAnimationFrame(sync);
    window.addEventListener("vakto-theme", sync);
    return () => window.removeEventListener("vakto-theme", sync);
  }, []);
  function setTheme(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("vakto-theme", next ? "dark" : "light"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("vakto-theme"));
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    toast(res.ok ? okMsg : (res.error ?? "Tókst ekki"));
    if (res.ok) router.refresh();
    return res.ok;
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await inviteTeamMember(inv);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    toast(res.emailed ? `Boð sent á ${inv.email}` : res.link ? "Boðshlekkur tilbúinn — afritaðu hann" : `${inv.email} hefur nú aðgang`);
    setLink(res.link ? { email: inv.email, link: res.link } : null);
    setInv({ email: "", name: "", role: "staff" });
    router.refresh();
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast("Afritað"); } catch { toast("Gat ekki afritað — veldu textann"); }
  }

  return (
    <>
      <PageHeader title="Stillingar" subtitle="Aðgangurinn þinn, útlit og hverjir í VAKTO-teyminu komast hingað inn" />

      <div className="adm-grid e2" style={{ marginTop: 0 }}>
        <div className="card">
          <div className="ch"><div><div className="ct">Aðgangurinn minn</div><div className="cs">Nafnið sést í teyminu og aðgerðaskránni</div></div><span className={`tag ${isOwner ? "info" : "mut"}`}>{isOwner ? "Eigandi" : "Starfsmaður"}</span></div>
          <div className="cb">
            <dl className="adm-kv" style={{ alignItems: "center" }}>
              <dt><label htmlFor="adm-name">Nafn</label></dt>
              <dd style={{ display: "flex", gap: 8 }}>
                <input id="adm-name" className="adm-input" style={{ flex: 1, minWidth: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Fullt nafn" />
                <button className="btn sm" disabled={busy || !name.trim() || name.trim() === (me.name ?? "")} onClick={() => run(() => saveMyName(name), "Nafn vistað")}>Vista</button>
              </dd>
              <dt>Netfang</dt><dd>{me.email}</dd>
              <dt>Lykilorð</dt><dd><a href="/nytt-lykilord" style={{ color: "var(--brand)", fontWeight: 600 }}>Velja nýtt lykilorð</a></dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div><div className="ct">Útlit</div><div className="cs">Gildir í þessum vafra</div></div></div>
          <div className="cb">
            <div className="seg">
              <button className={!dark ? "on" : undefined} onClick={() => setTheme(false)}>Ljóst</button>
              <button className={dark ? "on" : undefined} onClick={() => setTheme(true)}>Dökkt</button>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>Þú getur líka skipt með tunglinu efst til hægri.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">VAKTO-teymið</div><div className="cs">Fólk sem vinnur hjá VAKTO og kemst inn á þetta svæði — sér öll fyrirtæki og getur skráð sig inn sem notendur þeirra</div></div><span className="badge">{team.members.length}</span></div>
        {team.needsMigration && (
          <div className="cb" style={{ paddingBottom: 0 }}><p style={{ margin: 0, fontSize: 12.5, color: "var(--warn)" }}>Migration 0068 vantar í þennan gagnagrunn — boð í teymið vistast ekki fyrr en hún hefur verið keyrð.</p></div>
        )}
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>Nafn</th><th>Netfang</th><th>Hlutverk</th><th>Síðast inn</th><th>Bætt við</th>{isOwner && <th style={{ width: 150 }} />}</tr></thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.email}>
                  <td><b>{m.name ?? "—"}</b>{m.email === me.email && <span className="tag mut" style={{ marginLeft: 6, fontSize: 10.5 }}>Þú</span>}</td>
                  <td className="muted">{m.email}</td>
                  <td>
                    {isOwner && !m.fromEnv && m.email !== me.email ? (
                      <select className="adm-input" style={{ fontSize: 12, padding: "5px 7px" }} value={m.role} disabled={busy} aria-label={`Hlutverk ${m.email}`} onChange={(e) => run(() => setTeamRole(m.email, e.target.value), "Hlutverki breytt")}>
                        <option value="staff">Starfsmaður</option>
                        <option value="owner">Eigandi</option>
                      </select>
                    ) : <span className={`tag ${m.role === "owner" ? "info" : "mut"}`}>{m.role === "owner" ? "Eigandi" : "Starfsmaður"}</span>}
                  </td>
                  <td>{m.lastSignInAt ? relDate(m.lastSignInAt) : <span className="muted">{m.hasAccount ? "aldrei" : "boð ekki virkjað"}</span>}</td>
                  <td className="muted">{m.createdAt ? `${niceDate(m.createdAt)}${m.invitedBy ? ` · ${m.invitedBy}` : ""}` : "Frá upphafi"}</td>
                  {isOwner && (
                    <td style={{ textAlign: "right" }}>
                      {!m.fromEnv && m.email !== me.email && (
                        <button className="btn ghost sm" style={{ color: "var(--bad)" }} disabled={busy} onClick={() => { if (window.confirm(`Fjarlægja aðgang ${m.email} að VAKTO Admin?`)) run(() => removeTeamMember(m.email), "Aðgangur fjarlægður"); }}>Fjarlægja</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isOwner ? (
          <form className="cb" style={{ borderTop: "1px solid var(--line2)" }} onSubmit={invite}>
            <div className="ct" style={{ fontSize: 13.5, marginBottom: 10 }}>Bjóða í teymið</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className="adm-input" style={{ flex: "1 1 200px" }} type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="netfang@vakto.is" aria-label="Netfang" />
              <input className="adm-input" style={{ flex: "1 1 160px" }} value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} placeholder="Nafn" aria-label="Nafn" />
              <select className="adm-input" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} aria-label="Hlutverk">
                <option value="staff">Starfsmaður</option>
                <option value="owner">Eigandi — má bjóða og fjarlægja fólk</option>
              </select>
              <button className="btn" type="submit" disabled={busy || !inv.email.trim()}>Senda boð</button>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>Viðkomandi fær póst með hlekk til að velja lykilorð og skráir sig svo inn á admin.vakto.is. Hvert boð er skráð í aðgerðaskrána.</p>
            {link && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
                <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>Hlekkur fyrir {link.email}:</span>
                <input readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} className="adm-input" style={{ flex: 1, fontSize: 11.5, minWidth: 0 }} />
                <button type="button" className="btn ghost sm" onClick={() => copy(link.link)}>Afrita</button>
              </div>
            )}
          </form>
        ) : (
          <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aðeins eigandi getur boðið fólki í teymið eða fjarlægt það.</p></div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }} id="adgerdaskra">
        <div className="ch"><div><div className="ct">Aðgerðaskrá</div><div className="cs">Allt sem teymið gerir í admin — síðustu 50 færslur</div></div><span className="badge">{audit.length}</span></div>
        <div className="cb" style={{ paddingTop: 8 }}><AuditRows rows={audit} showCompany /></div>
      </div>
    </>
  );
}
