"use client";

// Ein leið til að búa til og breyta vakt — sama í dag-, viku- og mánaðarsýn:
//  • ShiftForm: vaktategund sem litaðir hnappar, upphaf/lok, klst., (valfrjálst) verkefni, „Tilkynnti veikindi“,
//    Vista / Afrita / Eyða. Opnast sem gluggi á tölvu og sem blað neðan frá í síma (.shift-sheet).
//  • PaintTools: „Mála“-stikan — veldu vaktategund (eða strokleður) og smelltu á reiti.

import { useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import { TimeField } from "@/components/app/fields";
import { SickOnShift } from "./sick-on-shift";

export type ShiftType = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
export type PaintTool = { kind: "type"; ty: ShiftType } | { kind: "clip"; start: string; end: string; type: string | null } | { kind: "erase" } | null;

/** Föst tímasetning vaktategundar („08:00–16:00“ → ["08:00","16:00"]), null ef engin. */
export const typeTimes = (ty: ShiftType | undefined): [string, string] | null => {
  const [a, b] = (ty?.t || "").split("–").map((x) => x?.trim().slice(0, 5));
  return a && b && /^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b) ? [a, b] : null;
};
export const shiftHours = (a: string, b: string) => {
  const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number);
  let d = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
  if (d <= 0) d += 1440;
  return Math.round((d / 60) * 100) / 100;
};

/** Vaktategundir sem hnappar (sami stíll og „Mála“). */
export function ShiftTypeChips({ types, value, onPick }: { types: ShiftType[]; value: string; onPick: (ty: ShiftType) => void }) {
  const { t } = useLang();
  return (
    <div className="sf-types" role="radiogroup" aria-label={t("Vaktategund")}>
      {types.map((ty) => (
        <button key={ty.nm} type="button" role="radio" aria-checked={value === ty.nm} className={`mr-tool${value === ty.nm ? " on" : ""}`} onClick={() => onPick(ty)}
          style={{ background: ty.bg, borderColor: value === ty.nm ? ty.fg : ty.bd, color: ty.fg }}>
          {t(ty.nm)}{ty.t && ty.t !== "–" ? <small>{ty.t.replace(/:00/g, "")}</small> : null}
        </button>
      ))}
    </div>
  );
}

/** Vaktaform — sama í öllum sýnum. `head` = t.d. val á starfsmanni/degi (vika) eða ekkert (fast). */
export function ShiftForm({ types, initial, isEdit, head, notice, sick, extra, onSave, onDelete, onCopy, onClose, onTypes, depts, mainDept, otherDepts }: {
  types: ShiftType[];
  initial: { type: string; start: string; end: string; dept?: string };
  /** Deildir starfsmannsins (0110). Fleiri en ein → val á deild vaktarinnar. */
  depts?: string[];
  /** Aðaldeild starfsmanns — sjálfgefin deild vaktar. */
  mainDept?: string;
  /** Aðrar deildir fyrirtækisins (vakt í deild sem starfsmaðurinn er ekki skráður í, t.d. lánaður). */
  otherDepts?: string[];
  isEdit: boolean;
  head?: React.ReactNode;
  notice?: string | null;
  sick?: { employeeId: string; name: string; dateISO: string; onDone: () => void } | null;
  extra?: React.ReactNode;
  /** dept: deild vaktarinnar ("" = aðaldeild). undefined ef starfsmaður er bara í einni deild. */
  onSave: (start: string, end: string, type: string, dept?: string) => void | Promise<void>;
  onDelete?: () => void;
  onCopy?: () => void;
  onClose: () => void;
  onTypes?: () => void;
}) {
  const { t } = useLang();
  const [type, setType] = useState(initial.type);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const own = depts ?? [];
  const others = (otherDepts ?? []).filter((d) => !own.includes(d));
  const startDept = initial.dept || mainDept || own[0] || "";
  const [dept, setDept] = useState(startDept);
  // Val á deild sést ef starfsmaður er í fleiri deildum, vaktin er þegar í annarri deild, eða notandinn opnar það.
  const [showDept, setShowDept] = useState(own.length > 1 || (!!initial.dept && initial.dept !== mainDept));
  const multi = own.length + others.length > 1;
  function pick(ty: ShiftType) { setType(ty.nm); const tt = typeTimes(ty); if (tt) { setStart(tt[0]); setEnd(tt[1]); } }
  return (
    <>
      {head}
      {notice && <p style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 600, margin: "0 0 10px" }}>{notice}</p>}
      <div className="sf-lbl">{t("Vaktategund")}</div>
      <ShiftTypeChips types={types} value={type} onPick={pick} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>{t("Upphaf")}</label><TimeField value={start} onChange={setStart} style={{ width: "100%" }} /></div>
        <div className="field" style={{ flex: 1 }}><label>{t("Lok")}</label><TimeField value={end} onChange={setEnd} style={{ width: "100%" }} /></div>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "-4px 0 10px" }}>
        {dec1(shiftHours(start, end))} {t("klst")}{end <= start ? ` · ${t("endar daginn eftir")}` : ""}
        {onTypes && <> · <a onClick={() => { onClose(); onTypes(); }} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>{t("Búa til vaktategund")}</a></>}
      </p>
      {multi && showDept && (
        <div style={{ marginBottom: 10 }}>
          <div className="sf-lbl">{t("Deild vaktarinnar")}</div>
          <div className="sf-types" role="radiogroup" aria-label={t("Deild")}>
            {[...own, ...(others.includes(dept) ? [dept] : [])].map((d) => (
              <button key={d} type="button" role="radio" aria-checked={dept === d} className={`mr-tool${dept === d ? " on" : ""}`} onClick={() => setDept(d)}>
                {d}{d === mainDept ? <small>{t("aðal")}</small> : null}
              </button>
            ))}
            {others.length > 0 && (
              <select className="mr-tool" value="" onChange={(e) => e.target.value && setDept(e.target.value)} aria-label={t("Önnur deild")} style={{ minHeight: 34 }}>
                <option value="">{t("Önnur deild…")}</option>
                {others.filter((d) => d !== dept).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
      {multi && !showDept && (
        <p className="muted" style={{ fontSize: 11.5, margin: "-6px 0 10px" }}>
          {t("Deild")}: {dept || t("aðaldeild")} · <a onClick={() => setShowDept(true)} style={{ color: "var(--brand)", fontWeight: 600, cursor: "pointer" }}>{t("Breyta deild")}</a>
        </p>
      )}
      {extra}
      {isEdit && sick && <SickOnShift employeeId={sick.employeeId} name={sick.name} dateISO={sick.dateISO} onDone={sick.onDone} />}
      <div className="sf-actions">
        <button className="btn" type="button" onClick={() => { if (start === end) { toast(t("Upphaf og lok mega ekki vera eins")); return; } void onSave(start, end, type, multi ? (dept === mainDept ? "" : dept) : undefined); }}>{t("Vista")}</button>
        {isEdit && onCopy && <button className="btn ghost" type="button" onClick={onCopy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>{t("Afrita")}
        </button>}
        {isEdit && onDelete && <button className="btn ghost" type="button" style={{ color: "var(--bad)" }} onClick={onDelete}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>{t("Eyða vakt")}
        </button>}
        <button className="btn ghost" type="button" onClick={onClose}>{t("Loka")}</button>
      </div>
    </>
  );
}

/** Gluggi utan um ShiftForm: miðjaður á tölvu, blað neðan frá í síma. */
export function ShiftSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mwrap show shift-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal shift-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div><button className="x" onClick={onClose} aria-label="Loka">✕</button></div>
        <div className="mb">{children}</div>
      </div>
    </div>
  );
}

/** „Mála“-stikan: vaktategund eða strokleður valið, svo smellt á reiti. Sama í viku og mánuði. */
export function PaintTools({ types, tool, setTool, onTypes }: { types: ShiftType[]; tool: PaintTool; setTool: (t: PaintTool) => void; onTypes?: () => void }) {
  const { t } = useLang();
  return (
    <>
      <div className="mr-tools compact">
        <span className="mr-lbl">{t("Mála")}:</span>
        {types.map((ty) => {
          const on = tool?.kind === "type" && tool.ty.nm === ty.nm;
          return (
            <button key={ty.nm} type="button" className={`mr-tool${on ? " on" : ""}`} onClick={() => setTool(on ? null : { kind: "type", ty })}
              style={{ background: ty.bg, borderColor: on ? ty.fg : ty.bd, color: ty.fg }} title={[ty.t || t("Enginn fastur tími"), ty.prem && ty.prem !== "Dagvinna" ? t(ty.prem) : ""].filter(Boolean).join(" · ")}>
              {t(ty.nm)}{ty.t && ty.t !== "–" ? <small>{ty.t.replace(/:00/g, "")}</small> : null}
            </button>
          );
        })}
        <button type="button" className={`mr-tool erase${tool?.kind === "erase" ? " on" : ""}`} onClick={() => setTool(tool?.kind === "erase" ? null : { kind: "erase" })}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H9L4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8" /></svg>{t("Strokleður")}
        </button>
        {onTypes && <button type="button" className="mr-tool add" onClick={onTypes} title={t("Búa til eða breyta vaktategundum")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>{t("Vaktategund")}
        </button>}
      </div>
      {/* Leiðbeining fljótandi neðst — lína ofan við töfluna ýtti henni niður og smellir lentu á röngum reit. */}
      {tool && (
        <div className="mr-hint">
          {tool.kind === "erase" ? t("Smelltu á vaktir til að eyða þeim.") : tool.kind === "clip" ? `${t("Smelltu á reiti til að líma")} ${tool.start}–${tool.end}.` : `${t("Smelltu á reiti til að setja")} ${t(tool.ty.nm)}.`}
          {" "}<a onClick={() => setTool(null)}>{t("Hætta")} (Esc)</a>
        </div>
      )}
    </>
  );
}

/** Fyrsta vaktategund með föstum tíma og tímar hennar — sjálfgefið fyrir nýja vakt. */
export function defaultsFor(types: ShiftType[]): { type: string; start: string; end: string } {
  const first = types.find((x) => typeTimes(x));
  const tt = typeTimes(first) ?? ["08:00", "16:00"];
  return { type: first?.nm ?? types[0]?.nm ?? "", start: tt[0], end: tt[1] };
}

/** Vaktir dagsins hjá starfsmanni sem flipar (0110: fleiri en ein vakt á dag): „07–10 · 10–15 · + Önnur vakt“. */
export function SlotTabs({ items, current, onPick, onAdd }: {
  items: { slot: number; start: string; end: string; dept?: string | null }[]; current: number;
  onPick: (slot: number) => void; onAdd?: () => void;
}) {
  const { t } = useLang();
  if (items.length === 0) return null;
  const isNew = !items.some((x) => x.slot === current);
  return (
    <div className="sf-slots" role="tablist" aria-label={t("Vaktir dagsins")}>
      {items.map((x) => (
        <button key={x.slot} type="button" role="tab" aria-selected={x.slot === current} className={`sf-slot${x.slot === current ? " on" : ""}`} onClick={() => onPick(x.slot)}>
          {x.start}–{x.end}{x.dept ? <small>{x.dept}</small> : null}
        </button>
      ))}
      {isNew
        ? <button type="button" role="tab" aria-selected className="sf-slot on">{t("Ný vakt")}</button>
        : onAdd && items.length < 4 && <button type="button" className="sf-slot add" onClick={onAdd}>+ {t("Önnur vakt sama dag")}</button>}
    </div>
  );
}
