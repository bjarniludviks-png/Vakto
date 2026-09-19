"use client";

// Building blocks of the employee experience, shared by the three employee
// screens: /stimpla (clock), /vaktir (shifts + requests) and /mitt (pay, chat,
// news). Everything here renders real data only — there is no demo branch.

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { TimeField, DateField } from "@/components/app/fields";
import { myPunch, submitLeaveRequest, requestShiftSwap, setAvailability, uploadPhoto, updateMyProfile, applyForShift, getMyPunches, requestCorrection, toggleShiftTask, getMyContract, signMyContract, type LeaveType, type MyPunchRow, type MyContract } from "./actions";
import { listCompanyDocs, openCompanyDoc, type CompanyDoc } from "../stillingar/actions";
import { dec1, nf } from "@/lib/format";
import { AsyncButton } from "@/components/app/async-button";
import type { MyArea } from "./my.server";

export type ReqKind = "leave" | "avail" | "swap" | "pickup";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };

/* ------------------------------------------------------------------ avatar */
export function PhotoAvatar({ photo, setPhoto, big, initials = "VK" }: { photo: string | null; setPhoto: (s: string) => void; big: boolean; initials?: string }) {
  const { t } = useLang();
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhoto(dataUrl); // optimistic preview
      const res = await uploadPhoto(dataUrl);
      toast(res.ok ? t("Prófílmynd uppfærð") : (res.error ?? t("Tókst ekki að hlaða mynd")));
    };
    r.readAsDataURL(f);
  }
  const style = photo ? { backgroundImage: `url(${photo})` } : undefined;
  return (
    <label className={big ? "emp-ava-lg" : "emp-ava"} style={{ cursor: "pointer", ...style }} title={t("Smelltu til að hlaða mynd af þér")}>
      {!photo && <span className="ini">{initials}</span>}
      <input type="file" accept="image/*" hidden onChange={onChange} />
      <span className="cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg></span>
    </label>
  );
}

/* ------------------------------------------------------------- punch card */
/** The clock: one big button, live elapsed time from the real open punch. */
export function PunchCard({ openSince }: { openSince: string | null }) {
  const { t } = useLang();
  const [on, setOn] = useState(!!openSince);
  const [since, setSince] = useState(openSince ? openSince.slice(11, 16) : "");
  const startRef = useRef<number>(openSince ? new Date(openSince).getTime() : 0);
  const [elapsed, setElapsed] = useState("00:00:00");
  useEffect(() => {
    const tick = () => {
      if (!on || !startRef.current) { setElapsed("00:00:00"); return; }
      const s = Math.max(0, Math.floor((Date.now() - startRef.current) / 1000));
      const z = (n: number) => String(n).padStart(2, "0");
      setElapsed(`${z(Math.floor(s / 3600))}:${z(Math.floor((s % 3600) / 60))}:${z(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [on]);
  async function toggle() {
    const next = !on;
    const res = await myPunch(next);
    if (!res.ok) { toast(res.error ?? t("Tókst ekki")); return; }
    if (next) {
      startRef.current = Date.now();
      const d = new Date();
      setSince(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    }
    setOn(next);
    toast(next ? t("Stimplað inn") : t("Stimplað út"));
  }
  return (
    <div className={`punch${on ? "" : " out"}`}>
      <div className="st">{on ? `${t("Á vakt síðan")} ${since}` : t("Ekki á vakt")}</div>
      <div className="big">{elapsed}</div>
      <AsyncButton className="" onClick={toggle}>{on ? t("Stimpla út") : t("Stimpla inn")}</AsyncButton>
    </div>
  );
}

/* --------------------------------------------------------- next shift box */
export function NextShiftCard({ my }: { my: MyArea }) {
  const { t } = useLang();
  return (
    <div className="mini">
      <div className="mh">{t("Næsta vakt")}</div>
      {my.upcoming.length ? my.upcoming.map((s, i) => (
        <div className="mr" key={i}>
          <span>{s.label}</span>
          <b style={s.premium ? { color: "var(--warn)" } : undefined}>{s.time}{s.premium ? ` ${s.premium}` : ""}</b>
        </div>
      )) : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Engar vaktir á plani framundan.")}</div>}
    </div>
  );
}

/* ------------------------------------------------------- contract signing */
/** Shows only while a contract awaits the employee's signature. */
export function ContractSignCard() {
  const { t } = useLang();
  const [contract, setContract] = useState<MyContract | null>(null);
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getMyContract().then((r) => { if (r.ok && r.contract?.status === "sent") setContract(r.contract); }); }, []);
  if (!contract) return null;
  async function sign() {
    if (!contract) return;
    setBusy(true);
    const res = await signMyContract(contract.id);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? t("Villa")); return; }
    toast(t("Samningurinn er undirritaður — til hamingju!"));
    setOpen(false);
    setContract(null);
  }
  return (
    <>
      <div className="mini" style={{ borderColor: "var(--brand)", background: "var(--brand-soft, #fdf1e7)" }}>
        <div className="mh" style={{ color: "var(--brand)" }}>{t("Ráðningarsamningur bíður undirritunar")}</div>
        <p style={{ fontSize: 13, margin: "4px 0 10px" }}>{t("Vinnuveitandinn þinn sendi þér ráðningarsamning. Lestu hann yfir og samþykktu rafrænt.")}</p>
        <button className="btn sm" onClick={() => setOpen(true)}>{t("Skoða & samþykkja")}</button>
      </div>
      {open && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="mbg" onClick={() => setOpen(false)} />
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="mh"><div style={{ fontSize: 15, fontWeight: 700 }}>{contract.title}</div><button className="x" onClick={() => setOpen(false)}>✕</button></div>
            <div className="mb">
              <div style={{ maxHeight: "48vh", overflowY: "auto", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{contract.content}</pre>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
                {t("Ég hef lesið samninginn og samþykki hann. Rafrænt samþykki mitt er skráð með nafni, tímastimpli og innskráningu.")}
              </label>
              <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
                <button className="btn" disabled={!agreed || busy} onClick={sign}>{t("Samþykkja ráðningarsamninginn")}</button>
                <button className="btn ghost" onClick={() => setOpen(false)}>{t("Loka")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------- company docs */
/** Shared company documents (handbooks …) — read-only for staff. */
export function CompanyDocsCard() {
  const { t } = useLang();
  const [docs, setDocs] = useState<CompanyDoc[]>([]);
  useEffect(() => { listCompanyDocs().then((r) => setDocs(r.docs)).catch(() => {}); }, []);
  if (!docs.length) return null;
  async function open(d: CompanyDoc) {
    const r = await openCompanyDoc(d.id);
    if (r.ok && r.url) window.open(r.url, "_blank");
  }
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ch"><div><div className="ct">{t("Skjöl fyrirtækisins")}</div><div className="cs">{t("handbækur og leiðbeiningar frá vinnuveitanda")}</div></div></div>
      <div className="cb att">
        {docs.map((d) => (
          <div className="it rowlink" key={d.id} onClick={() => open(d)}>
            <div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg></div>
            <div className="tx"><b>{d.name}</b><span>{d.created}</span></div>
            <span className="tag info">{t("Opna")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ shift tasks */
/** Today's shift checklist — set by the manager on the shift, ticked here. */
export function TasksCard({ initial }: { initial: { id: string; title: string; done: boolean }[] }) {
  const { t } = useLang();
  const [tasks, setTasks] = useState(initial);
  const doneCount = tasks.filter((x) => x.done).length;
  async function tick(id: string, done: boolean) {
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done } : x)));
    const res = await toggleShiftTask(id, done);
    if (!res.ok) { setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !done } : x))); toast(res.error ?? t("Villa")); }
  }
  if (!tasks.length) return null;
  return (
    <div className="mini">
      <div className="mh" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{t("Verkefni vaktarinnar")}</span>
        <span style={{ color: doneCount === tasks.length ? "var(--good)" : "var(--ink3)" }}>{doneCount}/{tasks.length}</span>
      </div>
      {tasks.map((task) => (
        <label key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, padding: "9px 0", cursor: "pointer", minHeight: 44 }}>
          <input type="checkbox" checked={task.done} onChange={(e) => tick(task.id, e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={task.done ? { textDecoration: "line-through", color: "var(--ink3)" } : undefined}>{task.title}</span>
        </label>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- request menu */
/** ONE "Beiðni" button per screen; the four request kinds live in its menu. */
export function RequestButton({ onReq }: { onReq: (k: ReqKind) => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const items: [ReqKind, string][] = [["leave", "Sækja um frí"], ["swap", "Skipta á vakt"], ["pickup", "Opnar vaktir"], ["avail", "Skrá framboð"]];
  return (
    <div style={{ position: "relative" }}>
      <button className="btn sm" onClick={() => setOpen((o) => !o)} style={{ minHeight: 40 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}><path d="M12 5v14M5 12h14" /></svg>{t("Beiðni")}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={() => setOpen(false)} />
          <div className="tmenu show" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, minWidth: 200 }}>
            {items.map(([k, label]) => (
              <div className="mi" key={k} style={{ minHeight: 44, display: "flex", alignItems: "center" }} onClick={() => { setOpen(false); onReq(k); }}>{t(label)}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------- worked hours */
export function MyHours({ canRequest }: { canRequest: boolean }) {
  const { t } = useLang();
  const [rows, setRows] = useState<MyPunchRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [corr, setCorr] = useState<{ punchId?: string; date: string } | null>(null);

  function load() {
    const now = new Date();
    const from = isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = isoOf(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    getMyPunches(from, to).then((r) => { if (r.ok) setRows(r.rows); setLoaded(true); });
  }
  useEffect(load, []);
  const total = rows.reduce((a, r) => a + r.hours, 0);

  return (
    <div className="mini" style={{ gridColumn: "1 / -1" }}>
      <div className="mh" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{t("Mínir unnir tímar · þessi mánuður")}</span>
        {canRequest && <button className="btn ghost sm" onClick={() => setCorr({ date: isoOf(new Date()) })}>{t("Óska eftir leiðréttingu")}</button>}
      </div>
      {!loaded ? <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Hleð…")}</div>
        : rows.length ? (
          <>
            {rows.map((p) => (
              <div className="mr" key={p.punchId} style={{ alignItems: "center" }}>
                <span>{niceISO(p.date)} · {p.in}–{p.out ?? t("opin")}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <b>{p.open ? "—" : `${dec1(p.hours)} ${t("klst")}`}</b>
                  {canRequest && <a style={{ color: "var(--brand)", fontWeight: 600, fontSize: 12, cursor: "pointer" }} onClick={() => setCorr({ punchId: p.punchId, date: p.date })}>{t("Leiðrétta")}</a>}
                </span>
              </div>
            ))}
            <div className="mr" style={{ borderTop: "1px solid var(--line2)", marginTop: 4, paddingTop: 8 }}><span style={{ fontWeight: 650 }}>{t("Samtals")}</span><b>{dec1(total)} {t("klst")}</b></div>
          </>
        ) : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Engar stimplanir í þessum mánuði enn.")}</div>}
      {corr && <CorrectionModal init={corr} onClose={() => setCorr(null)} onDone={() => { setCorr(null); load(); }} />}
    </div>
  );
}

function CorrectionModal({ init, onClose, onDone }: { init: { punchId?: string; date: string }; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [date, setDate] = useState(init.date);
  const [cin, setCin] = useState("");
  const [cout, setCout] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!reason.trim()) { toast(t("Skrifaðu stutta skýringu")); return; }
    setBusy(true);
    const res = await requestCorrection({ punchId: init.punchId, date, requestedIn: cin || undefined, requestedOut: cout || undefined, reason });
    setBusy(false);
    if (res.ok) { toast(t("Leiðréttingabeiðni send")); onDone(); } else toast(res.error ?? t("Villa"));
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Óska eftir leiðréttingu")}</div><div className="muted" style={{ fontSize: 12 }}>{t("t.d. gleymdi að stimpla inn eða út")}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <div className="field"><label>{t("Dagsetning")}</label><DateField value={date} onChange={setDate} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{t("Réttur tími inn")}</label><TimeField value={cin} onChange={setCin} style={{ width: "100%" }} /></div>
            <div className="field" style={{ flex: 1 }}><label>{t("Réttur tími út")}</label><TimeField value={cout} onChange={setCout} style={{ width: "100%" }} /></div>
          </div>
          <div className="field"><label>{t("Skýring")}</label><textarea className="lf-ta" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("t.d. gleymdi að stimpla út kl. 16")} /></div>
          <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
            <button className="btn" disabled={busy} onClick={send}>{t("Senda beiðni")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- pay */
/** Worked hours + the amount earned for them. The formal payslip comes from
 * the payroll system, so we don't duplicate it. */
export function PayCard({ my }: { my: MyArea }) {
  const { t } = useLang();
  const p = my.pay;
  return (
    <div className="mini">
      <div className="mh">{t("Unnir tímar — þessi mánuður")}</div>
      {p ? (p.monthly ? (
        <>
          <div className="mr"><span>{t("Mánaðarlaun (föst)")}</span><b>{nf(p.totalKr)} kr</b></div>
          <div className="mr"><span>{t("Unnir tímar")}</span><b>{dec1(p.totalH)} {t("klst")}</b></div>
        </>
      ) : (
        <>
          <div className="mr"><span>{t("Dagvinna")}</span><b>{dec1(p.dayH)} {t("klst")} · {nf(p.dayKr)} kr</b></div>
          <div className="mr"><span>{t("Álagstímar (kvöld/helgi)")}</span><b>{dec1(p.premH)} {t("klst")} · {nf(p.premKr)} kr</b></div>
          <div className="mr"><span>{t("Yfirvinna")}</span><b>{dec1(p.otH)} {t("klst")} · {nf(p.otKr)} kr</b></div>
          <div className="mr" style={{ borderTop: "1px solid var(--line)", marginTop: 3, paddingTop: 7 }}><span style={{ fontWeight: 650 }}>{t("Samtals unnið")}</span><b style={{ fontSize: 15 }}>{dec1(p.totalH)} {t("klst")} · {nf(p.totalKr)} kr</b></div>
        </>
      )) : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Engar stimplanir í þessum mánuði enn.")}</div>}
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "10px 0 0" }}>{t("Áætluð upphæð fyrir unna tíma á tímabilinu. Formlegur launaseðill kemur frá launakerfinu.")}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- rights */
export function RightsCard({ my }: { my: MyArea }) {
  const { t } = useLang();
  const r = my.rights;
  if (!r) {
    return (
      <div className="mini">
        <div className="mh">{t("Réttindi")}</div>
        <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Orlof, tímabanki og réttindi birtast þegar starfsmannaprófíll og stimplanir eru til staðar.")}</div>
      </div>
    );
  }
  const bankC = r.bank > 0.05 ? "var(--good)" : r.bank < -0.05 ? "var(--bad)" : undefined;
  return (
    <>
      <div className="mini">
        <div className="mh">{t("Orlof")} <span className="muted" style={{ fontWeight: 500 }}>· {t("áætlað")}</span></div>
        <div className="mr"><span>{t("Áunnir dagar (í ár)")}</span><b>{dec1(r.orlofDays)} {t("dagar")}</b></div>
        {r.orlofFund > 0 && <div className="mr"><span>{t("Orlofssjóður")}</span><b>{nf(r.orlofFund)} kr</b></div>}
      </div>
      <div className="mini">
        <div className="mh">{t("Tímabanki")}</div>
        <div className="mr"><span>{t("Vinnuskylda (mán)")}</span><b>{dec1(r.required)} {t("klst")}</b></div>
        <div className="mr"><span>{t("Unnið (þessi mán)")}</span><b>{dec1(r.worked)} {t("klst")}</b></div>
        <div className="mr"><span>{t("Staða banka")}</span><b style={bankC ? { color: bankC } : undefined}>{r.bank > 0 ? "+" : ""}{dec1(r.bank)} {t("klst")}</b></div>
        <div className="mr"><span>{t("Kjarasamningur")}</span><b>{r.union}</b></div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- profile */
export function ProfileCard({ photo, setPhoto, my, initials }: { photo: string | null; setPhoto: (s: string) => void; my: MyArea; initials?: string }) {
  const { t } = useLang();
  const p = my.profile;
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [email, setEmail] = useState(p?.email ?? "");
  const [bank, setBank] = useState(p?.bank ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await updateMyProfile({ phone, email, bankAccount: bank });
    setBusy(false);
    toast(res.ok ? t("Breytingar vistaðar") : (res.error ?? t("Tókst ekki")));
  }
  return (
    <div className="card"><div className="cb">
      <PhotoAvatar photo={photo} setPhoto={setPhoto} big initials={initials} />
      <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink3)", marginBottom: 18 }}>{t("Smelltu á myndina til að hlaða upp nýrri")}</p>
      {p && (
        <>
          <div className="emp-row2">
            <div className="emp-fld"><label>{t("Fullt nafn")}</label><input defaultValue={p.name} readOnly /></div>
            <div className="emp-fld"><label>{t("Kennitala")}</label><input defaultValue={p.kennitala} readOnly /></div>
          </div>
          <div className="emp-row2">
            <div className="emp-fld"><label>{t("prof:position")}</label><input defaultValue={p.position} readOnly /></div>
            <div className="emp-fld"><label>{t("Deild")}</label><input defaultValue={p.dept} readOnly /></div>
          </div>
        </>
      )}
      <div className="emp-row2">
        <div className="emp-fld"><label>{t("Sími")}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="emp-fld"><label>{t("Netfang")}</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div className="emp-fld"><label>{t("Bankareikningur (laun)")}</label><input value={bank} onChange={(e) => setBank(e.target.value)} /></div>
      {p && <div className="emp-fld"><label>{t("Kjarasamningur")}</label><input defaultValue={p.union} readOnly /></div>}
      {p && <p className="muted" style={{ fontSize: 11.5, margin: "2px 0 10px" }}>{t("Staða, deild og kjarasamningur eru skráð af stjórnanda — hafðu samband ef eitthvað er rangt.")}</p>}
      <button className="btn sm" style={{ width: "100%", justifyContent: "center", minHeight: 44 }} disabled={busy} onClick={save}>{t("Vista breytingar")}</button>
    </div></div>
  );
}

/* --------------------------------------------------------- request modal */
const CalIcon = () => <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>;

function PickupBody({ my }: { my: MyArea }) {
  const { t } = useLang();
  if (!my.openShifts.length) return <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t("Engar opnar vaktir í boði núna — kíktu aftur síðar.")}</p>;
  return (
    <div className="att">
      {my.openShifts.map((s) => (
        <div className="it" key={s.id}>
          <div className="ic info"><CalIcon /></div>
          <div className="tx"><b>{s.label} · {s.time}</b><span>{s.premium ? `${t("álag")} ${s.premium}` : t("dagvinna")}</span></div>
          <AsyncButton className="btn sm" onClick={async () => { const res = await applyForShift({ note: `${s.label} ${s.time}` }); toast(res.ok ? t("Umsókn send — bíður úthlutunar") : (res.error ?? t("Villa"))); }}>{t("Sækja um")}</AsyncButton>
        </div>
      ))}
    </div>
  );
}

export function ReqModal({ kind, onClose, my }: { kind: ReqKind; onClose: () => void; my: MyArea }) {
  const { t } = useLang();
  const todayISO = isoOf(new Date());
  const [leaveFrom, setLeaveFrom] = useState(todayISO);
  const [leaveTo, setLeaveTo] = useState(todayISO);
  const [leaveType, setLeaveType] = useState<LeaveType>("orlof");
  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const myShiftOptions = my.upcoming.map((s) => `${s.label} ${s.time}`);
  const [swapShift, setSwapShift] = useState(myShiftOptions[0] ?? "");
  const [swapWith, setSwapWith] = useState("");
  const [busy, setBusy] = useState(false);

  const titleIcon: Record<ReqKind, React.ReactNode> = {
    leave: <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></svg>,
    avail: <CalIcon />,
    swap: <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></svg>,
    pickup: <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></svg>,
  };
  const title: Record<ReqKind, string> = { leave: "Sækja um frí", avail: "Skrá framboð", swap: "Skipta á vakt", pickup: "Opnar vaktir" };
  const ok: Partial<Record<ReqKind, string>> = { leave: "Senda beiðni", avail: "Vista framboð", swap: "Senda beiðni" };
  const done: Record<ReqKind, string> = { leave: "req:leave:done", avail: "req:avail:done", swap: "req:swap:done", pickup: "" };

  async function submit() {
    setBusy(true);
    let res: { ok: boolean; error?: string } = { ok: true };
    if (kind === "leave") res = await submitLeaveRequest({ fromDate: leaveFrom, toDate: leaveTo, type: leaveType });
    else if (kind === "avail") res = await setAvailability({ weekdays: days.map((c, i) => (c ? i : -1)).filter((i) => i >= 0) });
    else if (kind === "swap") res = await requestShiftSwap({ note: swapShift, requesteeName: swapWith });
    setBusy(false);
    onClose();
    toast(res.ok ? t(done[kind]) : (res.error ?? t("Tókst ekki")));
  }

  let body: React.ReactNode;
  if (kind === "leave") {
    body = <>
      <div className="field"><label>{t("Frá")}</label><DateField value={leaveFrom} onChange={setLeaveFrom} /></div>
      <div className="field"><label>{t("Til")}</label><DateField value={leaveTo} onChange={setLeaveTo} min={leaveFrom || undefined} /></div>
      <div className="field"><label>{t("Tegund")}</label>
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
          <option value="orlof">{t("Orlof")}</option><option value="olaunad">{t("Frí (ólaunað)")}</option><option value="veikindi">{t("Veikindi")}</option>
        </select>
      </div>
    </>;
  } else if (kind === "avail") {
    body = <>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("Hakaðu við dagana sem þú getur unnið:")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"].map((d, i) => (
          <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px", minHeight: 44 }}>
            <input type="checkbox" checked={days[i]} onChange={(e) => setDays((ds) => ds.map((v, j) => (j === i ? e.target.checked : v)))} /> {t(d)}
          </label>
        ))}
      </div>
    </>;
  } else if (kind === "swap") {
    body = <>
      <div className="field"><label>{t("Vaktin þín")}</label>
        {myShiftOptions.length
          ? <select value={swapShift} onChange={(e) => setSwapShift(e.target.value)}>{myShiftOptions.map((o) => <option key={o}>{o}</option>)}</select>
          : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t("Engar vaktir á plani framundan.")}</p>}
      </div>
      <div className="field"><label>{t("Skipta við")}</label>
        <input value={swapWith} onChange={(e) => setSwapWith(e.target.value)} placeholder={t("Nafn samstarfsmanns (má sleppa)")} />
      </div>
    </>;
  } else {
    body = <PickupBody my={my} />;
  }

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{titleIcon[kind]} {t(title[kind])}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {body}
          {ok[kind] && (
            <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
              <button className="btn" disabled={busy || (kind === "swap" && !swapShift)} onClick={submit}>{t(ok[kind]!)}</button>
              <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ empty employee profile */
/** Signed in but no employee record is linked — say so honestly. */
export function NoEmployeeCard() {
  const { t } = useLang();
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="cb">
        <b style={{ display: "block", marginBottom: 6 }}>{t("Enginn starfsmannaprófíll tengdur")}</b>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t("Stjórnandi þarf að tengja netfangið þitt við starfsmann undir Starfsfólk. Þá birtast vaktir, stimplun og laun hér.")}</p>
      </div>
    </div>
  );
}
