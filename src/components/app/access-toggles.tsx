"use client";

// Aðgangsrofar stjórnanda (Stillingar → Notendur, boð og Nýr starfsmaður) — sama regla og resolveAccess.

import { useLang } from "@/components/app/lang";
import { AREAS, FULL_ACCESS, MANAGER_DEFAULTS, type Area } from "@/lib/user-permissions";

export function AccessToggles({ value, onChange }: { value: Record<Area, boolean>; onChange: (v: Record<Area, boolean>) => void }) {
  const { t } = useLang();
  const full = AREAS.every((a) => value[a.key]);
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button type="button" className={`btn sm${full ? "" : " ghost"}`} onClick={() => onChange({ ...FULL_ACCESS })}>{t("Fullur aðgangur")}</button>
        <button type="button" className="btn sm ghost" onClick={() => onChange({ ...MANAGER_DEFAULTS })}>{t("Sjálfgefið")}</button>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "0 0 8px" }}>
        {t("Fullur aðgangur = allt sem eigandi sér nema áskrift, greiðslukort og stjórnun eigenda.")}
      </p>
      {AREAS.map((a) => (
        <label className="statline" key={a.key} style={{ cursor: "pointer" }}>
          <span className="k">{t(a.label)} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t(a.hint)}</span></span>
          <input type="checkbox" checked={value[a.key]} onChange={(e) => onChange({ ...value, [a.key]: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
        </label>
      ))}
    </>
  );
}

