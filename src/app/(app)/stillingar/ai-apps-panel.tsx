"use client";

// Stillingar → Tengingar → „Tengd forrit“: Claude, ChatGPT o.fl. með lesaðgang (MCP). Sjá lib/mcp.server.ts.
import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { getAiApps, setAiExternal, disconnectAiApp, type AiAppsView } from "./ai-apps-actions";

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={() => onChange(!on)}
      style={{ width: 38, height: 22, borderRadius: 999, border: 0, padding: 2, cursor: "pointer", flex: "none", background: on ? "var(--brand)" : "var(--line)", transition: "background .15s" }}>
      <span style={{ display: "block", width: 18, height: 18, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transform: on ? "translateX(16px)" : "none", transition: "transform .15s" }} />
    </button>
  );
}

const Copy = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>;
const Spark = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>;

const day = (iso: string, en: boolean) => { const d = new Date(iso); return en ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` : `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };

export function AiAppsPanel() {
  const { lang } = useLang();
  const en = lang !== "is";
  const L = (is: string, e: string) => (en ? e : is);
  const [v, setV] = useState<AiAppsView | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setV(await getAiApps()), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sótt einu sinni þegar spjaldið opnast
  useEffect(() => { void load(); }, [load]);
  if (!v) return null;

  const toggle = async (on: boolean) => {
    if (!on && v.grants.length && !window.confirm(L("Slökkva á tengdum forritum? Öll forrit fyrirtækisins verða aftengd.", "Turn off connected apps? All of the company's apps will be disconnected."))) return;
    setBusy(true);
    const r = await setAiExternal(on);
    setBusy(false);
    toast(r.ok ? (on ? L("Kveikt á tengdum forritum", "Connected apps turned on") : L("Slökkt og öll forrit aftengd", "Turned off, all apps disconnected")) : (r.error ?? "Villa"));
    void load();
  };

  return (
    <div className="tg" style={{ marginTop: 16 }}><section className="card">
      <div className="ch">
        <div><div className="ct">{L("Tengd forrit", "Connected apps")}</div><div className="cs">{L("Claude, ChatGPT eða önnur gervigreindarforrit með lesaðgang að gögnum fyrirtækisins.", "Claude, ChatGPT or other AI apps with read access to the company's data.")}</div></div>
        {v.isOwner && <Switch on={v.enabled} label={L("Leyfa gervigreindarforrit", "Allow AI apps")} onChange={(on) => { if (!busy) void toggle(on); }} />}
      </div>
      <div className="cb">
        {v.blocked ? <p className="tg-small" style={{ margin: 0 }}>{v.blocked}</p> : <>
          {!v.enabled && (
            <p className="tg-small" style={{ margin: "0 0 14px" }}>
              {v.isOwner ? L("Slökkt. Kveiktu til að stjórnendur og vaktstjórar geti tengt sín forrit.", "Off. Turn on so managers can connect their apps.")
                : L("Eigandi fyrirtækisins þarf að kveikja á þessu áður en hægt er að tengja forrit.", "The company owner needs to turn this on before apps can be connected.")}
            </p>
          )}
          <ol style={{ listStyle: "decimal", margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.55, display: "grid", gap: 10 }}>
            <li>
              {L("Bættu við tengingu (MCP) í Claude, ChatGPT eða öðru gervigreindarforriti með þessari slóð:", "Add a connector (MCP) in Claude, ChatGPT or another AI app with this URL:")}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--card, #fff)" }}>
                <code style={{ flex: 1, fontSize: 14, overflowWrap: "anywhere" }}>{v.url}</code>
                <button type="button" className="btn ghost sm" aria-label={L("Afrita", "Copy")} title={L("Afrita", "Copy")}
                  onClick={async () => { try { await navigator.clipboard.writeText(v.url); toast(L("Slóð afrituð", "URL copied")); } catch { /* vafrinn leyfði það ekki */ } }}><Copy /></button>
              </div>
            </li>
            <li>{L("Skráðu þig inn með VAKTO og samþykktu aðganginn.", "Sign in with VAKTO and approve access.")}</li>
          </ol>
          <p className="tg-small" style={{ margin: "0 0 4px" }}>
            {L("Aðeins lestur: forritin geta ekki breytt vöktum, launum eða neinu öðru, og fá aldrei kennitölur, bankareikninga eða heimilisföng. Fyrir stjórnendur og vaktstjóra.",
              "Read only: apps can't change shifts, pay or anything else, and never get national IDs, bank accounts or addresses. For managers.")}
          </p>
        </>}
      </div>
      {v.grants.length > 0 && (
        <div className="cb att" style={{ paddingTop: 0 }}>
          <div className="tg-small" style={{ margin: "0 2px 6px" }}>{L("Tengd", "Connected")}</div>
          {v.grants.map((g) => (
            <div className="it" key={g.id}>
              <div className="ic good"><Spark /></div>
              <div className="tx">
                <b>{g.client}</b>
                <span>{[v.isOwner && !g.mine ? g.user : null, `${L("tengt", "connected")} ${day(g.created, en)}`, g.lastUsed ? `${L("síðast notað", "last used")} ${day(g.lastUsed, en)}` : L("ekki notað enn", "not used yet")].filter(Boolean).join(" · ")}</span>
              </div>
              <button className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={async () => { const r = await disconnectAiApp(g.id); toast(r.ok ? L("Forrit aftengt", "App disconnected") : (r.error ?? "Villa")); void load(); }}>{L("Aftengja", "Disconnect")}</button>
            </div>
          ))}
        </div>
      )}
    </section></div>
  );
}
