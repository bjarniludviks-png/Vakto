"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { initials, type Employee } from "@/lib/employees";
import { CUSTOM_UNION } from "@/lib/payrules";
import { PERM_FIELDS } from "@/lib/permissions";
import { updateEmployee, setEmployeeStatus, deleteEmployee } from "./actions";
import { ProfileTabBody, PROFILE_TABS, type ProfileTab } from "./employees-screen";

/** Full-page employee profile (replaces the cramped modal). Each section has room
 * to breathe — pay profile, custom rules, benefits, access, documents, etc. */
export default function EmployeeProfile({ employee }: { employee: Employee }) {
  const router = useRouter();
  const { t } = useLang();
  const [tab, setTab] = useState<ProfileTab>("Laun");
  const [saving, setSaving] = useState(false);
  const e = employee;

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
    });
    setSaving(false);
    toast(res.demo ? "Vistað (demo — tengdu Supabase)" : "Vistað");
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

  async function remove() {
    if (!window.confirm(`Eyða ${e.fullName}? Þetta er endanlegt og fjarlægir allar vaktir, stimplanir og sögu viðkomandi. Til að halda sögu skaltu frekar óvirkja.`)) return;
    setSaving(true);
    const res = await deleteEmployee(e.id);
    setSaving(false);
    if (res.ok) { toast("Starfsmanni eytt"); router.push("/starfsfolk"); }
    else toast(res.error ?? "Villa");
  }

  return (
    <>
      <PageHeader
        title={e.fullName}
        subtitle={[e.department, e.title].filter(Boolean).join(" · ") || t("Starfsmaður")}
        actions={
          <Link href="/starfsfolk" className="btn ghost sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}><path d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>
            {t("Til baka")}
          </Link>
        }
      />

      <div className="card" style={{ marginTop: 16, maxWidth: 760 }}>
        <div className="ch" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="avt" style={{ background: e.avatarColor, width: 42, height: 42, fontSize: 15 }}>{initials(e.fullName)}</span>
          <div>
            <div className="ct">{e.fullName}</div>
            <div className="cs">{[e.department, e.title].filter(Boolean).join(" · ") || t("Starfsmaður")}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
          {PROFILE_TABS.map((x) => (
            <button key={x} className={`etab${x === tab ? " on" : ""}`} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>
        <form className="cb" onSubmit={save}>
          <ProfileTabBody e={e} tab={tab} />
          <div style={{ display: "flex", gap: 9, marginTop: 22, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={saving}>{saving ? t("Vista…") : t("Vista")}</button>
            <button className="btn ghost" type="button" disabled={saving} onClick={toggleActive}>{e.status === "inactive" ? t("Virkja") : t("Óvirkja")}</button>
            <button className="btn ghost" type="button" disabled={saving} style={{ marginLeft: "auto", color: "var(--bad)" }} onClick={remove}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>{t("Eyða")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
