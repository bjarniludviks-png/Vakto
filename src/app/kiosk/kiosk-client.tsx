"use client";

import { useEffect, useRef, useState } from "react";
import { kioskPunch, kioskPunchByPin, type KioskData } from "./actions";

type Emp = { id: string; initials: string; name: string; color: string };

// Demo employees (with PINs) — only used for the unbound /kiosk preview.
const DEMO: [string, string, string, boolean, string, string][] = [
  ["MÍ", "Mína Huong", "#e9700f", true, "08:02", "4731"],
  ["BA", "Bach Luu", "#1f9d6b", false, "—", "2208"],
  ["PH", "Phong Ha", "#0891b2", true, "07:56", "9054"],
  ["ÓM", "Ómar S.", "#d8483a", false, "—", "1190"],
  ["HA", "Ha Vu", "#7c6ff2", true, "09:01", "6677"],
  ["JÓ", "Jón G.", "#db2777", false, "—", "8080"],
];

const DEMO_PIN: Record<string, string> = Object.fromEntries(DEMO.map((e) => [e[1], e[5]]));
const z = (n: number) => String(n).padStart(2, "0");

type Lang = "is" | "en";
const WD: Record<Lang, string[]> = {
  is: ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MO: Record<Lang, string[]> = {
  is: ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const STR = {
  is: {
    title: "Stimpilklukka", tap: "Smelltu á nafnið þitt til að stimpla inn eða út.",
    onShift: "Á vakt", offShift: "Ekki á vakt", err: "Villa",
    noStaff: "Engir starfsmenn skráðir enn — bættu við starfsfólki í appinu.",
    enterPin: "Sláðu inn 4-stafa kóðann þinn", wrong: "Rangur kóði — reyndu aftur", cancel: "Hætta",
    onSince: (tm: string) => `Á vakt síðan ${tm} — sláðu inn kóða til að stimpla út`,
    hintReal: "Kóðinn þinn = síðustu 4 tölurnar í kennitölunni þinni.",
    demoFor: (n: string) => `Demo-kóði fyrir ${n}: `,
    foot: "VAKTO · Stimpilklukka — opnaðu þessa síðu á sameiginlegri spjaldtölvu á vinnustaðnum.",
    stamped: (n: string, into: boolean) => `${n} stimplaði ${into ? "inn" : "út"}`,
    at: (tm: string, into: boolean) => `kl. ${tm}${into ? " · Góða vakt!" : " · Takk fyrir daginn!"}`,
    notFound: "Kiosk fannst ekki", notFoundSub: "Þetta fyrirtæki fannst ekki. Sæktu rétta kiosk-slóð í Stillingum → Kiosk.",
    date: (d: Date) => `${WD.is[d.getDay()]} ${d.getDate()}. ${MO.is[d.getMonth()]} ${d.getFullYear()}`,
  },
  en: {
    title: "Time clock", tap: "Tap your name to clock in or out.",
    onShift: "On shift", offShift: "Off shift", err: "Error",
    noStaff: "No employees yet — add staff in the app.",
    enterPin: "Enter your 4-digit code", wrong: "Wrong code — try again", cancel: "Cancel",
    onSince: (tm: string) => `On shift since ${tm} — enter your code to clock out`,
    hintReal: "Your code = the last 4 digits of your kennitala.",
    demoFor: (n: string) => `Demo code for ${n}: `,
    foot: "VAKTO · Time clock — open this page on a shared tablet at the workplace.",
    stamped: (n: string, into: boolean) => `${n} clocked ${into ? "in" : "out"}`,
    at: (tm: string, into: boolean) => `at ${tm}${into ? " · Have a great shift!" : " · Thanks for today!"}`,
    notFound: "Kiosk not found", notFoundSub: "This company wasn't found. Get the correct kiosk link in Settings → Kiosk.",
    date: (d: Date) => `${WD.en[d.getDay()]} ${d.getDate()} ${MO.en[d.getMonth()]} ${d.getFullYear()}`,
  },
} as const;

export default function KioskClient({ companyId, data }: { companyId: string | null; data: KioskData | null }) {
  const real = !!data;
  const emps: Emp[] = real
    ? data!.employees.map((e) => ({ id: e.id, initials: e.initials, name: e.name, color: e.color }))
    : DEMO.map((e) => ({ id: e[1], initials: e[0], name: e[1], color: e[2] }));

  const [now, setNow] = useState<Date | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    real ? Object.fromEntries(data!.employees.map((e) => [e.id, e.on]))
      : Object.fromEntries(DEMO.map((e) => [e[1], e[3]])));
  const [inTime, setInTime] = useState<Record<string, string>>(() =>
    real ? Object.fromEntries(data!.employees.map((e) => [e.id, e.inTime]))
      : Object.fromEntries(DEMO.map((e) => [e[1], e[4]])));
  const [cur, setCur] = useState<Emp | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<null | { name: string; into: boolean; tm: string }>(null);
  const [lang, setLang] = useState<Lang>("is");
  const s = STR[lang];
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("vakto-kiosk-lang");
    if (saved === "en" || saved === "is") setLang(saved);
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(t); };
  }, []);
  function pickLang(l: Lang) { setLang(l); try { localStorage.setItem("vakto-kiosk-lang", l); } catch { /* ignore */ } }

  function open(e: Emp) { setCur(e); setPin(""); setErr(""); setShake(false); }
  function close() { setCur(null); setPin(""); setBusy(false); }
  function key(d: string) {
    if (!cur || pin.length >= 4 || busy) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 4) setTimeout(() => check(np), 140);
  }
  function del() { setErr(""); setPin((p) => p.slice(0, -1)); }

  function wrong() {
    setShake(true);
    setErr(s.wrong);
    setTimeout(() => { setPin(""); setShake(false); }, 650);
  }
  async function check(np: string) {
    if (!cur) return;
    if (real) {
      setBusy(true);
      const res = await kioskPunchByPin(companyId!, cur.id, np);
      setBusy(false);
      if (!res.ok) { setErr(res.error ?? s.err); setShake(true); setTimeout(() => { setPin(""); setShake(false); }, 650); return; }
      finish(cur, !!res.into, res.time ?? nowHM());
    } else {
      if (np === DEMO_PIN[cur.name]) finish(cur, !on[cur.id], nowHM());
      else wrong();
    }
  }
  function nowHM() { const t = new Date(); return `${z(t.getHours())}:${z(t.getMinutes())}`; }
  function finish(e: Emp, into: boolean, tm: string) {
    if (!real) void kioskPunch(e.name, into);
    setOn((s) => ({ ...s, [e.id]: into }));
    if (into) setInTime((s) => ({ ...s, [e.id]: tm }));
    close();
    setFlash({ name: e.name, into, tm });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2100);
  }

  const time = now ? `${z(now.getHours())}:${z(now.getMinutes())}:${z(now.getSeconds())}` : "--:--:--";
  const date = now ? s.date(now) : "";
  const coName = data?.company ?? "Kaffi Krónan";

  // Bound to a company that wasn't found.
  if (companyId && !data) {
    return (
      <div className="wrap" style={{ textAlign: "center", paddingTop: 80 }}>
        <h1>{s.notFound}</h1>
        <div className="sub">{s.notFoundSub}</div>
      </div>
    );
  }

  const LangToggle = () => (
    <div className="klang">
      {(["is", "en"] as Lang[]).map((l) => (
        <button key={l} className={lang === l ? "on" : ""} onClick={() => pickLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );

  return (
    <>
      <div className="top">
        <div className="brand">
          <div className="m">
            <svg viewBox="0 0 28 28" fill="none">
              <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
              <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
              <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
            </svg>
          </div>
          <b>VAKTO</b>
        </div>
        <div className="co">{coName}</div>
        <div className="sp" />
        <LangToggle />
        <div className="clock"><div className="t">{time}</div><div className="d">{date}</div></div>
      </div>

      <div className="wrap">
        <h1>{s.title}</h1>
        <div className="sub">{s.tap}</div>
        {real && emps.length === 0 && (
          <div className="sub" style={{ marginTop: 20 }}>{s.noStaff}</div>
        )}
        <div className="grid">
          {emps.map((e) => {
            const isOn = on[e.id];
            return (
              <div className="tile" key={e.id} onClick={() => open(e)}>
                <div className="av" style={{ background: e.color }}>{e.initials}</div>
                <div className="nm">{e.name}</div>
                <div className={`st ${isOn ? "in" : "out"}`}>{isOn ? s.onShift : s.offShift}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="foot">
        {s.foot}
      </div>

      {cur && (
        <div className="ov show" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="card">
            <div className="av" style={{ background: cur.color }}>{cur.initials}</div>
            <div className="nm">{cur.name}</div>
            <div className="cur">
              {on[cur.id] ? s.onSince(inTime[cur.id]) : s.enterPin}
            </div>
            <div className={`dots${shake ? " shake" : ""}`}>
              {[0, 1, 2, 3].map((i) => <span key={i} className={`dot${i < pin.length ? " f" : ""}`} />)}
            </div>
            <div className="pin-err">{err}</div>
            <div className="pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} onClick={() => key(String(d))}>{d}</button>)}
              <button className="muted" onClick={close}>{s.cancel}</button>
              <button onClick={() => key("0")}>0</button>
              <button className="muted" onClick={del}>⌫</button>
            </div>
            <div className="hint">
              {real
                ? s.hintReal
                : <>{s.demoFor(cur.name.split(" ")[0])}<b>{DEMO_PIN[cur.name]}</b></>}
            </div>
          </div>
        </div>
      )}

      {flash && (
        <div className="flash show">
          <div className="fc">
            <div className={`ring ${flash.into ? "in" : "out"}`}>
              <svg viewBox="0 0 24 24" fill="none">
                {flash.into ? <path d="M5 12.5l4 4 10-10" /> : <path d="M6 6l12 12M18 6L6 18" />}
              </svg>
            </div>
            <div className="ft">{s.stamped(flash.name.split(" ")[0], flash.into)}</div>
            <div className="fs">{s.at(flash.tm, flash.into)}</div>
          </div>
        </div>
      )}
    </>
  );
}
