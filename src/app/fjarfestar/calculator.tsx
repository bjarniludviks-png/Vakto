"use client";
import { useMemo, useState } from "react";
import { PLANS } from "@/lib/pricing";
import { nf } from "@/lib/format";

// „Hvað ef við værum með X fyrirtæki?" — rekstur á ársgrundvelli í m.kr. án VSK.
// Tekjur byggja á raunverulegu verðskránni (src/lib/pricing.ts): grunngjald + virkir starfsmenn umfram.
type V = { n: number; emp: number; fte: number; ads: number };
const SCEN: Record<string, { label: string; v: V }> = {
  var: { label: "Varfærið", v: { n: 800, emp: 12, fte: 8, ads: 3 } },
  raun: { label: "Raunhæft", v: { n: 2500, emp: 15, fte: 18, ads: 8 } },
  bjart: { label: "Bjartsýnt", v: { n: 5000, emp: 18, fte: 30, ads: 15 } },
};
const P = PLANS.v2;
const monthlyPerCompany = (emp: number) => P.base + Math.max(0, emp - P.included) * P.extra;

function calc({ n, emp, fte, ads }: V) {
  const perCo = (monthlyPerCompany(emp) * 12) / 1e6; // m.kr. á ári per fyrirtæki
  const rev = n * perCo;
  const people = fte * 13;                 // laun + launatengd gjöld per stöðugildi
  const infra = 6 + n * 0.012;             // hýsing, gagnagrunnur, póstur, SMS, Taktikal-grunngjald
  const fees = rev * 0.025;                // greiðslugátt
  const marketing = ads * 12;
  const other = 8 + n * 0.01;              // húsnæði, bókhald, lögfræði, stuðningur
  const cost = people + infra + fees + marketing + other;
  const ebitda = rev - cost;
  const contrib = perCo * 0.975 - 0.012 - 0.01;
  const fixed = people + 6 + marketing + 8;
  const breakEven = contrib > 0 ? Math.ceil(fixed / contrib) : null;
  return { rev, cost, ebitda, margin: rev ? ebitda / rev : 0, breakEven, people, marketing, run: infra + fees + other };
}

const mkr = (v: number) => nf(Math.round(v));
const amt = (v: number) => (Math.abs(v) >= 1000 ? `${(Math.round(v / 100) / 10).toString().replace(".", ",")} ma.kr.` : `${mkr(v)} m.kr.`);

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="fj-sl">
      <div><span>{label}</span><b>{fmt(value)}</b></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Calculator() {
  const [s, setS] = useState("raun");
  const [v, setV] = useState<V>(SCEN.raun.v);
  const r = useMemo(() => calc(v), [v]);
  const set = (k: keyof V) => (x: number) => { setS(""); setV((o) => ({ ...o, [k]: x })); };
  const bar = (x: number) => `${Math.max(2, Math.min(100, (x / Math.max(r.rev, r.cost)) * 100))}%`;
  return (
    <div className="fj-calc">
      <div className="fj-calc-h">
        <h2>Hvað ef við værum með…</h2>
        <div className="fj-seg">
          {Object.entries(SCEN).map(([k, x]) => (
            <button key={k} type="button" className={s === k ? "on" : ""} onClick={() => { setS(k); setV(x.v); }}>{x.label}</button>
          ))}
        </div>
      </div>
      <div className="fj-calc-b">
        <div className="fj-sliders">
          <Slider label="Fyrirtæki í áskrift" value={v.n} min={10} max={8000} step={10} onChange={set("n")} fmt={(x) => nf(x)} />
          <Slider label="Virkir starfsmenn á fyrirtæki" value={v.emp} min={5} max={60} step={1} onChange={set("emp")} fmt={(x) => `${x} · ${nf(monthlyPerCompany(x))} kr/mán`} />
          <Slider label="Starfsfólk VAKTO" value={v.fte} min={2} max={60} step={1} onChange={set("fte")} fmt={(x) => `${x}`} />
          <Slider label="Auglýsingar á mánuði" value={v.ads} min={0} max={30} step={0.5} onChange={set("ads")} fmt={(x) => `${x.toString().replace(".", ",")} m.kr.`} />
        </div>
        <div>
          <div className="fj-res">
            <div className="fj-res-a"><span>Tekjur á ári</span><b>{amt(r.rev)}</b><small>{nf(Math.round((r.rev * 1e6) / v.n / 12))} kr á fyrirtæki á mánuði</small></div>
            <div className={`fj-res-b${r.ebitda >= 0 ? "" : " neg"}`}><span>Hagnaður (EBITDA)</span><b>{r.ebitda >= 0 ? "" : "−"}{amt(Math.abs(r.ebitda))}</b><small>{Math.round(r.margin * 100)} % af tekjum</small></div>
          </div>
          <div className="fj-bars">
            {([["Tekjur", r.rev, "#e9700f"], ["Laun", r.people, "#9aa0a8"], ["Auglýsingar", r.marketing, "#b9bec5"], ["Rekstur og annað", r.run, "#d6d9de"]] as const).map(([l, x, c]) => (
              <div key={l}><span>{l}</span><i><em style={{ width: bar(x), background: c }} /></i><b>{mkr(x)}</b></div>
            ))}
          </div>
          <p className="fj-be">{r.breakEven != null ? <>Jafnvægi næst við <b>{nf(r.breakEven)}</b> fyrirtæki með þetta starfsfólk og auglýsingar.</> : "Verðið stendur ekki undir kostnaði."}</p>
        </div>
      </div>
    </div>
  );
}
