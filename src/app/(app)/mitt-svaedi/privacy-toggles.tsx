"use client";

// Mitt svæði → Prófíll: hvað samstarfsfólk sér um mig í spjalli (0099). Vistast strax.
import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { getMyPrivacy, setMyPrivacy } from "../spjall/presence-actions";

export function PrivacyToggles() {
  const { t } = useLang();
  const [v, setV] = useState<{ showPresence: boolean; showPhone: boolean } | null>(null);
  useEffect(() => { getMyPrivacy().then(setV).catch(() => {}); }, []);
  if (!v) return null;
  async function flip(k: "showPresence" | "showPhone") {
    if (!v) return;
    const next = { ...v, [k]: !v[k] };
    setV(next);
    const r = await setMyPrivacy({ [k]: next[k] });
    if (!r.ok) { setV(v); toast(r.error ?? "Villa"); }
  }
  const row = (k: "showPresence" | "showPhone", label: string, hint: string) => (
    <label className="statline" style={{ cursor: "pointer" }}>
      <span className="k">{t(label)} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t(hint)}</span></span>
      <input type="checkbox" checked={v[k]} onChange={() => flip(k)} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
    </label>
  );
  return (
    <div style={{ margin: "4px 0 12px" }}>
      <div style={{ fontWeight: 700, fontSize: 13, margin: "8px 0 4px" }}>{t("Í spjalli")}</div>
      {row("showPresence", "Sýna þegar ég er virk(ur)", "slökkt = þú sérð ekki heldur virkni annarra")}
      {row("showPhone", "Sýna símanúmerið mitt", "samstarfsfólk getur hringt úr prófílnum þínum")}
    </div>
  );
}
