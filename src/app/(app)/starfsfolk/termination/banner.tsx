"use client";

// Borði á prófíl starfsmanns sem hættir / er hættur: „Hættir 31.10.2026 · Uppsögn starfsmanns“,
// staða skjals og lokauppgjörs, innri athugasemd (stjórnendur) og „Afturkalla starfslok“ til og með síðasta degi.

import "./termination.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { REASON_SHORT, isDate, noticeLabel, type LeavingInfo } from "@/lib/termination";
import type { TerminationRow } from "@/lib/terminations.server";
import { revokeTermination, setSettled, terminationDocUrl } from "./actions";

const DOC_STATE: Record<string, string> = { sent: "Bíður undirritunar starfsmanns", signed: "Undirritað", void: "Ógilt" };

export function TerminationBanner({ term, today }: { term: TerminationRow; today: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const past = term.lastDay < today;
  const canUndo = !past;

  async function undo() {
    if (!window.confirm(t("Afturkalla starfslokin? Starfsmaðurinn verður áfram í starfi, vaktir sem voru teknar af planinu koma aftur og skjal í undirritun fellur úr gildi."))) return;
    setBusy(true);
    const r = await revokeTermination(term.id);
    setBusy(false);
    toast(r.ok ? (r.warning ? `${t("Starfslok afturkölluð")} · ${r.warning}` : t("Starfslok afturkölluð")) : (r.error ?? t("Villa")), r.ok ? "ok" : "error");
    if (r.ok) router.refresh();
  }
  async function settle(v: boolean) {
    setBusy(true);
    const r = await setSettled(term.id, v);
    setBusy(false);
    toast(r.ok ? (v ? t("Lokauppgjör merkt afgreitt") : t("Lokauppgjör opnað aftur")) : (r.error ?? t("Villa")), r.ok ? "ok" : "error");
    if (r.ok) router.refresh();
  }
  async function openDoc() {
    const r = await terminationDocUrl(term.id);
    if (r.url) window.open(r.url, "_blank", "noopener"); else toast(r.error ?? t("Ekkert skjal"), "error");
  }

  const doc = term.documentMode === "sign"
    ? `${t("Skjal")}: ${t(DOC_STATE[term.contractStatus ?? ""] ?? "til undirritunar")}`
    : term.documentMode === "send" ? `${t("Skjal")}: ${t("sent án undirritunar")}`
    : term.documentMode === "upload" ? `${t("Skjal")}: ${t("eigið skjal")}` : null;
  const details = [
    `${t("Tilkynnt")} ${isDate(term.noticeDate)}`,
    `${t("frestur")} ${t(noticeLabel(term.noticeValue, term.noticeUnit)).toLowerCase()}`,
    term.gardenLeave ? `${t("laus undan vinnuskyldu frá")} ${isDate(term.gardenFrom ?? term.noticeDate)}` : null,
    doc,
    term.payrollReminder ? (term.settledAt ? t("lokauppgjör afgreitt") : t("lokauppgjör ógert")) : null,
    term.accessClosedAt ? t("aðgangi lokað") : term.accessMonths > 0 ? `${t("lesaðgangur til")} ${isDate(term.accessUntil)}` : t("aðgangur lokast eftir síðasta dag"),
  ].filter(Boolean).join(" · ");

  return (
    <div className={`tl-banner${past ? " past" : ""}`} role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
      <div className="tx">
        <b>{past ? t("Hætti") : t("Hættir")} {isDate(term.lastDay)} · {t(REASON_SHORT[term.reason])}</b>
        <span>{details}</span>
      </div>
      <div className="acts">
        {term.documentId && <button type="button" className="btn ghost sm" onClick={openDoc}>{t("Opna skjal")}</button>}
        {term.note && <button type="button" className="btn ghost sm" onClick={() => setShowNote((v) => !v)}>{showNote ? t("Fela athugasemd") : t("Innri athugasemd")}</button>}
        {term.payrollReminder && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => settle(!term.settledAt)}>{term.settledAt ? t("Opna lokauppgjör aftur") : t("Merkja lokauppgjör afgreitt")}</button>}
        {canUndo && <button type="button" className="btn ghost sm" disabled={busy} onClick={undo} style={{ color: "var(--bad)" }}>{t("Afturkalla starfslok")}</button>}
      </div>
      {showNote && term.note && <div className="tl-note">{term.note}</div>}
    </div>
  );
}

/** Pilla í starfsmannalistanum. */
export function LeavingPill({ info, today }: { info: LeavingInfo; today: string }) {
  const { t } = useLang();
  const past = info.lastDay < today;
  return <span className={`db2-pill ${past ? "mut" : "warn"}`} title={t(REASON_SHORT[info.reason])}>{past ? t("Hætti") : t("Hættir")} {isDate(info.lastDay)}</span>;
}
