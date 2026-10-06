"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { initials, type Employee } from "@/lib/employees";
import { CUSTOM_UNION } from "@/lib/payrules";
import { PERM_FIELDS } from "@/lib/permissions";
import { updateEmployee, setEmployeeStatus, uploadEmployeePhoto } from "./actions";
import { ProfileTabBody, profileTabsFor, type ProfileTab } from "./employees-screen";
import { Av } from "@/components/app/avatar";

/** Full-page employee profile (replaces the cramped modal). Each section has room
 * to breathe — pay profile, custom rules, benefits, access, documents, etc. */
/** Minnkar mynd í ferning (512 px, JPEG) svo hún fari undir 1 MB mörk Server Actions. */
async function squarePhoto(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(512, side);
    const c = document.createElement("canvas"); c.width = out; c.height = out;
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return c.toDataURL("image/jpeg", 0.86);
  } finally { URL.revokeObjectURL(url); }
}

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
  const e = employee;
  const tabs = profileTabsFor(e.role);
  const avtBg = e.avatarColor;

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


  const roleLabel = e.role === "contractor" ? t("emp:role:contractor") : e.role === "manager" ? t("emp:role:manager") : e.role === "owner" ? t("emp:role:owner") : null;
  const sub = [e.title, e.department ? t(e.department) : null].filter(Boolean).join(" · ");

  return (
    <div className="db2 ep">
      <div className="db2-top">
        <div>
          <Link href="/starfsfolk" className="ne-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>{t("Starfsfólk")}</Link>
          <div className="ep-head">
            <label className="ep-avwrap" title={t("Skipta um mynd")}>
              <Av id={e.id} className="ep-av" c={avtBg} av={initials(e.fullName)} />
              <span className="ep-cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg></span>
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (ev) => {
                const f = ev.target.files?.[0]; ev.target.value = "";
                if (!f) return;
                const dataUrl = await squarePhoto(f).catch(() => null);
                if (!dataUrl) { toast(t("Tókst ekki að lesa myndina")); return; }
                const r = await uploadEmployeePhoto(e.id, dataUrl);
                toast(r.ok ? t("Mynd vistuð") : (r.error ?? "Villa"));
                if (r.ok) router.refresh();
              }} />
            </label>
            <div>
              <h1>{e.fullName}</h1>
              <div className="ep-meta">
                {sub && <span>{sub}</span>}
                {roleLabel && <span className="db2-pill info">{roleLabel}</span>}
                {e.status === "inactive" ? <span className="db2-pill mut">{t("Óvirkur")}</span> : <span className="db2-pill good">{t("emp:active")}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="db2-period">
          <button className="btn ghost sm" type="button" disabled={saving} onClick={toggleActive}>{e.status === "inactive" ? t("Virkja") : t("Óvirkja")}</button>
        </div>
      </div>

      <div className="ep-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={x === tab} className={x === tab ? "on" : ""} onClick={() => openTab(x)}>{t(`ep:tab:${x}`)}</button>
        ))}
      </div>

      <form className="db2-card ep-card" onSubmit={save} onInput={() => setDirty(true)} onChange={() => setDirty(true)}>
        <div className="ep-body">
          {tabs.filter((x) => visited.has(x)).map((x) => (
            <div key={x} hidden={x !== tab}><ProfileTabBody e={e} tab={x} /></div>
          ))}
        </div>
        <div className={`ep-bar${dirty ? " dirty" : ""}`}>
          <span className="ep-state">{dirty && !saving ? t("Óvistaðar breytingar") : t("Vista geymir breytingar á öllum flipum í einu")}</span>
          <button className="btn" type="submit" disabled={saving}>{saving ? t("Vista…") : t("Vista")}</button>
        </div>
      </form>
    </div>
  );
}
