"use client";

import { useState, useEffect } from "react";
import { DateField } from "@/components/app/fields";
import PushToggle from "@/components/app/push-toggle";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { syncInventraRevenue, addLocation, addPosition, inviteUser, addRevenue, savePayRule, setWeekdayRevenue, getWeekdayRevenue, saveCompanyInfo } from "./actions";
import type { SettingsData, CompanyInfo } from "./settings.server";
import { type PayRule } from "@/lib/payrules";
import { dec1 } from "@/lib/format";

type SettingsModal = "location" | "position" | "invite" | "revenue" | "avgrevenue" | null;

// Mon-first weekday chips; value = JS getDay() (0=Sun … 6=Sat).
const WEEKDAYS: [number, string][] = [[1, "Mánudagur"], [2, "Þriðjudagur"], [3, "Miðvikudagur"], [4, "Fimmtudagur"], [5, "Föstudagur"], [6, "Laugardagur"], [0, "Sunnudagur"]];

const ROLE_LABEL: Record<string, string> = { owner: "Eigandi", manager: "Stjórnandi", employee: "role:employee", contractor: "Verktaki" };
const DEMO_SETTINGS: SettingsData = { locations: [], positions: [], users: [], companyId: null, company: null, live: false };

function copyKioskLink(companyId: string | null) {
  const url = `${window.location.origin}/kiosk${companyId ? `?company=${companyId}` : ""}`;
  navigator.clipboard?.writeText(url).then(() => toast("Kiosk-slóð afrituð"), () => toast(url));
}

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

export default function SettingsScreen({ initialModal = null, data = DEMO_SETTINGS, payRules = [] }: { initialModal?: SettingsModal; data?: SettingsData; payRules?: PayRule[] }) {
  const { t } = useLang();
  const [modal, setModal] = useState<SettingsModal>(initialModal);
  const [editRule, setEditRule] = useState<PayRule | null>(null);
  const [posName, setPosName] = useState<string | null>(null);
  function posConnect(name: string) { setPosName(name === "POS" ? "" : name); }
  const [section, setSection] = useState<string>("fyrirtaeki");
  const SECTIONS: [string, string][] = [
    ["fyrirtaeki", "Fyrirtæki"], ["tengingar", "Tengingar"], ["launareglur", "Launareglur"],
    ["notendur", "Notendur"], ["askrift", "Áskrift"],
  ];
  return (
    <>
      <PageHeader title="Stillingar" subtitle="Fyrirtæki, tengingar, notendur og áskrift" />
      <div className="settabs">
        {SECTIONS.map(([id, label]) => (
          <button key={id} className={`etab2${section === id ? " on" : ""}`} onClick={() => setSection(id)}>{t(label)}</button>
        ))}
      </div>
      <div>

      {section === "fyrirtaeki" && <>
      <div className="grid2b">
        <CompanyCard info={data.company} />
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
      </div>
      </>}

      {section === "tengingar" && (
        <div className="card">
          <div className="ch"><div className="ct">{t("Tengingar")}</div></div>
          <div className="cb att">
            <div className="it"><div className="ic good">P</div><div className="tx"><b>Payday</b><span>{t("launakeyrsla & skil")}</span></div><span className="tag good">{t("tengt")}</span></div>
            <div className="it rowlink" onClick={syncInventra}><div className="ic info">IN</div><div className="tx"><b>INVENTRA</b><span>{t("framleiðsluvelta í rauntíma · smelltu til að sækja veltu")}</span></div><span className="tag good">{t("tengt")}</span></div>
            <div className="it rowlink" onClick={() => posConnect("Dineout")}><div className="ic info">DO</div><div className="tx"><b>Dineout</b><span>{t("söluvelta veitingastaða í rauntíma")}</span></div><span className="tag info">{t("tengja")}</span></div>
            <div className="it rowlink" onClick={() => posConnect("SalesCloud")}><div className="ic info">SC</div><div className="tx"><b>SalesCloud</b><span>{t("söluvelta úr POS í rauntíma")}</span></div><span className="tag info">{t("tengja")}</span></div>
            <div className="it rowlink" onClick={() => setModal("revenue")}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div><div className="tx"><b>{t("Skrá veltu handvirkt")}</b><span>{t("án Inventra — sláðu inn veltu til að sjá laun vs velta")}</span></div><span className="tag info">{t("slá inn")}</span></div>
            <div className="it rowlink" onClick={() => setModal("avgrevenue")}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg></div><div className="tx"><b>{t("Meðalvelta per vikudag")}</b><span>{t("áætluð velta per vikudag — laun% án tengingar")}</span></div><span className="tag info">{t("slá inn")}</span></div>
            <div className="it"><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg></div><div className="tx"><b>{t("Push-tilkynningar")}</b><span>{t("vaktir, beiðnir og samþykki beint í símann")}</span></div><PushToggle /></div>
            <div className="it rowlink" onClick={() => copyKioskLink(data.companyId)}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg></div><div className="tx"><b>{t("Kiosk-stimpilklukka")}</b><span>{t("opnaðu á spjaldtölvu — PIN = síðustu 4 í kennitölu · smelltu til að afrita slóð")}</span></div><span className="tag info">{t("afrita slóð")}</span></div>
            <div className="it rowlink" onClick={() => posConnect("POS")}><div className="ic mut" style={{ background: "var(--line2)" }}>P</div><div className="tx"><b>{t("Fleiri sölukerfi")}</b><span>Dótturkassi, Salt, Verifone{t(" o.fl.")}</span></div><span className="tag mut">{t("tengja")}</span></div>
          </div>
        </div>
      )}

      {section === "launareglur" && (
      <div className="card">
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
      )}

      {section === "fyrirtaeki" && <>
      <div className="grid2b" style={{ marginTop: 16 }}>
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

      </>}

      {section === "notendur" && (
      <div className="card">
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
      )}

      {section === "askrift" && (
      <div className="card owner-only">
        <div className="ch"><div><div className="ct">{t("Áskrift & greiðslur")}</div><div className="cs">{t("VAKTO · mánaðarlega")}</div></div><span className="badge" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("virk")}</span></div>
        <div className="cb">
          <div className="statline"><span className="k">{t("Mánaðargjald")}</span><span className="v">9.990 kr {t("m/VSK")}</span></div>
          <div className="statline"><span className="k">{t("Notendur innifaldir")}</span><span className="v">5</span></div>
          <div className="statline"><span className="k">{t("Umfram notendur")}</span><span className="v">990 kr/{t("notanda")}</span></div>
          <div className="statline"><span className="k">{t("Næsta greiðsla")}</span><span className="v">13. júlí 2026</span></div>
          <div className="hr" />
          <div className="statline"><span className="k">{t("Greiðslumáti")}</span><span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, color: "#1a1f71", fontSize: 12, letterSpacing: ".5px" }}>VISA</span> •••• 1817 · 04/28</span></div>
          <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
            <button className="btn ghost sm" onClick={() => toast("Opna kortastillingar")}>{t("Uppfæra kort")}</button>
            <button className="btn ghost sm" onClick={() => toast("Sæki reikninga")}>{t("Reikningar")}</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>{t("Fast mánaðarverð með VSK, 5 notendur innifaldir og 990 kr fyrir hvern til viðbótar. Engin binding.")}</p>
        </div>
      </div>
      )}

      </div>

      {modal && <SettingsFormModal modal={modal} onClose={() => setModal(null)} />}
      {editRule && <PayRuleModal rule={editRule} onClose={() => setEditRule(null)} />}
      {posName !== null && <PosConnectModal name={posName} onClose={() => setPosName(null)} />}
    </>
  );
}

/** Editable company info (name, kennitala, address, contact) — Stillingar → Fyrirtæki. */
function CompanyCard({ info }: { info: CompanyInfo | null }) {
  const { t } = useLang();
  const [name, setName] = useState(info?.name ?? "");
  const [kt, setKt] = useState(info?.kennitala ?? "");
  const [address, setAddress] = useState(info?.address ?? "");
  const [phone, setPhone] = useState(info?.phone ?? "");
  const [email, setEmail] = useState(info?.email ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await saveCompanyInfo({ name, kennitala: kt, address, phone, email });
    setBusy(false);
    toast(res.ok ? (res.demo ? "Vistað (demo — tengdu Supabase)" : "Fyrirtækjaupplýsingar vistaðar") : (res.error ?? "Tókst ekki"));
  }
  return (
    <div className="card">
      <div className="ch"><div><div className="ct">{t("Fyrirtækið mitt")}</div><div className="cs">{t("birtist á skírteinum, skýrslum og launaseðlum")}</div></div></div>
      <div className="cb">
        <div className="field"><label>{t("Nafn fyrirtækis")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.d. Kaffi Krónan ehf." /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><label>{t("Kennitala")}</label><input value={kt} onChange={(e) => setKt(e.target.value)} placeholder="550101-2210" /></div>
          <div className="field" style={{ flex: 1 }}><label>{t("Sími")}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+354 555 1234" /></div>
        </div>
        <div className="field"><label>{t("Heimilisfang")}</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("t.d. Laugavegur 1, 101 Reykjavík")} /></div>
        <div className="field"><label>{t("Netfang")}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bokhald@fyrirtaeki.is" /></div>
        <button className="btn sm" disabled={busy} onClick={save}>{t("Vista")}</button>
      </div>
    </div>
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
  const [week, setWeek] = useState<string[]>(["", "", "", "", "", "", ""]); // by getDay 0..6

  useEffect(() => {
    if (modal !== "avgrevenue") return;
    getWeekdayRevenue().then((wr) => { if (wr) setWeek(Array.from({ length: 7 }, (_, d) => (wr[String(d)] ? String(wr[String(d)]) : ""))); });
  }, [modal]);

  const titles: Record<Exclude<SettingsModal, null>, string> = {
    location: "Bæta við stað", position: "Ný staða", invite: "Bjóða notanda", revenue: "Skrá veltu handvirkt", avgrevenue: "Meðalvelta per vikudag",
  };

  async function submit() {
    setBusy(true); setError(null);
    let res: { ok: boolean; demo?: boolean; error?: string } = { ok: true };
    if (modal === "location") res = await addLocation({ name });
    else if (modal === "position") res = await addPosition({ name, baseRate: rate });
    else if (modal === "invite") res = await inviteUser({ email, role });
    else if (modal === "revenue") res = await addRevenue({ amount, date });
    else if (modal === "avgrevenue") res = await setWeekdayRevenue(Object.fromEntries(week.map((v, d) => [String(d), Number((v || "0").replace(/[^\d]/g, "")) || 0])));
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Tókst ekki"); return; }
    onClose();
    const ok: Record<Exclude<SettingsModal, null>, string> = {
      location: "Staður bætt við", position: "Staða stofnuð", invite: "Boð sent", revenue: "Velta skráð — laun% uppfært", avgrevenue: "Meðalvelta vistuð — laun% uppfært",
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
            <div className="field"><label>{t("Dagsetning")}</label><DateField value={date} onChange={setDate} /></div>
          </>}
          {modal === "avgrevenue" && <>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("Sláðu inn dæmigerða veltu fyrir hvern vikudag. Kerfið áætlar laun% út frá þessu þegar engin rauntala er skráð. Raunvelta tekur alltaf fram yfir.")}</p>
            {WEEKDAYS.map(([d, label]) => (
              <div className="field" key={d} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ flex: 1, margin: 0 }}>{t(label)}</label>
                <input value={week[d]} onChange={(e) => setWeek((w) => { const n = [...w]; n[d] = e.target.value; return n; })} placeholder="0" style={{ width: 130, textAlign: "right" }} />
              </div>
            ))}
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

/** POS / sales-system connection request. Real sync needs each provider's API key,
 * so this captures interest + explains sales vs production revenue. */
function PosConnectModal({ name, onClose }: { name: string; onClose: () => void }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const title = name || t("Sölukerfi");
  async function request() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 300));
    setBusy(false);
    onClose();
    toast(t("Takk! Við höfum samband um tengingu."));
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Tengja")} {title}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            {t("VAKTO les veltu í rauntíma úr sölukerfinu þínu og reiknar launahlutfall jafnóðum. Veldu hvað þú vilt fylgjast með:")}
          </p>
          <div className="att" style={{ marginBottom: 12 }}>
            <div className="it"><div className="ic good">$</div><div className="tx"><b>{t("Söluvelta")}</b><span>{t("t.d. Dineout, SalesCloud, POS — sala til viðskiptavina")}</span></div></div>
            <div className="it"><div className="ic info">IN</div><div className="tx"><b>{t("Framleiðsluvelta")}</b><span>{t("t.d. Inventra — framleitt/afgreitt magn")}</span></div></div>
          </div>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>{t("Tengingin krefst aðgangs frá þjónustuaðilanum. Sláðu inn áhuga og við setjum hana upp með þér.")}</p>
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="btn" disabled={busy} onClick={request}>{busy ? t("Sendi…") : t("Óska eftir tengingu")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
