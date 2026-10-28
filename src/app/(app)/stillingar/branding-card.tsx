"use client";

// Stillingar → Fyrirtæki → Útlit skjala: einn ljós litatónn + eigið merki í haus ráðningarsamninga og
// launaseðla. Forsýnin sýnir hausinn eins og hann kemur út í PDF.

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { VaktoLogo } from "@/components/brand/vakto-logo";
import { TONES, TONE_KEYS, type ToneKey } from "@/lib/branding";
import { getBrandingSettings, saveBrandingTone, uploadBrandLogo, removeBrandLogo } from "./branding-actions";

const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const rgb = (c: [number, number, number]) => `rgb(${c.join(",")})`;

export function BrandingCard() {
  const { t } = useLang();
  const [s, setS] = useState<{ tone: ToneKey; logo: string | null; canEdit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { getBrandingSettings().then(setS).catch(() => {}); }, []);
  if (!s) return null;
  const tone = TONES[s.tone];

  async function pickTone(k: ToneKey) {
    if (!s || k === s.tone) return;
    const prev = s.tone;
    setS({ ...s, tone: k });
    const r = await saveBrandingTone(k);
    if (!r.ok) { setS((x) => (x ? { ...x, tone: prev } : x)); toast(r.error ?? "Villa"); }
  }
  async function onFile(f: File | undefined) {
    if (!f || !s) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { toast(t("Merkið þarf að vera PNG eða JPG")); return; }
    if (f.size > 600 * 1024) { toast(t("Merkið má mest vera 600 KB")); return; }
    setBusy(true);
    const data = await readAsDataUrl(f);
    const r = await uploadBrandLogo(data);
    setBusy(false);
    if (r.ok) { setS({ ...s, logo: data }); toast(t("Merki vistað")); } else toast(r.error ?? "Villa");
  }
  async function dropLogo() {
    if (!s) return;
    setBusy(true);
    const r = await removeBrandLogo();
    setBusy(false);
    if (r.ok) setS({ ...s, logo: null }); else toast(r.error ?? "Villa");
  }

  return (
    <div className="card" style={{ marginTop: 16 }} id="utlit-skjala">
      <div className="ch"><div>
        <div className="ct">{t("Útlit skjala")}</div>
        <div className="cs">{t("Litur og merki á ráðningarsamningum og launaseðlum")}</div>
      </div></div>
      <div className="cb" style={{ display: "grid", gap: 16 }}>
        <div className="brand-prev" style={{ background: tone.css, borderRadius: 12, padding: "18px 20px", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            {s.logo
              ? <img src={s.logo} alt={t("Merki fyrirtækisins")} style={{ maxHeight: 30, maxWidth: 170, objectFit: "contain" }} />
              : <VaktoLogo size={20} />}
            <span style={{ fontSize: 11, color: rgb(tone.mut) }}>vakto.is</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 19, color: "#1a1c22", marginTop: 16 }}>{t("Ráðningarsamningur")}</div>
          <div style={{ fontStyle: "italic", fontSize: 12, color: rgb(tone.mut) }}>Employment contract</div>
        </div>

        <div>
          <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 8 }}>{t("Litur")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="radiogroup" aria-label={t("Litur á skjölum")}>
            {TONE_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={s.tone === k} disabled={!s.canEdit}
                onClick={() => pickTone(k)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px", borderRadius: 999, font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: s.canEdit ? "pointer" : "default",
                  border: `1.5px solid ${s.tone === k ? "var(--brand)" : "var(--line)"}`, background: "var(--panel)", color: "var(--ink)" }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: TONES[k].css, border: `1px solid ${rgb(TONES[k].mut)}55` }} />
                {t(TONES[k].label)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 8 }}>{t("Merki")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="btn sm" disabled={!s.canEdit || busy} onClick={() => file.current?.click()}>{s.logo ? t("Skipta um merki") : t("Hlaða upp merki")}</button>
            {s.logo && <button type="button" className="btn sm ghost" disabled={!s.canEdit || busy} onClick={dropLogo}>{t("Nota VAKTO-merkið")}</button>}
            <span className="muted" style={{ fontSize: 12 }}>{t("PNG eða JPG, mest 600 KB. Liggjandi merki með gegnsæjum bakgrunni kemur best út.")}</span>
          </div>
        </div>
        {!s.canEdit && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t("Aðeins eigandi getur breytt útliti skjala.")}</p>}
      </div>
    </div>
  );
}
