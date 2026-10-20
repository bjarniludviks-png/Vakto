"use client";

// „Ljúka ráðningu“ — fjögurra skrefa hjálpari (ástæða → dagsetningar → skjal → áhrif). VAKTO skráir það
// sem vinnuveitandinn velur; tillögur eru alltaf breytanlegar og orðalag hlutlaust (ekki lögfræðiráðgjöf).

import "./termination.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { ContractView } from "@/components/app/contract-view";
import { createClient } from "@/lib/supabase/client";
import {
  ACCESS_MONTHS, NOTE_REQUIRED, REASONS, REASON_LABEL, buildLetter, computeLastDay, isDate, noticeLabel, shiftCutoff, suggestNotice,
  type DocumentMode, type NoticeUnit, type ShiftAction, type TerminationReason,
} from "@/lib/termination";
import { createTermination, prepareTermination, type TerminationPrep } from "./actions";

const REASON_SUB: Record<TerminationReason, string> = {
  employee_resigned: "tl:sub:employee_resigned",
  employer_terminated: "tl:sub:employer_terminated",
  mutual: "tl:sub:mutual",
  fixed_term_end: "tl:sub:fixed_term_end",
  summary_dismissal: "tl:sub:summary_dismissal",
  other: "tl:sub:other",
};
const STEP_NAMES = ["Ástæða", "Dagsetningar", "Skjal", "Áhrif og staðfesting"];
const MODE_LABEL: Record<DocumentMode, [string, string]> = {
  sign: ["VAKTO býr til bréf og sendir til undirritunar", "tl:mode:sign"],
  send: ["VAKTO býr til bréf og sendir án undirritunar", "tl:mode:send"],
  upload: ["Hlaða upp eigin skjali", "tl:mode:upload"],
  none: ["Ekkert skjal", "tl:mode:none"],
};
const MAX_UPLOAD = 10 * 1024 * 1024;

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

export function TerminateButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn ghost sm" type="button" onClick={() => setOpen(true)} title={t("Skrá starfslok starfsmannsins")}>{t("Ljúka ráðningu")}</button>
      {open && <TerminationWizard employeeId={employeeId} employeeName={employeeName} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TerminationWizard({ employeeId, employeeName, onClose }: { employeeId: string; employeeName: string; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [prep, setPrep] = useState<TerminationPrep | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ warning?: string; employerUrl?: string } | null>(null);

  // 1. ástæða
  const [reason, setReason] = useState<TerminationReason | null>(null);
  const [note, setNote] = useState("");
  // 2. dagsetningar
  const [noticeDate, setNoticeDate] = useState("");
  // Frestur og síðasti dagur eru reiknuð (tillaga) þar til notandinn breytir þeim sjálfur.
  const [noticeOverride, setNoticeOverride] = useState<{ value: number; unit: NoticeUnit } | null>(null);
  const [lastDayOverride, setLastDayOverride] = useState<string | null>(null);
  const [garden, setGarden] = useState(false);
  const [gardenFrom, setGardenFrom] = useState("");
  // 3. skjal
  const [mode, setMode] = useState<DocumentMode>("sign");
  const [upload, setUpload] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [signer, setSigner] = useState<{ ssn: string; phone: string }>({ ssn: "", phone: "" });
  const [showPreview, setShowPreview] = useState(false);
  // 4. áhrif
  const [shiftAction, setShiftAction] = useState<ShiftAction>("unassign");
  const [shiftsOn, setShiftsOn] = useState(true);
  const [payroll, setPayroll] = useState(true);
  const [deactivate, setDeactivate] = useState(true);
  const [access, setAccess] = useState<number>(12);

  useEffect(() => {
    let live = true;
    prepareTermination(employeeId).then((p) => {
      if (!live) return;
      setPrep(p);
      if (p.ok && p.today) { setNoticeDate(p.today); setGardenFrom(p.today); }
      if (p.ok && !p.employee?.email) setMode("none");
    });
    return () => { live = false; };
  }, [employeeId]);

  const emp = prep?.employee;
  const sugg = useMemo(() => (reason && noticeDate ? suggestNotice(reason, emp?.union, emp?.hireDate, noticeDate) : null), [reason, noticeDate, emp?.union, emp?.hireDate]);

  const noticeEdited = noticeOverride !== null, lastDayEdited = lastDayOverride !== null;
  const noticeValue = noticeOverride?.value ?? sugg?.value ?? 1;
  const noticeUnit: NoticeUnit = noticeOverride?.unit ?? sugg?.unit ?? "months";
  const lastDay = lastDayOverride ?? (noticeDate ? computeLastDay(noticeDate, noticeValue, noticeUnit) : "");

  const cutoff = lastDay ? shiftCutoff(lastDay, garden, gardenFrom) : "";
  const shiftCount = useMemo(() => {
    if (!prep?.shiftDates || !cutoff) return 0;
    const from = prep.today && prep.today > cutoff ? prep.today : cutoff;
    return prep.shiftDates.filter((d) => d >= from).length;
  }, [prep, cutoff]);

  const letter = useMemo(() => {
    if (!reason || !prep?.company || !emp || !lastDay) return "";
    return buildLetter({
      reason, company: prep.company, employee: { name: emp.name, kennitala: emp.kennitala, title: emp.title, address: emp.address },
      noticeDate, noticeValue, noticeUnit, lastDay, gardenLeave: garden, gardenFrom, signed: mode === "sign",
    });
  }, [reason, prep, emp, noticeDate, noticeValue, noticeUnit, lastDay, garden, gardenFrom, mode]);

  const noteRequired = !!reason && NOTE_REQUIRED.includes(reason);
  const stepOk = [
    !!reason && (!noteRequired || note.trim().length > 0),
    !!noticeDate && !!lastDay && lastDay >= noticeDate && (!garden || (!!gardenFrom && gardenFrom >= noticeDate && gardenFrom <= lastDay)),
    mode !== "upload" ? (mode !== "sign" || !prep?.company?.taktikal || signer.ssn.replace(/\D/g, "").length === 10) : !!upload,
    true,
  ];

  async function onFile(f: File | undefined) {
    if (!f || !prep?.uploadPrefix) return;
    if (f.size > MAX_UPLOAD) { toast(t("Skjalið má mest vera 10 MB"), "error"); return; }
    setUploading(true);
    const safe = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `${prep.uploadPrefix}${Date.now()}-${safe}`;
    const { error } = await createClient().storage.from("documents").upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    setUploading(false);
    if (error) { toast(t("Tókst ekki að hlaða skjalinu upp"), "error"); return; }
    setUpload({ path, name: f.name });
  }

  async function submit() {
    if (!reason) return;
    setBusy(true);
    const res = await createTermination({
      employeeId, reason, noticeDate, noticeValue, noticeUnit, lastDay, gardenLeave: garden, gardenFrom: garden ? gardenFrom : null,
      note, documentMode: mode, upload, signer: mode === "sign" && prep?.company?.taktikal ? signer : null,
      shiftAction: shiftsOn ? shiftAction : "keep", payrollReminder: payroll, deactivate, accessMonths: access,
    });
    setBusy(false);
    if (res.needSigner) { setSigner({ ssn: res.needSigner.ssn, phone: res.needSigner.phone }); setStep(2); toast(t("Sláðu inn kennitölu þína fyrir rafræn skilríki"), "error"); return; }
    if (!res.ok) { toast(res.error ?? t("Villa"), "error"); return; }
    setDone({ warning: res.warning, employerUrl: res.employerUrl });
    router.refresh();
  }

  const close = () => { if (!busy) onClose(); };

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="mbg" onClick={close} />
      <div className="modal tl-modal" role="dialog" aria-modal="true" aria-labelledby="tl-h">
        <div className="mh">
          <div>
            <div id="tl-h" style={{ fontSize: 15, fontWeight: 700 }}>{t("Ljúka ráðningu")}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>{employeeName}</div>
          </div>
          <button className="x" type="button" onClick={close} aria-label={t("Loka")}>✕</button>
        </div>
        {!done && <div className="tl-steps" aria-hidden="true">{STEP_NAMES.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>}
        <div className="mb">
          {!prep ? <p className="muted" style={{ fontSize: 13 }}>{t("Augnablik…")}</p>
            : !prep.ok ? <p style={{ fontSize: 13.5, color: "var(--bad)" }}>{t(prep.error ?? "Villa")}</p>
            : done ? (
              <div className="tl-done">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>
                <h3>{t("Starfslok skráð")}</h3>
                <p>{t("Síðasti starfsdagur")} {isDate(lastDay)}. {t("Hægt er að afturkalla starfslokin til og með síðasta starfsdegi.")}</p>
                {done.warning && <p style={{ color: "var(--warn)" }}>{done.warning}</p>}
                {done.employerUrl && (
                  <>
                    <p>{t("Skjalið er tilbúið hjá Taktikal. Skrifaðu undir núna — starfsmaðurinn fær tölvupóst þegar þú hefur skrifað undir.")}</p>
                    <a className="btn" href={done.employerUrl} target="_blank" rel="noopener noreferrer">{t("Skrifa undir hjá Taktikal")}</a>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="tl-stepname">{t("Skref")} {step + 1}/4 · {t(STEP_NAMES[step])}</div>

                {step === 0 && (
                  <>
                    <div className="tl-reasons" role="radiogroup" aria-label={t("Ástæða")}>
                      {REASONS.map((r) => (
                        <button key={r} type="button" role="radio" aria-checked={reason === r} className={`tl-opt${reason === r ? " on" : ""}`} onClick={() => { setReason(r); setNoticeOverride(null); setLastDayOverride(null); }}>
                          <span className="tl-dot" />
                          <span><b>{t(REASON_LABEL[r])}</b><small>{t(REASON_SUB[r])}</small></span>
                        </button>
                      ))}
                    </div>
                    {reason === "summary_dismissal" && (
                      <div className="tl-hint"><Icon d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><span>{t("Riftun er fyrirvaralaus slit vegna alvarlegra vanefnda — leitaðu ráða ef þú ert í vafa.")}</span></div>
                    )}
                    <div className="emp-fld" style={{ marginTop: 14 }}>
                      <label htmlFor="tl-note">{t("Innri athugasemd")} {noteRequired ? <span style={{ color: "var(--bad)" }}>*</span> : <span style={{ color: "var(--ink3)", fontWeight: 500 }}>({t("valkvætt")})</span>}</label>
                      <textarea id="tl-note" className="lf-ta" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Aðeins stjórnendur sjá þetta. Starfsmaðurinn sér það ekki og það fer ekki í bréfið.")} />
                    </div>
                  </>
                )}

                {step === 1 && reason && (
                  <>
                    <div className="tl-row">
                      <div className="emp-fld"><label htmlFor="tl-nd">{reason === "employee_resigned" ? t("Dagsetning uppsagnar starfsmanns") : t("Dagsetning tilkynningar")}</label>
                        <input id="tl-nd" type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} /></div>
                      <div className="emp-fld"><label htmlFor="tl-nv">{t("Uppsagnarfrestur")}</label>
                        <div className="tl-row3">
                          <input id="tl-nv" type="number" min={0} max={60} value={noticeUnit === "none" ? 0 : noticeValue} disabled={noticeUnit === "none"}
                            onChange={(e) => setNoticeOverride({ value: Math.max(0, Math.min(60, Number(e.target.value) || 0)), unit: noticeUnit })} />
                          <select aria-label={t("Eining")} value={noticeUnit} onChange={(e) => { const u = e.target.value as NoticeUnit; setNoticeOverride({ unit: u, value: u !== "none" && !noticeValue ? 1 : noticeValue }); }}>
                            <option value="none">{t("Enginn")}</option>
                            <option value="days">{t("dagar")}</option>
                            <option value="weeks">{t("vikur")}</option>
                            <option value="months">{t("mánuðir")}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {sugg && (
                      <p className="tl-sugg">
                        {t("Tillaga")}: <b>{t(noticeLabel(sugg.value, sugg.unit))}</b> — {t(sugg.basis)}. {t("Breyttu ef við á (ráðningarsamningur eða kjarasamningur getur kveðið á um annað).")}
                        {noticeEdited && <> <button type="button" className="tl-link" onClick={() => { setNoticeOverride(null); setLastDayOverride(null); }}>{t("Nota tillögu")}</button></>}
                      </p>
                    )}
                    <div className="tl-row">
                      <div className="emp-fld"><label htmlFor="tl-ld">{t("Síðasti starfsdagur")}</label>
                        <input id="tl-ld" type="date" value={lastDay} min={noticeDate} onChange={(e) => setLastDayOverride(e.target.value)} /></div>
                      <div className="emp-fld" style={{ alignSelf: "end" }}>
                        {lastDayEdited
                          ? <button type="button" className="tl-link" style={{ fontSize: 12.5 }} onClick={() => setLastDayOverride(null)}>{t("Reikna út frá fresti")} ({isDate(computeLastDay(noticeDate, noticeValue, noticeUnit))})</button>
                          : <span style={{ fontSize: 12, color: "var(--ink3)" }}>{noticeUnit === "months" ? t("Reiknað: frestur hefst um næstu mánaðamót") : t("Reiknað út frá fresti")}</span>}
                      </div>
                    </div>
                    {lastDay && lastDay < noticeDate && <p style={{ color: "var(--bad)", fontSize: 12.5, marginTop: -6 }}>{t("Síðasti starfsdagur getur ekki verið á undan tilkynningardegi")}</p>}
                    <label className="tl-check" style={{ borderTop: "1px solid var(--line2)", marginTop: 4 }}>
                      <input type="checkbox" checked={garden} onChange={(e) => setGarden(e.target.checked)} />
                      <span className="tx"><b>{t("Laus undan vinnuskyldu")}</b><small>{t("Starfsmaðurinn heldur launum á uppsagnarfresti en mætir ekki til vinnu. Vaktir frá þeim degi eru teknar af planinu.")}</small>
                        {garden && <span className="emp-fld" style={{ display: "block", marginTop: 8, marginBottom: 0, maxWidth: 220 }}><label htmlFor="tl-gf">{t("Frá og með")}</label><input id="tl-gf" type="date" value={gardenFrom} min={noticeDate} max={lastDay} onChange={(e) => setGardenFrom(e.target.value)} /></span>}
                      </span>
                    </label>
                  </>
                )}

                {step === 2 && reason && (
                  <>
                    <div style={{ display: "grid", gap: 8 }} role="radiogroup" aria-label={t("Skjal")}>
                      {(["sign", "send", "upload", "none"] as DocumentMode[]).map((m) => {
                        const needsEmail = (m === "sign") && !emp?.email;
                        return (
                          <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={needsEmail} className={`tl-opt${mode === m ? " on" : ""}`} style={needsEmail ? { opacity: 0.55, cursor: "not-allowed" } : undefined} onClick={() => setMode(m)}>
                            <span className="tl-dot" />
                            <span><b>{t(MODE_LABEL[m][0])}</b><small>{needsEmail ? t("Netfang starfsmanns vantar — skráðu það í flipanum Persónulegt") : m === "sign" && prep.company?.taktikal ? t("tl:mode:sign:taktikal") : t(MODE_LABEL[m][1])}</small></span>
                          </button>
                        );
                      })}
                    </div>
                    {mode === "sign" && prep.company?.taktikal && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: 12.5, color: "var(--ink3)", margin: "0 0 10px" }}>{t("Kostnaður: 490 kr á hverja undirskrift (980 kr fyrir samninginn, án VSK) bætist á næsta mánaðarreikning.")}</p>
                        <div className="tl-row">
                          <div className="emp-fld"><label htmlFor="tl-ssn">{t("Kennitala þín")}</label><input id="tl-ssn" inputMode="numeric" value={signer.ssn} onChange={(e) => setSigner({ ...signer, ssn: e.target.value })} placeholder="000000-0000" /></div>
                          <div className="emp-fld"><label htmlFor="tl-ph">{t("Farsími með rafrænum skilríkjum")}</label><input id="tl-ph" type="tel" value={signer.phone} onChange={(e) => setSigner({ ...signer, phone: e.target.value })} placeholder="6xx xxxx" /></div>
                        </div>
                      </div>
                    )}
                    {mode === "upload" && (
                      <div className="tl-file">
                        <input type="file" accept="application/pdf,image/*,.doc,.docx" disabled={uploading} onChange={(e) => onFile(e.target.files?.[0])} />
                        <span style={{ color: upload ? "var(--good)" : "var(--ink3)" }}>{uploading ? t("Hleð upp…") : upload ? `${t("Hlaðið upp")}: ${upload.name}` : t("PDF eða mynd, mest 10 MB")}</span>
                      </div>
                    )}
                    {(mode === "sign" || mode === "send") && (
                      <>
                        <button type="button" className="tl-link" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setShowPreview((v) => !v)}>{showPreview ? t("Fela forskoðun") : t("Forskoða bréfið")}</button>
                        {showPreview && <div className="tl-preview"><ContractView content={letter} /></div>}
                      </>
                    )}
                    <p className="tl-sugg" style={{ marginTop: 12 }}>{t("Skjalið vistast í skjalasafni starfsmannsins. VAKTO veitir ekki lögfræðiráðgjöf — farðu yfir textann áður en hann er sendur.")}</p>
                  </>
                )}

                {step === 3 && reason && (
                  <>
                    <div>
                      <label className="tl-check">
                        <input type="checkbox" checked={shiftsOn} onChange={(e) => setShiftsOn(e.target.checked)} />
                        <span className="tx"><b>{shiftCount === 0 ? t("Engar vaktir á plani eftir síðasta dag") : `${t("Taka")} ${shiftCount} ${shiftCount === 1 ? t("vakt") : t("vaktir")} ${t("af planinu")}`}</b>
                          <small>{t("Vaktir frá og með")} {isDate(cutoff)}{garden ? ` (${t("laus undan vinnuskyldu")})` : ""}.</small>
                          {shiftsOn && shiftCount > 0 && (
                            <select aria-label={t("Hvað verður um vaktirnar")} value={shiftAction} onChange={(e) => setShiftAction(e.target.value as ShiftAction)}>
                              <option value="unassign">{t("Gera að lausum vöktum (aðrir geta tekið þær)")}</option>
                              <option value="delete">{t("Eyða vöktunum")}</option>
                            </select>
                          )}
                        </span>
                      </label>
                      <label className="tl-check">
                        <input type="checkbox" checked={payroll} onChange={(e) => setPayroll(e.target.checked)} />
                        <span className="tx"><b>{t("Áminning um lokauppgjör launa og orlofs")}</b><small>{t("Birtist í Launakeyrslum og „Þarf athygli“ á mælaborði þar til þú merkir það afgreitt.")}</small></span>
                      </label>
                      <label className="tl-check">
                        <input type="checkbox" checked={deactivate} onChange={(e) => setDeactivate(e.target.checked)} />
                        <span className="tx"><b>{t("Óvirkja starfsmanninn eftir síðasta dag")}</b><small>{t("Sagan helst: tímar, laun og skýrslur telja hann með til og með síðasta degi.")}</small></span>
                      </label>
                      <div className="tl-check">
                        <span style={{ width: 17 }} />
                        <span className="tx"><b>{t("Aðgangur að appinu eftir síðasta dag")}</b><small>{emp?.hasAccount ? t("Aðeins lesaðgangur að eigin launaseðlum, samningum og skjölum. Síðan lokast aðgangurinn sjálfkrafa.") : t("Starfsmaðurinn er ekki með aðgang að appinu.")}</small>
                          <select aria-label={t("Aðgangur að appinu eftir síðasta dag")} value={access} onChange={(e) => setAccess(Number(e.target.value))}>
                            {ACCESS_MONTHS.map((m) => <option key={m} value={m}>{m === 0 ? t("Loka strax eftir síðasta dag") : `${m} ${t("mánuðir")}`}</option>)}
                          </select>
                        </span>
                      </div>
                    </div>
                    <dl className="tl-sum" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                      <dt>{t("Ástæða")}</dt><dd>{t(REASON_LABEL[reason])}</dd>
                      <dt>{t("Tilkynnt")}</dt><dd>{isDate(noticeDate)}</dd>
                      <dt>{t("Uppsagnarfrestur")}</dt><dd>{t(noticeLabel(noticeValue, noticeUnit))}</dd>
                      <dt>{t("Síðasti starfsdagur")}</dt><dd>{isDate(lastDay)}</dd>
                      {garden && <><dt>{t("Laus undan vinnuskyldu")}</dt><dd>{t("frá")} {isDate(gardenFrom)}</dd></>}
                      <dt>{t("Skjal")}</dt><dd>{t(MODE_LABEL[mode][0])}</dd>
                    </dl>
                  </>
                )}
              </>
            )}
        </div>
        {prep?.ok && !done && (
          <div className="tl-foot">
            {step > 0 && <button type="button" className="btn ghost" disabled={busy} onClick={() => setStep((s) => s - 1)}>{t("Til baka")}</button>}
            <span className="sp" />
            {step < 3
              ? <button type="button" className="btn" disabled={!stepOk[step]} onClick={() => setStep((s) => s + 1)}>{t("Áfram")}</button>
              : <button type="button" className="btn" disabled={busy || !stepOk.every(Boolean)} onClick={submit}>{busy ? t("Skrái…") : t("Skrá starfslok")}</button>}
          </div>
        )}
        {done && (
          <div className="tl-foot"><span className="sp" /><button type="button" className="btn" onClick={onClose}>{t("Loka")}</button></div>
        )}
      </div>
    </div>
  );
}
