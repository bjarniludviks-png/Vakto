"use client";

// Stillingar → Tengingar → DK: (1) launaliðir í dk Laun fyrir CSV-innlestur í launakeyrslu,
// (2) valfrjálst: dkPlus-lykill svo velta komi sjálfkrafa úr bókhaldinu (laun % af veltu).
import { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import { getDkSettings, saveDkCodes, type DkSettings } from "./dk-actions";
import { connectIntegration, disconnectIntegration } from "./integration-actions";

type Lf = (is: string, en: string) => string;

export function DkModal({ L, locations, onClose, onDone }: { L: Lf; locations: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [s, setS] = useState<DkSettings | null>(null);
  const [day, setDay] = useState(""); const [ot, setOt] = useState("");
  const [alag, setAlag] = useState<Record<string, string>>({});
  const [pcts, setPcts] = useState<number[]>([]);
  const [newPct, setNewPct] = useState("");
  const [token, setToken] = useState("");
  const [loc, setLoc] = useState(locations[0]?.id ?? "");
  const [busy, setBusy] = useState<"codes" | "token" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getDkSettings().then((r) => {
      if (!r) return;
      setS(r); setDay(r.codes.dagvinna ?? ""); setOt(r.codes.yfirvinna ?? ""); setAlag(r.codes.alag ?? {}); setPcts(r.alagPcts);
    });
  }, []);

  const saveCodes = async () => {
    setBusy("codes"); setErr(null);
    const r = await saveDkCodes({ dagvinna: day, yfirvinna: ot, alag });
    setBusy(null);
    if (r.ok) toast(L("Launaliðir vistaðir", "Pay codes saved")); else setErr(r.error ?? "Villa");
  };
  const connect = async () => {
    setBusy("token"); setErr(null);
    const r = await connectIntegration({ provider: "dk", site: "", token, locationId: loc || undefined });
    setBusy(null);
    if (r.ok) { toast(`DK ${L("tengt", "connected")}${r.total ? ` · ${nf(r.total)} kr ${L("sóttar", "fetched")}` : ""}`); onDone(); } else setErr(r.error ?? "Villa");
  };

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="mh">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="tg-logo" style={{ width: 36, height: 36 }}><img src="/integrations/dk.png" alt="" width={22} height={22} /></span>
          <div style={{ fontSize: 16, fontWeight: 650 }}>DK</div><button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb tg-modal">
          {!s ? <div className="tg-small">{L("Sæki…", "Loading…")}</div> : <>
            <div style={{ fontWeight: 650 }}>{L("1. Tímar í launakeyrslu dk Laun", "1. Hours into a dk Laun pay run")}</div>
            <div className="tg-small">{L(
              "Settu inn númer launaliðanna ykkar í dk Laun. Í Launakeyrslum velur þú svo „DK“ og færð skrá sem bókarinn les inn: Laun → Launakeyrsla → Skráning tíma/launa → F5 → „Lesa úr CSV-skrá inn í launakeyrslu“. Fastlaunafólk er ekki með, DK greiðir mánaðarlaunin sjálft.",
              "Enter your dk Laun pay code numbers. In Payroll choose “DK” to get a file your bookkeeper imports: Laun → Launakeyrsla → Skráning tíma/launa → F5 → “Lesa úr CSV-skrá inn í launakeyrslu”. Salaried staff are left out; DK pays their monthly salary itself.")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="tg-field"><span>{L("Dagvinna (klst.)", "Day work (hrs)")}</span><input value={day} onChange={(e) => setDay(e.target.value)} placeholder="t.d. 100" inputMode="numeric" /></label>
              <label className="tg-field"><span>{L("Yfirvinna (klst.)", "Overtime (hrs)")}</span><input value={ot} onChange={(e) => setOt(e.target.value)} placeholder="t.d. 200" inputMode="numeric" /></label>
              {pcts.map((p) => (
                <label className="tg-field" key={p}><span>{L(`Álag ${String(p).replace(".", ",")}% (klst.)`, `Premium ${p}% (hrs)`)}</span>
                  <input value={alag[String(p)] ?? ""} onChange={(e) => setAlag((a) => ({ ...a, [String(p)]: e.target.value }))} placeholder={L("númer launaliðar", "pay code")} inputMode="numeric" /></label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label className="tg-field" style={{ width: 120, margin: 0 }}><input value={newPct} onChange={(e) => setNewPct(e.target.value)} placeholder={L("Álag %", "Premium %")} inputMode="decimal" /></label>
              <button className="btn ghost sm" type="button" onClick={() => { const n = Number(newPct.replace(",", ".")); if (n > 0 && !pcts.includes(n)) setPcts((x) => [...x, n].sort((a, b) => a - b)); setNewPct(""); }}>{L("Bæta við álagi", "Add premium")}</button>
            </div>
            <button className="btn" disabled={busy !== null} onClick={saveCodes}>{busy === "codes" ? L("Vista…", "Saving…") : L("Vista launaliði", "Save pay codes")}</button>

            <div style={{ height: 1, background: "var(--line)", margin: "6px 0" }} />
            <div style={{ fontWeight: 650 }}>{L("2. Velta úr DK (valfrjálst)", "2. Revenue from DK (optional)")}</div>
            {s.connected ? (
              <div className="tg-conn-n">
                <span>{s.connected.lastError ? <span style={{ color: "var(--bad)" }}>{s.connected.lastError}</span> : L("Tengt — velta sótt daglega úr tekjureikningum bókhaldsins.", "Connected — revenue fetched daily from the income accounts.")}</span>
                <button className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={async () => { await disconnectIntegration(s.connected!.id); toast(L("DK aftengt", "DK disconnected")); onDone(); }}>{L("Aftengja", "Disconnect")}</button>
              </div>
            ) : <>
              <div className="tg-small">{L(
                "Í dkPlus: Notandastillingar → Aðgangslyklar → skrifaðu „VAKTO“, veldu fyrirtækið og ýttu á Stofna. Afritaðu lykilinn og límdu hér. VAKTO les aðeins bókhaldið. DK rukkar um 1.800 kr. á mánuði fyrir lykilinn.",
                "In dkPlus: User settings → Access tokens → type “VAKTO”, pick the company and press Create. Copy the token and paste it here. VAKTO only reads the books. DK charges about 1,800 ISK a month for the token.")}</div>
              <label className="tg-field"><span>{L("Aðgangslykill (dkPlus)", "Access token (dkPlus)")}</span><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" /></label>
              {locations.length > 1 && <label className="tg-field"><span>{L("Veltan fer á starfsstöð", "Revenue goes to location")}</span><select value={loc} onChange={(e) => setLoc(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
              <button className="btn ghost" disabled={busy !== null || !token.trim()} onClick={connect}>{busy === "token" ? L("Tengi og sæki veltu…", "Connecting…") : L("Tengja og sækja veltu", "Connect and fetch revenue")}</button>
            </>}
            {err && <div className="tg-err">{err}</div>}
          </>}
        </div>
      </div>
    </div>
  );
}
