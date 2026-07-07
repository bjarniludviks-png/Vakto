"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { TimeField, DateField } from "@/components/app/fields";
import { myPunch, submitLeaveRequest, requestShiftSwap, setAvailability, uploadPhoto, updateMyProfile, applyForShift, getMyPunches, requestCorrection, type LeaveType, type MyPunchRow } from "./actions";
import { dec1, nf } from "@/lib/format";
import { StaffCardModal, type StaffCardData } from "@/components/app/staff-card";
import type { StaffCard } from "@/lib/mycard.server";
import type { MyArea } from "./my.server";
import { resolvePerms, type Perms } from "@/lib/permissions";
import PushToggle from "@/components/app/push-toggle";
import { AsyncButton } from "@/components/app/async-button";
import { WalletButtons } from "@/components/app/wallet-buttons";

type ReqKind = "leave" | "avail" | "swap" | "pickup";
const IC = (d: string) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>;
const NAV: [string, string, React.ReactNode][] = [
  ["ov", "Yfirlit", IC("M3 12l9-9 9 9|M5 10v10h14V10")],
  ["sh", "Mínar vaktir", IC("M8 2v4M16 2v4|M3 9h18|M3 5h18v16H3z")],
  ["pay", "Laun", IC("M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6")],
  ["ri", "Réttindi", IC("M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z")],
  ["pr", "Prófíll", IC("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7")],
];

export default function EmployeeScreen({ card, my: myProp }: { card?: StaffCard; my?: MyArea }) {
  const { t } = useLang();
  const [tab, setTab] = useState<string>("ov");
  const [photo, setPhoto] = useState<string | null>(card?.photoUrl ?? null);
  // Signed-in user WITHOUT an employee profile (e.g. owner-only account): never
  // show demo data — synthesize an empty live state from the card instead.
  const my: MyArea | undefined = myProp?.live
    ? myProp
    : card?.live
      ? {
        live: true, openSince: null, weekLabel: "", days: [], upcoming: [], weekHours: 0,
        nextPayday: "", pay: null, rights: null, openShifts: [],
        profile: { name: card.name, kennitala: card.employeeKt ?? "", position: card.role, dept: card.department ?? "", phone: "", email: "", bank: "", union: "" },
      }
      : myProp;
  const [req, setReq] = useState<ReqKind | null>(null);
  const [showCard, setShowCard] = useState(false);
  const perms = card?.perms ?? resolvePerms();
  const cardData: StaffCardData = card
    ? { name: card.name, role: card.role, department: card.department, company: card.company, photoUrl: photo ?? card.photoUrl, idCode: card.idCode, initials: card.initials, color: card.color, employeeKt: card.employeeKt, companyKt: card.companyKt }
    : { name: "Mína Huong", role: "Kokkur", department: "Eldhús", company: "Kaffi Krónan", photoUrl: photo, idCode: "demo", initials: "MÍ", color: "#5b50e6", employeeKt: "010190-2389", companyKt: "550101-2210" };

  return (
    <>
      <PageHeader title="Mitt svæði" subtitle="Vaktir, laun, réttindi og prófíll" />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="cb" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <PhotoAvatar photo={photo} setPhoto={setPhoto} big={false} initials={cardData.initials} />
          <div style={{ flex: 1, minWidth: 0 }}><div className="emp-nm">{card?.name ?? "Mína Huong"}</div><div className="emp-meta">{card ? `${t(card.role)} · ${card.company}` : t("emp:meta")}</div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <PushToggle />
            {perms.card && <button className="btn ghost sm" onClick={() => setShowCard(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M14 9h4M14 13h4M5 16h7" /></svg>{t("Skírteini")}
            </button>}
          </div>
        </div>
      </div>

      <div className="settabs">
        {NAV.filter(([id]) => (id !== "pay" || perms.pay) && (id !== "sh" || perms.shifts)).map(([id, label]) => (
          <button key={id} className={`etab2${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{t(label)}</button>
        ))}
      </div>

      <div>
        {tab === "ov" && <Overview onReq={setReq} perms={perms} my={my} />}
        {tab === "sh" && perms.shifts && <MyShifts onReq={setReq} perms={perms} my={my} />}
        {tab === "pay" && perms.pay && <Pay my={my} />}
        {tab === "ri" && <Rights my={my} />}
        {tab === "pr" && <Profile photo={photo} setPhoto={setPhoto} my={my} />}
      </div>

      {req && <ReqModal kind={req} onClose={() => setReq(null)} my={my} />}
      {showCard && <StaffCardModal card={cardData} onClose={() => setShowCard(false)} />}
    </>
  );
}

function PhotoAvatar({ photo, setPhoto, big, initials = "MÍ" }: { photo: string | null; setPhoto: (s: string) => void; big: boolean; initials?: string }) {
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhoto(dataUrl); // optimistic preview
      const res = await uploadPhoto(dataUrl);
      toast(res.ok ? "Prófílmynd uppfærð" : (res.error ?? "Tókst ekki að hlaða mynd"));
    };
    r.readAsDataURL(f);
  }
  const style = photo ? { backgroundImage: `url(${photo})` } : undefined;
  return (
    <label className={big ? "emp-ava-lg" : "emp-ava"} style={{ cursor: "pointer", ...style }} title="Smelltu til að hlaða mynd af þér">
      {!photo && <span className="ini">{initials}</span>}
      <input type="file" accept="image/*" hidden onChange={onChange} />
      <span className="cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg></span>
    </label>
  );
}

function PunchCard({ live = false, openSince = null }: { live?: boolean; openSince?: string | null }) {
  const { t } = useLang();
  // Live: real open-punch state from Supabase. Demo: illustrative running shift.
  const [on, setOn] = useState(live ? !!openSince : true);
  const [since, setSince] = useState(live && openSince ? openSince.slice(11, 16) : "08:02");
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState("00:00:00");
  useEffect(() => {
    if (startRef.current !== 0) return;
    if (live) startRef.current = openSince ? new Date(openSince).getTime() : 0;
    else startRef.current = Date.now() - (4 * 3600 + 18 * 60 + 22) * 1000;
  }, [live, openSince]);
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
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    if (next) {
      startRef.current = Date.now();
      const d = new Date();
      setSince(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
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

function QuickActions({ onReq }: { onReq: (k: ReqKind) => void }) {
  const { t } = useLang();
  return (
    <div className="emp-qa">
      <button className="btn sm" onClick={() => onReq("leave")}>{t("Sækja um frí")}</button>
      <button className="btn ghost sm" onClick={() => onReq("swap")}>{t("Skipta á vakt")}</button>
      <button className="btn ghost sm" onClick={() => onReq("pickup")}>{t("Opnar vaktir")}</button>
      <button className="btn ghost sm" onClick={() => onReq("avail")}>{t("Skrá framboð")}</button>
    </div>
  );
}

function Overview({ onReq, perms, my }: { onReq: (k: ReqKind) => void; perms: Perms; my?: MyArea }) {
  const { t } = useLang();
  const live = !!my?.live;
  return (
    <div className="emp-pane on">
      {perms.clock && <PunchCard live={live} openSince={my?.openSince ?? null} />}
      <div className="mini">
        <div className="mh">{t("Næsta vakt")}</div>
        {live ? (
          my!.upcoming.length ? my!.upcoming.map((s, i) => (
            <div className="mr" key={i}>
              <span>{s.label}</span>
              <b style={s.premium ? { color: "var(--warn)" } : undefined}>{s.time}{s.premium ? ` ${s.premium}` : ""}</b>
            </div>
          )) : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Engar vaktir á plani framundan.")}</div>
        ) : (
          <>
            <div className="mr"><span>Í dag · Mið 24. júní</span><b>08:00–16:00</b></div>
            <div className="mr"><span>Fim 25. júní</span><b>10:00–18:00</b></div>
            <div className="mr"><span>Lau 27. júní</span><b style={{ color: "var(--warn)" }}>12:00–20:00 +45%</b></div>
          </>
        )}
      </div>
      {!live && (
        <div className="mini">
          <div className="mh">{t("Verkefni vaktarinnar")}</div>
          {[["Opna kassa & kveikja á græjum", true], ["Fylla á sósur og meðlæti", false], ["Þrífa grill fyrir lokun", false]].map((task, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, padding: "6px 0" }}>
              <input type="checkbox" defaultChecked={task[1] as boolean} /> <span>{t(task[0] as string)}</span>
            </label>
          ))}
        </div>
      )}
      {perms.requests && <QuickActions onReq={onReq} />}
    </div>
  );
}

function MyShifts({ onReq, perms, my }: { onReq: (k: ReqKind) => void; perms: Perms; my?: MyArea }) {
  const { t } = useLang();
  const live = !!my?.live;
  return (
    <div className="emp-pane on">
      <div className="mini">
        <div className="mh">{t("Mitt vaktaplan")}{(live ? my!.weekLabel : "22.–28. júní") ? ` · ${live ? my!.weekLabel : "22.–28. júní"}` : ""}</div>
        {live && !my!.days.length && <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Vaktaplan birtist hér þegar vaktir eru birtar á þig.")}</div>}
        {live ? my!.days.map((d, i) => (
          <div className="mr" key={i}>
            <span>{d.label}{d.today && <span style={{ color: "var(--brand)", fontWeight: 600 }}> · {t("í dag")}</span>}</span>
            {d.time
              ? <b style={d.premium ? { color: "var(--warn)" } : undefined}>{d.time}{d.premium ? ` ${d.premium}` : ""}</b>
              : <b className="muted">{t("Frí")}</b>}
          </div>
        )) : (
          <>
            <div className="mr"><span>Mán 22.</span><b className="muted">Frí</b></div>
            <div className="mr"><span>Þri 23.</span><b>14:00–22:00 <span style={{ color: "var(--warn)", fontWeight: 500 }}>+33%</span></b></div>
            <div className="mr"><span>Mið 24. <span style={{ color: "var(--brand)", fontWeight: 600 }}>· í dag</span></span><b>08:00–16:00</b></div>
            <div className="mr"><span>Fim 25.</span><b>10:00–18:00</b></div>
            <div className="mr"><span>Fös 26.</span><b className="muted">Frí</b></div>
            <div className="mr"><span>Lau 27.</span><b style={{ color: "var(--warn)" }}>12:00–20:00 +45%</b></div>
            <div className="mr"><span>Sun 28.</span><b className="muted">Frí</b></div>
          </>
        )}
      </div>
      <div className="mini">
        <div className="mh">{t("Samantekt")}</div>
        <div className="mr"><span>{t("Tímar vikunnar")}</span><b>{live ? dec1(my!.weekHours) : "32,0"} {t("klst")}</b></div>
        <div className="mr"><span>{t("Næsta útborgun")}</span><b>{live ? (my!.nextPayday || "—") : "1. júlí"}</b></div>
      </div>
      <MyHours canRequest={perms.requests} />
      {perms.requests && <QuickActions onReq={onReq} />}
    </div>
  );
}

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };

function MyHours({ canRequest }: { canRequest: boolean }) {
  const { t } = useLang();
  const [rows, setRows] = useState<MyPunchRow[]>([]);
  const [live, setLive] = useState(false);
  const [corr, setCorr] = useState<{ punchId?: string; date: string } | null>(null);

  function load() {
    const now = new Date();
    const from = isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = isoOf(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    getMyPunches(from, to).then((r) => { if (r.ok) { setRows(r.rows); setLive(true); } });
  }
  useEffect(load, []);
  const total = rows.reduce((a, r) => a + r.hours, 0);

  return (
    <div className="mini" style={{ gridColumn: "1 / -1" }}>
      <div className="mh" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{t("Mínir unnir tímar · þessi mánuður")}</span>
        {canRequest && <button className="btn ghost sm" onClick={() => setCorr({ date: isoOf(new Date()) })}>{t("Óska eftir leiðréttingu")}</button>}
      </div>
      {live ? (rows.length ? (
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
      ) : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Engar stimplanir í þessum mánuði enn.")}</div>)
        : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Stimplanir birtast hér þegar þú stimplar inn/út.")}</div>}
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
    if (!reason.trim()) { toast("Skrifaðu stutta skýringu"); return; }
    setBusy(true);
    const res = await requestCorrection({ punchId: init.punchId, date, requestedIn: cin || undefined, requestedOut: cout || undefined, reason });
    setBusy(false);
    if (res.ok) { toast(res.demo ? "Beiðni skráð (demo)" : "Leiðréttingabeiðni send"); onDone(); } else toast(res.error ?? "Villa");
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

// Simplified "Mín launamál" — worked hours + the amount earned for them. The formal
// payslip (and payment history) comes from Payday, so we don't duplicate it here.
function Pay({ my }: { my?: MyArea }) {
  const { t } = useLang();
  const live = !!my?.live;
  const p = my?.pay ?? null;
  return (
    <div className="emp-pane on">
      <div className="mini">
        <div className="mh">{t("Unnir tímar — þessi mánuður")}</div>
        {live ? (
          p ? (p.monthly ? (
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
          )) : <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Engar stimplanir í þessum mánuði enn.")}</div>
        ) : (
          <>
            <div className="mr"><span>{t("Dagvinna")}</span><b>118,0 {t("klst")} · 342.200 kr</b></div>
            <div className="mr"><span>{t("Álagstímar (kvöld/helgi)")}</span><b>18,5 {t("klst")} · 78.400 kr</b></div>
            <div className="mr"><span>{t("Yfirvinna")}</span><b>6,0 {t("klst")} · 30.400 kr</b></div>
            <div className="mr" style={{ borderTop: "1px solid var(--line)", marginTop: 3, paddingTop: 7 }}><span style={{ fontWeight: 650 }}>{t("Samtals unnið")}</span><b style={{ fontSize: 15 }}>142,5 {t("klst")} · 451.000 kr</b></div>
          </>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{t("Áætluð upphæð fyrir unna tíma á tímabilinu. Formlegur launaseðill kemur frá Payday.")}</p>
    </div>
  );
}

function Rights({ my }: { my?: MyArea }) {
  const { t } = useLang();
  const r = my?.live ? my.rights : null;
  if (my?.live && !r) {
    return (
      <div className="emp-pane on">
        <div className="mini">
          <div className="mh">{t("Réttindi")}</div>
          <div className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>{t("Orlof, tímabanki og réttindi birtast þegar starfsmannaprófíll og stimplanir eru til staðar.")}</div>
        </div>
      </div>
    );
  }
  if (r) {
    const bankC = r.bank > 0.05 ? "var(--good)" : r.bank < -0.05 ? "var(--bad)" : undefined;
    return (
      <div className="emp-pane on">
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
        </div>
        <div className="mini">
          <div className="mh">{t("Réttindi")}</div>
          <div className="mr"><span>{t("Kjarasamningur")}</span><b>{r.union}</b></div>
          <div className="mr"><span>{t("Hvíldartími (11 klst)")}</span><b style={{ color: "var(--good)" }}>{t("Í lagi")}</b></div>
        </div>
      </div>
    );
  }
  return (
    <div className="emp-pane on">
      <div className="mini">
        <div className="mh">{t("Orlof")}</div>
        <div className="mr"><span>{t("Áunnir dagar")}</span><b>11,4 {t("dagar")}</b></div>
        <div className="mr"><span>{t("Nýttir í ár")}</span><b>5,0 {t("dagar")}</b></div>
        <div className="mr"><span>{t("Orlofssjóður")}</span><b>66.200 kr</b></div>
      </div>
      <div className="mini">
        <div className="mh">{t("Tímabanki")}</div>
        <div className="mr"><span>{t("Vinnuskylda (mán)")}</span><b>162 {t("klst")}</b></div>
        <div className="mr"><span>{t("Unnið")}</span><b>171 {t("klst")}</b></div>
        <div className="mr"><span>{t("Staða banka")}</span><b style={{ color: "var(--good)" }}>+9,0 {t("klst")}</b></div>
      </div>
      <div className="mini">
        <div className="mh">{t("Veikindi & réttindi")}</div>
        <div className="mr"><span>{t("Veikindadagar nýttir")}</span><b>3 af 24</b></div>
        <div className="mr"><span>{t("Starfshlutfall")}</span><b style={{ color: "var(--warn)" }}>118%</b></div>
        <div className="mr"><span>{t("Hvíldartími (11 klst)")}</span><b style={{ color: "var(--good)" }}>{t("Í lagi")}</b></div>
        <div className="mr"><span>{t("Kjarasamningur")}</span><b>Efling</b></div>
      </div>
    </div>
  );
}

function Profile({ photo, setPhoto, my }: { photo: string | null; setPhoto: (s: string) => void; my?: MyArea }) {
  const { t } = useLang();
  const p = my?.live ? my.profile : null;
  const [phone, setPhone] = useState(p ? p.phone : "+354 691 2389");
  const [email, setEmail] = useState(p ? p.email : "mina@kaffikronan.is");
  const [bank, setBank] = useState(p ? p.bank : "0133-26-001234");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await updateMyProfile({ phone, email, bankAccount: bank });
    setBusy(false);
    toast(res.ok ? "Breytingar vistaðar" : (res.error ?? "Tókst ekki"));
  }
  return (
    <div className="emp-pane on">
      <div className="card"><div className="cb">
        <PhotoAvatar photo={photo} setPhoto={setPhoto} big />
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink3)", marginBottom: 18 }}>{t("Smelltu á myndina til að hlaða upp nýrri")}</p>
        <div className="emp-row2">
          <div className="emp-fld"><label>{t("Fullt nafn")}</label><input defaultValue={p ? p.name : "Mína Huong"} readOnly={!!p} /></div>
          <div className="emp-fld"><label>{t("Kennitala")}</label><input defaultValue={p ? p.kennitala : "010195-2389"} readOnly={!!p} /></div>
        </div>
        <div className="emp-row2">
          <div className="emp-fld"><label>{t("prof:position")}</label><input defaultValue={p ? p.position : "Kokkur"} readOnly={!!p} /></div>
          <div className="emp-fld"><label>{t("Deild")}</label><input defaultValue={p ? p.dept : "Eldhús"} readOnly={!!p} /></div>
        </div>
        <div className="emp-row2">
          <div className="emp-fld"><label>{t("Sími")}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="emp-fld"><label>{t("Netfang")}</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="emp-fld"><label>{t("Bankareikningur (laun)")}</label><input value={bank} onChange={(e) => setBank(e.target.value)} /></div>
        <div className="emp-fld"><label>{t("Kjarasamningur")}</label>
          {p
            ? <input defaultValue={p.union} readOnly />
            : <select><option>Efling</option><option>VR</option><option>SGS</option></select>}
        </div>
        {p && <p className="muted" style={{ fontSize: 11.5, margin: "2px 0 10px" }}>{t("Staða, deild og kjarasamningur eru skráð af stjórnanda — hafðu samband ef eitthvað er rangt.")}</p>}
        <button className="btn sm" style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={save}>{t("Vista breytingar")}</button>
      </div></div>
      <WalletButtons />
    </div>
  );
}

const CalIcon = () => <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>;

function PickupBody({ my }: { my?: MyArea }) {
  const { t } = useLang();
  if (my?.live) {
    if (!my.openShifts.length) return <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t("Engar opnar vaktir í boði núna — kíktu aftur síðar.")}</p>;
    return (
      <div className="att">
        {my.openShifts.map((s) => (
          <div className="it" key={s.id}>
            <div className="ic info"><CalIcon /></div>
            <div className="tx"><b>{s.label} · {s.time}</b><span>{s.premium ? `${t("álag")} ${s.premium}` : t("dagvinna")}</span></div>
            <AsyncButton className="btn sm" onClick={async () => { const res = await applyForShift({ note: `${s.label} ${s.time}` }); toast(res.ok ? "Umsókn send — bíður úthlutunar" : (res.error ?? "Villa")); }}>{t("Sækja um")}</AsyncButton>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="att">
      <div className="it"><div className="ic info"><CalIcon /></div><div className="tx"><b>Laugardagur 12:00–20:00</b><span>Sal · +45% helgarálag</span></div><AsyncButton className="btn sm" onClick={async () => { const res = await applyForShift({ note: "Laugardagur 12:00–20:00 · Sal" }); toast(res.ok ? "Umsókn send — bíður úthlutunar" : (res.error ?? "Villa")); }}>{t("Sækja um")}</AsyncButton></div>
      <div className="it"><div className="ic info"><CalIcon /></div><div className="tx"><b>Sunnudagur 10:00–18:00</b><span>Eldhús · +45%</span></div><AsyncButton className="btn sm" onClick={async () => { const res = await applyForShift({ note: "Sunnudagur 10:00–18:00 · Eldhús" }); toast(res.ok ? "Umsókn send" : (res.error ?? "Villa")); }}>{t("Sækja um")}</AsyncButton></div>
    </div>
  );
}

function ReqModal({ kind, onClose, my }: { kind: ReqKind; onClose: () => void; my?: MyArea }) {
  const { t } = useLang();
  const todayISO = new Date().toISOString().slice(0, 10);
  const [leaveFrom, setLeaveFrom] = useState(todayISO);
  const [leaveTo, setLeaveTo] = useState(todayISO);
  const [leaveType, setLeaveType] = useState<LeaveType>("orlof");
  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const myShiftOptions = my?.live && my.upcoming.length
    ? my.upcoming.map((s) => `${s.label} ${s.time}`)
    : ["Laugardagur 12:00–20:00", "Föstudagur 16:00–24:00"];
  const [swapShift, setSwapShift] = useState(myShiftOptions[0]);
  const [swapWith, setSwapWith] = useState("");
  const [busy, setBusy] = useState(false);

  const titleIcon: Record<ReqKind, React.ReactNode> = {
    leave: <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" /></svg>,
    avail: <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>,
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
    toast(res.ok ? t(done[kind]) : (res.error ?? "Tókst ekki"));
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
          <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, border: "1px solid var(--line)", borderRadius: 9, padding: "7px 11px" }}>
            <input type="checkbox" checked={days[i]} onChange={(e) => setDays((ds) => ds.map((v, j) => (j === i ? e.target.checked : v)))} /> {t(d)}
          </label>
        ))}
      </div>
    </>;
  } else if (kind === "swap") {
    body = <>
      <div className="field"><label>{t("Vaktin þín")}</label>
        <select value={swapShift} onChange={(e) => setSwapShift(e.target.value)}>{myShiftOptions.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      <div className="field"><label>{t("Skipta við")}</label>
        {my?.live
          ? <input value={swapWith} onChange={(e) => setSwapWith(e.target.value)} placeholder={t("Nafn samstarfsmanns (má sleppa)")} />
          : <select value={swapWith} onChange={(e) => setSwapWith(e.target.value)}><option>Phong</option><option>Bach</option><option>Ha Vu</option></select>}
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
              <button className="btn" disabled={busy} onClick={submit}>{t(ok[kind]!)}</button>
              <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
