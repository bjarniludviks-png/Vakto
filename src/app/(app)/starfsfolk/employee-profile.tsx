"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { initials, type Employee } from "@/lib/employees";
import { CUSTOM_UNION } from "@/lib/payrules";
import { PERM_FIELDS } from "@/lib/permissions";
import { updateEmployee, setEmployeeStatus, getDepartmentColors } from "./actions";
import { ProfileTabBody, profileTabsFor, type ProfileTab } from "./employees-screen";

/** Full-page employee profile (replaces the cramped modal). Each section has room
 * to breathe — pay profile, custom rules, benefits, access, documents, etc. */
export default function EmployeeProfile({ employee }: { employee: Employee }) {
  const router = useRouter();
  const { t } = useLang();
  const [tab, setTab] = useState<ProfileTab>("Laun");
  // Flipar sem hafa verið opnaðir haldast lifandi (faldir) svo óvistaður innsláttur
  // tapast ekki þegar skipt er um flipa; „Vista“ vistar alla flipa í einu.
  const [visited, setVisited] = useState<Set<ProfileTab>>(() => new Set<ProfileTab>(["Laun"]));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const openTab = (x: ProfileTab) => { setTab(x); setVisited((v) => (v.has(x) ? v : new Set(v).add(x))); };
  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [deptColors, setDeptColors] = useState<Record<string, string>>({});
  useEffect(() => { getDepartmentColors().then(setDeptColors).catch(() => {}); }, []);
  const e = employee;
  const tabs = profileTabsFor(e.role);
  const avtBg = (e.department && deptColors[e.department]) || e.avatarColor;

  async function save(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const g = (k: string) => (fd.get(k) as string)?.trim() || undefined;
    setSaving(true);
    const union = g("union");
    let payRule = undefined;
    if (union === CUSTOM_UNION) {
      try { payRule = JSON.parse((fd.get("payRuleJson") as string) || "{}"); } catch { payRule = undefined; }
    }
    const permissions = fd.get("permform")
      ? Object.fromEntries(PERM_FIELDS.map((f) => [f.key, fd.has(`perm_${f.key}`)]))
      : undefined;
    const res = await updateEmployee(e.id, {
      rate: g("rate"), employmentRatio: g("employmentRatio"), union, payType: g("payType"), payRule, permissions,
      monthlyHours: g("monthlyHours"),
      // Vinna tab (only present when that tab is open — undefined otherwise)
      position: fd.has("position") ? (fd.get("position") as string) : undefined,
      department: fd.has("department") ? (fd.get("department") as string) : undefined,
      location: fd.has("location") ? (fd.get("location") as string) : undefined,
      // Persónulegt tab (only present when open)
      email: fd.has("pEmail") ? (fd.get("pEmail") as string) : undefined,
      phone: fd.has("pPhone") ? (fd.get("pPhone") as string) : undefined,
      kennitala: fd.has("pKennitala") ? (fd.get("pKennitala") as string) : undefined,
      bankAccount: fd.has("pBank") ? (fd.get("pBank") as string) : undefined,
      address: fd.has("pAddress") ? (fd.get("pAddress") as string) : undefined,
      postalCode: fd.has("pPostal") ? (fd.get("pPostal") as string) : undefined,
      city: fd.has("pCity") ? (fd.get("pCity") as string) : undefined,
      hireDate: fd.has("pHireDate") ? ((fd.get("pHireDate") as string) || undefined) : undefined,
      nextOfKin: fd.has("pNextOfKin") ? (fd.get("pNextOfKin") as string) : undefined,
    });
    setSaving(false);
    if (res.ok) setDirty(false);
    toast(res.demo ? "Vistað (demo — tengdu Supabase)" : res.ok ? "Vistað" : (res.error ?? "Villa"));
    router.refresh();
  }

  async function toggleActive() {
    const active = e.status === "inactive";
    setSaving(true);
    const res = await setEmployeeStatus(e.id, active);
    setSaving(false);
    toast(res.ok ? (active ? "Starfsmaður virkjaður" : "Starfsmaður óvirkjaður") : (res.error ?? "Villa"));
    router.refresh();
  }


  return (
    <>
      <PageHeader
        title={e.fullName}
        subtitle={[e.department, e.title].filter(Boolean).join(" · ") || (e.role === "contractor" ? t("Verktaki") : t("Starfsmaður"))}
        actions={
          <Link href="/starfsfolk" className="btn ghost sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}><path d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>
            {t("Til baka")}
          </Link>
        }
      />

      <div className="card" style={{ marginTop: 16, maxWidth: 760 }}>
        <div className="ch" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="avt" style={{ background: avtBg, width: 42, height: 42, fontSize: 15 }}>{initials(e.fullName)}</span>
          <div>
            <div className="ct">{e.fullName}</div>
            <div className="cs">{[e.department, e.title].filter(Boolean).join(" · ") || (e.role === "contractor" ? t("Verktaki") : t("Starfsmaður"))}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
          {tabs.map((x) => (
            <button key={x} type="button" className={`etab${x === tab ? " on" : ""}`} onClick={() => openTab(x)}>{x}</button>
          ))}
        </div>
        <form className="cb" onSubmit={save} onInput={() => setDirty(true)} onChange={() => setDirty(true)}>
          {tabs.filter((x) => visited.has(x)).map((x) => (
            <div key={x} hidden={x !== tab}><ProfileTabBody e={e} tab={x} /></div>
          ))}
          <div style={{ display: "flex", gap: 9, marginTop: 22, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={saving}>{saving ? t("Vista…") : t("Vista")}</button>
            {dirty && !saving && <span style={{ alignSelf: "center", fontSize: 12.5, color: "var(--warn)", fontWeight: 600 }}>{t("Óvistaðar breytingar")}</span>}
            <button className="btn ghost" type="button" disabled={saving} onClick={toggleActive}>{e.status === "inactive" ? t("Virkja") : t("Óvirkja")}</button>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 12, alignSelf: "center" }}>{t("Eyðing er á starfsmannalistanum")}</span>
          </div>
        </form>
      </div>
    </>
  );
}
