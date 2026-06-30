"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { initials, type Employee } from "@/lib/employees";
import { kr, nf, dec1 as num1 } from "@/lib/format";
import { useLang } from "@/components/app/lang";
import { createEmployee, updateEmployee, uploadDocument, importEmployees, setEmployeeStatus, deleteEmployee, getEmployeePayRule, getEmployeeExtras } from "./actions";
import { RULE_FIELDS, UNION_PRESETS, CUSTOM_UNION, resolveRuleSet, type RuleSet } from "@/lib/payrules";
import { PERM_FIELDS, resolvePerms, BENEFIT_PRESETS, type Benefit } from "@/lib/permissions";

/** Best-effort document type from a filename (for the documents table). */
function detectDocType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("ráðning") || n.includes("samning")) return "ráðningarsamningur";
  if (n.includes("skattkort") || n.includes("skatt")) return "skattkort";
  if (n.includes("vottorð") || n.includes("námskeið") || n.includes("skírteini")) return "vottorð";
  return "skjal";
}

/** Lightweight Icelandic kjarasamninga preview (brief §9). */
function payrollPreview(e: Employee) {
  const PERSONAL = 68691;
  let gross: number;
  if (e.payType === "monthly") {
    gross = e.rate;
  } else {
    const hours = Math.round(173 * (e.employmentRatio / 100));
    gross = hours * e.rate * 1.18; // dagvinna + álög uplift
  }
  const pension = gross * 0.04;
  const unionFee = gross * 0.01;
  const taxable = Math.max(0, gross - pension);
  const withholding = Math.max(0, taxable * 0.3162 - PERSONAL);
  const net = gross - pension - unionFee - withholding;
  const cost = gross * 1.302; // +30,2% byrði
  return { gross, net, cost };
}


function statusBadge(e: Employee) {
  if (e.employmentRatio > 120)
    return { cls: "bad", bg: "var(--bad-soft)", fg: "var(--bad)", labelKey: "emp:overratio" };
  if (e.employmentRatio >= 110)
    return { cls: "warn", bg: "var(--warn-soft)", fg: "var(--warn)", labelKey: "emp:overtime" };
  return { cls: "good", bg: "var(--good-soft)", fg: "var(--good)", labelKey: "emp:active" };
}

const PROFILE_TABS = ["Laun", "Vinna", "Frí", "Skjöl", "Persónulegt"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

export default function EmployeesScreen({
  employees,
  live,
  openNew,
}: {
  employees: Employee[];
  live: boolean;
  openNew?: boolean;
}) {
  const router = useRouter();
  const { t } = useLang();
  const [current, setCurrent] = useState<Employee | null>(null);
  const [tab, setTab] = useState<ProfileTab>("Laun");
  const [showNew, setShowNew] = useState(!!openNew);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function onImportFile(file: File | null | undefined) {
    if (!file) return;
    setImporting(true);
    try {
      const readXlsx = (await import("read-excel-file")).default;
      const out = (await readXlsx(file)) as unknown;
      // Browser build returns rows[][]; guard for the sheet-wrapped shape too.
      const wrapped = out as { data?: unknown[][] }[];
      const grid: unknown[][] = Array.isArray(wrapped?.[0]?.data) ? wrapped[0].data : (out as unknown[][]);
      const header = (grid[0] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
      const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
      const ci = {
        name: col("nafn", "name"),
        kt: col("kennitala", "ssn"),
        phone: col("sími", "simi", "phone"),
        email: col("tölvupóst", "tolvupost", "netfang", "email"),
        hire: col("ráðning", "radning", "hire"),
        active: col("virk", "active"),
      };
      if (ci.name < 0) { toast("Fann ekki 'Nafn' dálk í skránni"); setImporting(false); return; }
      const val = (row: unknown[], i: number) => (i >= 0 && row[i] != null ? String(row[i]).trim() : "");
      const rows = grid.slice(1)
        .filter((r) => val(r, ci.name))
        .map((r) => {
          const a = val(r, ci.active).toLowerCase();
          return {
            fullName: val(r, ci.name),
            kennitala: val(r, ci.kt) || undefined,
            phone: val(r, ci.phone) || undefined,
            email: val(r, ci.email) || undefined,
            hireDate: ci.hire >= 0 && r[ci.hire] instanceof Date ? (r[ci.hire] as Date).toISOString().slice(0, 10) : (val(r, ci.hire) || undefined),
            active: a ? !["nei", "no", "false", "óvirkur", "ovirkur"].includes(a) : true,
          };
        });
      if (!rows.length) { toast("Engir starfsmenn í skránni"); setImporting(false); return; }
      const res = await importEmployees(rows);
      if (!res.ok) { toast(res.error ?? "Innflutningur tókst ekki"); }
      else toast(res.demo
        ? `${res.inserted} starfsmenn lesnir (demo — tengdu Supabase)`
        : `${res.inserted} starfsmenn fluttir inn${res.skipped ? ` · ${res.skipped} sleppt` : ""}`);
      router.refresh();
    } catch {
      toast("Gat ekki lesið skrána — er hún á Excel (.xlsx) formi?");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function saveCurrent(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!current) return;
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => (fd.get(k) as string)?.trim() || undefined;
    setSaving(true);
    const union = g("union");
    const num = (k: string) => Math.max(0, Number(fd.get(k)) || 0);
    const payRule = union === CUSTOM_UNION
      ? { eve: num("rule_eve"), weekend: num("rule_weekend"), overtime: num("rule_overtime"), holiday: num("rule_holiday"), night: num("rule_night") }
      : undefined;
    const permissions = fd.get("permform")
      ? Object.fromEntries(PERM_FIELDS.map((f) => [f.key, fd.has(`perm_${f.key}`)]))
      : undefined;
    const res = await updateEmployee(current.id, {
      rate: g("rate"), employmentRatio: g("employmentRatio"), union, payType: g("payType"), payRule, permissions,
    });
    setSaving(false);
    setCurrent(null);
    toast(res.demo ? "Vistað (demo — tengdu Supabase)" : "Vistað");
    router.refresh();
  }

  async function toggleActive() {
    if (!current) return;
    const active = current.status === "inactive"; // currently inactive → activate
    setSaving(true);
    const res = await setEmployeeStatus(current.id, active);
    setSaving(false);
    setCurrent(null);
    toast(res.ok ? (active ? "Starfsmaður virkjaður" : "Starfsmaður óvirkjaður") : (res.error ?? "Villa"));
    router.refresh();
  }

  async function removeCurrent() {
    if (!current) return;
    if (!window.confirm(`Eyða ${current.fullName}? Þetta er endanlegt og fjarlægir allar vaktir, stimplanir og sögu viðkomandi. Til að halda sögu skaltu frekar óvirkja.`)) return;
    setSaving(true);
    const res = await deleteEmployee(current.id);
    setSaving(false);
    setCurrent(null);
    toast(res.ok ? "Starfsmanni eytt" : (res.error ?? "Villa"));
    router.refresh();
  }

  const count = employees.length;
  const fte = employees.reduce((a, e) => a + e.employmentRatio, 0) / 100;
  const overRatio = employees.filter((e) => e.employmentRatio > 100).length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;

  function openEmp(e: Employee) {
    setCurrent(e);
    setTab("Laun");
  }

  return (
    <>
      <PageHeader
        title="Starfsfólk"
        subtitle={`${count} ${t("emp:subtitle")} · ${num1(fte)} ${t("emp:fteword")}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => onImportFile(e.target.files?.[0])} />
            <button className="btn ghost sm" disabled={importing} onClick={() => importRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" /></svg>
              {importing ? t("Flyt inn…") : t("Flytja inn (Excel)")}
            </button>
            <button className="btn sm" onClick={() => setShowNew(true)}>
              {t("emp:new")}
            </button>
          </div>
        }
      />

      <div className="kpis">
        <div className="kpi">
          <div className="lab">{t("emp:kpi:count")}</div>
          <div className="val">{count}</div>
        </div>
        <div className="kpi">
          <div className="lab">{t("emp:kpi:fte")}</div>
          <div className="val">{num1(fte)}</div>
        </div>
        <div className="kpi">
          <div className="lab">{t("emp:kpi:over")}</div>
          <div className="val" style={{ color: "var(--warn)" }}>{overRatio}</div>
        </div>
        <div className="kpi">
          <div className="lab">{t("emp:kpi:leave")}</div>
          <div className="val">{onLeave}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch">
          <div className="ct">{t("emp:card")}</div>
          <div className="cs">{t("emp:card:sub")}</div>
        </div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>{t("emp:th:name")}</th>
                <th>{t("emp:th:dept")}</th>
                <th>{t("emp:th:type")}</th>
                <th className="r">{t("emp:th:rate")}</th>
                <th className="r">{t("emp:th:ratio")}</th>
                <th>{t("emp:th:union")}</th>
                <th>{t("emp:th:status")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const b = statusBadge(e);
                return (
                  <tr key={e.id} className="rowlink" onClick={() => openEmp(e)}>
                    <td>
                      <span className="who">
                        <span className="avt" style={{ background: e.avatarColor }}>
                          {initials(e.fullName)}
                        </span>
                        {e.title ? (
                          <span>
                            {e.fullName.split(" ")[0]}
                            <small>{e.title}</small>
                          </span>
                        ) : (
                          <span>{e.fullName.split(" ")[0]}</span>
                        )}
                      </span>
                    </td>
                    <td>{e.department}</td>
                    <td>
                      {e.payType === "monthly" ? (
                        <span className="pill info" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                          {t("emp:monthly")}
                        </span>
                      ) : (
                        <span className="pill mut" style={{ background: "var(--line2)", color: "var(--ink2)" }}>
                          {t("emp:hourly")}
                        </span>
                      )}
                    </td>
                    <td className="r">
                      {e.payType === "monthly" ? kr(e.rate) : `${nf(e.rate)} kr`}
                    </td>
                    <td className="r" style={e.employmentRatio > 120 ? { color: "var(--bad)" } : undefined}>
                      {e.employmentRatio}%
                    </td>
                    <td>{e.union}</td>
                    <td>
                      <span className="pill" style={{ background: b.bg, color: b.fg }}>
                        {t(b.labelKey)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
          <p className="muted" style={{ fontSize: 12 }}>
            {t("emp:shows")} {count} {t("emp:subtitle")}. {t("emp:footer")}
            {!live && t("emp:demo")}
          </p>
        </div>
      </div>

      {/* ---------- profile modal ---------- */}
      {current && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setCurrent(null)}>
          <div className="mbg" onClick={() => setCurrent(null)} />
          <div className="modal">
            <div className="mh">
              <span className="avt" style={{ background: current.avatarColor, width: 38, height: 38, fontSize: 14 }}>
                {initials(current.fullName)}
              </span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{current.fullName}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {[current.department, current.title].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button className="x" onClick={() => setCurrent(null)}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
              {PROFILE_TABS.map((t) => (
                <button key={t} className={`etab${t === tab ? " on" : ""}`} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <form className="mb" onSubmit={saveCurrent}>
              <ProfileTabBody e={current} tab={tab} />
              <div style={{ display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" }}>
                <button className="btn" type="submit" disabled={saving}>{saving ? t("Vista…") : t("Vista")}</button>
                <button className="btn ghost" type="button" disabled={saving} onClick={toggleActive}>{current.status === "inactive" ? t("Virkja") : t("Óvirkja")}</button>
                <button className="btn ghost" type="button" onClick={() => setCurrent(null)}>{t("Loka")}</button>
                <button className="btn ghost" type="button" disabled={saving} style={{ marginLeft: "auto", color: "var(--bad)" }} onClick={removeCurrent}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>{t("Eyða")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- new employee modal ---------- */}
      {showNew && <NewEmployeeModal onClose={() => setShowNew(false)} />}
    </>
  );
}

function Sec({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <div className="sec" style={first ? { marginTop: 0 } : undefined}>{children}</div>;
}

function Stat({ k, v, vColor, strong }: { k: string; v: React.ReactNode; vColor?: string; strong?: boolean }) {
  return (
    <div className="statline">
      <span className="k" style={strong ? { fontWeight: 650, color: "var(--ink)" } : undefined}>{k}</span>
      <span className="v" style={{ ...(vColor ? { color: vColor } : {}), ...(strong ? { fontSize: 15 } : {}) }}>{v}</span>
    </div>
  );
}

const FLD: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 7,
  padding: "5px 9px",
  font: "inherit",
  fontSize: 13,
  background: "#fff",
};

function LaunTab({ e }: { e: Employee }) {
  const { t } = useLang();
  const pay = payrollPreview(e);
  const rateLabel = e.payType === "monthly" ? `${nf(e.rate)} kr/mán` : `${nf(e.rate)} kr/klst`;
  const [union, setUnion] = useState<string>(e.union ?? "Efling");
  const custom = union === CUSTOM_UNION;
  const [rules, setRules] = useState<RuleSet>(resolveRuleSet(CUSTOM_UNION, e.payRule));
  const shown = custom ? rules : (UNION_PRESETS[union] ?? UNION_PRESETS["Efling"]);
  const [benefits, setBenefits] = useState<Benefit[]>(e.benefits ?? []);
  const [bName, setBName] = useState(BENEFIT_PRESETS[0]);
  const [bType, setBType] = useState<"fixed" | "perkm">("fixed");
  const [bAmt, setBAmt] = useState("");

  useEffect(() => {
    if (e.union === CUSTOM_UNION) getEmployeePayRule(e.id).then((r) => { if (r) setRules(r); });
    getEmployeeExtras(e.id).then((x) => { if (x.benefits) setBenefits(x.benefits as Benefit[]); });
  }, [e.id, e.union]);

  function saveBenefits(list: Benefit[]) { setBenefits(list); updateEmployee(e.id, { benefits: list }).then((r) => toast(r.ok ? "Hlunnindi vistuð" : (r.error ?? "Villa"))); }
  function addBenefit() {
    const amt = Math.max(0, Math.round(Number(bAmt) || 0));
    if (!bName.trim() || !amt) { toast("Sláðu inn heiti og upphæð"); return; }
    saveBenefits([...benefits, { name: bName.trim(), type: bType, amount: amt }]); setBAmt("");
  }

  return (
    <>
      <Sec first>Launasnið</Sec>
      <div className="statline">
        <span className="k">Tegund</span>
        <select name="payType" style={FLD} defaultValue={e.payType === "monthly" ? "Mánaðarlaun" : "Tímakaup"}>
          <option>Tímakaup</option><option>Mánaðarlaun</option>
        </select>
      </div>
      <div className="statline">
        <span className="k">Taxti</span>
        <input name="rate" defaultValue={rateLabel} style={{ ...FLD, width: 150, textAlign: "right" }} />
      </div>
      <div className="statline">
        <span className="k">Starfshlutfall</span>
        <input name="employmentRatio" defaultValue={`${e.employmentRatio}%`} style={{ ...FLD, width: 80, textAlign: "right" }} />
      </div>
      <div className="statline">
        <span className="k">Kjarasamningur</span>
        <select name="union" value={union} onChange={(ev) => setUnion(ev.target.value)} style={{ ...FLD, width: 190 }}>
          {Object.keys(UNION_PRESETS).map((u) => <option key={u}>{u}</option>)}
          <option>{CUSTOM_UNION}</option>
        </select>
      </div>

      <Sec>Álög & yfirvinna {custom ? "· sérsniðnar reglur" : "· úr kjarasamningi"}</Sec>
      {RULE_FIELDS.map((f) => (
        <div className="statline" key={f.key}>
          <span className="k">{f.label} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {f.hint}</span></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <input
              name={`rule_${f.key}`}
              type="number" min={0}
              value={shown[f.key]}
              readOnly={!custom}
              onChange={custom ? (ev) => setRules((r) => ({ ...r, [f.key]: Math.max(0, Number(ev.target.value) || 0) })) : undefined}
              style={{ ...FLD, width: 72, textAlign: "right", background: custom ? undefined : "var(--line2)" }}
            />
            <span className="muted">%</span>
          </span>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
        {custom ? "Sérsniðnar reglur — gilda fyrir alþjóðamarkað eða sérsamninga." : "Reglur koma sjálfkrafa úr kjarasamningi. Veldu „Eigin reglur\" til að breyta. (Hlutföll óstaðfest — yfirfarið gegn samningi.)"}
      </p>

      <Sec>Hlunnindi & styrkir</Sec>
      {benefits.map((b, i) => (
        <div className="statline" key={i}>
          <span className="k">{b.name}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <b>{nf(b.amount)} {b.type === "perkm" ? "kr/km" : "kr/mán"}</b>
            <a style={{ color: "var(--bad)", fontSize: 12, cursor: "pointer" }} onClick={() => saveBenefits(benefits.filter((_, j) => j !== i))}>{t("Eyða")}</a>
          </span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <input list="benefit-presets" value={bName} onChange={(e2) => setBName(e2.target.value)} placeholder={t("Heiti")} style={{ ...FLD, flex: 1, minWidth: 120 }} />
        <datalist id="benefit-presets">{BENEFIT_PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
        <select value={bType} onChange={(e2) => setBType(e2.target.value as "fixed" | "perkm")} style={FLD}><option value="fixed">{t("Fast (kr/mán)")}</option><option value="perkm">{t("Per km")}</option></select>
        <input type="number" min={0} value={bAmt} onChange={(e2) => setBAmt(e2.target.value)} placeholder={t("Upphæð")} style={{ ...FLD, width: 100, textAlign: "right" }} />
        <button type="button" className="btn ghost sm" onClick={addBenefit}>{t("Bæta við")}</button>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>{t("Föst hlunnindi bætast við laun. Per-km (t.d. ökutækjastyrkur) reiknast af skráðum km.")}</p>

      <Sec>Reiknaður mánaðarkostnaður</Sec>
      <Stat k="Brúttólaun" v={kr(pay.gross)} />
      <Stat k="Útborgað (áætl.)" v={kr(pay.net)} vColor="var(--good)" />
      <Stat k="Kostnaður þinn (m. byrði)" v={kr(pay.cost)} strong />
    </>
  );
}

function ProfileTabBody({ e, tab }: { e: Employee; tab: ProfileTab }) {

  if (tab === "Laun") return <LaunTab e={e} />;
  if (tab === "Vinna") {
    return (
      <>
        <Sec first>Starf & aðgangur</Sec>
        <div className="statline">
          <span className="k">Staða (position)</span>
          <select style={{ ...FLD, width: 160 }} defaultValue={e.position ?? "Kokkur"}>
            <option>Kokkur</option>
            <option>Þjónn / Sal</option>
            <option>Bílstjóri</option>
          </select>
        </div>
        <div className="statline">
          <span className="k">Staðsetning</span>
          <select style={{ ...FLD, width: 160 }} defaultValue={e.location ?? "Reykjavík Asian"}>
            <option>Reykjavík Asian</option>
            <option>Hotel Umi</option>
          </select>
        </div>
        <div className="statline">
          <span className="k">Aðgangur (kerfishlutverk)</span>
          <select style={{ ...FLD, width: 150 }} defaultValue={e.role === "manager" ? "Stjórnandi" : "Starfsmaður"}>
            <option>Stjórnandi</option>
            <option>Vaktstjóri</option>
            <option>Starfsmaður</option>
          </select>
        </div>
        <div className="statline">
          <span className="k">Ráðningardagur</span>
          <input type="date" defaultValue="2025-10-08" style={FLD} />
        </div>
        <div className="statline">
          <span className="k">Æskilegir tímar/viku</span>
          <input defaultValue={e.employmentRatio === 100 ? "40" : ""} style={{ ...FLD, width: 70, textAlign: "right" }} />
        </div>
        <div className="statline">
          <span className="k">Yfirmaður</span>
          <select style={{ ...FLD, width: 170 }}>
            <option>Jón (rekstrarstjóri)</option>
            <option>Bjarni (eigandi)</option>
          </select>
        </div>

        <Sec>Aðgangur að Mitt svæði</Sec>
        <input type="hidden" name="permform" value="1" />
        {(() => { const perms = resolvePerms(e.permissions); return PERM_FIELDS.map((f) => (
          <label className="statline" key={f.key} style={{ cursor: "pointer" }}>
            <span className="k">{f.label} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {f.hint}</span></span>
            <input type="checkbox" name={`perm_${f.key}`} defaultChecked={perms[f.key]} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
          </label>
        )); })()}
      </>
    );
  }
  if (tab === "Frí") {
    return (
      <>
        <Sec first>Orlof & frí</Sec>
        <Stat k="Áunninn orlofsréttur" v="11,4 dagar" />
        <Stat k="Orlofssjóður" v="66.200 kr" />
        <Stat k="Frí tekið 2026" v="6 dagar" />
        <Sec>Beiðnir</Sec>
        <div className="statline">
          <span className="k">27.–28. júní · orlof</span>
          <span className="v">
            <span className="pill warn" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>Bíður</span>
          </span>
        </div>
      </>
    );
  }
  if (tab === "Skjöl") {
    return <DocsTab employeeId={e.id} />;
  }
  return (
    <>
      <Sec first>Persónulegt</Sec>
      <Stat k="Netfang" v={e.email ?? "—"} />
      <Stat k="Sími" v={e.phone ?? "—"} />
      <Stat k="Kennitala" v={e.kennitala ?? "—"} />
      <Stat k="Bankareikningur" v={e.bankAccount ?? "—"} />
      <Stat k="Tímabelti" v="Atlantic/Reykjavik" />
    </>
  );
}

function DocsTab({ employeeId }: { employeeId: string }) {
  const [docs, setDocs] = useState<{ name: string; meta: string }[]>([
    { name: "Ráðningarsamningur.pdf", meta: "undirritað 8.10.2025" },
    { name: "Skattkort_2026.pdf", meta: "PDF · 88 KB" },
    { name: "Matvælanámskeið.pdf", meta: "gildir til 2027" },
  ]);
  function readAsDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
  }
  async function onFiles(files: FileList | null) {
    if (!files) return;
    const list = [...files];
    setDocs((d) => [...d, ...list.map((f) => ({ name: f.name, meta: `${Math.max(1, Math.round(f.size / 1024))} KB` }))]);
    let okCount = 0;
    for (const f of list) {
      const dataUrl = await readAsDataUrl(f);
      const res = await uploadDocument({ employeeId, fileName: f.name, dataUrl, type: detectDocType(f.name) });
      if (res.ok) okCount++;
    }
    toast(okCount > 1 ? "Skjöl hlaðin upp" : "Skjal hlaðið upp");
  }
  return (
    <>
      <Sec first>Skjöl starfsmanns</Sec>
      <div className="docs">
        {docs.map((d, i) => (
          <div className="docrow" key={i}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6" />
            </svg>
            <span>{d.name}</span>
            <span className="dl">{d.meta}</span>
          </div>
        ))}
      </div>
      <label className="upz" style={{ marginTop: 12 }}>
        <input type="file" hidden multiple onChange={(e) => onFiles(e.target.files)} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
        </svg>
        <div>
          <b>Hlaða upp skjali</b>
          <span>ráðningarsamningur, vottorð, skírteini</span>
        </div>
      </label>
    </>
  );
}

function NewEmployeeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [docs, setDocs] = useState<{ name: string; meta: string }[]>([]);
  const staged = useRef<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function onFiles(files: FileList | null) {
    if (!files) return;
    const list = [...files];
    staged.current.push(...list);
    setDocs((d) => [...d, ...list.map((f) => ({ name: f.name, meta: `${Math.max(1, Math.round(f.size / 1024))} KB` }))]);
    toast(list.length > 1 ? "Skjöl bætt við" : "Skjal bætt við");
  }
  function readAsDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
  }
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => (fd.get(k) as string)?.trim() || undefined;
    if (!g("fullName")) { setError("Fullt nafn vantar"); return; }
    setBusy(true);
    setError(null);
    const res = await createEmployee({
      fullName: g("fullName")!, kennitala: g("kennitala"), email: g("email"), phone: g("phone"),
      bankAccount: g("bankAccount"), role: g("role") ?? "Starfsmaður", position: g("position"),
      department: g("department"), location: g("location"), hireDate: g("hireDate"),
      employmentRatio: g("employmentRatio"), payType: g("payType"), rate: g("rate"), union: g("union"),
      monthlyHours: g("monthlyHours"),
    });
    if (!res.ok) { setBusy(false); setError(res.error ?? "Tókst ekki að stofna"); return; }
    // Persist any staged documents now that the employee exists.
    if (res.id && staged.current.length) {
      for (const f of staged.current) {
        const dataUrl = await readAsDataUrl(f);
        await uploadDocument({ employeeId: res.id, fileName: f.name, dataUrl, type: detectDocType(f.name) });
      }
    }
    setBusy(false);
    onClose();
    toast(res.demo ? "Starfsmaður stofnaður (demo — tengdu Supabase)" : "Starfsmaður stofnaður — boð sent");
    router.refresh();
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Nýr starfsmaður</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <form className="mb" onSubmit={submit}>
          <Sec first>Persónulegt</Sec>
          <div className="emp-row2">
            <div className="emp-fld"><label>Fullt nafn</label><input name="fullName" placeholder="Fullt nafn" /></div>
            <div className="emp-fld"><label>Kennitala</label><input name="kennitala" placeholder="000000-0000" /></div>
          </div>
          <div className="emp-row2">
            <div className="emp-fld"><label>Netfang</label><input name="email" placeholder="netfang@fyrirtaeki.is" /></div>
            <div className="emp-fld"><label>Sími</label><input name="phone" placeholder="+354 ..." /></div>
          </div>
          <div className="emp-fld"><label>Bankareikningur (laun)</label><input name="bankAccount" placeholder="0000-00-000000" /></div>

          <Sec>Starf & aðgangur</Sec>
          <div className="emp-fld">
            <label>Hlutverk (aðgangur)</label>
            <select name="role">
              <option>Starfsmaður — eigin app (stimpilklukka, vaktir, laun)</option>
              <option>Vaktstjóri — vaktir, tímar, starfsfólk, skýrslur</option>
              <option>Stjórnandi — fullur aðgangur</option>
              <option>Verktaki — eigin tímar &amp; verk (sér-aðgangur)</option>
            </select>
          </div>
          <div className="emp-row2">
            <div className="emp-fld"><label>Staða</label><select name="position"><option>Kokkur</option><option>Þjónn / Sal</option><option>Bílstjóri</option></select></div>
            <div className="emp-fld"><label>Deild</label><select name="department"><option>Eldhús</option><option>Sal</option><option>Stjórnun</option></select></div>
          </div>
          <div className="emp-row2">
            <div className="emp-fld"><label>Staðsetning</label><select name="location"><option>Reykjavík Asian</option><option>Hotel Umi</option></select></div>
            <div className="emp-fld"><label>Ráðningardagur</label><input type="date" name="hireDate" defaultValue="2026-06-23" /></div>
          </div>
          <div className="emp-row2">
            <div className="emp-fld"><label>Starfshlutfall</label><input name="employmentRatio" placeholder="100%" /></div>
            <div className="emp-fld"><label>Æskilegir tímar á mánuði</label><input name="monthlyHours" placeholder="173" /></div>
          </div>

          <Sec>Laun</Sec>
          <div className="emp-row2">
            <div className="emp-fld"><label>Tegund launa</label><select name="payType"><option>Tímakaup</option><option>Mánaðarlaun</option></select></div>
            <div className="emp-fld"><label>Taxti</label><input name="rate" defaultValue="2.900 kr/klst" /></div>
          </div>
          <div className="emp-fld">
            <label>Kjarasamningur</label>
            <select name="union"><option>Efling</option><option>Efling – veitingar/SGS</option><option>VR</option><option>Matvís</option><option>Eigin reglur</option></select>
          </div>

          <Sec>Skjöl</Sec>
          <label className="upz">
            <input type="file" hidden multiple onChange={(e) => onFiles(e.target.files)} />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
            </svg>
            <div>
              <b>Hlaða upp skjölum</b>
              <span>ráðningarsamningur, skattkort, skírteini — PDF eða mynd</span>
            </div>
          </label>
          {docs.length > 0 && (
            <div className="docs" style={{ marginTop: 10 }}>
              {docs.map((d, i) => (
                <div className="docrow" key={i}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <path d="M14 3v6h6" />
                  </svg>
                  <span>{d.name}</span>
                  <span className="dl">{d.meta}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{error}</p>}

          <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Stofna…" : "Stofna & senda boð"}
            </button>
            <button className="btn ghost" type="button" onClick={onClose}>Hætta við</button>
          </div>
        </form>
      </div>
    </div>
  );
}
