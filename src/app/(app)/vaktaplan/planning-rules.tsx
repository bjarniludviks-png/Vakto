"use client";

// Planreglur (0101): fastar reglur sem AI-vaktaplanið virðir í hverju plani. Sýnt í AI-glugga Vaktaplans;
// VAKTO AI getur líka vistað reglu („mundu að …“) eftir staðfestingu.

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { MAX_RULE_LEN, type PlanningRule } from "@/lib/planning-rules";
import { listPlanningRules, addPlanningRule, setPlanningRuleActive, deletePlanningRule } from "./actions";

export function PlanningRules({ examples = [] }: { examples?: string[] }) {
  const { t } = useLang();
  const [rules, setRules] = useState<PlanningRule[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listPlanningRules().then((r) => { if (r.ok) setRules(r.rules); else { setRules([]); setErr(r.error ?? null); } }).catch(() => setRules([]));
  }, []);

  async function add() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    const r = await addPlanningRule(v);
    setBusy(false);
    if (r.ok && r.rule) { setRules((x) => [...(x ?? []), r.rule!]); setText(""); } else toast(r.error ?? t("Tókst ekki"));
  }
  async function toggle(rule: PlanningRule) {
    setRules((x) => x?.map((y) => (y.id === rule.id ? { ...y, active: !y.active } : y)) ?? null);
    const r = await setPlanningRuleActive(rule.id, !rule.active);
    if (!r.ok) { setRules((x) => x?.map((y) => (y.id === rule.id ? rule : y)) ?? null); toast(r.error ?? t("Tókst ekki")); }
  }
  async function remove(rule: PlanningRule) {
    const prev = rules;
    setRules((x) => x?.filter((y) => y.id !== rule.id) ?? null);
    const r = await deletePlanningRule(rule.id);
    if (!r.ok) { setRules(prev); toast(r.error ?? t("Tókst ekki")); }
  }

  if (err) return null; // t.d. 0101 vantar eða ekki stjórnandi — glugginn virkar áfram án reglna
  const active = rules?.filter((r) => r.active).length ?? 0;
  return (
    <div className="prules">
      <div className="prules-h">
        <b>{t("Planreglur")}</b>
        <span className="muted">{rules === null ? t("Sæki…") : active ? `${active} ${t("virkar — gilda í hverju plani")}` : t("Vistaðu reglur sem eiga alltaf að gilda")}</span>
      </div>
      {rules && rules.length > 0 && (
        <ul>
          {rules.map((r) => (
            <li key={r.id} className={r.active ? "" : "off"}>
              <input type="checkbox" checked={r.active} onChange={() => toggle(r)} title={r.active ? t("Slökkva á reglu") : t("Kveikja á reglu")} />
              <span>{r.text}{r.via === "ai" && <small> · VAKTO AI</small>}</span>
              <button type="button" onClick={() => remove(r)} aria-label={t("Eyða reglu")}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="prules-add">
        <input value={text} maxLength={MAX_RULE_LEN} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          placeholder={examples[0] ? `${t("t.d.")} ${examples[0]}` : t("t.d. Alltaf 3 á vakt í eldhúsi um helgar")} />
        <button type="button" className="btn ghost sm" disabled={!text.trim() || busy} onClick={add}>{t("Vista reglu")}</button>
      </div>
    </div>
  );
}
