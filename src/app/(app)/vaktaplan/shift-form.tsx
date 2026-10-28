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
export function ShiftForm({ types, initial, isEdit, head, notice, sick, extra, onSave, onDelete, onCopy, onClose, onTypes }: {
  types: ShiftType[];
  initial: { type: string; start: string; end: string };
  isEdit: boolean;
  head?: React.ReactNode;
  notice?: string | null;
  sick?: { employeeId: string; name: string; dateISO: string; onDone: () => void } | null;
  extra?: React.ReactNode;
  onSave: (start: string, end: string, type: string) => void | Promise<void>;
  onDelete?: () => void;
  onCopy?: () => void;
  onClose: () => void;
  onTypes?: () => void;
}) {
  const { t } = useLang();
  const [type, setType] = useState(initial.type);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
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
      {extra}
      {isEdit && sick && <SickOnShift employeeId={sick.employeeId} name={sick.name} dateISO={sick.dateISO} onDone={sick.onDone} />}
      <div className="sf-actions">
        <button className="btn" type="button" onClick={() => { if (start === end) { toast(t("Upphaf og lok mega ekki vera eins")); return; } void onSave(start, end, type); }}>{t("Vista")}</button>
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
