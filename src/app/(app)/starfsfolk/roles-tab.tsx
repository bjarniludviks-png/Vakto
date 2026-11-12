"use client";

// Starfsmannaspjald → „Hlutverk og ábyrgð“ (0111). Vistast strax (ekki með „Vista“-hnappi spjaldsins),
// svo allir hnappar hér eru type="button".

import "../verkefni/verkefni.css";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { counts, VIA_LABEL } from "@/lib/tasks";
import { getEmployeeResp, setEmployeeRoles, setReportsTo, returnHandover, type EmployeeResp } from "../verkefni/actions";
import { HandoverModal, personAv } from "../verkefni/editors";

export function RolesTab({ employeeId }: { employeeId: string }) {
  const { t } = useLang();
  const [d, setD] = useState<EmployeeResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [ho, setHo] = useState(false);
  const load = useCallback(() => getEmployeeResp(employeeId).then(setD), [employeeId]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="tk-empty">{t("Sæki…")}</div>;
  if (d.missing) return <div className="tk-missing">{t("Hlutverk eru ekki komin í gagnagrunninn ennþá (migration 0111).")}</div>;
  if (!d.ok) return <div className="tk-empty">{d.error ?? t("Tókst ekki að sækja")}</div>;
  const me = d.people.find((p) => p.id === employeeId);
  const nm = (id: string) => d.people.find((p) => p.id === id)?.name.split(" ")[0] ?? "";
  const mine = (rid: string) => d.roles.find((r) => r.id === rid)?.holders.find((h) => h.employeeId === employeeId);
  const subs = d.people.filter((p) => p.reportsTo === employeeId);

  async function setRole(rid: string, v: "none" | "fast" | "vara") {
    const cur = d!.roles.flatMap((r) => r.holders.filter((h) => h.employeeId === employeeId).map((h) => ({ roleId: r.id, backup: h.backup })));
    const next = cur.filter((x) => x.roleId !== rid);
    if (v !== "none") next.push({ roleId: rid, backup: v === "vara" });
    setBusy(true);
    const r = await setEmployeeRoles(employeeId, next);
    setBusy(false);
    if (!r.ok) toast(r.error ?? "Villa", "error"); else load();
  }
  async function setBoss(v: string) {
    setBusy(true);
    const r = await setReportsTo(employeeId, v || null);
    setBusy(false);
    if (!r.ok) toast(r.error ?? "Villa", "error"); else { toast(t("Skipuritið er uppfært")); load(); }
  }
  const c = d.day ? counts(d.day) : { done: 0, total: 0 };

  return (
    // Vistast strax — breytingar hér mega ekki merkja spjaldið „óvistað“.
    <div className="tk-wrap" style={{ gap: 18 }} onChange={(e) => e.stopPropagation()} onInput={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Starfsmaðurinn sér hlutverkin sín og varamanninn í appinu (Ég → Hlutverkin mín). Breytingar hér vistast strax.")}</div>

      <div className="tk-row2">
        <div className="field" style={{ margin: 0 }}><label>{t("Yfirmaður")}</label>
          <select value={me?.reportsTo ?? ""} disabled={busy} onChange={(e) => setBoss(e.target.value)}>
            <option value="">{t("Enginn")}</option>
            {d.people.filter((p) => p.id !== employeeId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}><label>{t("Undirmenn")}</label>
          <div className="tk-avs" style={{ minHeight: 40 }}>{subs.length ? subs.map((s) => <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{personAv(s)}{s.name.split(" ")[0]}</span>) : <span style={{ color: "var(--ink3)" }}>{t("Enginn")}</span>}</div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>{t("Föst hlutverk")}</b><span className="tk-grow" />
          <Link href="/verkefni?tab=hlutverk" className="btn ghost sm">{t("Sjá öll hlutverk")}</Link>
        </div>
        {d.roles.length === 0 ? <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Engin hlutverk til ennþá.")} <Link href="/verkefni?tab=hlutverk" style={{ color: "var(--brand)" }}>{t("Búa til hlutverk")}</Link></div> : (
          <div className="tk-holdlist" style={{ maxHeight: "none" }}>
            {d.roles.map((r) => {
              const h = mine(r.id); const v = h ? (h.backup ? "vara" : "fast") : "none";
              const others = r.holders.filter((x) => x.employeeId !== employeeId);
              return (
                <div className="tk-hold" key={r.id}>
                  <span className="tk-dot" style={{ background: r.color ?? "var(--brand)", marginTop: 0 }} />
                  <span className="tk-grow"><b style={{ fontWeight: 600 }}>{r.name}</b>
                    {others.length > 0 && <span style={{ color: "var(--ink3)", fontSize: 12 }}> · {others.map((o) => `${nm(o.employeeId)}${o.backup ? ` (${t("vara")})` : ""}`).join(", ")}</span>}
                  </span>
                  <div className="tk-opts">
                    {([["none", "—"], ["fast", t("Fast")], ["vara", t("Varamaður")]] as const).map(([k, l]) => (
                      <button type="button" key={k} disabled={busy} className={`tk-opt sm${v === k ? " on" : ""}`} onClick={() => v !== k && setRole(r.id, k)}>{l}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>{t("Ábyrgð í dag")}</b>
          <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>{c.done}/{c.total} {t("klárað")}</span><span className="tk-grow" />
          <button type="button" className="btn sm" onClick={() => setHo(true)}>{t("Færa ábyrgð")}</button>
        </div>
        {d.handovers.map((h) => (
          <div className="tk-banner" key={h.id} style={{ marginBottom: 8 }}>
            <div className="tk-grow">
              {h.fromId === employeeId ? <>{t("Fært til")} <b>{nm(h.toId)}</b></> : <>{t("Fékk frá")} <b>{nm(h.fromId)}</b></>}
              {" · "}{h.roleId ? d.roles.find((r) => r.id === h.roleId)?.name : t("allar ábyrgðir")}
              {" · "}{h.end ? `${t("til")} ${h.end.slice(8, 10)}.${h.end.slice(5, 7)}.` : t("þar til skilað")}
            </div>
            <button type="button" className="btn ghost sm" onClick={async () => { const r = await returnHandover(h.id); if (!r.ok) toast(r.error ?? "Villa", "error"); else load(); }}>{t("Skila")}</button>
          </div>
        ))}
        {d.day && (d.day.roles.length > 0 || d.day.lists.length > 0 || d.day.adhoc.length > 0) ? (
          <div style={{ display: "grid", gap: 6, fontSize: 13.5 }}>
            {d.day.roles.map((r) => <div key={r.id}><span className={`tk-chip ${r.via}`}><i style={{ background: r.color ?? undefined }} />{r.name}</span> <span style={{ color: "var(--ink3)", fontSize: 12 }}>{t(VIA_LABEL[r.via])}{r.from_name ? ` — ${r.from_name}` : ""}</span></div>)}
            {d.day.lists.map((l) => <div key={l.id}>{l.name} <span style={{ color: "var(--ink3)" }}>{l.items.filter((i) => i.done).length}/{l.items.length}{l.due_time ? ` · ${t("fyrir kl.")} ${l.due_time}` : ""}</span></div>)}
            {d.day.adhoc.map((a) => <div key={a.id}>{a.done ? "✓ " : ""}{a.title}</div>)}
          </div>
        ) : <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Ekkert á könnu starfsmannsins í dag.")}</div>}
      </div>

      {ho && me && <HandoverModal from={me} date={d.today} people={d.people} roles={d.roles} onClose={() => setHo(false)} onSaved={load} />}
    </div>
  );
}
