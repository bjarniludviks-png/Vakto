"use client";

import { useState, useEffect } from "react";
import { DateField } from "@/components/app/fields";
import PushToggle from "@/components/app/push-toggle";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { syncInventraRevenue, addLocation, updateLocation, deleteLocation, addDepartment, renameDepartment, deleteDepartment, addPosition, updatePosition, deletePosition, inviteUser, addRevenue, savePayRule, setWeekdayRevenue, getWeekdayRevenue, saveCompanyInfo, saveRuleTemplate, deleteRuleTemplate, aiSuggestRules, saveContractTerms, getContractTerms, createApiKey, revokeApiKey, savePayPeriodStart } from "./actions";
import type { SettingsData, CompanyInfo } from "./settings.server";
import { type PayRule } from "@/lib/payrules";
import { type RuleSet, type RuleTemplate, RULE_PRESETS, summarizeRules } from "@/lib/rules";
import { dec1 } from "@/lib/format";

type SettingsModal = "location" | "department" | "position" | "invite" | "revenue" | "avgrevenue" | null;

// Mon-first weekday chips; value = JS getDay() (0=Sun … 6=Sat).
const WEEKDAYS: [number, string][] = [[1, "Mánudagur"], [2, "Þriðjudagur"], [3, "Miðvikudagur"], [4, "Fimmtudagur"], [5, "Föstudagur"], [6, "Laugardagur"], [0, "Sunnudagur"]];

const ROLE_LABEL: Record<string, string> = { owner: "Eigandi", manager: "Stjórnandi", employee: "role:employee", contractor: "Verktaki" };
const DEMO_SETTINGS: SettingsData = { departments: [], locations: [], positions: [], users: [], apiKeys: [], companyId: null, company: null, live: false };

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

export default function SettingsScreen({ initialModal = null, data = DEMO_SETTINGS, payRules = [], ruleTemplates = [] }: { initialModal?: SettingsModal; data?: SettingsData; payRules?: PayRule[]; ruleTemplates?: RuleTemplate[] }) {
  const { t } = useLang();
  const [modal, setModal] = useState<SettingsModal>(initialModal);
  const [keyModal, setKeyModal] = useState(false);
  const [tplModal, setTplModal] = useState<RuleTemplate | "new" | null>(null);
  const [deptEdit, setDeptEdit] = useState<{ id: string; name: string; location: string; staff: number; color: string | null; members: string[] } | null>(null);
  const [rowEdit, setRowEdit] = useState<{ kind: "location" | "position"; id: string; name: string; rate?: number } | null>(null);
  const [posName, setPosName] = useState<string | null>(null);
  function posConnect(name: string) { setPosName(name === "POS" ? "" : name); }
  const [section, setSection] = useState<string>(initialModal === "revenue" || initialModal === "avgrevenue" ? "velta" : "fyrirtaeki");
  const SECTIONS: [string, string][] = [
    ["fyrirtaeki", "Fyrirtæki"], ["tengingar", "Samþættingar"], ["velta", "Veltuskráning"],
    ["launareglur", "Launareglur"], ["notendur", "Notendur"], ["askrift", "Áskrift"],
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
            <div className="statline"><span className="k">{t("Launatímabil")}</span>
              <select className="badge" style={{ border: "1px solid var(--line)", padding: "5px 9px", font: "inherit", fontSize: 12.5 }}
                defaultValue={String(data.company && "payPeriodStart" in (data.company as object) ? (data.company as unknown as { payPeriodStart?: number }).payPeriodStart ?? 1 : 1)}
                onChange={async (e) => { const r = await savePayPeriodStart(Number(e.target.value)); toast(r.ok ? t("Launatímabil vistað") : (r.error ?? "Villa")); }}>
                <option value="1">1. → {t("mánaðamóta")}</option>
                <option value="15">15. → 14.</option>
                <option value="21">21. → 20.</option>
                <option value="25">25. → 24.</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      </>}

      {section === "tengingar" && (
        <div className="card">
          <div className="ch">
            <div>
              <div className="ct">{t("Samþættingar (API)")}</div>
              <div className="cs">{t("búðu til samþættingu fyrir hvaða kerfi sem er — nefndu hana (t.d. SalesCloud) og settu lykilinn í kerfið sem á að senda sölutölur")}</div>
            </div>
            <button className="btn sm" onClick={() => setKeyModal(true)}>{t("+ Ný tenging")}</button>
          </div>
          <div className="cb att">
            {data.apiKeys.length === 0 && (
              <div className="muted" style={{ fontSize: 13, padding: "8px 2px" }}>
                {t("Engin API-tenging enn — búðu til lykil og láttu sölukerfið þitt POST-a á")} <code style={{ fontSize: 12 }}>/api/v1/revenue</code>
              </div>
            )}
            {data.apiKeys.map((k) => (
              <div className="it" key={k.id}>
                <div className={`ic ${k.revoked ? "mut" : "good"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3zM11.4 11.6a5 5 0 1 0 1 1z" /></svg></div>
                <div className="tx">
                  <b style={k.revoked ? { textDecoration: "line-through", color: "var(--ink3)" } : undefined}>{k.name}</b>
                  <span>{k.prefix} · {t("stofnuð")} {k.created}{k.lastUsed ? ` · ${t("síðast notuð")} ${k.lastUsed}` : ` · ${t("aldrei notuð")}`}</span>
                </div>
                {k.revoked
                  ? <span className="tag mut">{t("afturkölluð")}</span>
                  : <button className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={async () => { const r = await revokeApiKey(k.id); toast(r.ok ? t("Tenging afturkölluð") : (r.error ?? "Villa")); }}>{t("Afturkalla")}</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "tengingar" && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="ch"><div><div className="ct">{t("Tæki & tilkynningar")}</div><div className="cs">{t("stimpilklukkan á staðnum, push í símana og launaskil")}</div></div></div>
          <div className="cb att">
            <div className="it"><div className="ic good">P</div><div className="tx"><b>Payday</b><span>{t("launakeyrsla & skil")}</span></div><span className="tag good">{t("tengt")}</span></div>
            <div className="it"><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg></div><div className="tx"><b>{t("Push-tilkynningar")}</b><span>{t("vaktir, beiðnir og samþykki beint í símann")}</span></div><PushToggle /></div>
            <div className="it rowlink" onClick={() => copyKioskLink(data.companyId)}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg></div><div className="tx"><b>{t("Kiosk-stimpilklukka")}</b><span>{t("opnaðu á spjaldtölvu — PIN = síðustu 4 í kennitölu · smelltu til að afrita slóð")}</span></div><span className="tag info">{t("afrita slóð")}</span></div>
          </div>
        </div>
      )}

      {section === "velta" && (
        <div className="card">
          <div className="ch"><div><div className="ct">{t("Velta & sölutölur")}</div><div className="cs">{t("fóðraðu laun%-útreikninginn — sjálfvirkt gegnum samþættingu eða handvirkt")}</div></div></div>
          <div className="cb att">
            <div className="it rowlink" onClick={syncInventra}><div className="ic info">IN</div><div className="tx"><b>INVENTRA</b><span>{t("framleiðsluvelta í rauntíma · smelltu til að sækja veltu")}</span></div><span className="tag good">{t("tengt")}</span></div>
            <div className="it rowlink" onClick={() => setModal("revenue")}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div><div className="tx"><b>{t("Skrá veltu handvirkt")}</b><span>{t("án Inventra — sláðu inn veltu til að sjá laun vs velta")}</span></div><span className="tag info">{t("slá inn")}</span></div>
            <div className="it rowlink" onClick={() => setModal("avgrevenue")}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg></div><div className="tx"><b>{t("Meðalvelta per vikudag")}</b><span>{t("áætluð velta per vikudag — laun% án tengingar")}</span></div><span className="tag info">{t("slá inn")}</span></div>
            <div className="it rowlink" onClick={() => setSection("tengingar")}><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3zM11.4 11.6a5 5 0 1 0 1 1z" /></svg></div><div className="tx"><b>{t("Sjálfvirkt gegnum API")}</b><span>{t("búðu til samþættingu — sölukerfið þitt sendir þá veltuna sjálft")}</span></div><span className="tag info">{t("opna Samþættingar")}</span></div>
          </div>
        </div>
      )}

      {section === "launareglur" && (<>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch">
          <div><div className="ct">{t("Reglusniðmát")}</div><div className="cs">{t("þín eigin vinnureglur — fyrir hvaða land, grein eða stéttarfélag sem er")}</div></div>
          <button className="btn sm" onClick={() => setTplModal("new")}>{t("+ Nýtt sniðmát")}</button>
        </div>
        <div className="cb att">
          {ruleTemplates.map((tp) => (
            <div className="it rowlink" key={tp.id} onClick={() => setTplModal(tp)}>
              <div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M9 12h6M9 16h4M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg></div>
              <div className="tx"><b>{tp.name}</b><span>{summarizeRules(tp.rules)}</span></div>
              <span className={`tag ${tp.source === "ai" ? "info" : "good"}`}>{tp.source === "ai" ? "AI" : tp.source === "preset" ? t("sniðmát") : t("eigin")}</span>
            </div>
          ))}
          {ruleTemplates.length === 0 && (
            <p className="muted" style={{ fontSize: 12.5 }}>{t("Engin sniðmát enn. Búðu til þitt eigið, byrjaðu á innbyggðu sniðmáti eða láttu AI stinga upp á reglum fyrir þitt land og grein — þú yfirferð og samþykkir alltaf áður en neitt er vistað.")}</p>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t("Sniðmát eru tengd starfsfólki í starfsmannaspjaldinu — yfirvinna, álag, hvíld, orlof og veikindi fylgja sniðmátinu.")}</p>
        </div>
      </div>
      <ContractTermsCard />
      </>
      )}


      {section === "fyrirtaeki" && <>
      <div className="grid2b" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="ch"><div className="ct">{t("Staðir")}</div><button className="btn sm" onClick={() => setModal("location")}>{t("+ Bæta við stað")}</button></div>
          <div className="cb att">
            {data.locations.map((l) => (
              <div className={l.id ? "it rowlink" : "it"} key={l.name} onClick={() => l.id && setRowEdit({ kind: "location", id: l.id, name: l.name })}>
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
              <div className={p.id ? "it rowlink" : "it"} key={p.name} onClick={() => p.id && setRowEdit({ kind: "position", id: p.id, name: p.name, rate: p.rawRate })}>
                <div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 14v5.5h12V14M6 14a4 4 0 0 1-1-7.8A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 7 2.2A4 4 0 0 1 18 14Z" /></svg></div>
                <div className="tx"><b>{p.name}</b><span>{p.staff} {t("starfsmenn")} · {t("grunntaxti")} {p.baseRate} kr</span></div>
              </div>
            ))}
            {data.positions.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{t("Engar stöður enn — stöður birtast í vali þegar þú stofnar starfsmann.")}</p>}
          </div>
        </div>
      </div>

      <div className="grid2b" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="ch"><div className="ct">{t("Deildir")}</div><button className="btn sm" onClick={() => setModal("department")}>{t("+ Ný deild")}</button></div>
          <div className="cb att">
            {data.departments.map((d) => (
              <div className="it rowlink" key={d.id} onClick={() => setDeptEdit(d)}>
                <div className="ic" style={{ background: (d.color ?? "#8b93a7") + "22", color: d.color ?? "#8b93a7" }}><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg></div>
                <div className="tx"><b><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: d.color ?? "var(--line)", marginRight: 7 }} />{d.name}</b><span>{d.location} · {d.staff} {t("starfsmenn")}{d.members.length ? ` — ${d.members.slice(0, 3).map((m) => m.split(" ")[0]).join(", ")}${d.members.length > 3 ? ` +${d.members.length - 3}` : ""}` : ""}</span></div>
              </div>
            ))}
            {data.departments.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{t("Engar deildir enn — deildir (t.d. Eldhús, Sal) birtast í vali þegar þú stofnar starfsmann.")}</p>}
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

      {modal && <SettingsFormModal modal={modal} onClose={() => setModal(null)} locations={data.locations.map((l) => l.name)} />}
      {deptEdit && <DeptEditModal dept={deptEdit} onClose={() => setDeptEdit(null)} />}
      {rowEdit && <RowEditModal row={rowEdit} onClose={() => setRowEdit(null)} />}
      {keyModal && <ApiKeyModal onClose={() => setKeyModal(false)} />}
      {tplModal && <RuleTemplateModal tpl={tplModal === "new" ? null : tplModal} onClose={() => setTplModal(null)} />}
      {posName !== null && <PosConnectModal name={posName} onClose={() => setPosName(null)} />}
    </>
  );
}

/** Company-wide custom contract terms — appended to every new employment contract. */
function ContractTermsCard() {
  const { t } = useLang();
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { getContractTerms().then(setTerms).catch(() => {}); }, []);
  async function save() {
    setBusy(true);
    const res = await saveContractTerms(terms);
    setBusy(false);
    toast(res.ok ? (res.demo ? t("Vistað (demo)") : t("Skilmálar vistaðir — birtast á nýjum samningum")) : (res.error ?? "Tókst ekki"));
  }
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch"><div><div className="ct">{t("Sérskilmálar ráðningarsamninga")}</div><div className="cs">{t("þínir skilmálar — birtast sem sér kafli á hverjum nýjum samningi")}</div></div></div>
      <div className="cb">
        <textarea className="lf-ta" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)}
          placeholder={t("t.d. Trúnaðarskylda gildir um öll viðskiptaleyndarmál. Starfsmaður skal tilkynna veikindi fyrir kl. 10:00. Einkennisfatnaður er lagður til af fyrirtækinu…")} />
        <button className="btn sm" disabled={busy} onClick={save} style={{ marginTop: 10 }}>{t("Vista skilmála")}</button>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t("Skilmálarnir bætast við alla nýja ráðningarsamninga sem kaflinn „Sérákvæði fyrirtækisins“. Eldri samningar breytast ekki.")}</p>
      </div>
    </div>
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

function SettingsFormModal({ modal, onClose, locations = [] }: { modal: Exclude<SettingsModal, null>; onClose: () => void; locations?: string[] }) {
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
  const [dept, setDept] = useState(locations[0] ?? "");
  const [deptColor, setDeptColor] = useState<string | null>(null);

  useEffect(() => {
    if (modal !== "avgrevenue") return;
    getWeekdayRevenue().then((wr) => { if (wr) setWeek(Array.from({ length: 7 }, (_, d) => (wr[String(d)] ? String(wr[String(d)]) : ""))); });
  }, [modal]);

  const titles: Record<Exclude<SettingsModal, null>, string> = {
    location: "Bæta við stað", department: "Ný deild", position: "Ný staða", invite: "Bjóða notanda", revenue: "Skrá veltu handvirkt", avgrevenue: "Meðalvelta per vikudag",
  };

  async function submit() {
    setBusy(true); setError(null);
    let res: { ok: boolean; demo?: boolean; error?: string } = { ok: true };
    if (modal === "location") res = await addLocation({ name });
    else if (modal === "department") res = await addDepartment({ name, locationName: dept, color: deptColor });
    else if (modal === "position") res = await addPosition({ name, baseRate: rate });
    else if (modal === "invite") res = await inviteUser({ email, role });
    else if (modal === "revenue") res = await addRevenue({ amount, date });
    else if (modal === "avgrevenue") res = await setWeekdayRevenue(Object.fromEntries(week.map((v, d) => [String(d), Number((v || "0").replace(/[^\d]/g, "")) || 0])));
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Tókst ekki"); return; }
    onClose();
    const ok: Record<Exclude<SettingsModal, null>, string> = {
      location: "Staður bætt við", department: "Deild stofnuð", position: "Staða stofnuð", invite: "Boð sent", revenue: "Velta skráð — laun% uppfært", avgrevenue: "Meðalvelta vistuð — laun% uppfært",
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
          {modal === "department" && <>
            <div className="field"><label>{t("Heiti deildar")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Eldhús")} autoFocus /></div>
            <div className="field"><label>{t("Litur deildar")}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["#e9700f", "#5b50e6", "#1fb6a6", "#0891b2", "#e0356b", "#7c6ff2", "#16a34a", "#f59e0b"].map((c) => (
                  <button key={c} type="button" onClick={() => setDeptColor(c)} aria-label={c}
                    style={{ width: 26, height: 26, borderRadius: 8, background: c, cursor: "pointer",
                      border: deptColor === c ? "2.5px solid var(--ink)" : "2.5px solid transparent" }} />
                ))}
              </div>
            </div>
            {locations.length > 1 && (
              <div className="field"><label>{t("Staður")}</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)}>
                  {locations.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            )}
          </>}
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

/** Universal rule-template editor: manual fields, presets, and the AI
 * assistant (suggests only — the user reviews, edits and saves = approval). */
const TPL_DAYS: [number, string][] = [[0, "Má"], [1, "Þr"], [2, "Mi"], [3, "Fi"], [4, "Fö"], [5, "La"], [6, "Su"]];

function RuleTemplateModal({ tpl, onClose }: { tpl: RuleTemplate | null; onClose: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState(tpl?.name ?? "");
  const [country, setCountry] = useState(tpl?.country ?? "");
  const [region, setRegion] = useState(tpl?.region ?? "");
  const [industry, setIndustry] = useState(tpl?.industry ?? "");
  const [unionName, setUnionName] = useState(tpl?.union_name ?? "");
  const [role, setRole] = useState("");
  const [tenure, setTenure] = useState("");
  const [aiQ, setAiQ] = useState("");
  const [rules, setRules] = useState<RuleSet>(tpl?.rules ?? {});
  const [source, setSource] = useState<"manual" | "preset" | "ai">(tpl?.source ?? "manual");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const numVal = (v: number | undefined) => (v == null ? "" : String(v).replace(".", ","));
  const setNum = (path: (r: RuleSet, n: number | undefined) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(",", ".").trim();
    const n = raw === "" ? undefined : Number(raw);
    setRules((r) => { const c = structuredClone(r); path(c, Number.isFinite(n as number) ? (n as number) : undefined); return c; });
  };

  function applyPreset(key: string) {
    const p = RULE_PRESETS.find((x) => x.key === key);
    if (!p) return;
    setRules(p.rules);
    if (!name) setName(p.name);
    if (!country) setCountry(p.country);
    setSource("preset");
    setAiNote(null);
  }

  async function askAi() {
    setAiBusy(true);
    const res = await aiSuggestRules({ country, region, industry, unionName, role, notes: tenure, freeText: aiQ });
    setAiBusy(false);
    setRules(res.rules);
    if (!name) setName(res.name);
    setSource("ai");
    setAiNote(res.explanation);
  }

  async function submit() {
    if (!name.trim()) { toast(t("Gefðu sniðmátinu nafn")); return; }
    setBusy(true);
    // Best-effort mapping of the free-form rows onto the structured slots the
    // payroll calc reads today (night/weekend/holiday) — the rows stay the
    // source of truth in premiums[].
    const out = structuredClone(rules);
    const rows2 = out.premiums ?? [];
    const timeRow = rows2.find((x) => x.from && x.to);
    if (timeRow) out.night = { from: timeRow.from, to: timeRow.to, pct: timeRow.pct };
    const wk = rows2.find((x) => /helg|weekend/i.test(x.label) || (x.days ?? []).some((d) => d >= 5));
    if (wk) out.weekend = { pct: wk.pct };
    const hol = rows2.find((x) => /hátíð|holiday/i.test(x.label));
    if (hol) out.holiday = { pct: hol.pct };
    const res = await saveRuleTemplate({ id: tpl?.id, name, country, region, industry, unionName, rules: out, source });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    onClose();
    toast(res.demo ? t("Vistað (demo)") : t("Reglusniðmát vistað"));
  }

  async function remove() {
    if (!tpl?.id) return;
    setBusy(true);
    const res = await deleteRuleTemplate(tpl.id);
    setBusy(false);
    onClose();
    toast(res.ok ? t("Sniðmáti eytt") : (res.error ?? "Tókst ekki"));
  }

  const prem = rules.premiums ?? [];
  const setPrem = (i: number, patch: Partial<{ label: string; pct: number; from?: string; to?: string; days?: number[] }>) =>
    setRules((r) => ({ ...r, premiums: (r.premiums ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const toggleDay = (i: number, d: number) => {
    const cur = prem[i]?.days ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
    setPrem(i, { days: next.length ? next : undefined });
  };
  const addPrem = () => setRules((r) => ({ ...r, premiums: [...(r.premiums ?? []), { label: "", pct: 0 }] }));
  const delPrem = (i: number) => setRules((r) => ({ ...r, premiums: (r.premiums ?? []).filter((_, j) => j !== i) }));

  const N = ({ label, value, onChange }: { label: string; value: number | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="field" style={{ flex: 1, minWidth: 0 }}><label>{label}</label><input inputMode="decimal" value={numVal(value)} onChange={onChange} placeholder="—" /></div>
  );

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{tpl ? tpl.name : t("Nýtt reglusniðmát")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <div className="field"><label>{t("Nafn sniðmáts")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Efling — þjónn")} autoFocus /></div>
          <div className="field"><label>{t("Spyrðu AI (frjáls texti)")}</label>
            <textarea className="lf-ta" rows={2} value={aiQ} onChange={(e) => setAiQ(e.target.value)} placeholder={t("t.d. Ómenntaður þjónn hjá Eflingu í Reykjavík, unnið í 3 ár — hvaða laun og álög?")} />
            <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{t("Nefndu stéttarfélag, starf, svæði og starfsaldur í textanum — AI fyllir reglurnar inn og þú yfirferð.")}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 10px" }}>
            {RULE_PRESETS.map((p) => (
              <button key={p.key} className="btn ghost sm" onClick={() => applyPreset(p.key)}>{p.name.split(" — ")[0]} {t("sniðmát")}</button>
            ))}
            <button className="btn sm" disabled={aiBusy} onClick={askAi}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>
              {aiBusy ? t("AI hugsar…") : t("Fá tillögu með AI")}
            </button>
          </div>
          {aiNote && <p className="muted" style={{ fontSize: 12, background: "var(--brand-soft)", borderRadius: 9, padding: "9px 11px", marginBottom: 10 }}>{aiNote}</p>}

          <div className="hr" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink3)" }}>{t("Álagsreglur")}</label>
            <button className="btn ghost sm" onClick={addPrem}>+ {t("Ný regla")}</button>
          </div>
          {prem.length === 0 && <p className="muted" style={{ fontSize: 12.5, margin: "2px 0 8px" }}>{t("Engar álagsreglur enn — bættu við (t.d. Kvöldálag 33% frá 16:00 til 18:00) eða notaðu sniðmát/AI.")}</p>}
          {prem.map((pr, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 9px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ flex: 2, minWidth: 120 }} value={pr.label} placeholder={t("Heiti (t.d. Kvöldálag)")} onChange={(e) => setPrem(i, { label: e.target.value })} />
                <input style={{ width: 62 }} inputMode="decimal" value={pr.pct ? String(pr.pct).replace(".", ",") : ""} placeholder="%" onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); setPrem(i, { pct: Number.isFinite(n) ? n : 0 }); }} />
                <span className="muted" style={{ fontSize: 11 }}>%</span>
                <input style={{ width: 70 }} value={pr.from ?? ""} placeholder={t("frá")} onChange={(e) => setPrem(i, { from: e.target.value || undefined })} />
                <span className="muted">–</span>
                <input style={{ width: 70 }} value={pr.to ?? ""} placeholder={t("til")} onChange={(e) => setPrem(i, { to: e.target.value || undefined })} />
                <button className="x" title={t("Eyða reglu")} onClick={() => delPrem(i)}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 7, flexWrap: "wrap" }}>
                {TPL_DAYS.map(([d, l]) => (
                  <button key={d} type="button" onClick={() => toggleDay(i, d)}
                    className="btn ghost sm"
                    style={{ padding: "3px 8px", fontSize: 11.5, fontWeight: 600,
                      background: (pr.days ?? []).includes(d) ? "var(--brand)" : "#fff",
                      color: (pr.days ?? []).includes(d) ? "#fff" : "var(--ink2)",
                      borderColor: (pr.days ?? []).includes(d) ? "var(--brand)" : "var(--line)" }}>{l}</button>
                ))}
                <span className="muted" style={{ fontSize: 11 }}>{(pr.days ?? []).length ? "" : t("— alla daga")}</span>
              </div>
            </div>
          ))}

          <div className="hr" />
          <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink3)", display: "block", marginBottom: 6 }}>{t("Grunnstillingar")}</label>
          <div style={{ display: "flex", gap: 10 }}>
            <N label={t("Yfirvinna eftir klst/viku")} value={rules.overtime?.afterHoursPerWeek} onChange={setNum((r, n) => { r.overtime = { ...r.overtime, afterHoursPerWeek: n }; })} />
            <N label={t("Yfirvinna eftir klst/mánuði")} value={rules.overtime?.afterHoursPerMonth} onChange={setNum((r, n) => { r.overtime = { ...r.overtime, afterHoursPerMonth: n }; })} />
            <N label={t("Yfirvinnuálag %")} value={rules.overtime?.pct} onChange={setNum((r, n) => { r.overtime = { ...r.overtime, pct: n }; })} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <N label={t("Lágm. hvíld milli vakta (klst)")} value={rules.rest?.minHoursBetweenShifts} onChange={setNum((r, n) => { r.rest = { ...r.rest, minHoursBetweenShifts: n }; })} />
            <N label={t("Hámark samfelldir dagar")} value={rules.rest?.maxConsecutiveDays} onChange={setNum((r, n) => { r.rest = { ...r.rest, maxConsecutiveDays: n }; })} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <N label={t("Orlofsdagar á ári")} value={rules.vacation?.daysPerYear} onChange={setNum((r, n) => { r.vacation = { ...r.vacation, daysPerYear: n }; })} />
            <N label={t("Veikindadagar á ári")} value={rules.sick?.daysPerYear} onChange={setNum((r, n) => { r.sick = { ...r.sick, daysPerYear: n }; })} />
            <N label={t("Launatengd gjöld %")} value={rules.levies?.pct} onChange={setNum((r, n) => { r.levies = { pct: n }; })} />
          </div>
          <div className="field"><label>{t("Aðrar reglur (frjáls texti)")}</label>
            <textarea className="lf-ta" rows={3} value={rules.notes ?? ""} onChange={(e) => setRules((r) => ({ ...r, notes: e.target.value }))} placeholder={t("t.d. matartími, ferðakostnaður, sérreglur samnings…")} />
          </div>
          <p className="muted" style={{ fontSize: 11.5 }}>{t("AI-tillögur eru aldrei notaðar sjálfkrafa — það sem þú vistar hér er það sem gildir.")}</p>
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            <button className="btn" disabled={busy} onClick={submit}>{t("Vista sniðmát")}</button>
            {tpl?.id && <button className="btn ghost" disabled={busy} onClick={remove} style={{ color: "var(--bad)" }}>{t("Eyða")}</button>}
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEPT_COLORS = ["#e9700f", "#5b50e6", "#1fb6a6", "#0891b2", "#e0356b", "#7c6ff2", "#16a34a", "#f59e0b"];

/** Rename, recolor or delete a department — with its member list. */
function DeptEditModal({ dept, onClose }: { dept: { id: string; name: string; location: string; staff: number; color: string | null; members: string[] }; onClose: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState(dept.name);
  const [color, setColor] = useState<string | null>(dept.color);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await renameDepartment(dept.id, name, color);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    onClose();
    toast(res.demo ? t("Vistað (demo)") : t("Deild uppfærð"));
  }
  async function remove() {
    if (!window.confirm(t("Eyða deildinni? Starfsfólk í henni verður án deildar (ekki eytt)."))) return;
    setBusy(true);
    const res = await deleteDepartment(dept.id);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    onClose();
    toast(res.demo ? t("Eytt (demo)") : t("Deild eydd"));
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{dept.name}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="field"><label>{t("Heiti deildar")}</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="field"><label>{t("Litur deildar")}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DEPT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                  style={{ width: 26, height: 26, borderRadius: 8, background: c, cursor: "pointer",
                    border: color === c ? "2.5px solid var(--ink)" : "2.5px solid transparent" }} />
              ))}
              <button type="button" onClick={() => setColor(null)}
                style={{ width: 26, height: 26, borderRadius: 8, background: "#fff", cursor: "pointer",
                  border: color === null ? "2.5px solid var(--ink)" : "1px solid var(--line)", color: "var(--ink3)", fontSize: 12 }}>✕</button>
            </div>
          </div>
          <label style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink3)", display: "block", margin: "10px 0 6px" }}>{t("Starfsfólk í deildinni")} ({dept.staff})</label>
          {dept.members.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              {dept.members.map((m) => <span key={m} className="tag mut" style={{ fontSize: 12 }}>{m}</span>)}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>{t("Enginn skráður í deildina — veldu deild á starfsmanni (Starfsfólk → Vinna).")}</p>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{dept.location}</p>
          <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
            <button className="btn" disabled={busy} onClick={save}>{t("Vista")}</button>
            <button className="btn ghost" disabled={busy} onClick={remove} style={{ color: "var(--bad)" }}>{t("Eyða")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Edit or delete a position / location. */
function RowEditModal({ row, onClose }: { row: { kind: "location" | "position"; id: string; name: string; rate?: number }; onClose: () => void }) {
  const { t } = useLang();
  const isPos = row.kind === "position";
  const [name, setName] = useState(row.name);
  const [rate, setRate] = useState(row.rate ? String(row.rate) : "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = isPos ? await updatePosition(row.id, { name, baseRate: rate }) : await updateLocation(row.id, { name });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    onClose();
    toast(res.demo ? t("Vistað (demo)") : (isPos ? t("Staða uppfærð") : t("Staður uppfærður")));
  }
  async function remove() {
    const q = isPos
      ? t("Eyða stöðunni? Starfsfólk með hana verður án stöðu (ekki eytt).")
      : t("Eyða staðnum? Aðeins hægt ef engar deildir eða veltufærslur eru tengdar honum.");
    if (!window.confirm(q)) return;
    setBusy(true);
    const res = isPos ? await deletePosition(row.id) : await deleteLocation(row.id);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    onClose();
    toast(res.demo ? t("Eytt (demo)") : (isPos ? t("Stöðu eytt") : t("Stað eytt")));
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{row.name}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="field"><label>{isPos ? t("Heiti stöðu") : t("Heiti staðar")}</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          {isPos && <div className="field"><label>{t("Grunntaxti (kr/klst)")}</label><input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="2.900" /></div>}
          <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
            <button className="btn" disabled={busy} onClick={save}>{t("Vista")}</button>
            <button className="btn ghost" disabled={busy} onClick={remove} style={{ color: "var(--bad)" }}>{t("Eyða")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

/** Create a named API connection — shows the full key ONCE with copy + a
 * ready-to-paste curl example, then it only exists as a hash server-side. */
function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  async function create() {
    if (!name.trim()) { toast(t("Gefðu tengingunni nafn")); return; }
    setBusy(true);
    const res = await createApiKey(name);
    setBusy(false);
    if (!res.ok || !res.key) { toast(res.error ?? "Villa"); return; }
    setKey(res.key);
  }
  const curl = key
    ? `curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://vakto.is"}/api/v1/revenue \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"date":"2026-08-08","amount":214500}'`
    : "";
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Ný API-tenging")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {!key ? (
            <>
              <div className="field"><label>{t("Nafn tengingar")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Kassinn Kringlunni, Shopify-búðin")} autoFocus /></div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{t("Lykillinn birtist EINU sinni — kerfið sem fær hann getur sent sölutölur beint inn í VAKTO.")}</p>
              <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                <button className="btn" disabled={busy} onClick={create}>{t("Búa til lykil")}</button>
                <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13.5, fontWeight: 650, margin: "0 0 8px" }}>{t("Lykillinn — afritaðu hann NÚNA, hann sést ekki aftur:")}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code style={{ flex: 1, fontSize: 12, background: "var(--line2)", borderRadius: 9, padding: "10px 12px", wordBreak: "break-all" }}>{key}</code>
                <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(key); toast(t("Lykill afritaður")); }}>{t("Afrita")}</button>
              </div>
              <p className="muted" style={{ fontSize: 12, margin: "14px 0 6px", fontWeight: 650 }}>{t("Svona sendir kerfið þitt inn veltu:")}</p>
              <pre style={{ fontSize: 11, background: "var(--line2)", borderRadius: 9, padding: "10px 12px", overflowX: "auto", margin: 0 }}>{curl}</pre>
              <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                <button className="btn" onClick={onClose}>{t("Lokið")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
