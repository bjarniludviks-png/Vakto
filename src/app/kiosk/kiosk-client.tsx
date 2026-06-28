"use client";

import { useEffect, useRef, useState } from "react";
import { kioskPunch } from "./actions";

// [initials, name, color, startsOn, clockInTime, pin] — ported from vakto-kiosk.html
const EMP: [string, string, string, boolean, string, string][] = [
  ["MÍ", "Mína Huong", "#e9700f", true, "08:02", "4731"],
  ["BA", "Bach Luu", "#1f9d6b", false, "—", "2208"],
  ["PH", "Phong Ha", "#0891b2", true, "07:56", "9054"],
  ["ÓM", "Ómar S.", "#d8483a", false, "—", "1190"],
  ["HA", "Ha Vu", "#7c6ff2", true, "09:01", "6677"],
  ["DA", "Dalya R.", "#ca8a04", false, "—", "3321"],
  ["JÓ", "Jón G.", "#db2777", false, "—", "8080"],
  ["TR", "Truong Vu", "#0f766e", true, "11:00", "5512"],
  ["MO", "Moon M.", "#2563eb", false, "—", "7140"],
  ["NG", "Ngoan Thi", "#16a34a", true, "08:00", "4499"],
  ["FA", "Fannar F.", "#9333ea", false, "—", "1357"],
  ["LO", "Lolo", "#e11d48", false, "—", "2468"],
];

const z = (n: number) => String(n).padStart(2, "0");
const WD = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export default function KioskClient() {
  const [now, setNow] = useState<Date | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    EMP.forEach((e) => (o[e[1]] = e[3]));
    return o;
  });
  const [inTime, setInTime] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    EMP.forEach((e) => (o[e[1]] = e[4]));
    return o;
  });
  const [cur, setCur] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<null | { name: string; into: boolean; tm: string }>(null);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, []);

  const emp = (n: string) => EMP.find((e) => e[1] === n)!;

  function open(n: string) {
    setCur(n);
    setPin("");
    setErr("");
    setShake(false);
  }
  function close() {
    setCur(null);
    setPin("");
  }
  function key(d: string) {
    if (!cur || pin.length >= 4) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 4) setTimeout(() => check(np), 140);
  }
  function del() {
    setErr("");
    setPin((p) => p.slice(0, -1));
  }
  function check(np: string) {
    if (!cur) return;
    if (np === emp(cur)[5]) {
      punch(cur);
    } else {
      setShake(true);
      setErr("Rangur kóði — reyndu aftur");
      setTimeout(() => {
        setPin("");
        setShake(false);
      }, 650);
    }
  }
  function punch(n: string) {
    const wasOn = on[n];
    const t = new Date();
    const tm = `${z(t.getHours())}:${z(t.getMinutes())}`;
    void kioskPunch(n, !wasOn); // persists to Supabase when configured; no-op in demo
    setOn((s) => ({ ...s, [n]: !wasOn }));
    if (!wasOn) setInTime((s) => ({ ...s, [n]: tm }));
    close();
    setFlash({ name: n, into: !wasOn, tm });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2100);
  }

  const time = now ? `${z(now.getHours())}:${z(now.getMinutes())}:${z(now.getSeconds())}` : "--:--:--";
  const date = now ? `${WD[now.getDay()]} ${now.getDate()}. ${MO[now.getMonth()]} ${now.getFullYear()}` : "";

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
        <div className="co">Kaffi Krónan</div>
        <div className="sp" />
        <div className="clock">
          <div className="t">{time}</div>
          <div className="d">{date}</div>
        </div>
      </div>

      <div className="wrap">
        <h1>Stimpilklukka</h1>
        <div className="sub">Smelltu á nafnið þitt til að stimpla inn eða út.</div>
        <div className="grid">
          {EMP.map((e) => {
            const isOn = on[e[1]];
            return (
              <div className="tile" key={e[1]} onClick={() => open(e[1])}>
                <div className="av" style={{ background: e[2] }}>{e[0]}</div>
                <div className="nm">{e[1]}</div>
                <div className={`st ${isOn ? "in" : "out"}`}>{isOn ? "Á vakt" : "Ekki á vakt"}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="foot">
        VAKTO · Stimpilklukka — opnaðu þessa síðu á sameiginlegri tölvu eða spjaldtölvu á vinnustaðnum.
      </div>

      {/* PIN overlay */}
      {cur && (
        <div className="ov show" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="card">
            <div className="av" style={{ background: emp(cur)[2] }}>{emp(cur)[0]}</div>
            <div className="nm">{cur}</div>
            <div className="cur">
              {on[cur]
                ? `Á vakt síðan ${inTime[cur]} — sláðu inn kóða til að stimpla út`
                : "Sláðu inn 4-stafa kóðann þinn"}
            </div>
            <div className={`dots${shake ? " shake" : ""}`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`dot${i < pin.length ? " f" : ""}`} />
              ))}
            </div>
            <div className="pin-err">{err}</div>
            <div className="pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} onClick={() => key(String(d))}>{d}</button>
              ))}
              <button className="muted" onClick={close}>Hætta</button>
              <button onClick={() => key("0")}>0</button>
              <button className="muted" onClick={del}>⌫</button>
            </div>
            <div className="hint">
              Demo-kóði fyrir {cur.split(" ")[0]}: <b>{emp(cur)[5]}</b> · (sést ekki í alvöru kerfi)
            </div>
          </div>
        </div>
      )}

      {/* success flash */}
      {flash && (
        <div className="flash show">
          <div className="fc">
            <div className={`ring ${flash.into ? "in" : "out"}`}>
              <svg viewBox="0 0 24 24" fill="none">
                {flash.into ? <path d="M5 12.5l4 4 10-10" /> : <path d="M6 6l12 12M18 6L6 18" />}
              </svg>
            </div>
            <div className="ft">{flash.name.split(" ")[0]} stimplaði {flash.into ? "inn" : "út"}</div>
            <div className="fs">kl. {flash.tm}{flash.into ? " · Góða vakt!" : " · Takk fyrir daginn!"}</div>
          </div>
        </div>
      )}
    </>
  );
}
