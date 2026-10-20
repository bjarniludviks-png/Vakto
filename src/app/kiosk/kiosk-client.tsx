"use client";

import { useEffect, useRef, useState } from "react";
import { kioskPunchByPin, kioskPunchByToken, kioskPunchByKennitala, type KioskData } from "./actions";
import { VaktoLogo } from "@/components/brand/vakto-logo";

type Emp = { id: string; initials: string; name: string; color: string };

const z = (n: number) => String(n).padStart(2, "0");

type Lang = "is" | "en" | "pl";
const LANGS: Lang[] = ["is", "en", "pl"];
const WD: Record<Lang, string[]> = {
  is: ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  pl: ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"],
};
const MO: Record<Lang, string[]> = {
  is: ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  // dopełniacz: „16 października 2026”
  pl: ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"],
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
    scanBtn: "Skanna skírteini", scanTitle: "Sýndu QR-skírteinið fyrir myndavélina", scanUnsupported: "Þessi vafri styður ekki QR-skönnun — notaðu PIN.", scanNoCam: "Ekki tókst að opna myndavél.",
    names: "Nöfn", ktTab: "Kennitala", ktPrompt: "Sláðu inn kennitöluna þína", ktPh: "ddmmáá-xxxx", notLinked: "Virkar þegar kiosk er tengdur fyrirtæki",
    errs: {} as Record<string, string>,
    locked: (min: string) => `Of margar rangar tilraunir — reyndu aftur eftir ${min} mínútur.`,
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
    scanBtn: "Scan ID card", scanTitle: "Show the QR ID card to the camera", scanUnsupported: "This browser doesn't support QR scanning — use a PIN.", scanNoCam: "Couldn't open the camera.",
    names: "Names", ktTab: "ID number", ktPrompt: "Type your kennitala (ID number)", ktPh: "ddmmyy-xxxx", notLinked: "Works when the kiosk is linked to a company",
    errs: {
      "Kiosk-slóðin er ógild": "The kiosk link is invalid",
      "Starfsmaður fannst ekki": "Employee not found",
      "Engin kennitala skráð á starfsmann": "No kennitala registered for this employee",
      "Rangur kóði — reyndu aftur": "Wrong code — try again",
      "Stimplun tókst ekki — reyndu aftur.": "Clocking failed — try again.",
      "Sláðu inn 10 stafa kennitölu": "Enter a 10-digit kennitala",
      "Engin(n) starfsmaður fannst með þessa kennitölu": "No employee found with this kennitala",
      "QR-stimplun er ekki virk": "QR clocking is not enabled",
      "Skírteini fannst ekki": "ID card not found",
    } as Record<string, string>,
    locked: (min: string) => `Too many wrong attempts — try again in ${min} minutes.`,
  },
  pl: {
    title: "Rejestrator czasu", tap: "Stuknij swoje imię, aby odbić wejście lub wyjście.",
    onShift: "Na zmianie", offShift: "Poza zmianą", err: "Błąd",
    noStaff: "Brak pracowników — dodaj pracowników w aplikacji.",
    enterPin: "Wpisz swój 4-cyfrowy kod", wrong: "Błędny kod — spróbuj ponownie", cancel: "Anuluj",
    onSince: (tm: string) => `Na zmianie od ${tm} — wpisz kod, aby odbić wyjście`,
    hintReal: "Twój kod = ostatnie 4 cyfry Twojego numeru kennitala.",
    demoFor: (n: string) => `Kod demo dla ${n}: `,
    foot: "VAKTO · Rejestrator czasu — otwórz tę stronę na wspólnym tablecie w miejscu pracy.",
    stamped: (n: string, into: boolean) => `${n} — ${into ? "wejście odbite" : "wyjście odbite"}`,
    at: (tm: string, into: boolean) => `o ${tm}${into ? " · Udanej zmiany!" : " · Dziękujemy za dziś!"}`,
    notFound: "Nie znaleziono kiosku", notFoundSub: "Nie znaleziono tej firmy. Pobierz właściwy link do kiosku w Ustawienia → Kiosk.",
    date: (d: Date) => `${WD.pl[d.getDay()]}, ${d.getDate()} ${MO.pl[d.getMonth()]} ${d.getFullYear()}`,
    scanBtn: "Zeskanuj identyfikator", scanTitle: "Pokaż identyfikator z kodem QR do kamery", scanUnsupported: "Ta przeglądarka nie obsługuje skanowania QR — użyj PIN-u.", scanNoCam: "Nie udało się uruchomić kamery.",
    names: "Imiona", ktTab: "Kennitala", ktPrompt: "Wpisz swój numer kennitala", ktPh: "ddmmrr-xxxx", notLinked: "Działa, gdy kiosk jest połączony z firmą",
    errs: {
      "Kiosk-slóðin er ógild": "Link do kiosku jest nieprawidłowy",
      "Starfsmaður fannst ekki": "Nie znaleziono pracownika",
      "Engin kennitala skráð á starfsmann": "Pracownik nie ma zapisanego numeru kennitala",
      "Rangur kóði — reyndu aftur": "Błędny kod — spróbuj ponownie",
      "Stimplun tókst ekki — reyndu aftur.": "Odbicie nie powiodło się — spróbuj ponownie.",
      "Sláðu inn 10 stafa kennitölu": "Wpisz 10-cyfrowy numer kennitala",
      "Engin(n) starfsmaður fannst með þessa kennitölu": "Nie znaleziono pracownika z tym numerem kennitala",
      "QR-stimplun er ekki virk": "Odbijanie kodem QR nie jest włączone",
      "Skírteini fannst ekki": "Nie znaleziono identyfikatora",
    } as Record<string, string>,
    locked: (min: string) => `Zbyt wiele błędnych prób — spróbuj ponownie za ${min} min.`,
  },
};

export default function KioskClient({ kioskKey, data }: { kioskKey: string | null; data: KioskData | null }) {
  const real = !!data;
  const emps: Emp[] = real
    ? data!.employees.map((e) => ({ id: e.id, initials: e.initials, name: e.name, color: e.color }))
    : [];

  const [now, setNow] = useState<Date | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    real ? Object.fromEntries(data!.employees.map((e) => [e.id, e.on])) : {});
  const [inTime, setInTime] = useState<Record<string, string>>(() =>
    real ? Object.fromEntries(data!.employees.map((e) => [e.id, e.inTime])) : {});
  const [cur, setCur] = useState<Emp | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<null | { name: string; into: boolean; tm: string }>(null);
  const [lang, setLang] = useState<Lang>("is");
  const s = STR[lang];
  // Villur koma á íslensku frá þjóninum; þýðum þær þekktu.
  const tErr = (m: string | undefined) => {
    if (!m) return s.err;
    const lock = /^Of margar rangar tilraunir — reyndu aftur eftir (\d+) mínútur\.$/.exec(m); // LOCKED í actions.ts
    return lock ? s.locked(lock[1]) : s.errs[m] ?? m;
  };
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scan, setScan] = useState(false);
  const [mode, setMode] = useState<"cards" | "kt">("cards");
  const [kt, setKt] = useState("");
  const [ktErr, setKtErr] = useState("");
  const [ktBusy, setKtBusy] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("vakto-kiosk-lang");
    if (LANGS.includes(saved as Lang)) setLang(saved as Lang);
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(t); };
  }, []);
  function pickLang(l: Lang) { setLang(l); try { localStorage.setItem("vakto-kiosk-lang", l); } catch { /* ignore */ } }
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vakto-kiosk-mode");
      if (saved === "kt" || saved === "cards") setMode(saved);
      else if ((data?.employees.length ?? 0) > 20) setMode("kt");
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function pickMode(m: "cards" | "kt") { setMode(m); setKt(""); setKtErr(""); try { localStorage.setItem("vakto-kiosk-mode", m); } catch { /* ignore */ } }
  function ktKey(d: string) {
    if (ktBusy || kt.length >= 10) return;
    setKtErr("");
    const nk = kt + d;
    setKt(nk);
    if (nk.length === 10) setTimeout(() => ktSubmit(nk), 160);
  }
  async function ktSubmit(nk: string) {
    if (!real) { setKtErr(s.notLinked); setKt(""); return; }
    setKtBusy(true);
    const res = await kioskPunchByKennitala(kioskKey!, nk);
    setKtBusy(false);
    if (!res.ok) { setKtErr(tErr(res.error)); setKt(""); return; }
    setKt("");
    if (res.employeeId) {
      setOn((m) => ({ ...m, [res.employeeId!]: !!res.into }));
      if (res.into) setInTime((m) => ({ ...m, [res.employeeId!]: res.time ?? nowHM() }));
    }
    setFlash({ name: res.name ?? "", into: !!res.into, tm: res.time ?? nowHM() });
    if (flashT.current) clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(null), 2100);
  }
  const ktFmt = kt.length > 6 ? `${kt.slice(0, 6)}-${kt.slice(6)}` : kt;

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
      const res = await kioskPunchByPin(kioskKey!, cur.id, np);
      setBusy(false);
      if (!res.ok) { setErr(tErr(res.error)); setShake(true); setTimeout(() => { setPin(""); setShake(false); }, 650); return; }
      finish(cur, !!res.into, res.time ?? nowHM());
    } else wrong();
  }
  function nowHM() { const t = new Date(); return `${z(t.getHours())}:${z(t.getMinutes())}`; }

  // QR scan — read the staff Wallet pass with the camera (BarcodeDetector) and punch.
  useEffect(() => {
    if (!scan) return;
    let stream: MediaStream | null = null, raf = 0, done = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    // Safari (iPad) hefur ekki BarcodeDetector → lesum rammann með jsQR í staðinn.
    let detect: (v: HTMLVideoElement) => Promise<string | null>;
    if (BD) {
      const detector = new BD({ formats: ["qr_code"] });
      detect = async (v) => (await detector.detect(v))[0]?.rawValue ?? null;
    } else {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let jsQR: typeof import("jsqr").default | null = null;
      detect = async (v) => {
        if (!ctx || !v.videoWidth) return null;
        jsQR ??= (await import("jsqr")).default;
        const w = Math.min(640, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w);
        canvas.width = w; canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
      };
    }
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch { setScanErr(s.scanNoCam); return; }
      const tick = async () => {
        if (done || !videoRef.current) return;
        try {
          const raw = await detect(videoRef.current);
          if (raw) {
            done = true;
            const res = await kioskPunchByToken(kioskKey!, raw);
            if (res.ok) { setScan(false); finish({ id: res.name ?? "", initials: "", name: res.name ?? "", color: "#e9700f" }, !!res.into, res.time ?? nowHM()); return; }
            setScanErr(tErr(res.error)); done = false;
          }
        } catch { /* keep scanning */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [scan]); // eslint-disable-line react-hooks/exhaustive-deps
  function finish(e: Emp, into: boolean, tm: string) {
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
  // No key at all (someone typed /kiosk) or a key that matches no company.
  if (!data) {
    return (
      <div className="wrap" style={{ textAlign: "center", paddingTop: 80 }}>
        <h1>{s.notFound}</h1>
        <div className="sub">{s.notFoundSub}</div>
      </div>
    );
  }

  const LangToggle = () => (
    <div className="klang">
      {LANGS.map((l) => (
        <button key={l} className={lang === l ? "on" : ""} onClick={() => pickLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );

  return (
    <>
      <div className="top">
        <div className="brand"><VaktoLogo size={27} /></div>
        <div className="co">{coName}</div>
        <div className="sp" />
        <LangToggle />
        <div className="clock"><div className="t">{time}</div><div className="d">{date}</div></div>
      </div>

      <div className="wrap">
        <h1>{s.title}</h1>
        <div className="sub">{s.tap}</div>
        {real && <button className="scanbtn" onClick={() => { setScanErr(""); setScan(true); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2M20 7V5a1 1 0 0 0-1-1h-2M20 17v2a1 1 0 0 1-1 1h-2M4 12h16" /></svg>
          {s.scanBtn}
        </button>}
        {real && emps.length === 0 && (
          <div className="sub" style={{ marginTop: 20 }}>{s.noStaff}</div>
        )}
        <div className="klang" style={{ justifyContent: "center", display: "flex", margin: "14px auto 22px" }}>
          <button className={mode === "cards" ? "on" : ""} onClick={() => pickMode("cards")}>{s.names}</button>
          <button className={mode === "kt" ? "on" : ""} onClick={() => pickMode("kt")}>{s.ktTab}</button>
        </div>
        {mode === "kt" && (
          <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="cur" style={{ marginBottom: 10 }}>{s.ktPrompt}</div>
            <div className="dots" style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>
              {ktFmt || <span style={{ opacity: .3 }}>{s.ktPh}</span>}
            </div>
            <div className="pin-err">{ktErr}</div>
            <div className="pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} disabled={ktBusy} onClick={() => ktKey(String(d))}>{d}</button>)}
              <button className="muted" onClick={() => { setKt(""); setKtErr(""); }}>{s.cancel}</button>
              <button disabled={ktBusy} onClick={() => ktKey("0")}>0</button>
              <button className="muted" onClick={() => { setKtErr(""); setKt((p) => p.slice(0, -1)); }}>⌫</button>
            </div>
          </div>
        )}
        {mode === "cards" && <div className="grid">
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
        </div>}
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
                : null}
            </div>
          </div>
        </div>
      )}

      {scan && (
        <div className="ov show" onClick={(e) => e.target === e.currentTarget && setScan(false)}>
          <div className="card" style={{ maxWidth: 420 }}>
            <div className="nm" style={{ marginBottom: 12 }}>{s.scanTitle}</div>
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", aspectRatio: "1" }}>
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: "18%", border: "3px solid rgba(255,255,255,.85)", borderRadius: 16 }} />
            </div>
            {scanErr && <div className="pin-err" style={{ marginTop: 10 }}>{scanErr}</div>}
            <div className="pad" style={{ gridTemplateColumns: "1fr", marginTop: 14 }}>
              <button className="muted" onClick={() => setScan(false)}>{s.cancel}</button>
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
