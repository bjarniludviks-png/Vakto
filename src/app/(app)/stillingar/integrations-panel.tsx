"use client";

// Stillingar → Tengingar: hvaðan veltan kemur (kerfi / innslegin / áætluð), lært vikudagamynstur,
// og kerfi sem tengjast VAKTO (Shopify og WooCommerce virk; önnur skráð sem „Láta mig vita").
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { nf } from "@/lib/format";
import { addRevenue, revokeApiKey } from "./actions";
import {
  getTengingar, connectIntegration, syncNow, disconnectIntegration, setRevenueMode, saveMonthlyEstimate,
  relearnPattern, notifyInterest, type TengingarView, type RevenueMode,
} from "./integration-actions";

type Cat = "pos" | "web" | "book" | "acc" | "pay";
type App = { id: string; name: string; logo: string; cat: Cat[]; is: boolean; kind: "connect" | "apikey" | "soon" | "export"; d: [string, string]; sub: [string, string] };
const APPS: App[] = [
  { id: "shopify", name: "Shopify", logo: "/integrations/shopify.svg", cat: ["web"], is: false, kind: "connect", sub: ["Netverslun", "Online store"], d: ["Velta úr pöntunum sótt sjálfkrafa á hverjum degi.", "Revenue from orders, fetched automatically every day."] },
  { id: "woocommerce", name: "WooCommerce", logo: "/integrations/woocommerce.svg", cat: ["web"], is: false, kind: "connect", sub: ["Netverslun", "Online store"], d: ["Vefverslun á WordPress. Tengist með lesaðgangslykli.", "WordPress store. Connects with a read-only key."] },
  { id: "inventra", name: "INVENTRA", logo: "inventra", cat: ["pos"], is: true, kind: "apikey", sub: ["Framleiðsla og sala", "Production and sales"], d: ["Systurkerfi VAKTO. Velta send beint með lykli.", "VAKTO's sister system. Revenue sent with a key."] },
  { id: "noona", name: "Noona", logo: "/integrations/noona.png", cat: ["pos", "book"], is: true, kind: "soon", sub: ["Kassakerfi og bókanir (áður SalesCloud)", "POS and bookings (formerly SalesCloud)"], d: ["Velta úr kassanum og bókanir næstu daga fyrir veltuspá.", "POS revenue and upcoming bookings for the forecast."] },
  { id: "dineout", name: "Dineout", logo: "/integrations/dineout.png", cat: ["pos", "book"], is: true, kind: "soon", sub: ["Kassakerfi og bókanir", "POS and bookings"], d: ["Velta og bókanir, gott fyrir veltuspá vaktaplansins.", "Revenue and bookings for the schedule forecast."] },
  { id: "payday", name: "Payday", logo: "/integrations/payday.png", cat: ["pay", "acc"], is: true, kind: "export", sub: ["Laun og bókhald", "Payroll and accounting"], d: ["Tímaskrá flutt út fyrir launakeyrslu í Payday.", "Timesheet export for payroll in Payday."] },
  { id: "dk", name: "DK", logo: "/integrations/dk.png", cat: ["pay", "acc"], is: true, kind: "export", sub: ["Bókhald og laun", "Accounting and payroll"], d: ["Launaskrá flutt út fyrir DK.", "Payroll file export for DK."] },
  { id: "regla", name: "Regla", logo: "/integrations/regla.png", cat: ["acc"], is: true, kind: "soon", sub: ["Bókhald", "Accounting"], d: ["Velta úr bókhaldinu.", "Revenue from your books."] },
  { id: "square", name: "Square", logo: "/integrations/square.svg", cat: ["pos"], is: false, kind: "soon", sub: ["Kassakerfi", "POS"], d: ["Algengt kassakerfi í Bandaríkjunum og Bretlandi.", "Common POS in the US and UK."] },
  { id: "lightspeed", name: "Lightspeed", logo: "/integrations/lightspeedhq.png", cat: ["pos"], is: false, kind: "soon", sub: ["Kassakerfi", "POS"], d: ["Veitingar og verslanir víða um heim.", "Restaurants and retail worldwide."] },
  { id: "zettle", name: "Zettle", logo: "/integrations/zettle.png", cat: ["pos"], is: false, kind: "soon", sub: ["Kassakerfi", "POS"], d: ["Frá PayPal, algengt á Norðurlöndum.", "By PayPal, common in the Nordics."] },
  { id: "xero", name: "Xero", logo: "/integrations/xero.svg", cat: ["acc"], is: false, kind: "soon", sub: ["Bókhald", "Accounting"], d: ["Velta og laun erlendis.", "Revenue and payroll abroad."] },
  { id: "quickbooks", name: "QuickBooks", logo: "/integrations/quickbooks.svg", cat: ["acc"], is: false, kind: "soon", sub: ["Bókhald", "Accounting"], d: ["Bretland, Írland og víðar.", "UK, Ireland and beyond."] },
  { id: "fortnox", name: "Fortnox", logo: "/integrations/fortnox.png", cat: ["acc", "pay"], is: false, kind: "soon", sub: ["Bókhald og laun", "Accounting and payroll"], d: ["Svíþjóð og Noregur.", "Sweden and Norway."] },
  { id: "zapier", name: "Zapier / Make", logo: "zap", cat: ["pos", "web", "acc"], is: false, kind: "apikey", sub: ["Þúsundir kerfa", "Thousands of apps"], d: ["Sendu veltu úr hvaða kerfi sem er með „Webhooks“ og lykli.", "Send revenue from any app with Webhooks and a key."] },
];
const CATS: [Cat | "all", string, string][] = [["all", "Allt", "All"], ["pos", "Kassakerfi", "POS"], ["web", "Netverslun", "Online"], ["book", "Bókanir", "Bookings"], ["acc", "Bókhald", "Accounting"], ["pay", "Laun", "Payroll"]];
const WD = [["Sun", "Sun"], ["Mán", "Mon"], ["Þri", "Tue"], ["Mið", "Wed"], ["Fim", "Thu"], ["Fös", "Fri"], ["Lau", "Sat"]];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function Logo({ app, size = 40 }: { app: { logo: string; name: string }; size?: number }) {
  if (app.logo === "inventra") return <span className="tg-logo" style={{ width: size, height: size }}><span className="tg-inv"><i style={{ height: 8 }} /><i style={{ height: 12 }} /><i style={{ height: 16 }} /></span></span>;
  if (app.logo === "zap") return <span className="tg-logo" style={{ width: size, height: size }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#ff4f00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></svg></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="tg-logo" style={{ width: size, height: size }}><img src={app.logo} alt="" width={size - 14} height={size - 14} /></span>;
}

export function IntegrationsPanel({ apiKeys, onNewKey }: { apiKeys: { id: string; name: string; prefix: string; created: string; lastUsed: string | null; revoked: boolean }[]; onNewKey: () => void }) {
  const { lang, t } = useLang();
  const en = lang === "en";
  const L = (is: string, e: string) => (en ? e : is);
  const [v, setV] = useState<TengingarView | null>(null);
  const [mode, setMode] = useState<RevenueMode>("system");
  const [cat, setCat] = useState<Cat | "all">("all");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("IS");
  const [connect, setConnect] = useState<App | null>(null);
  const [csv, setCsv] = useState(false);
  const appsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => getTengingar().then((r) => { setV(r); if (r.mode) setMode(r.mode); }), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- gögnin sótt eftir hleðslu
  useEffect(() => { void load(); }, [load]);

  const pick = async (m: RevenueMode) => { setMode(m); const r = await setRevenueMode(m); if (!r.ok) toast(r.error ?? "Villa", "error"); };
  const connected = (id: string) => v?.integrations.filter((i) => i.provider === id) ?? [];
  const fmtTime = (s: string | null) => { if (!s) return "—"; const d = new Date(s); return `${d.getDate()}.${d.getMonth() + 1}. kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  const list = APPS
    .filter((a) => (cat === "all" || a.cat.includes(cat)) && (!q || a.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (country === "IS" ? Number(b.is) - Number(a.is) : Number(a.is) - Number(b.is)));

  const wk = v?.weekday ?? null;
  const wkMax = wk ? Math.max(1, ...Object.values(wk).map(Number)) : 1;

  return (
    <div className="tg">
      <section className="card">
        <div className="ch"><div><div className="ct">{L("Velta", "Revenue")}</div><div className="cs">{L("Laun % af veltu þarf veltutölur. Veldu leiðina sem hentar, þú getur skipt hvenær sem er.", "Labor % of revenue needs revenue figures. Pick what suits you, you can switch at any time.")}</div></div>
          {v?.yesterday ? <span className="tag good">{L("Laun % reiknast", "Labor % is live")}</span> : <span className="tag mut">{L("Engin velta enn", "No revenue yet")}</span>}
        </div>
        <div className="cb tg-rev">
          <div>
            <p className="tg-q">{L("Hvaðan kemur veltan þín?", "Where does your revenue come from?")}</p>
            <div className="tg-choices">
              {([["system", L("Úr kerfinu sem ég nota", "From the system I use"), L("Kassakerfi, netverslun eða bókhald sendir veltuna sjálfkrafa á hverjum degi.", "Your POS, store or accounting sends revenue automatically every day.")],
                ["manual", L("Ég slæ hana inn", "I'll type it in"), L("Ein tala í lok dags. Tekur tíu sekúndur.", "One number at the end of the day. Takes ten seconds.")],
                ["estimate", L("Áætla út frá mánaðarveltu", "Estimate from monthly revenue"), L("Sláðu inn ca. mánaðarveltu einu sinni. VAKTO skiptir henni á vikudaga.", "Enter roughly your monthly revenue once. VAKTO spreads it over the week.")]] as const).map(([m, h, p]) => (
                <button key={m} type="button" className={`tg-choice${mode === m ? " on" : ""}`} onClick={() => pick(m)}><span className="tg-dot" /><span><b>{h}</b><span>{p}</span></span></button>
              ))}
            </div>
          </div>
          <div className="tg-live">
            {mode === "system" && (v?.integrations.length ? v.integrations.map((i) => {
              const app = APPS.find((a) => a.id === i.provider);
              return (
                <div key={i.id} className="tg-conn">
                  <div className="tg-conn-h">{app && <Logo app={app} size={36} />}<span><b>{app?.name ?? i.provider}</b><small>{i.site.replace(/^https:\/\//, "")}{i.location ? ` · ${i.location}` : ""}</small></span>
                    <span className={`tag ${i.status === "connected" ? "good" : "bad"}`}>{i.status === "connected" ? L("Tengt", "Connected") : L("Villa", "Error")}</span></div>
                  {i.status === "error" && i.lastError && <div className="tg-err">{i.lastError}</div>}
                  <div className="tg-conn-n"><span>{L("Velta í gær", "Revenue yesterday")}</span><b>{i.lastAmount != null ? `${nf(i.lastAmount)} kr` : "—"}</b></div>
                  <div className="tg-small">{L("Síðast sótt", "Last fetched")} {fmtTime(i.lastSync)} · {L("sótt sjálfkrafa daglega", "fetched automatically every day")}</div>
                  <div className="tg-btns">
                    <button className="btn ghost sm" onClick={async () => { const r = await syncNow(i.id); toast(r.ok ? L("Velta sótt", "Revenue fetched") : (r.error ?? "Villa"), r.ok ? "ok" : "error"); void load(); }}>{L("Sækja núna", "Fetch now")}</button>
                    <button className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={async () => { await disconnectIntegration(i.id); toast(L("Aftengt", "Disconnected")); void load(); }}>{L("Aftengja", "Disconnect")}</button>
                  </div>
                </div>
              );
            }) : (
              <div className="tg-empty">
                <b>{L("Ekkert kerfi tengt enn", "No system connected yet")}</b>
                <span>{L("Veldu kerfið þitt hér fyrir neðan. Flestar tengingar taka innan við mínútu.", "Pick your system below. Most connections take under a minute.")}</span>
                <button className="btn sm" onClick={() => appsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>{L("Velja kerfi", "Choose a system")}</button>
              </div>
            ))}
            {mode === "manual" && <ManualEntry L={L} locations={v?.locations ?? []} onSaved={load} />}
            {mode === "estimate" && <EstimateEntry L={L} current={wk && !v?.learned ? Object.values(wk).reduce((a, b) => a + Number(b), 0) * 52 / 12 : 0} onSaved={load} />}
            <div className="tg-pattern">
              <div className="tg-small" style={{ marginBottom: 8 }}>
                {wk ? (v?.learned ? L("Veltumynstur vikunnar, lært úr raunveltu síðustu 8 vikna", "Weekly revenue pattern, learned from the last 8 weeks") : L("Áætlað veltumynstur vikunnar", "Estimated weekly revenue pattern")) : L("Mynstrið birtist þegar velta er komin inn", "The pattern appears once revenue comes in")}
              </div>
              <div className="tg-wk" aria-label={L("Meðalvelta eftir vikudögum", "Average revenue by weekday")}>
                {ORDER.map((d) => {
                  const val = wk ? Number(wk[String(d)] ?? 0) : 0;
                  return <div key={d} title={wk ? `${nf(val)} kr` : ""}><i style={{ height: `${wk ? Math.max(4, (val / wkMax) * 100) : 8}%`, opacity: wk ? 0.9 : 0.25 }} /><span>{WD[d][en ? 1 : 0]}</span></div>;
                })}
              </div>
              <div className="tg-small" style={{ marginTop: 8 }}>{L("Notað til að fylla daga án tölu og spá fyrir um veltu í vaktaplaninu. Raunvelta gildir alltaf þegar hún er til.", "Used to fill days without figures and to forecast revenue in the schedule. Real revenue always wins.")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" ref={appsRef}>
        <div className="ch"><div><div className="ct">{L("Kerfi sem tengjast VAKTO", "Systems that connect to VAKTO")}</div><div className="cs">{L("Veldu kerfið og fylgdu skrefunum.", "Pick your system and follow the steps.")}</div></div></div>
        <div className="cb">
          <div className="tg-bar">
            <div className="tg-chips">{CATS.map(([k, is, e]) => <button key={k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>{en ? e : is}</button>)}</div>
            <div className="tg-right">
              <input className="tg-search" placeholder={L("Leita að kerfi", "Search systems")} aria-label={L("Leita að kerfi", "Search systems")} value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="tg-search" aria-label={L("Land", "Country")} value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "auto" }}>
                <option value="IS">{L("Ísland", "Iceland")}</option><option value="XX">{L("Önnur lönd", "Other countries")}</option>
              </select>
            </div>
          </div>
          <div className="tg-grid">
            {list.map((a) => {
              const c = connected(a.id);
              const wanted = v?.interest.includes(a.id);
              return (
                <div className="tg-app" key={a.id}>
                  <div className="tg-app-h"><Logo app={a} /><span><b>{a.name}</b><small>{en ? a.sub[1] : a.sub[0]}</small></span></div>
                  <p>{en ? a.d[1] : a.d[0]}</p>
                  <div className="tg-app-f">
                    {a.kind === "connect" && (c.length ? <span className="tag good">{L("Tengt", "Connected")}</span> : <span className="tag mut">{L("Ekki tengt", "Not connected")}</span>)}
                    {a.kind === "apikey" && <span className="tag mut">{L("Með lykli", "With a key")}</span>}
                    {a.kind === "export" && <span className="tag warn">{L("Útflutningur", "Export")}</span>}
                    {a.kind === "soon" && <span className="tag info">{L("Væntanlegt", "Coming soon")}</span>}
                    {a.kind === "connect" && <button className={`btn sm${c.length ? " ghost" : ""}`} onClick={() => setConnect(a)}>{c.length ? L("Bæta við", "Add another") : L("Tengja", "Connect")}</button>}
                    {a.kind === "apikey" && <button className="btn sm" onClick={onNewKey}>{L("Búa til lykil", "Create key")}</button>}
                    {a.kind === "export" && <a className="btn ghost sm" href="/launakeyrslur">{L("Flytja út", "Export")}</a>}
                    {a.kind === "soon" && (wanted
                      ? <span className="tg-small">{L("Við látum þig vita", "We'll let you know")}</span>
                      : <button className="btn ghost sm" onClick={async () => { const r = await notifyInterest(a.id); toast(r.ok ? L("Við látum þig vita þegar tengingin er tilbúin", "We'll let you know when it's ready") : (r.error ?? "Villa")); void load(); }}>{L("Láta mig vita", "Notify me")}</button>)}
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <p className="tg-small">{L("Ekkert kerfi fannst. Sjáðu „Annað kerfi?“ hér fyrir neðan.", "No system found. See “Another system?” below.")}</p>}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="ch"><div><div className="ct">{L("Annað kerfi?", "Another system?")}</div><div className="cs">{L("Ef kerfið þitt er ekki á listanum er samt hægt að fá veltuna inn.", "If your system isn't listed you can still bring revenue in.")}</div></div></div>
        <div className="cb tg-other">
          <div><b>{L("Hlaða upp skrá", "Upload a file")}</b><span>{L("CSV eða Excel úr kassakerfinu (dagsetning og upphæð). Gott til að sækja söguna.", "CSV from your POS (date and amount). Good for importing history.")}</span><button className="btn ghost sm" onClick={() => setCsv(true)}>{L("Velja skrá", "Choose file")}</button></div>
          <div><b>Zapier / Make</b><span>{L("Notaðu „Webhooks“ til að senda veltu úr hvaða kerfi sem er, með lykli frá VAKTO.", "Use Webhooks to send revenue from any app, with a key from VAKTO.")}</span><button className="btn ghost sm" onClick={onNewKey}>{L("Búa til lykil", "Create key")}</button></div>
          <div><b>{L("Fyrir forritara", "For developers")}</b><span>{L("Sendu veltu beint í VAKTO með lykli.", "Send revenue straight to VAKTO with a key.")}</span><code className="tg-code">POST /api/v1/revenue</code></div>
        </div>
        {apiKeys.length > 0 && (
          <div className="cb att" style={{ paddingTop: 0 }}>
            <div className="tg-small" style={{ margin: "0 2px 6px" }}>{L("Lyklar", "Keys")}</div>
            {apiKeys.map((k) => (
              <div className="it" key={k.id}>
                <div className={`ic ${k.revoked ? "mut" : "good"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3zM11.4 11.6a5 5 0 1 0 1 1z" /></svg></div>
                <div className="tx"><b style={k.revoked ? { textDecoration: "line-through", color: "var(--ink3)" } : undefined}>{k.name}</b><span>{k.prefix} · {t("stofnuð")} {k.created}{k.lastUsed ? ` · ${t("síðast notuð")} ${k.lastUsed}` : ` · ${t("aldrei notuð")}`}</span></div>
                {k.revoked ? <span className="tag mut">{t("afturkölluð")}</span>
                  : <button className="btn ghost sm" style={{ color: "var(--bad)" }} onClick={async () => { const r = await revokeApiKey(k.id); toast(r.ok ? t("Tenging afturkölluð") : (r.error ?? "Villa")); }}>{t("Afturkalla")}</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      {connect && <ConnectModal app={connect} L={L} locations={v?.locations ?? []} onClose={() => setConnect(null)} onDone={() => { setConnect(null); setMode("system"); void load(); }} />}
      {csv && <CsvModal L={L} locations={v?.locations ?? []} onClose={() => setCsv(false)} onDone={() => { setCsv(false); void load(); }} />}
    </div>
  );
}

type Lf = (is: string, en: string) => string;
const yISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const digits = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

function ManualEntry({ L, locations, onSaved }: { L: Lf; locations: { id: string; name: string }[]; onSaved: () => void }) {
  const [date, setDate] = useState(yISO());
  const [amt, setAmt] = useState("");
  const [loc, setLoc] = useState(locations[0]?.name ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="tg-form">
      <b>{L("Skrá veltu", "Record revenue")}</b>
      <div className="tg-row">
        <label className="tg-field"><span>{L("Dagur", "Day")}</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="tg-field"><span>{L("Velta án VSK (kr)", "Revenue excl. VAT")}</span><input inputMode="numeric" placeholder="385.000" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))} /></label>
      </div>
      {locations.length > 1 && <label className="tg-field"><span>{L("Starfsstöð", "Location")}</span><select value={loc} onChange={(e) => setLoc(e.target.value)}>{locations.map((l) => <option key={l.id}>{l.name}</option>)}</select></label>}
      <button className="btn sm" disabled={busy || !digits(amt)} onClick={async () => {
        setBusy(true);
        const r = await addRevenue({ amount: String(digits(amt)), date, locationName: loc || undefined });
        setBusy(false);
        if (r.ok) { toast(L("Velta skráð", "Revenue saved")); setAmt(""); await relearnPattern(); onSaved(); } else toast(r.error ?? "Villa", "error");
      }}>{L("Vista", "Save")}</button>
    </div>
  );
}

function EstimateEntry({ L, current, onSaved }: { L: Lf; current: number; onSaved: () => void }) {
  const [amt, setAmt] = useState(current ? nf(Math.round(current / 1000) * 1000) : "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="tg-form">
      <b>{L("Áætluð velta", "Estimated revenue")}</b>
      <label className="tg-field"><span>{L("Velta á mánuði án VSK, ca. (kr)", "Monthly revenue excl. VAT, roughly")}</span><input inputMode="numeric" placeholder="9.500.000" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))} /></label>
      <button className="btn sm" disabled={busy || !digits(amt)} onClick={async () => { setBusy(true); const r = await saveMonthlyEstimate(digits(amt)); setBusy(false); toast(r.ok ? L("Áætlun vistuð", "Estimate saved") : (r.error ?? "Villa"), r.ok ? "ok" : "error"); if (r.ok) onSaved(); }}>{L("Vista", "Save")}</button>
      <div className="tg-small">{L("Meira um helgar, minna í byrjun viku. Laun % er merkt áætlað þar til raunvelta kemur inn.", "More at weekends, less early in the week. Labor % is marked as estimated until real revenue arrives.")}</div>
    </div>
  );
}

function ConnectModal({ app, L, locations, onClose, onDone }: { app: App; L: Lf; locations: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [site, setSite] = useState("");
  const [token, setToken] = useState("");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [loc, setLoc] = useState(locations[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const shop = app.id === "shopify";
  const steps = shop
    ? [L("Í Shopify: Settings → Apps and sales channels → Develop apps → Create an app (nefndu hana VAKTO).", "In Shopify: Settings → Apps and sales channels → Develop apps → Create an app (name it VAKTO)."),
       L("Configure Admin API scopes: hakaðu við read_orders og vistaðu. Smelltu svo á Install app.", "Configure Admin API scopes: tick read_orders and save. Then click Install app."),
       L("Afritaðu „Admin API access token“ og límdu hér. VAKTO les aðeins pantanir, aldrei kortaupplýsingar.", "Copy the Admin API access token and paste it here. VAKTO only reads orders, never card details.")]
    : [L("Í WordPress: WooCommerce → Settings → Advanced → REST API → Add key.", "In WordPress: WooCommerce → Settings → Advanced → REST API → Add key."),
       L("Nefndu lykilinn VAKTO og veldu Permissions: Read. Smelltu á Generate API key.", "Name the key VAKTO and choose Permissions: Read. Click Generate API key."),
       L("Afritaðu Consumer key og Consumer secret og límdu hér.", "Copy the Consumer key and Consumer secret and paste them here.")];
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="mh"><Logo app={app} size={36} /><div style={{ fontSize: 16, fontWeight: 650 }}>{L("Tengja", "Connect")} {app.name}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb tg-modal">
          <ol className="tg-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <label className="tg-field"><span>{shop ? L("Slóð verslunar", "Store address") : L("Slóð vefverslunar", "Store URL")}</span><input placeholder={shop ? "verslunin.myshopify.com" : "https://verslunin.is"} value={site} onChange={(e) => setSite(e.target.value)} autoComplete="off" /></label>
          {shop
            ? <label className="tg-field"><span>Admin API access token</span><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="shpat_…" autoComplete="off" /></label>
            : <><label className="tg-field"><span>Consumer key</span><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ck_…" autoComplete="off" /></label>
                <label className="tg-field"><span>Consumer secret</span><input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="cs_…" autoComplete="off" /></label></>}
          {locations.length > 1 && <label className="tg-field"><span>{L("Veltan fer á starfsstöð", "Revenue goes to location")}</span><select value={loc} onChange={(e) => setLoc(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
          {err && <div className="tg-err">{err}</div>}
          <button className="btn" disabled={busy} onClick={async () => {
            setBusy(true); setErr(null);
            const r = await connectIntegration({ provider: shop ? "shopify" : "woocommerce", site, token, key, secret, locationId: loc || undefined });
            setBusy(false);
            if (r.ok) { toast(`${app.name} ${L("tengt", "connected")}${r.total ? ` · ${nf(r.total)} kr ${L("sóttar", "fetched")}` : ""}`); onDone(); } else setErr(r.error ?? "Villa");
          }}>{busy ? L("Tengi og sæki veltu…", "Connecting and fetching…") : L("Tengja og sækja veltu", "Connect and fetch revenue")}</button>
          <div className="tg-small">{L("Fyrsta sókn nær 90 daga aftur í tímann. Svo er sótt sjálfkrafa daglega. Þú getur aftengt hvenær sem er.", "The first fetch goes back 90 days. After that it runs automatically every day. Disconnect at any time.")}</div>
        </div>
      </div>
    </div>
  );
}

/** CSV/TSV: hver lína „dagsetning;upphæð“ (YYYY-MM-DD eða DD.MM.YYYY). Fyrirsagnarlína hunsuð. */
function parseCsv(text: string): { date: string; amount: number }[] {
  const out = new Map<string, number>();
  for (const raw of text.split(/\r?\n/)) {
    const cells = raw.split(/[;\t,](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/"/g, "").trim());
    if (cells.length < 2) continue;
    let date = "";
    const m1 = cells[0].match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), m2 = cells[0].match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m1) date = `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
    else if (m2) date = `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
    if (!date) continue;
    const val = cells.slice(1).map((c) => Number(c.replace(/\s|kr/gi, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))).find((n) => Number.isFinite(n) && n > 0);
    if (val) out.set(date, (out.get(date) ?? 0) + val);
  }
  return [...out.entries()].map(([date, amount]) => ({ date, amount: Math.round(amount) })).sort((a, b) => a.date.localeCompare(b.date));
}

function CsvModal({ L, locations, onClose, onDone }: { L: Lf; locations: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<{ date: string; amount: number }[] | null>(null);
  const [loc, setLoc] = useState(locations[0]?.name ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 650 }}>{L("Hlaða upp veltu", "Upload revenue")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb tg-modal">
          <div className="tg-small">{L("CSV-skrá með dagsetningu í fyrsta dálki og veltu án VSK í öðrum, t.d. „2026-09-01;412300“. Ef dagur er þegar skráður bætist upphæðin við.", "A CSV with the date in the first column and revenue excl. VAT in the second, e.g. “2026-09-01;412300”. If a day already has revenue the amount is added.")}</div>
          <input type="file" accept=".csv,.txt,.tsv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRows(parseCsv(await f.text())); }} />
          {rows && (rows.length
            ? <div className="tg-conn-n"><span>{rows.length} {L("dagar", "days")} · {rows[0].date} – {rows[rows.length - 1].date}</span><b>{nf(rows.reduce((a, r) => a + r.amount, 0))} kr</b></div>
            : <div className="tg-err">{L("Engar línur fundust. Athugaðu að dagsetning sé í fyrsta dálki.", "No rows found. Check that the date is in the first column.")}</div>)}
          {locations.length > 1 && <label className="tg-field"><span>{L("Starfsstöð", "Location")}</span><select value={loc} onChange={(e) => setLoc(e.target.value)}>{locations.map((l) => <option key={l.id}>{l.name}</option>)}</select></label>}
          <button className="btn" disabled={busy || !rows?.length} onClick={async () => {
            setBusy(true); let ok = 0;
            for (const r of rows ?? []) { const res = await addRevenue({ amount: String(r.amount), date: r.date, locationName: loc || undefined }); if (res.ok) ok++; }
            await relearnPattern();
            setBusy(false); toast(`${ok} ${L("dagar fluttir inn", "days imported")}`); onDone();
          }}>{busy ? L("Flyt inn…", "Importing…") : L("Flytja inn", "Import")}</button>
        </div>
      </div>
    </div>
  );
}
