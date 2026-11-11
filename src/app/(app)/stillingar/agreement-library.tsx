"use client";

// Stillingar → Reglur og laun → Kjarasamningasafn: öll afbrigði kjarasamninga flokkuð eftir félagi, opna eitt og sjá
// á mannamáli hvernig launin reiknast, „Nota þessa reglu“ (staðall fyrirtækisins / valið starfsfólk), „Afrita sem eigin
// reglu“ (ritill), „Spyrja um samninginn“ (AI) og „Lesa samning með AI“ (PDF/texti → drög til yfirferðar).
// Launalyklar fyrirtækisins (PayKeysCard) eru hér líka.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { AGREEMENTS_LIB, UNION_ORDER, describeRules, rulesOf, type Agreement, type AgreementStatus } from "@/lib/agreements";
import { CUSTOM_UNION, type Band, type CustomRules, type PayKeyComp, type PayKeys } from "@/lib/payrules";
import { PAY_KEY_COMPONENTS } from "@/lib/pay-keys";
import { engineToTemplate, type RuleTemplate } from "@/lib/rules";
import type { AgreementResult, AgreementSource } from "@/lib/ai/agreement";
import { saveRuleTemplate, deleteRuleTemplate } from "./actions";
import { applyAgreement, getAgreementSetup, savePayKeys, type AgreementSetup } from "./agreement-actions";

const pc = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const STATUS: Record<AgreementStatus, { cls: string; is: string }> = {
  verified: { cls: "good", is: "Staðfest" },
  partial: { cls: "warn", is: "Staðfest að hluta" },
  unverified: { cls: "bad", is: "Óstaðfest" },
};

const Doc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 13h6M9 17h4" /></svg>
);
const Spark = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /></svg>
);

// ============================================================ safnið
export function AgreementLibraryCard({ templates }: { templates: RuleTemplate[] }) {
  const { t } = useLang();
  const router = useRouter();
  const [setup, setSetup] = useState<AgreementSetup | null>(null);
  const [union, setUnion] = useState<string>("");
  const [legacy, setLegacy] = useState(false);
  const [open, setOpen] = useState<Agreement | null>(null);
  const [editor, setEditor] = useState<EditorInit | null>(null);
  const reload = () => getAgreementSetup().then(setSetup).catch(() => {});
  useEffect(() => { reload(); }, []);

  const inUse = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of setup?.employees ?? []) m.set(e.used, (m.get(e.used) ?? 0) + 1);
    return m;
  }, [setup]);
  const list = AGREEMENTS_LIB.filter((a) => (!union || a.union === union) && (legacy || !a.legacy || (inUse.get(a.preset) ?? 0) > 0));
  const groups = UNION_ORDER.map((u) => ({ u, items: list.filter((a) => a.union === u) })).filter((g) => g.items.length);
  const engineTpls = templates.filter((tp) => tp.rules.engine);

  return (
    <div className="card" style={{ marginBottom: 16 }} id="kjarasamningar">
      <div className="ch">
        <div><div className="ct">{t("Kjarasamningasafn")}</div><div className="cs">{t("samningar SA 2024–2028 — veldu reglu, sjáðu hvernig launin reiknast og notaðu hana")}</div></div>
        <button className="btn sm" onClick={() => setEditor({ ai: true })}><Spark />{t("Lesa samning með AI")}</button>
      </div>
      <div className="cb">
        <div className="kjs-chips">
          <button className={`kjs-chip${!union ? " on" : ""}`} onClick={() => setUnion("")}>{t("Öll félög")}</button>
          {UNION_ORDER.map((u) => <button key={u} className={`kjs-chip${union === u ? " on" : ""}`} onClick={() => setUnion(u)}>{u}</button>)}
          <label className="kjs-legacy"><input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} /> {t("Eldri staðlar")}</label>
        </div>
        {setup?.defaultAgreement && (
          <p className="muted" style={{ fontSize: 12, margin: "2px 0 10px" }}>{t("Staðall fyrir nýtt starfsfólk")}: <b style={{ color: "var(--ink)" }}>{setup.defaultAgreement}</b></p>
        )}
        {groups.map((g) => (
          <div key={g.u} className="kjs-group">
            <div className="kjs-gh">{g.u} <span>{t("og SA")}</span></div>
            <div className="att">
              {g.items.map((a) => {
                const r = rulesOf(a), n = inUse.get(a.preset) ?? 0;
                return (
                  <div className="it rowlink" key={a.id} onClick={() => setOpen(a)}>
                    <div className={`ic ${a.kind === "vaktavinna" ? "info" : "mut"}`} style={a.kind === "vaktavinna" ? undefined : { background: "var(--line2)" }}><Doc /></div>
                    <div className="tx">
                      <b>{a.title}</b>
                      <span>{a.sector} · {t(`kind:${a.kind}`)} · {r.eve ? `${t("kvöld")} +${pc(r.eve)}% · ` : ""}{t("lib:ot")} +{pc(r.overtime)}%{n ? ` · ${n} ${t("starfsm. á reglunni")}` : ""}</span>
                    </div>
                    <span className={`tag ${STATUS[a.status].cls}`}>{t(STATUS[a.status].is)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {engineTpls.length > 0 && (
          <div className="kjs-group">
            <div className="kjs-gh">{t("Eigin reglur")}</div>
            <div className="att">
              {engineTpls.map((tp) => (
                <div className="it rowlink" key={tp.id} onClick={() => setEditor({ template: tp })}>
                  <div className="ic info"><Doc /></div>
                  <div className="tx"><b>{tp.name}</b><span>{describeRules(tp.rules.engine!).slice(1, 4).map((l) => `${l.label} ${l.value}`).join(" · ")}{(() => { const n = setup?.employees.filter((e) => e.custom && e.templateName === tp.name).length ?? 0; return n ? ` · ${n} ${t("starfsm. á reglunni")}` : ""; })()}</span></div>
                  <span className={`tag ${tp.source === "ai" ? "info" : "good"}`}>{tp.source === "ai" ? "AI" : t("eigin")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          {t("„Staðfest“ = hver tala hefur verið borin saman við lokaskjal samningsins á sa.is. Laun starfsfólks breytast aðeins þegar þú velur „Nota þessa reglu“. Launataxtar (kr) fylgja ekki — þeir eru á hverjum starfsmanni.")}
        </p>
      </div>
      {open && (
        <AgreementModal a={open} setup={setup} onClose={() => setOpen(null)}
          onCopy={() => { const a = open; setOpen(null); setEditor({ from: a }); }}
          onApplied={() => { reload(); router.refresh(); }} />
      )}
      {editor && <RuleEditorModal init={editor} setup={setup} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); reload(); router.refresh(); }} />}
    </div>
  );
}

// ============================================================ einn samningur
function AgreementModal({ a, setup, onClose, onCopy, onApplied }: { a: Agreement; setup: AgreementSetup | null; onClose: () => void; onCopy: () => void; onApplied: () => void }) {
  const { t, lang } = useLang();
  const [panel, setPanel] = useState<"apply" | "ask" | null>(null);
  const r = rulesOf(a);
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="mh">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{a.title}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.union} {t("og SA")} · {a.sector} · {t(`kind:${a.kind}`)} · {a.validity}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <span className={`tag ${STATUS[a.status].cls}`} style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 7 }}>{t(STATUS[a.status].is)}</span>
            {a.legacy && <span className="tag mut" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 7 }}>{t("Eldri staðall")}</span>}
            <span className="muted" style={{ fontSize: 12 }}>{t("Reiknað sem")} „{a.preset}“</span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 4px" }}>{a.who}</p>
          <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>{a.hours}</p>

          <div className="kjs-sec">{t("Hvernig launin reiknast")}</div>
          <div className="kjs-rows">
            {describeRules(r, lang).map((l, i) => (
              <div className="kjs-row" key={i}><span className="k">{l.label}{l.detail ? <small>{l.detail}</small> : null}</span><span className="v">{l.value}</span></div>
            ))}
          </div>

          {a.points.length > 0 && <>
            <div className="kjs-sec">{t("Annað í samningnum")}</div>
            {a.points.map((p, i) => (
              <div key={i} className="kjs-point"><b>{p.label}.</b> {p.text}{p.ref ? <span className="muted"> · {p.ref}</span> : null}</div>
            ))}
          </>}

          <div className="kjs-sec">{t("Orlof eftir starfsaldri")}</div>
          {a.orlof.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 8 }}>
              {g.group && <div style={{ fontSize: 12, fontWeight: 600, margin: "2px 0 4px" }}>{g.group}</div>}
              <div className="kjs-orlof">
                {g.steps.map((s, i) => (
                  <div key={i}><b>{s.days} {t("dagar")}</b><span>{pc(s.pct)} %</span><small>{s.when}</small></div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>{g.ref}</div>
            </div>
          ))}

          {a.unverified.length > 0 && (
            <div className="kjs-warn">
              <b>{t("Óstaðfest eða einfaldað í VAKTO")}</b>
              <ul>{a.unverified.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          <a href={a.source.url} target="_blank" rel="noreferrer" className="kjs-src"><Doc /> {a.source.label}</a>

          <div className="kjs-actions">
            <button className={`btn${panel === "apply" ? "" : " primary"}`} onClick={() => setPanel(panel === "apply" ? null : "apply")}>{t("Nota þessa reglu")}</button>
            <button className="btn ghost" onClick={onCopy}>{t("Afrita sem eigin reglu")}</button>
            <button className="btn ghost" onClick={() => setPanel(panel === "ask" ? null : "ask")}><Spark />{t("Spyrja um samninginn")}</button>
          </div>
          {panel === "apply" && <ApplyPanel preset={a.preset} label={a.title} setup={setup} onDone={() => { onApplied(); onClose(); }} />}
          {panel === "ask" && <AskPanel agreementId={a.id} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================ nota reglu
function ApplyPanel({ preset, templateId, label, setup, onDone }: { preset?: string; templateId?: string; label: string; setup: AgreementSetup | null; onDone: () => void }) {
  const { t } = useLang();
  const emps = setup?.employees ?? [];
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [makeDefault, setMakeDefault] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  if (!setup?.canEdit) return <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{t("Aðeins eigandi eða stjórnandi með aðgang að launakeyrslum getur breytt launareglum.")}</p>;
  const shown = emps.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const current = (e: AgreementSetup["employees"][number]) => (e.custom ? (e.templateName ?? CUSTOM_UNION) : e.used);
  async function go() {
    if (!sel.size && !makeDefault) { toast(t("Veldu starfsfólk eða staðal fyrir nýtt starfsfólk")); return; }
    if (sel.size && !window.confirm(`${t("lib:laun")} ${sel.size} ${t("starfsmanna reiknast eftir")} „${label}“ ${t("frá og með næstu launakeyrslu. Halda áfram?")}`)) return;
    setBusy(true);
    const r = await applyAgreement({ preset, templateId, employeeIds: [...sel], makeDefault });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? t("Tókst ekki")); return; }
    toast(r.demo ? t("Vistað (demo)") : `${t("Reglan er komin á")}${r.count ? ` ${r.count} ${t("starfsmenn")}` : ""}${makeDefault ? ` · ${t("staðall fyrir nýtt starfsfólk")}` : ""}`);
    onDone();
  }
  return (
    <div className="kjs-panel">
      {preset && (
        <label className="kjs-check"><input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
          <span><b>{t("Staðall fyrirtækisins")}</b> — {t("sjálfvalið þegar nýtt starfsfólk er stofnað")}{setup.defaultAgreement === preset ? ` (${t("er nú þegar")})` : ""}</span></label>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0 6px", flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5 }}>{t("Starfsfólk")}</b>
        {emps.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Leita…")} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", font: "inherit", fontSize: 12.5, flex: 1, minWidth: 120 }} />}
        <button className="btn ghost sm" onClick={() => setSel(new Set(shown.map((e) => e.id)))}>{t("Velja alla")}</button>
        <button className="btn ghost sm" onClick={() => setSel(new Set())}>{t("Engan")}</button>
      </div>
      <div className="kjs-emps">
        {shown.map((e) => (
          <label key={e.id} className="kjs-emp">
            <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
            <span className="n">{e.name}</span>
            <span className={`c${(preset && e.used === preset && !e.custom) ? " same" : ""}`}>{current(e)}</span>
          </label>
        ))}
        {emps.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{t("Ekkert virkt starfsfólk.")}</p>}
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "8px 0", lineHeight: 1.5 }}>{t("Aðeins valið starfsfólk breytist. Félagsaðild helst; reglan sem launin reiknast eftir breytist frá og með næstu launakeyrslu. Lokaðar launakeyrslur breytast ekki.")}</p>
      <button className="btn primary" disabled={busy} onClick={go}>{busy ? t("Vista…") : sel.size ? `${t("Nota á")} ${sel.size} ${t("starfsmenn")}` : t("Vista")}</button>
    </div>
  );
}

// ============================================================ spyrja AI
function AskPanel({ agreementId, templateId }: { agreementId?: string; templateId?: string }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<{ q: string; a: string }[]>([]);
  async function ask() {
    const question = q.trim();
    if (!question) return;
    setBusy(true);
    try {
      const r = await fetch("/api/ai/agreement/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agreementId, templateId, question, history: hist }) });
      const res = (await r.json()) as { ok: boolean; answer?: string; error?: string };
      if (!res.ok || !res.answer) { toast(res.error ?? t("AI svaraði ekki")); return; }
      setHist((h) => [...h, { q: question, a: res.answer! }]); setQ("");
    } catch { toast(t("AI svaraði ekki")); } finally { setBusy(false); }
  }
  return (
    <div className="kjs-panel">
      {hist.map((h, i) => (
        <div key={i} className="kjs-qa"><div className="q">{h.q}</div><div className="a">{h.a}</div></div>
      ))}
      <textarea className="lf-ta" rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("t.d. Hvað fær starfsmaður fyrir vakt á laugardagskvöldi? Hvenær fær hann 30 daga orlof?")}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>{t("AI svarar út frá reglunni sem VAKTO reiknar eftir og vísar í greinar — ekki lögfræðiráðgjöf.")}</span>
        <button className="btn sm" disabled={busy || !q.trim()} onClick={ask}>{busy ? t("AI hugsar…") : t("Spyrja")}</button>
      </div>
    </div>
  );
}

// ============================================================ ritill: eigin regla (nákvæm launaregla)
type EditorInit = { from?: Agreement; template?: RuleTemplate; ai?: boolean };
const DAY_CHIPS: [number, string][] = [[1, "Má"], [2, "Þr"], [3, "Mi"], [4, "Fi"], [5, "Fö"], [6, "La"], [0, "Su"]];
const NUM_FIELDS: { k: keyof CustomRules; label: string; hint?: string }[] = [
  { k: "eve", label: "Kvöld / utan dagvinnu %" },
  { k: "night", label: "Nætur %" },
  { k: "weekend", label: "Helgar %" },
  { k: "holiday", label: "Stórhátíðir %" },
  { k: "overtime", label: "Yfirvinna %" },
  { k: "otWeekly", label: "Yfirvinna eftir klst./viku" },
  { k: "otMonthly", label: "… eða klst./mánuði" },
  { k: "ot1Weekly", label: "Yfirvinna 1 frá klst./viku" },
  { k: "ot1Pct", label: "Yfirvinna 1 %" },
  { k: "fridagur", label: "Almennir frídagar % (ef annað en helgar)" },
  { k: "graceMin", label: "Svigrúm (mín.)", hint: "stimplun nálægt upphafi/lokum dagvinnu færist á mörkin" },
  { k: "restHours", label: "Lágmarkshvíld (klst.)" },
];

function RuleEditorModal({ init, setup, onClose, onSaved }: { init: EditorInit; setup: AgreementSetup | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang();
  const tpl = init.template;
  const start: CustomRules = tpl?.rules.engine ?? (init.from ? structuredClone(rulesOf(init.from)) : { eve: 0, weekend: 0, night: 0, overtime: 80, holiday: 90 });
  const [name, setName] = useState(tpl?.name ?? (init.from ? `${init.from.union} — ${init.from.title} (eigin)` : ""));
  const [unionName, setUnionName] = useState(tpl?.union_name ?? init.from?.unionName ?? "");
  const [r, setR] = useState<CustomRules>(start);
  const [source, setSource] = useState<"manual" | "preset" | "ai">(tpl?.source ?? (init.from ? "preset" : "manual"));
  const [sources, setSources] = useState<AgreementSource[]>(tpl?.rules.sources ?? []);
  const [missing, setMissing] = useState<string[]>([]);
  const [orlof, setOrlof] = useState<{ days: number; pct: number; condition: string }[]>([]);
  const [note, setNote] = useState<string>(tpl?.rules.notes ?? "");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(!!tpl || !init.ai);
  const [aiOpen, setAiOpen] = useState(!!init.ai);
  const [paste, setPaste] = useState("");
  const [hint, setHint] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"apply" | "ask" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<CustomRules>) => setR((x) => ({ ...x, ...patch }));
  const numStr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v < 1000 ? String(v).replace(".", ",") : "");
  const parse = (s: string): number | undefined => { const n = Number(s.replace(",", ".").trim()); return s.trim() === "" || !Number.isFinite(n) ? undefined : n; };
  const bands = r.bands ?? [];
  const setBand = (i: number, p: Partial<Band>) => set({ bands: bands.map((b, j) => (j === i ? { ...b, ...p } : b)) });

  async function readAi(file?: File) {
    if (!file && paste.trim().length < 200) { toast(t("Veldu PDF eða límdu inn meiri texta úr samningnum")); return; }
    setAiBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file); else fd.append("text", paste);
      fd.append("hint", hint);
      const res = (await (await fetch("/api/ai/agreement", { method: "POST", body: fd })).json()) as AgreementResult;
      if (!res.ok || !res.engine) { toast(res.error ?? t("Tókst ekki að lesa samninginn")); return; }
      setR(res.engine); setSources(res.sources); setMissing(res.missing); setOrlof(res.orlof ?? []);
      setExplanation(res.explanation); setNote(res.rules.notes ?? ""); setSource("ai"); setReviewed(false); setAiOpen(false);
      if (!name) setName(res.name);
    } catch { toast(t("Tókst ekki að lesa samninginn")); } finally {
      setAiBusy(false); if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!name.trim()) { toast(t("Gefðu reglunni nafn")); return; }
    if (source === "ai" && !reviewed) { toast(t("Staðfestu að þú hafir borið gildin saman við samninginn")); return; }
    setBusy(true);
    const top = orlof.slice().sort((a, b) => a.days - b.days)[0];
    const res = await saveRuleTemplate({
      id: tpl?.id, name: name.trim(), country: "Ísland", unionName, source,
      rules: engineToTemplate({ ...r, templateName: name.trim() }, { notes: note || undefined, vacationDays: top?.days, vacationPct: top?.pct, sources }),
    });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? t("Tókst ekki")); return; }
    toast(res.demo ? t("Vistað (demo)") : t("Regla vistuð — notaðu hana á starfsfólk úr safninu"));
    onSaved();
  }
  async function remove() {
    if (!tpl?.id || !window.confirm(t("Eyða reglunni? Starfsfólk sem er á henni heldur reglunum sínum."))) return;
    setBusy(true);
    const res = await deleteRuleTemplate(tpl.id);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? t("Tókst ekki")); return; }
    onSaved();
  }

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{tpl ? tpl.name : init.from ? t("Afrita sem eigin reglu") : t("Ný regla úr kjarasamningi")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb" style={{ maxHeight: "74vh", overflowY: "auto" }}>
          {/* ---- AI lestur ---- */}
          {aiOpen ? (
            <div className="kjs-panel" style={{ marginTop: 0, marginBottom: 12 }}>
              <b style={{ fontSize: 13 }}>{t("AI les kjarasamninginn")}</b>
              <p className="muted" style={{ fontSize: 12, margin: "4px 0 8px", lineHeight: 1.5 }}>{t("Hladdu upp PDF eða límdu inn kaflana um vinnutíma, álög, yfirvinnu og orlof. AI fyllir reglurnar út sem DRÖG með tilvitnun í grein fyrir hvert gildi — ekkert er notað fyrr en þú vistar.")}</p>
              <div className="field"><label>{t("Hlutverk / starfsaldur (valfrjálst)")}</label><input value={hint} onChange={(e) => setHint(e.target.value)} placeholder={t("t.d. matreiðslumaður í vaktavinnu, 4 ár í starfi")} /></div>
              <textarea className="lf-ta" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t("…eða límdu inn texta úr samningnum hér")} />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button className="btn sm" disabled={aiBusy} onClick={() => fileRef.current?.click()}><Doc />&nbsp;{aiBusy ? t("Les samninginn… (allt að mínúta)") : t("Hlaða upp PDF")}</button>
                <button className="btn ghost sm" disabled={aiBusy || paste.trim().length < 200} onClick={() => readAi()}>{t("Lesa límdan texta")}</button>
                {!init.ai && <button className="btn ghost sm" onClick={() => setAiOpen(false)}>{t("Loka")}</button>}
              </div>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf,.txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readAi(f); }} />
            </div>
          ) : (
            !tpl && <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => setAiOpen(true)}><Spark />{t("Lesa samning með AI")}</button>
          )}
          {explanation && <p className="muted" style={{ fontSize: 12, background: "var(--brand-soft)", borderRadius: 9, padding: "9px 11px", marginBottom: 10 }}>{explanation}</p>}
          {sources.length > 0 && (
            <div className="kjs-panel" style={{ marginTop: 0, marginBottom: 12 }}>
              <div className="kjs-sec" style={{ marginTop: 0 }}>{t("Heimildir úr samningnum")}</div>
              {sources.map((s, i) => (
                <div key={i} style={{ fontSize: 12.5, padding: "5px 0", borderTop: i ? "1px dashed var(--line2)" : undefined }}>
                  <div><b>{s.field}</b> = {s.value} <span className="muted">· {s.location}</span></div>
                  <div className="muted" style={{ fontStyle: "italic", marginTop: 2 }}>„{s.quote}“</div>
                </div>
              ))}
              {missing.length > 0 && <div style={{ fontSize: 12.5, marginTop: 8, color: "var(--warn)" }}>{t("Ekki í samningnum — fylltu inn sjálf(ur):")} {missing.join(", ")}</div>}
              {orlof.length > 0 && <div style={{ fontSize: 12.5, marginTop: 8 }}><b>{t("Orlofsþrep")}:</b> {orlof.map((o) => `${o.days} d / ${pc(o.pct)} % (${o.condition})`).join(" · ")}</div>}
              {source === "ai" && !tpl && (
                <label className="kjs-check" style={{ marginTop: 10 }}><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /><span>{t("Ég hef borið gildin saman við samninginn og þau eru rétt.")}</span></label>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 2, minWidth: 200 }}><label>{t("Heiti reglu")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Matvís — kokkar á kvöldvöktum")} /></div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>{t("Stéttarfélag")}</label><input value={unionName} onChange={(e) => setUnionName(e.target.value)} placeholder="Matvís" /></div>
          </div>

          <div className="kjs-sec">{t("Dagvinna (mán.–fös.)")}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {([["dayStart", "Hefst kl."], ["dayEnd", "Lýkur kl."], ["nightEnd", "Næturálag til kl."]] as const).map(([k, l]) => (
              <div className="field" key={k} style={{ flex: 1, minWidth: 110 }}><label>{t(l)}</label>
                <input inputMode="numeric" value={numStr(r[k] ?? (k === "dayEnd" ? 17 : 8))} onChange={(e) => { const n = parse(e.target.value); set({ [k]: n == null ? undefined : Math.max(0, Math.min(24, Math.round(n))) } as Partial<CustomRules>); }} />
              </div>
            ))}
          </div>
          <label className="kjs-check"><input type="checkbox" checked={!!r.verslStor} onChange={(e) => set({ verslStor: e.target.checked || undefined })} /><span>{t("Frídagur verslunarmanna er stórhátíðardagur (VR)")}</span></label>

          <div className="kjs-sec">{t("Álög og yfirvinna")}</div>
          <div className="kjs-grid">
            {NUM_FIELDS.map((f) => (
              <div className="field" key={f.k} style={{ margin: 0 }}><label title={f.hint}>{t(f.label)}</label>
                <input inputMode="decimal" value={numStr(r[f.k])} placeholder="—" onChange={(e) => {
                  const n = parse(e.target.value);
                  const required = ["eve", "night", "weekend", "holiday", "overtime"].includes(f.k);
                  set({ [f.k]: n == null ? (required ? 0 : undefined) : n } as Partial<CustomRules>);
                }} />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="kjs-sec">{t("Sérálög (tímabil og dagar)")}</div>
            <button className="btn ghost sm" onClick={() => set({ bands: [...bands, { label: "", days: [1, 2, 3, 4, 5], from: "17:00", to: "24:00", pct: 0 }] })}>+ {t("Nýtt álag")}</button>
          </div>
          {bands.length === 0 && <p className="muted" style={{ fontSize: 12 }}>{t("Engin sérálög — t.d. 55 % kl. 00–05 aðfaranótt laugardags. Hæsta álag gildir þegar tvö skarast.")}</p>}
          {bands.map((b, i) => (
            <div key={i} className="kjs-band">
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ flex: 2, minWidth: 120 }} value={b.label} placeholder={t("Heiti")} onChange={(e) => setBand(i, { label: e.target.value })} />
                <input style={{ width: 58 }} inputMode="decimal" value={b.pct ? pc(b.pct) : ""} placeholder="%" onChange={(e) => setBand(i, { pct: parse(e.target.value) ?? 0 })} />
                <span className="muted" style={{ fontSize: 11 }}>%</span>
                <input style={{ width: 62 }} value={b.from} onChange={(e) => setBand(i, { from: e.target.value })} />
                <span className="muted">–</span>
                <input style={{ width: 62 }} value={b.to} onChange={(e) => setBand(i, { to: e.target.value })} />
                <input style={{ width: 92 }} value={b.key ?? ""} placeholder={t("Launalykill")} onChange={(e) => setBand(i, { key: e.target.value || undefined })} />
                <button className="x" title={t("Eyða")} onClick={() => set({ bands: bands.filter((_, j) => j !== i) })}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {DAY_CHIPS.map(([d, l]) => (
                  <button key={d} type="button" className={`kjs-chip sm${b.days.includes(d) ? " on" : ""}`}
                    onClick={() => setBand(i, { days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d].sort() })}>{l}</button>
                ))}
              </div>
            </div>
          ))}

          <div className="kjs-sec">{t("Launalyklar reglunnar")} <span className="muted" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· {t("tómt = lykill fyrirtækisins")}</span></div>
          <div className="kjs-grid">
            {PAY_KEY_COMPONENTS.map((c) => (
              <div className="field" key={c.comp} style={{ margin: 0 }}><label>{t(c.label)}</label>
                <input value={r.keys?.[c.comp] ?? ""} placeholder={setup?.payKeys?.[c.comp] ?? "—"} onChange={(e) => set({ keys: { ...(r.keys ?? {}), [c.comp]: e.target.value || undefined } })} />
              </div>
            ))}
          </div>

          <div className="field" style={{ marginTop: 10 }}><label>{t("Athugasemdir")}</label>
            <textarea className="lf-ta" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("t.d. sérákvæði, neysluhlé, útköll…")} />
          </div>

          <div className="kjs-sec">{t("Svona reiknast launin")}</div>
          <div className="kjs-rows">
            {describeRules(r).map((l, i) => <div className="kjs-row" key={i}><span className="k">{l.label}{l.detail ? <small>{l.detail}</small> : null}</span><span className="v">{l.value}</span></div>)}
          </div>

          <div className="kjs-actions">
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? t("Vista…") : t("Vista reglu")}</button>
            {tpl?.id && <button className="btn ghost" onClick={() => setPanel(panel === "apply" ? null : "apply")}>{t("Nota á starfsfólk")}</button>}
            {tpl?.id && <button className="btn ghost" onClick={() => setPanel(panel === "ask" ? null : "ask")}><Spark />{t("Spyrja")}</button>}
            {tpl?.id && <button className="btn ghost" disabled={busy} onClick={remove} style={{ color: "var(--bad)" }}>{t("Eyða")}</button>}
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
          {panel === "apply" && tpl?.id && <ApplyPanel templateId={tpl.id} label={tpl.name} setup={setup} onDone={onSaved} />}
          {panel === "ask" && tpl?.id && <AskPanel templateId={tpl.id} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================ launalyklar fyrirtækisins
export function PayKeysCard() {
  const { t } = useLang();
  const [keys, setKeys] = useState<PayKeys | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => { getAgreementSetup().then((s) => { setKeys(s.payKeys); setSaved(JSON.stringify(s.payKeys)); setCanEdit(s.canEdit); }).catch(() => {}); }, []);
  if (!keys || !canEdit) return null;
  const dirty = JSON.stringify(keys) !== saved;
  async function save() {
    setBusy(true);
    const r = await savePayKeys(keys!);
    setBusy(false);
    if (r.ok) setSaved(JSON.stringify(keys));
    toast(r.ok ? t("Launalyklar vistaðir") : (r.error ?? "Villa"));
  }
  return (
    <div className="card" style={{ marginBottom: 16 }} id="launalyklar">
      <div className="ch"><div><div className="ct">{t("Launalyklar")}</div><div className="cs">{t("heiti launaliða í Payday — hver tímaflokkur fer á sinn lið í tímaskránni")}</div></div></div>
      <div className="cb">
        <div className="kjs-grid">
          {PAY_KEY_COMPONENTS.map((c) => (
            <div className="field" key={c.comp} style={{ margin: 0 }}>
              <label title={t(c.hint)}>{t(c.label)}</label>
              <input value={keys[c.comp as PayKeyComp] ?? ""} placeholder={c.comp === "dagvinna" ? "Dagvinna" : c.comp === "yfirvinna" ? "Yfirvinna" : c.comp === "yfirvinna1" ? "Yfirvinna 1" : t("Álag x%")}
                onChange={(e) => setKeys({ ...keys, [c.comp]: e.target.value || undefined })} />
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0", lineHeight: 1.5 }}>
          {t("Tómt = sjálfgefið heiti („Dagvinna“, „Yfirvinna“, „Álag 33%“). Launaliðurinn þarf að vera til í Payday með nákvæmlega sama heiti. Sérálög í eigin reglum geta haft eigin lykil. DK notar launaliðanúmerin í Tengingar → DK.")}
        </p>
        {dirty && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><button className="btn primary" disabled={busy} onClick={save}>{busy ? t("Vista…") : t("Vista launalykla")}</button></div>}
      </div>
    </div>
  );
}
