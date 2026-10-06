"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Autocomplete } from "@/components/app/autocomplete";
import { DateField, BankField } from "@/components/app/fields";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { UNIONS, PENSION_FUNDS } from "@/lib/is-lists";
import { initials } from "@/lib/employees";
import { nf } from "@/lib/format";
import { CONTRACT_TYPES, SCHEDULE_PATTERNS, type RuleTemplate } from "@/lib/rules";
import { listRuleTemplates } from "../stillingar/actions";
import { createEmployee, uploadDocument, getCompanyOptions } from "./actions";

type Role = "employee" | "manager" | "owner" | "contractor";
// createEmployee les hlutverkið út frá upphafi merkisins (sjá ROLE_MAP í actions.ts).
const ROLE_LABEL: Record<Role, string> = { employee: "Starfsmaður", manager: "Vaktstjóri", owner: "Stjórnandi", contractor: "Verktaki" };
const ROLES: { key: Role; title: string; en: string; desc: string; icon: React.ReactNode }[] = [
  { key: "employee", en: "Employee", title: "Starfsmaður", desc: "Appið: vaktir, stimpilklukka, spjall og laun", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  { key: "manager", en: "Shift manager", title: "Vaktstjóri", desc: "Vaktaplan, tímaskráning og starfsfólk", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="m16 11 2 2 4-4" /></> },
  { key: "owner", en: "Admin", title: "Stjórnandi", desc: "Fullur aðgangur, líka laun og stillingar", icon: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></> },
  { key: "contractor", en: "Contractor", title: "Verktaki", desc: "Sendir reikning. Engin staðgreiðsla eða orlof", icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></> },
];

function detectDocType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("ráðning") || n.includes("samning")) return "ráðningarsamningur";
  if (n.includes("skattkort") || n.includes("skatt")) return "skattkort";
  if (n.includes("vottorð") || n.includes("námskeið") || n.includes("skírteini")) return "vottorð";
  return "skjal";
}
const readAsDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(f);
});
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function Card({ n, title, sub, children, id }: { n: number; title: string; sub?: string; children: React.ReactNode; id: string }) {
  return (
    <section className="db2-card ne-card" id={id}>
      <div className="ne-ch"><span className="ne-n">{n}</span><div><div className="db2-ct">{title}</div>{sub && <div className="db2-cs">{sub}</div>}</div></div>
      <div className="ne-cb">{children}</div>
    </section>
  );
}
function Fld({ label, hint, children, span }: { label: string; hint?: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={`ne-fld${span ? " span" : ""}`}>
      <label>{label}{hint && <small> · {hint}</small>}</label>
      {children}
    </div>
  );
}

export default function NewEmployee() {
  const { t, lang } = useLang();
  // Sum orð hafa annað samhengi í DICT (t.d. „Staða“ = status) → beinar þýðingar hér.
  const L = (is: string, en: string) => (lang === "is" ? is : en);
  const router = useRouter();
  const staged = useRef<File[]>([]);
  const [docs, setDocs] = useState<{ name: string; meta: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState<{ departments: string[]; positions: string[]; locations: string[] }>({ departments: [], positions: [], locations: [] });
  const [tpls, setTpls] = useState<RuleTemplate[]>([]);
  const [role, setRole] = useState<Role>("employee");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [payType, setPayType] = useState<"Tímakaup" | "Mánaðarlaun">("Tímakaup");
  const [rate, setRate] = useState("");
  const [union, setUnion] = useState("Efling");
  const [pension, setPension] = useState("");
  const [hireDate] = useState(todayISO);
  const contractor = role === "contractor";
  const monthly = payType === "Mánaðarlaun";

  useEffect(() => {
    getCompanyOptions().then((o) => { setOpts(o); setPosition(o.positions[0] ?? ""); setDepartment(o.departments[0] ?? ""); }).catch(() => {});
    listRuleTemplates().then((r) => setTpls(r.templates)).catch(() => {});
  }, []);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const list = [...files];
    staged.current.push(...list);
    setDocs((d) => [...d, ...list.map((f) => ({ name: f.name, meta: `${Math.max(1, Math.round(f.size / 1024))} KB` }))]);
  }
  function removeDoc(i: number) {
    staged.current.splice(i, 1);
    setDocs((d) => d.filter((_, j) => j !== i));
  }
  function pickTemplate(id: string) {
    const w = tpls.find((x) => x.id === id)?.rules.wage;
    if (w?.dayRate) { setPayType("Tímakaup"); setRate(nf(Math.round(w.dayRate))); }
    else if (w?.monthly) { setPayType("Mánaðarlaun"); setRate(nf(Math.round(w.monthly))); }
  }

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => (fd.get(k) as string | null)?.trim() || undefined;
    if (!name.trim()) { setError(t("Skráðu fullt nafn")); document.getElementById("ne-1")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (!rate.replace(/\D/g, "")) { setError(contractor ? t("Skráðu tímagjald eða mánaðargjald") : t("Skráðu tímakaup eða mánaðarlaun")); document.getElementById("ne-4")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    setBusy(true);
    setError(null);
    const res = await createEmployee({
      fullName: name.trim(), kennitala: g("kennitala"), email: email.trim() || undefined, phone: g("phone"),
      bankAccount: g("bankAccount"), address: g("address"), postalCode: g("postalCode"), city: g("city"),
      role: ROLE_LABEL[role], position: position || undefined, department: department || undefined, location: g("location"), hireDate: g("hireDate"),
      employmentRatio: contractor ? undefined : g("employmentRatio"), monthlyHours: contractor ? undefined : g("monthlyHours"),
      payType, rate, union: contractor ? undefined : union || undefined, pensionFund: contractor ? undefined : pension || undefined,
      ruleTemplateId: contractor ? undefined : g("ruleTemplateId"), contractType: contractor ? "contractor" : g("contractType"), schedulePattern: g("schedulePattern"),
    });
    if (!res.ok) { setBusy(false); setError(res.error ?? t("Tókst ekki að stofna")); return; }
    if (res.id && staged.current.length) {
      for (const f of staged.current) await uploadDocument({ employeeId: res.id, fileName: f.name, dataUrl: await readAsDataUrl(f), type: detectDocType(f.name) });
    }
    toast(res.demo ? t("Starfsmaður stofnaður (demo)") : res.invited ? t("Starfsmaður stofnaður — boð sent í pósti") : res.inviteError ? `${t("Starfsmaður stofnaður — boð ekki sent")}: ${res.inviteError}` : t("Starfsmaður stofnaður"));
    router.push(res.id ? `/starfsfolk/${res.id}` : "/starfsfolk");
    router.refresh();
  }

  const unit = monthly ? t("kr/mán") : t("kr/klst");
  const payLabel = contractor ? (monthly ? t("Mánaðargjald") : t("Tímagjald")) : monthly ? t("Mánaðarlaun") : t("Tímakaup");
  const steps = [
    { id: "ne-1", label: t("Persónuupplýsingar"), done: !!name.trim() },
    { id: "ne-2", label: t("Hlutverk"), done: true },
    { id: "ne-3", label: t("Starf"), done: !!(position || department) },
    { id: "ne-4", label: contractor ? t("Þóknun") : L("Laun", "Pay"), done: !!rate.replace(/\D/g, "") },
    { id: "ne-5", label: t("Skjöl"), done: docs.length > 0, optional: true },
  ];

  return (
    <form className="db2 ne" onSubmit={submit} noValidate>
      <div className="db2-top">
        <div>
          <Link href="/starfsfolk" className="ne-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>{t("Starfsfólk")}</Link>
          <h1>{t("Nýr starfsmaður")}</h1>
          <div className="db2-sub">{t("Aðeins nafn og laun eru nauðsynleg. Restina má fylla út síðar á spjaldi starfsmannsins.")}</div>
        </div>
      </div>

      <div className="ne-grid">
        <div className="ne-main">
          <Card n={1} id="ne-1" title={t("Persónuupplýsingar")} sub={t("Fara á launaseðil og samning")}>
            <div className="ne-row">
              <Fld label={L("Fullt nafn", "Full name")} span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jón Jónsson" autoFocus autoComplete="off" /></Fld>
              <Fld label={L("Kennitala", "ID number (kennitala)")}><input name="kennitala" placeholder="000000-0000" inputMode="numeric" /></Fld>
              <Fld label={L("Sími", "Phone")}><input name="phone" placeholder="+354 ..." inputMode="tel" /></Fld>
              <Fld label={L("Netfang", "Email")} hint={t("boð í appið fer hingað")} span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nafn@dæmi.is" /></Fld>
              <Fld label={t("Heimilisfang")} span><input name="address" placeholder={t("Gata og húsnúmer")} /></Fld>
              <Fld label={t("Póstnúmer")}><input name="postalCode" placeholder="101" inputMode="numeric" maxLength={3} /></Fld>
              <Fld label={L("Staður", "Town")}><input name="city" placeholder="Reykjavík" /></Fld>
              <Fld label={contractor ? t("Bankareikningur") : L("Bankareikningur (laun)", "Bank account (pay)")} span><BankField name="bankAccount" /></Fld>
            </div>
          </Card>

          <Card n={2} id="ne-2" title={t("Hlutverk")} sub={t("Ræður hvað viðkomandi sér í VAKTO")}>
            <div className="ne-roles" role="radiogroup">
              {ROLES.map((r) => (
                <button type="button" role="radio" aria-checked={role === r.key} key={r.key} className={`ne-role${role === r.key ? " on" : ""}`} onClick={() => setRole(r.key)}>
                  <span className="ne-ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{r.icon}</svg></span>
                  <b>{L(r.title, r.en)}</b><span>{t(r.desc)}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card n={3} id="ne-3" title={t("Starf")} sub={t("Hvar og hvernig viðkomandi vinnur")}>
            <div className="ne-row">
              <Fld label={L("Staða", "Position")}>
                <select value={position} onChange={(e) => setPosition(e.target.value)}>
                  {opts.positions.map((o) => <option key={o}>{o}</option>)}
                  {!opts.positions.length && <option value="">{t("— engin staða skráð —")}</option>}
                </select>
              </Fld>
              <Fld label={t("Deild")}>
                <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {opts.departments.map((o) => <option key={o}>{o}</option>)}
                  {!opts.departments.length && <option value="">{t("— engin deild skráð —")}</option>}
                </select>
              </Fld>
              <Fld label={t("Starfsstöð")}>
                <select name="location">
                  {opts.locations.map((o) => <option key={o}>{o}</option>)}
                  {!opts.locations.length && <option value="">{t("— enginn staður skráður —")}</option>}
                </select>
              </Fld>
              <Fld label={contractor ? t("Upphaf verks") : t("Ráðningardagur")}><DateField name="hireDate" defaultValue={hireDate} full /></Fld>
              {!contractor && <>
                <Fld label={t("Ráðningarform")}>
                  <select name="contractType" defaultValue="fulltime">
                    {CONTRACT_TYPES.filter((c) => c.key !== "contractor").map((c) => <option key={c.key} value={c.key}>{t(c.is)}</option>)}
                  </select>
                </Fld>
                <Fld label={L("Starfshlutfall", "Employment ratio")}><div className="ne-suf"><input name="employmentRatio" defaultValue="100" inputMode="numeric" /><span>%</span></div></Fld>
                <Fld label={t("Tímar á mánuði")} hint={t("fullt starf")}><div className="ne-suf"><input name="monthlyHours" placeholder="173" inputMode="decimal" /><span>{t("klst")}</span></div></Fld>
              </>}
              <Fld label={t("Vaktamynstur")}>
                <select name="schedulePattern" defaultValue="open">
                  {SCHEDULE_PATTERNS.map((s) => <option key={s.key} value={s.key}>{t(s.is)}</option>)}
                </select>
              </Fld>
            </div>
            {(!opts.positions.length || !opts.departments.length) && <p className="ne-note">{t("Stöður, deildir og starfsstöðvar stofnar þú í Stillingar → Staðir og teymi.")}</p>}
          </Card>

          <Card n={4} id="ne-4" title={contractor ? t("Þóknun") : L("Laun", "Pay")} sub={contractor ? t("Án VSK. Verktaki gefur út reikning") : t("Grunnur launakeyrslunnar")}>
            <div className="ne-row">
              <Fld label={contractor ? t("Gjaldtaka") : t("Launagerð")} span>
                <div className="db2-seg ne-seg">
                  {(["Tímakaup", "Mánaðarlaun"] as const).map((p) => (
                    <button type="button" key={p} className={payType === p ? "on" : ""} onClick={() => setPayType(p)}>
                      {contractor ? (p === "Tímakaup" ? t("Tímagjald") : t("Fast mánaðargjald")) : t(p)}
                    </button>
                  ))}
                </div>
              </Fld>
              {!contractor && tpls.length > 0 && (
                <Fld label={t("Launasniðmát")} hint={t("fyllir út laun og álög")}>
                  <select name="ruleTemplateId" defaultValue="" onChange={(e) => pickTemplate(e.target.value)}>
                    <option value="">{t("— ekkert —")}</option>
                    {tpls.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                  </select>
                </Fld>
              )}
              <Fld label={payLabel}>
                <div className="ne-suf big"><input value={rate} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setRate(d ? nf(Number(d)) : ""); }} placeholder={monthly ? "650.000" : "3.100"} inputMode="numeric" /><span>{unit}</span></div>
              </Fld>
              {!contractor && <>
                <Fld label={t("Stéttarfélag / kjarasamningur")}><Autocomplete value={union} onChange={setUnion} suggestions={UNIONS} placeholder={t("Byrjaðu að skrifa…")} style={{ display: "block" }} /></Fld>
                <Fld label={t("Lífeyrissjóður")}><Autocomplete value={pension} onChange={setPension} suggestions={PENSION_FUNDS} placeholder={t("Byrjaðu að skrifa…")} style={{ display: "block" }} /></Fld>
              </>}
            </div>
            <p className="ne-note">{contractor
              ? t("Verktaki sér sjálfur um skatta og lífeyri, svo stéttarfélag, lífeyrissjóður og orlof eiga ekki við.")
              : t("Álög, yfirvinna og orlof reiknast eftir kjarasamningnum. Þú getur fínstillt reglurnar á spjaldi starfsmannsins.")}</p>
          </Card>

          <Card n={5} id="ne-5" title={t("Skjöl")} sub={t("Valfrjálst: skattkort, vottorð, eldri samningur")}>
            <label className="upz">
              <input type="file" hidden multiple onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" /></svg>
              <div><b>{t("Hlaða upp skjölum")}</b><span>{t("PDF eða mynd. Vistast í skjalasafni starfsmannsins")}</span></div>
            </label>
            {docs.length > 0 && (
              <div className="docs" style={{ marginTop: 10 }}>
                {docs.map((d, i) => (
                  <div className="docrow" key={i}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                    <span>{d.name}</span><span className="dl">{d.meta}</span>
                    <button type="button" className="ne-x" aria-label={t("Fjarlægja")} onClick={() => removeDoc(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="ne-note">{contractor ? t("Verksamning býrðu til á spjaldi verktakans eftir að hann hefur verið stofnaður.") : t("Ráðningarsamning býrðu til á spjaldi starfsmannsins eftir að hann hefur verið stofnaður.")}</p>
          </Card>
        </div>

        <aside className="ne-side">
          <div className="db2-card ne-sum">
            <div className="ne-who">
              <span className="ne-av">{name.trim() ? initials(name) : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}</span>
              <div><b>{name.trim() || t("Nýr starfsmaður")}</b><span>{L(ROLE_LABEL[role], ROLES.find((r) => r.key === role)!.en)}{position ? ` · ${position}` : ""}</span></div>
            </div>
            <ol className="ne-steps">
              {steps.map((s) => (
                <li key={s.id} className={s.done ? "done" : ""}>
                  <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                    <i>{s.done && <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>}</i>{s.label}{s.optional && <small>{t("valfrjálst")}</small>}
                  </a>
                </li>
              ))}
            </ol>
            <div className="ne-pay"><span>{payLabel}</span><b>{rate ? `${rate} ${unit}` : "—"}</b></div>
            <div className={`ne-inv${email.trim() ? " on" : ""}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              <span>{email.trim() ? <>{t("Boð í appið verður sent á")} <b>{email.trim()}</b></> : t("Ekkert netfang: enginn aðgangur sendur. Má bæta við síðar.")}</span>
            </div>
            {error && <p className="ne-err">{error}</p>}
            <button className="btn ne-go" type="submit" disabled={busy}>{busy ? t("Stofna…") : email.trim() ? t("Stofna & senda boð") : t("Stofna starfsmann")}</button>
            <Link href="/starfsfolk" className="btn ghost ne-go">{t("Hætta við")}</Link>
          </div>
        </aside>
      </div>
    </form>
  );
}
