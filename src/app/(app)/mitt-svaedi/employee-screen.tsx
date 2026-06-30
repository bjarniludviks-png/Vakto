"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { myPunch, submitLeaveRequest, requestShiftSwap, setAvailability, uploadPhoto, updateMyProfile, applyForShift, type LeaveType } from "./actions";
import { PayslipModal } from "@/components/app/payslip-modal";
import { StaffCardModal, type StaffCardData } from "@/components/app/staff-card";
import type { StaffCard } from "@/lib/mycard.server";

type ReqKind = "leave" | "avail" | "swap" | "pickup";
const TABS = [
  ["ov", "Yfirlit"], ["sh", "Mínar vaktir"], ["pay", "Laun"], ["ri", "Réttindi"], ["pr", "Prófíll"],
] as const;

export default function EmployeeScreen({ card }: { card?: StaffCard }) {
  const { t } = useLang();
  const [tab, setTab] = useState<string>("ov");
  const [photo, setPhoto] = useState<string | null>(null);
  const [req, setReq] = useState<ReqKind | null>(null);
  const [showCard, setShowCard] = useState(false);
  const cardData: StaffCardData = card
    ? { name: card.name, role: card.role, company: card.company, photoUrl: photo ?? card.photoUrl, idCode: card.idCode, initials: card.initials, color: card.color }
    : { name: "Mína Huong", role: "Vaktstjóri", company: "Kaffi Krónan", photoUrl: photo, idCode: "demo", initials: "MÍ", color: "#5b50e6" };

  return (
    <>
      <PageHeader title="Mitt svæði" subtitle="Vaktir, laun, réttindi og prófíll" />
      <div className="emparea">
        <div className="emp-head">
          <PhotoAvatar photo={photo} setPhoto={setPhoto} big={false} />
          <div style={{ flex: 1 }}><div className="emp-nm">{card?.name ?? "Mína Huong"}</div><div className="emp-meta">{card ? `${t(card.role)} · ${card.company}` : t("emp:meta")}</div></div>
          <button className="btn ghost sm" onClick={() => setShowCard(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M14 9h4M14 13h4M5 16h7" /></svg>{t("Skírteini")}
          </button>
        </div>

        <div className="emp-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`etab2${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{t(label)}</button>
          ))}
        </div>

        {tab === "ov" && <Overview onReq={setReq} />}
        {tab === "sh" && <MyShifts onReq={setReq} />}
        {tab === "pay" && <Pay />}
        {tab === "ri" && <Rights />}
        {tab === "pr" && <Profile photo={photo} setPhoto={setPhoto} />}
      </div>

      {req && <ReqModal kind={req} onClose={() => setReq(null)} />}
      {showCard && <StaffCardModal card={cardData} onClose={() => setShowCard(false)} />}
    </>
  );
}

function PhotoAvatar({ photo, setPhoto, big }: { photo: string | null; setPhoto: (s: string) => void; big: boolean }) {
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
      {!photo && <span className="ini">MÍ</span>}
      <input type="file" accept="image/*" hidden onChange={onChange} />
      <span className="cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg></span>
    </label>
  );
}

function PunchCard() {
  const { t } = useLang();
  const [on, setOn] = useState(true);
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState("04:18:22");
  useEffect(() => {
    if (startRef.current === 0) startRef.current = Date.now() - (4 * 3600 + 18 * 60 + 22) * 1000;
  }, []);
  useEffect(() => {
    const tick = () => {
      if (!on) { setElapsed("00:00:00"); return; }
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      const z = (n: number) => String(n).padStart(2, "0");
      setElapsed(`${z(Math.floor(s / 3600))}:${z(Math.floor((s % 3600) / 60))}:${z(s % 60)}`);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [on]);
  function toggle() {
    void myPunch(!on);
    if (!on) startRef.current = Date.now();
    setOn((o) => !o);
  }
  return (
    <div className={`punch${on ? "" : " out"}`}>
      <div className="st">{on ? t("Á vakt síðan 08:02") : t("Ekki á vakt")}</div>
      <div className="big">{elapsed}</div>
      <button onClick={toggle}>{on ? t("Stimpla út") : t("Stimpla inn")}</button>
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

function Overview({ onReq }: { onReq: (k: ReqKind) => void }) {
  const { t } = useLang();
  return (
    <div className="emp-pane on">
      <PunchCard />
      <div className="mini">
        <div className="mh">{t("Næsta vakt")}</div>
        <div className="mr"><span>Í dag · Mið 24. júní</span><b>08:00–16:00</b></div>
        <div className="mr"><span>Fim 25. júní</span><b>10:00–18:00</b></div>
        <div className="mr"><span>Lau 27. júní</span><b style={{ color: "var(--warn)" }}>12:00–20:00 +45%</b></div>
      </div>
      <div className="mini">
        <div className="mh">{t("Verkefni vaktarinnar")}</div>
        {[["Opna kassa & kveikja á græjum", true], ["Fylla á sósur og meðlæti", false], ["Þrífa grill fyrir lokun", false]].map((task, i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, padding: "6px 0" }}>
            <input type="checkbox" defaultChecked={task[1] as boolean} /> <span>{t(task[0] as string)}</span>
          </label>
        ))}
      </div>
      <QuickActions onReq={onReq} />
    </div>
  );
}

function MyShifts({ onReq }: { onReq: (k: ReqKind) => void }) {
  const { t } = useLang();
  return (
    <div className="emp-pane on">
      <div className="mini">
        <div className="mh">{t("Mitt vaktaplan · 22.–28. júní")}</div>
        <div className="mr"><span>Mán 22.</span><b className="muted">Frí</b></div>
        <div className="mr"><span>Þri 23.</span><b>14:00–22:00 <span style={{ color: "var(--warn)", fontWeight: 500 }}>+33%</span></b></div>
        <div className="mr"><span>Mið 24. <span style={{ color: "var(--brand)", fontWeight: 600 }}>· í dag</span></span><b>08:00–16:00</b></div>
        <div className="mr"><span>Fim 25.</span><b>10:00–18:00</b></div>
        <div className="mr"><span>Fös 26.</span><b className="muted">Frí</b></div>
        <div className="mr"><span>Lau 27.</span><b style={{ color: "var(--warn)" }}>12:00–20:00 +45%</b></div>
        <div className="mr"><span>Sun 28.</span><b className="muted">Frí</b></div>
      </div>
      <div className="mini">
        <div className="mh">{t("Samantekt")}</div>
        <div className="mr"><span>{t("Tímar vikunnar")}</span><b>32,0 {t("klst")}</b></div>
        <div className="mr"><span>{t("Tímar mánaðar (til þessa)")}</span><b>142,5 {t("klst")}</b></div>
        <div className="mr"><span>{t("Næsta útborgun")}</span><b>1. júlí</b></div>
      </div>
      <QuickActions onReq={onReq} />
    </div>
  );
}

function Pay() {
  const { t } = useLang();
  const [slip, setSlip] = useState(false);
  return (
    <div className="emp-pane on">
      <div className="mini">
        <div className="mh">{t("Laun — júní 2026 (áætlað)")}</div>
        <div className="mr"><span>{t("Unnir tímar")}</span><b>142,5 {t("klst")}</b></div>
        <div className="mr"><span>{t("Dagvinna")}</span><b>413.250 kr</b></div>
        <div className="mr"><span>{t("Álög (kvöld/helgi)")}</span><b>167.400 kr</b></div>
        <div className="mr"><span>{t("Yfirvinna")}</span><b>70.350 kr</b></div>
        <div className="mr" style={{ borderTop: "1px solid var(--line)", marginTop: 3, paddingTop: 7 }}><span>{t("Brúttó laun")}</span><b>651.000 kr</b></div>
        <div className="mr"><span className="muted">{t("Staðgreiðsla")}</span><b className="muted">−142.300 kr</b></div>
        <div className="mr"><span className="muted">{t("Lífeyrir 4% + félag 1%")}</span><b className="muted">−32.550 kr</b></div>
        <div className="mr"><span className="muted">{t("Persónuafsláttur")}</span><b className="muted">+68.691 kr</b></div>
        <div className="mr" style={{ borderTop: "1px solid var(--line)", marginTop: 3, paddingTop: 7 }}><span style={{ fontWeight: 650 }}>{t("Áætlað útborgað")}</span><b style={{ color: "var(--good)", fontSize: 15 }}>468.150 kr</b></div>
      </div>
      <div className="mini">
        <div className="mh">{t("Fyrri mánuðir (útborgað)")}</div>
        <div className="mr"><span>Maí 2026</span><b>451.300 kr</b></div>
        <div className="mr"><span>Apríl 2026</span><b>442.900 kr</b></div>
        <div className="mr"><span>Mars 2026</span><b>438.100 kr</b></div>
      </div>
      <button className="btn ghost sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setSlip(true)}>{t("Sækja launaseðil (PDF)")}</button>
      {slip && <PayslipModal onClose={() => setSlip(false)} data={{ name: "Mína Huong", period: "21. maí – 20. júní 2026", hours: "171,0", gross: "651.000", withholding: "142.300", pension: "32.550", net: "468.150" }} />}
    </div>
  );
}

function Rights() {
  const { t } = useLang();
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

function Profile({ photo, setPhoto }: { photo: string | null; setPhoto: (s: string) => void }) {
  const { t } = useLang();
  const [phone, setPhone] = useState("+354 691 2389");
  const [email, setEmail] = useState("mina@kaffikronan.is");
  const [bank, setBank] = useState("0133-26-001234");
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
          <div className="emp-fld"><label>{t("Fullt nafn")}</label><input defaultValue="Mína Huong" /></div>
          <div className="emp-fld"><label>{t("Kennitala")}</label><input defaultValue="010195-2389" /></div>
        </div>
        <div className="emp-row2">
          <div className="emp-fld"><label>{t("prof:position")}</label><input defaultValue="Kokkur" /></div>
          <div className="emp-fld"><label>{t("Deild")}</label><input defaultValue="Eldhús" /></div>
        </div>
        <div className="emp-row2">
          <div className="emp-fld"><label>{t("Sími")}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="emp-fld"><label>{t("Netfang")}</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="emp-fld"><label>{t("Bankareikningur (laun)")}</label><input value={bank} onChange={(e) => setBank(e.target.value)} /></div>
        <div className="emp-fld"><label>{t("Kjarasamningur")}</label><select><option>Efling</option><option>VR</option><option>SGS</option></select></div>
        <button className="btn sm" style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={save}>{t("Vista breytingar")}</button>
      </div></div>
    </div>
  );
}

function PickupBody() {
  const { t } = useLang();
  return (
    <div className="att">
      <div className="it"><div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg></div><div className="tx"><b>Laugardagur 12:00–20:00</b><span>Sal · +45% helgarálag</span></div><button className="btn sm" onClick={async () => { const res = await applyForShift({ note: "Laugardagur 12:00–20:00 · Sal" }); toast(res.ok ? "Umsókn send — bíður úthlutunar" : (res.error ?? "Villa")); }}>{t("Sækja um")}</button></div>
      <div className="it"><div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg></div><div className="tx"><b>Sunnudagur 10:00–18:00</b><span>Eldhús · +45%</span></div><button className="btn sm" onClick={async () => { const res = await applyForShift({ note: "Sunnudagur 10:00–18:00 · Eldhús" }); toast(res.ok ? "Umsókn send" : (res.error ?? "Villa")); }}>{t("Sækja um")}</button></div>
    </div>
  );
}

function ReqModal({ kind, onClose }: { kind: ReqKind; onClose: () => void }) {
  const { t } = useLang();
  const [leaveFrom, setLeaveFrom] = useState("2026-06-27");
  const [leaveTo, setLeaveTo] = useState("2026-06-28");
  const [leaveType, setLeaveType] = useState<LeaveType>("orlof");
  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [swapShift, setSwapShift] = useState("Laugardagur 12:00–20:00");
  const [swapWith, setSwapWith] = useState("Phong");
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
      <div className="field"><label>{t("Frá")}</label><input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} /></div>
      <div className="field"><label>{t("Til")}</label><input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} /></div>
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
        <select value={swapShift} onChange={(e) => setSwapShift(e.target.value)}><option>Laugardagur 12:00–20:00</option><option>Föstudagur 16:00–24:00</option></select>
      </div>
      <div className="field"><label>{t("Skipta við")}</label>
        <select value={swapWith} onChange={(e) => setSwapWith(e.target.value)}><option>Phong</option><option>Bach</option><option>Ha Vu</option></select>
      </div>
    </>;
  } else {
    body = <PickupBody />;
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
