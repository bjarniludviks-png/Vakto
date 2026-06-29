"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { syncInventraRevenue, addLocation, addPosition, inviteUser, addRevenue, savePayRule } from "./actions";
import type { AuditEntry } from "@/lib/audit";
import type { SettingsData } from "./settings.server";
import { type PayRule } from "@/lib/payrules";
import { dec1 } from "@/lib/format";

type SettingsModal = "location" | "position" | "invite" | "revenue" | null;

const ROLE_LABEL: Record<string, string> = { owner: "Eigandi", manager: "Stjórnandi", employee: "role:employee", contractor: "Verktaki" };
const DEMO_SETTINGS: SettingsData = { locations: [], positions: [], users: [], live: false };

const AUDIT_ICON: Record<string, string> = {
  "employee.create": "M12 5v14M5 12h14",
  "employee.update": "M4 13.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5.5M16 6l-4-4-4 4M12 2v13",
  "payroll.run": "M3 7h18v12H3zM3 11h18",
  "schedule.publish": "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4",
  "inventra.sync": "M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2",
};

async function syncInventra() {
  const res = await syncInventraRevenue();
  if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
  toast(res.demo ? "Velta sótt frá Inventra (demo)" : "Velta sótt frá Inventra — laun% uppfært");
}

const Globe = () => (
  <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M3.2 9h17.6M3.2 15h17.6M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
);
const Pin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
);

export default function SettingsScreen({ audit = [], initialModal = null, data = DEMO_SETTINGS, payRules = [] }: { audit?: AuditEntry[]; initialModal?: SettingsModal; data?: SettingsData; payRules?: PayRule[] }) {
  const { t } = useLang();
  const [modal, setModal] = useState<SettingsModal>(initialModal);
  const [editRule, setEditRule] = useState<PayRule | null>(null);
  return (
    <>
      <PageHeader title="Stillingar" subtitle="Reglur, kjarasamningar og tengingar" />

      <div className="grid2b">
        <div className="card">
          <div className="ch"><div className="ct">{t("Land & launareglur")}</div></div>
          <div className="cb">
            <div className="att">
              <div className="it"><div className="ic info"><Globe /></div><div className="tx"><b>{t("Ísland (virkt)")}</b><span>{t("staðgreiðsla, tryggingagjald, lífeyrir, orlof")}</span></div><span className="tag good">{t("virkt")}</span></div>
              <div className="it" style={{ opacity: 0.6 }}><div className="ic mut" style={{ background: "var(--line2)" }}><Globe /></div><div className="tx"><b>{t("Fleiri lönd")}</b><span>{t("Noregur, Danmörk, Bretland")}</span></div><span className="tag mut">{t("væntanlegt")}</span></div>
            </div>
            <div className="hr" />
            <div className="statline"><span className="k">{t("Tryggingagjald")}</span><span className="v">6,35%</span></div>
            <div className="statline"><span className="k">{t("Mótframlag lífeyris")}</span><span className="v">11,5%</span></div>
            <div className="statline"><span className="k">{t("Orlof")}</span><span className="v">10,17%</span></div>
            <div className="statline"><span className="k">{t("Launatímabil")}</span><span className="v">21. → 20.</span></div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Tengingar")}</div></div>
          <div className="cb att">
            <div className="it"><div className="ic good">P</div><div className="tx"><b>Payday</b><span>{t("launakeyrsla & skil")}</span></div><span className="tag good">{t("tengt")}</span></div>
            <div className="it rowlink" onClick={syncInventra}><div className="ic info">IN</div><div className="tx"><b>INVENTRA</b><span>{t("velta í rauntíma — laun vs velta · smelltu til að sækja veltu")}</span></div><span className="tag good">{t("tengt")}</span></div>
            <div className="it rowlink" onClick={() => setModal("revenue")}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div><div className="tx"><b>{t("Skrá veltu handvirkt")}</b><span>{t("án Inventra — sláðu inn veltu til að sjá laun vs velta")}</span></div><span className="tag info">{t("slá inn")}</span></div>
            <div className="it"><div className="ic mut" style={{ background: "var(--line2)" }}>P</div><div className="tx"><b>{t("POS / sölukerfi")}</b><span>Dótturkassi, Salt, Verifone</span></div><span className="tag mut">{t("tengja")}</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch">
          <div><div className="ct">{t("Launareglur kjarasamninga")}</div><div className="cs">{t("álag, yfirvinna og stórhátíðardagar — smelltu til að staðfesta")}</div></div>
          {payRules.every((r) => r.confirmed) && payRules.length > 0
            ? <span className="badge" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("staðfest")}</span>
            : <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("óstaðfest")}</span>}
        </div>
        <div className="cb att">
          {payRules.map((r) => (
            <div className="it rowlink" key={r.code} onClick={() => setEditRule(r)}>
              <div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
              <div className="tx"><b>{t(r.label)}</b><span>{r.pct > 0 ? `+${dec1(r.pct)}%` : t("grunntaxti")}{r.kind === "overtime" ? " · " + t("yfirvinna") : r.kind === "holiday" ? " · " + t("stórhátíð") : ""}</span></div>
              <span className={`tag ${r.confirmed ? "good" : "mut"}`} style={r.confirmed ? undefined : { background: "var(--warn-soft)", color: "var(--warn)" }}>{r.confirmed ? t("staðfest") : t("óstaðfest")}</span>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t("⚠️ Prósenturnar eru staðlað sniðmát — staðfestu hverja gegn raunverulegum kjarasamningi (Efling/VR) áður en þær eru notaðar á laun.")}</p>
        </div>
      </div>

      <div className="grid2b">
        <div className="card">
          <div className="ch"><div className="ct">{t("Staðir")}</div><button className="btn sm" onClick={() => setModal("location")}>{t("+ Bæta við stað")}</button></div>
          <div className="cb att">
            {data.locations.map((l) => (
              <div className="it" key={l.name}>
                <div className={`ic ${l.staff > 0 ? "info" : "mut"}`} style={l.staff > 0 ? undefined : { background: "var(--line2)" }}><Pin /></div>
                <div className="tx"><b>{l.name}</b><span>{l.staff} {t("starfsmenn")} · {l.timezone}</span></div>
                <span className={`tag ${l.staff > 0 ? "good" : "mut"}`}>{l.staff > 0 ? t("virkt") : t("nýtt")}</span>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t("Hver staður hefur eigin starfsfólk, vaktaplan, laun% og tímabelti — fyrir keðjur og mörg útibú.")}</p>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Stöður (positions)")}</div><button className="btn sm" onClick={() => setModal("position")}>{t("+ Ný staða")}</button></div>
          <div className="cb att">
            {data.positions.map((p) => (
              <div className="it" key={p.name}>
                <div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 14v5.5h12V14M6 14a4 4 0 0 1-1-7.8A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 7 2.2A4 4 0 0 1 18 14Z" /></svg></div>
                <div className="tx"><b>{p.name}</b><span>{p.staff} {t("starfsmenn")} · {t("grunntaxti")} {p.baseRate} kr</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div className="ct">{t("Notendur & aðgangur")}</div><button className="btn sm" onClick={() => setModal("invite")}>{t("+ Bjóða notanda")}</button></div>
        <div className="cb att">
          {data.users.map((u, i) => (
            <div className="it" key={u.name + i}>
              <div className="ic info" style={u.role === "manager" ? { background: "#ece9fd", color: "#8b7bff" } : undefined}>{u.initials}</div>
              <div className="tx"><b>{u.name}</b><span>{u.email}</span></div>
              <span className={`tag ${u.role === "owner" ? "info" : "mut"}`}>{t(ROLE_LABEL[u.role] ?? "role:employee")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card owner-only" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t("Áskrift & greiðslur")}</div><div className="cs">{t("Vakto Business · mánaðarlega")}</div></div><span className="badge" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("virk")}</span></div>
        <div className="cb">
          <div className="statline"><span className="k">{t("Fjöldi notenda")}</span><span className="v">14</span></div>
          <div className="statline"><span className="k">{t("Verð á notanda")}</span><span className="v">590 kr/mán</span></div>
          <div className="statline"><span className="k" style={{ fontWeight: 650, color: "var(--ink)" }}>{t("Samtals")}</span><span className="v" style={{ fontSize: 15 }}>8.260 kr/mán</span></div>
          <div className="statline"><span className="k">{t("Næsta greiðsla")}</span><span className="v">13. júlí 2026</span></div>
          <div className="hr" />
          <div className="statline"><span className="k">{t("Greiðslumáti")}</span><span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, color: "#1a1f71", fontSize: 12, letterSpacing: ".5px" }}>VISA</span> •••• 1817 · 04/28</span></div>
          <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
            <button className="btn ghost sm" onClick={() => toast("Opna kortastillingar")}>{t("Uppfæra kort")}</button>
            <button className="btn ghost sm" onClick={() => toast("Sæki reikninga")}>{t("Reikningar")}</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{t("Verð aðlagast sjálfkrafa þegar notendum fjölgar eða fækkar (per-notanda). Lítil teymi (≤5 starfsmenn) ókeypis.")}</p>
        </div>
      </div>

      <div className="card owner-only" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t("audit:title")}</div><div className="cs">{t("audit:sub")}</div></div><span className="badge">{audit.length}</span></div>
        <div className="cb att">
          {audit.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>{t("audit:empty")}</p>
          ) : (
            audit.map((a, i) => (
              <div className="it" key={i}>
                <div className="ic info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}>
                    <path d={AUDIT_ICON[a.action] ?? "M5 12h14"} />
                  </svg>
                </div>
                <div className="tx"><b>{a.detail ?? a.action}</b><span>{a.action}</span></div>
                <span className="tag mut" style={{ background: "var(--line2)", color: "var(--ink3)" }}>
                  {a.at.slice(8, 10)}.{a.at.slice(5, 7)}. · {a.at.slice(11, 16)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {modal && <SettingsFormModal modal={modal} onClose={() => setModal(null)} />}
      {editRule && <PayRuleModal rule={editRule} onClose={() => setEditRule(null)} />}
    </>
  );
}

function SettingsFormModal({ modal, onClose }: { modal: Exclude<SettingsModal, null>; onClose: () => void }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // shared fields
  const [name, setName] = useState("");
  const [rate, setRate] = useState("2.900");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Starfsmaður");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const titles: Record<Exclude<SettingsModal, null>, string> = {
    location: "Bæta við stað", position: "Ný staða", invite: "Bjóða notanda", revenue: "Skrá veltu handvirkt",
  };

  async function submit() {
    setBusy(true); setError(null);
    let res: { ok: boolean; demo?: boolean; error?: string } = { ok: true };
    if (modal === "location") res = await addLocation({ name });
    else if (modal === "position") res = await addPosition({ name, baseRate: rate });
    else if (modal === "invite") res = await inviteUser({ email, role });
    else if (modal === "revenue") res = await addRevenue({ amount, date });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Tókst ekki"); return; }
    onClose();
    const ok: Record<Exclude<SettingsModal, null>, string> = {
      location: "Staður bætt við", position: "Staða stofnuð", invite: "Boð sent", revenue: "Velta skráð — laun% uppfært",
    };
    toast(res.demo ? `${ok[modal]} (demo — tengdu Supabase)` : ok[modal]);
  }

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t(titles[modal])}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {modal === "location" && (
            <div className="field"><label>{t("Heiti staðar")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.d. Hotel Umi" autoFocus /></div>
          )}
          {modal === "position" && <>
            <div className="field"><label>{t("Heiti stöðu")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.d. Vaktstjóri" autoFocus /></div>
            <div className="field"><label>{t("Grunntaxti (kr/klst)")}</label><input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="2.900" /></div>
          </>}
          {modal === "invite" && <>
            <div className="field"><label>{t("Netfang")}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netfang@fyrirtaeki.is" autoFocus /></div>
            <div className="field"><label>{t("Hlutverk (aðgangur)")}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option>{t("Starfsmaður")}</option><option>{t("Vaktstjóri")}</option><option>{t("Stjórnandi")}</option><option>{t("Verktaki")}</option>
              </select>
            </div>
          </>}
          {modal === "revenue" && <>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("Sláðu inn veltu dagsins (eða tímabils) til að reikna laun% án Inventra.")}</p>
            <div className="field"><label>{t("Velta (kr)")}</label><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="612.000" autoFocus /></div>
            <div className="field"><label>{t("Dagsetning")}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </>}
          {error && <p style={{ color: "var(--bad)", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
          <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
            <button className="btn" disabled={busy} onClick={submit}>{t("Vista")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayRuleModal({ rule, onClose }: { rule: PayRule; onClose: () => void }) {
  const { t } = useLang();
  const [pct, setPct] = useState(String(rule.pct).replace(".", ","));
  const [confirmed, setConfirmed] = useState(rule.confirmed);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const res = await savePayRule({ code: rule.code, label: rule.label, kind: rule.kind, pct, confirmed });
    setBusy(false);
    onClose();
    toast(res.ok ? (res.demo ? "Vistað (demo)" : "Launaregla vistuð") : "Tókst ekki");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t(rule.label)}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="field"><label>{t("Álag / yfirvinna (%)")}</label><input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="33" autoFocus /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, margin: "4px 0 2px", cursor: "pointer" }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {t("Ég staðfesti að þetta stemmir við kjarasamninginn")}
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t("Berðu saman við réttan samning (Efling/VR/SGS) áður en þú staðfestir.")}</p>
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="btn" disabled={busy} onClick={submit}>{t("Vista")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
