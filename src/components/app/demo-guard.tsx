"use client";

// Opið demo er AÐEINS til skoðunar. Þjónninn stöðvar öll skrif (proxy, server actions,
// þjónustulykill, RLS — sjá lib/demo-readonly.ts). Þessi hluti sér til þess að gesturinn fái
// vinalega skýringu + hlekk á nýskráningu í stað almennrar villu: hann hlustar á svör
// (fetch) og birtir spjaldið þegar þjónninn svarar með demo-lokun.

import { useEffect, useState } from "react";
import { useLang } from "./lang";
import { createClient } from "@/lib/supabase/client";
import { DEMO_READONLY_HEADER, DEMO_READONLY_MSG } from "@/lib/demo-readonly";

const EVT = "vakto:demo-readonly";

/** Birtir „aðeins til skoðunar"-spjaldið (t.d. úr hnöppum sem eru óvirkir í demo). */
export function showDemoReadOnly() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

function hasActionHeader(init?: RequestInit): boolean {
  const h = init?.headers;
  if (!h) return false;
  if (h instanceof Headers) return h.has("next-action");
  if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === "next-action");
  return Object.keys(h).some((k) => k.toLowerCase() === "next-action");
}

const MARK = DEMO_READONLY_MSG.slice(0, 27); // „Demo er aðeins til skoðunar"

export function DemoGuard() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setOpen(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOpen(false), 9000);
    };
    window.addEventListener(EVT, show);

    const orig = window.fetch;
    const patched: typeof window.fetch = async (input, init) => {
      const res = await orig(input, init);
      try {
        if (res.headers.get(DEMO_READONLY_HEADER)) show();
        else if (hasActionHeader(init) && (res.headers.get("content-type") ?? "").startsWith("text/x-component")) {
          // Server action skilaði demo-lokun ({ ok: false, error: DEMO_BLOCKED }) — lesið úr afriti.
          void res.clone().text().then((body) => { if (body.includes(MARK)) show(); }).catch(() => {});
        }
      } catch { /* aldrei trufla svarið */ }
      return res;
    };
    window.fetch = patched;
    return () => {
      window.removeEventListener(EVT, show);
      clearTimeout(timer);
      if (window.fetch === patched) window.fetch = orig;
    };
  }, []);

  async function signup() {
    setBusy(true);
    try { await createClient().auth.signOut({ scope: "local" }); } catch { /* ignore */ }
    window.location.assign("/nyskraning");
  }

  return (
    <div className={`demoro${open ? " show" : ""}`} role="alert" aria-hidden={!open}>
      <div className="demoro-txt">
        <b>{t("Aðeins til skoðunar")}</b>
        <span>{t(DEMO_READONLY_MSG)}</span>
      </div>
      <div className="demoro-act">
        <button className="demoro-cta" onClick={signup} disabled={busy}>{t("Stofna eigið fyrirtæki")}</button>
        <button className="demoro-x" onClick={() => setOpen(false)} aria-label={t("Loka")}>×</button>
      </div>
    </div>
  );
}
