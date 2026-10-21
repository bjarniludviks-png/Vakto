"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { nf } from "@/lib/format";
import Link from "next/link";
import { PLANS, AI_PACK, ESIGN_PRICE, annualMonthly, getPlan, type PlanId } from "@/lib/plans";
import { setBillingInterval, startCardChange, setAiPacks, setPlan, cancelSubscription, resumeSubscription } from "./actions";
import type { SettingsData } from "./settings.server";
import { CardBrandLogo, brandName, brandOf } from "./card-brand";
import "./billing.css";

const STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "mut" }> = {
  paying: { label: "Virk áskrift", tone: "good" },
  trial: { label: "Prufutími", tone: "warn" },
  unpaid: { label: "Ógreitt", tone: "bad" },
  suspended: { label: "Lokað", tone: "bad" },
  free: { label: "Frí áskrift", tone: "mut" },
  canceled: { label: "Uppsögn skráð", tone: "warn" },
};

const INV_STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "mut" }> = {
  paid: { label: "Greitt", tone: "good" },
  failed: { label: "Greiðsla tókst ekki", tone: "bad" },
  refunded: { label: "Endurgreitt", tone: "mut" },
  void: { label: "Ógilt", tone: "mut" },
  pending: { label: "Í bið", tone: "warn" },
};

const isoToIs = (iso: string | null | undefined) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso;
};

export function BillingPanel({ data }: { data: SettingsData }) {
  const { t } = useLang();
  const router = useRouter();
  const pr = data.pricing ?? null;
  const yearly = pr?.interval === "year";
  const plan = getPlan(pr?.plan ?? "voxtur");
  const price = (n: number) => (yearly ? annualMonthly(n) : n);
  const st = STATUS[data.company?.billingStatus ?? "trial"] ?? STATUS.trial;
  const card = data.card ?? null;
  const brand = brandOf(card?.brand);
  const canceled = data.company?.billingStatus === "canceled";
  const endsAt = isoToIs(data.company?.accessEndsAt);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changeCard() {
    const r = await startCardChange(window.location.origin);
    if (r.ok && r.url) window.location.assign(r.url);
    else toast(r.error ?? t("Tókst ekki"));
  }
  const [cap, setCap] = useState(String(data.ai?.packCap ?? 10));
  async function toggleAi(on: boolean, newCap?: number) {
    const r = await setAiPacks(on, newCap);
    toast(r.ok ? (newCap !== undefined && on ? t("Hámark vistað") : on ? t("Kveikt á AI-pökkum") : t("Slökkt á AI-pökkum")) : (r.error ?? t("Tókst ekki")));
    if (r.ok) router.refresh();
  }
  const [pick, setPick] = useState<PlanId | null>(null);
  async function changePlan(id: PlanId) {
    setBusy(true);
    const r = await setPlan(id);
    setBusy(false);
    setPick(null);
    toast(r.ok ? `${t("Leið breytt í")} ${getPlan(id).name}` : (r.error ?? t("Tókst ekki")));
    if (r.ok) router.refresh();
  }
  async function pickInterval(iv: "month" | "year") {
    const r = await setBillingInterval(iv);
    toast(r.ok ? (iv === "year" ? t("Árleg greiðsla tekur gildi á næsta gjalddaga") : t("Mánaðarleg greiðsla vistuð")) : (r.error ?? t("Tókst ekki")));
    if (r.ok) router.refresh();
  }

  async function cancelSub(on: boolean) {
    setBusy(true);
    const r = on ? await cancelSubscription() : await resumeSubscription();
    setBusy(false);
    if (!r.ok) { toast(r.error ?? t("Tókst ekki")); return; }
    setAsk(false);
    toast(on ? t("Uppsögn skráð") : t("Hætt við uppsögn. Áskriftin heldur áfram."));
    router.refresh();
  }

  const intervalNote = !pr ? null
    : pr.paidYearUntil
      ? (yearly ? `${t("Árið er greitt til")} ${pr.paidYearUntil}.` : `${t("Greitt ár gildir til")} ${pr.paidYearUntil}${t("; mánaðarleg greiðsla tekur við eftir það.")}`)
      : yearly
        ? `${t("Árgjaldið")} (${nf(pr.yearFeeTotal)} kr ${t("m. VSK")}) ${t("verður tekið á næsta gjalddaga")}${pr.nextDue ? ` (${pr.nextDue})` : ""}. ${t("Virkir umfram innifalda eru gerðir upp mánaðarlega á árlegum kjörum.")}`
        : `${t("Árleg greiðsla sparar 15%. Hún tekur gildi á næsta gjalddaga, svo mánuðurinn sem þú hefur greitt nýtist að fullu.")}`;

  return (
    <div className="bill owner-only">
      <div className="bill-top">
        <section className="card bill-plan">
          <div className="bill-plan-head">
            <div>
              <div className="bill-eyebrow">{t("Áskrift")}</div>
              <div className="bill-plan-name">VAKTO {plan.name} · {yearly ? t("Árleg greiðsla") : t("Mánaðarleg greiðsla")}</div>
            </div>
            <span className={`bill-pill ${st.tone}`}>{t(st.label)}</span>
          </div>
          {pr && (
            <div className="bill-amount">
              <b>{nf(pr.estimateTotal)} kr</b>
              <span>{t("á mánuði m. VSK, áætlað")} · {nf(pr.estimateNet)} kr {t("án VSK")}</span>
            </div>
          )}
          <div className="bill-facts">
            {pr?.nextDue && data.company?.billingStatus === "paying" && <div><span>{t("Næsti gjalddagi")}</span><b>{pr.nextDue}</b></div>}
            {canceled && endsAt && <div><span>{t("Áskriftin rennur út")}</span><b>{endsAt}</b></div>}
            {data.company?.trialEndsAt && data.company?.billingStatus !== "paying" && !canceled && <div><span>{t("Prufa gildir til")}</span><b>{data.company.trialEndsAt}</b></div>}
            <div><span>{t("Virkir starfsmenn í þessum mánuði")}</span><b>{pr?.units ?? "—"}{pr ? ` / ${plan.included} ${t("innifaldir")}` : ""}</b></div>
            {pr?.legacyUntil && <div><span>{t("Eldra verð gildir til")}</span><b>{pr.legacyUntil}{pr.legacyApplies ? ` · ${t("lægra verðið gildir")}` : ""}</b></div>}
          </div>
          {pr && (
            <div className="bill-interval">
              <div className="seg" role="group" aria-label={t("Greiðslutíðni")}>
                {(["month", "year"] as const).map((iv) => (
                  <button key={iv} type="button" className={pr.interval === iv ? "on" : ""} disabled={pr.interval === iv} onClick={() => pickInterval(iv)}>
                    {iv === "month" ? t("Mánaðarlega") : t("Árlega · 15% afsláttur")}
                  </button>
                ))}
              </div>
              {intervalNote && <p>{intervalNote}</p>}
            </div>
          )}
        </section>

        <section className="card bill-pay">
          <div className="bill-eyebrow">{t("Greiðslukort")}</div>
          {card ? (
            <div className={`bill-cc ${brand}`}>
              <div className="bill-cc-top"><span className="bill-cc-chip" aria-hidden /><CardBrandLogo code={card.brand} height={brand === "visa" ? 18 : 26} onDark /></div>
              <div className="bill-cc-num">•••• •••• •••• {card.last4 ?? "····"}</div>
              <div className="bill-cc-foot"><span>{brandName(card.brand)}</span>{card.expiry && <span>{t("Gildir til")} {card.expiry}</span>}</div>
            </div>
          ) : (
            <div className="bill-cc empty"><span>{t("Ekkert kort skráð")}</span></div>
          )}
          <button className="btn" onClick={changeCard}>{card ? t("Skipta um kort") : t("Skrá kort")}</button>
          <p className="bill-fine">{t("Kortið er geymt hjá Straumi (Kvika). VAKTO geymir aldrei kortanúmer.")}</p>
        </section>
      </div>

      <section className="card" id="leidir">
        <div className="ch">
          <div><div className="ct">{t("Áskriftarleið")}</div><div className="cs">{t("breyting gildir strax; nýja verðið á næsta reikningi")} · <Link href="/verd" style={{ color: "var(--brand)", fontWeight: 600 }}>{t("sjá samanburð á leiðum")}</Link></div></div>
        </div>
        <div className="cb" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {PLANS.map((p) => {
            const cur = p.id === plan.id;
            return (
              <div key={p.id} style={{ border: `1px solid ${cur ? "var(--brand)" : "var(--line)"}`, borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 650 }}>{p.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{nf(price(p.base))} kr<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink3)" }}>/mán</span></div>
                <div style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.45 }}>
                  {p.extraPerEmployee === null ? `${t("allt að")} ${p.included} ${t("starfsmenn, aðeins vefur")}` : `${p.included} ${t("virkir innifaldir")}, +${nf(price(p.extraPerEmployee))} kr ${t("á hvern umfram")}`}
                  <br />{p.aiQuestions ? `${p.aiQuestions} ${t("AI-spurningar á mánuði")}` : t("án VAKTO AI")}
                </div>
                {cur
                  ? <span className="bill-pill good" style={{ justifySelf: "start" }}>{t("Núverandi leið")}</span>
                  : <button className="btn ghost sm" style={{ justifySelf: "start" }} disabled={busy} onClick={() => setPick(p.id)}>{t("Velja")} {p.name}</button>}
              </div>
            );
          })}
        </div>
      </section>

      {pick && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && !busy && setPick(null)}>
          <div className="mbg" onClick={() => !busy && setPick(null)} />
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Skipta yfir í")} {getPlan(pick).name}</div><button className="x" onClick={() => setPick(null)} disabled={busy}>✕</button></div>
            <div className="mb">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                {pick === "free"
                  ? t("Fría leiðin er aðeins vaktaplan á vefnum: starfsfólk kemst ekki í appið, engin stimpilklukka, spjall, beiðnir, launakeyrslur, samningar né VAKTO AI. Mest 5 starfsmenn og 1 staður. Gögnin haldast og þú getur skipt aftur hvenær sem er.")
                  : `${getPlan(pick).name}: ${nf(price(getPlan(pick).base))} kr/mán ${t("án VSK með")} ${getPlan(pick).included} ${t("virkum starfsmönnum. Breytingin gildir strax og nýja verðið kemur á næsta reikning.")}`}
              </p>
              <div style={{ display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" }}>
                <button className="btn" disabled={busy} onClick={() => changePlan(pick)}>{busy ? t("Augnablik…") : `${t("Já, skipta yfir í")} ${getPlan(pick).name}`}</button>
                <button className="btn ghost" disabled={busy} onClick={() => setPick(null)}>{t("Hætta við")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.ai && plan.aiQuestions > 0 && (
        <section className="card bill-ai" id="vakto-ai">
          <div className="ch">
            <div><div className="ct">VAKTO AI</div><div className="cs">{t("aðstoðarmaðurinn í horninu: tölur, vaktaplan og breytingar sem þú staðfestir")}</div></div>
            <span className={`bill-pill ${data.ai.packEnabled ? "good" : "mut"}`}>{data.ai.packEnabled ? t("AI-pakkar á") : `${data.ai.included} ${t("á mánuði")}`}</span>
          </div>
          <div className="cb">
            <div className="bill-ai-use">
              <div><span>{t("Spurningar í þessum mánuði")}</span><b>{nf(data.ai.used)} / {nf(data.ai.limit)}</b></div>
              <div className="bill-meter" aria-hidden><i style={{ width: `${Math.min(100, Math.round((data.ai.used / Math.max(1, data.ai.limit)) * 100))}%` }} /></div>
            </div>
            <p className="bill-ai-note">
              {`${plan.name} ${t("inniheldur")} ${data.ai.included} ${t("spurningar á mánuði.")} `}
              {data.ai.packEnabled
                ? `${t("Þegar þær klárast bætist sjálfkrafa við pakki með")} ${AI_PACK.questions} ${t("spurningum á")} ${nf(AI_PACK.price)} kr ${t("án VSK, mest")} ${data.ai.packCap} ${t("pakkar á mánuði. Pakkar mánaðarins:")} ${data.ai.packs}.`
                : `${t("Með AI-pökkum bætist sjálfkrafa við")} ${AI_PACK.questions} ${t("spurningar á")} ${nf(AI_PACK.price)} kr ${t("þegar þær klárast — aðeins greitt fyrir pakka sem eru notaðir, með hámarki sem þú velur.")}`}
            </p>
            <div className="bill-foot" style={{ justifyContent: "flex-start", marginTop: 4, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {data.ai.packEnabled
                ? <button className="btn ghost" onClick={() => toggleAi(false)}>{t("Slökkva á AI-pökkum")}</button>
                : <button className="btn" onClick={() => toggleAi(true)}>{t("Kveikja á AI-pökkum")} · {nf(AI_PACK.price)} kr / {AI_PACK.questions}</button>}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                {t("Hámark á mánuði")}
                <input type="number" min={1} max={100} value={cap} onChange={(e) => setCap(e.target.value)} style={{ width: 70, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", font: "inherit", background: "var(--panel)", color: "var(--ink)" }} />
              </label>
              <button className="btn ghost sm" onClick={() => toggleAi(data.ai!.packEnabled, Number(cap))}>{t("Vista hámark")}</button>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="ch"><div><div className="ct">{t("Verðskrá")}</div><div className="cs">{t("öll verð án VSK")}</div></div></div>
        <div className="cb bill-price">
          <div><span>{t("Grunnverð")} · {plan.name}<em>{plan.included} {plan.extraPerEmployee === null ? t("starfsmenn að hámarki") : t("virkir starfsmenn innifaldir")}</em></span><b>{nf(price(plan.base))} kr/mán</b></div>
          {plan.extraPerEmployee !== null && <div><span>{t("Hver virkur starfsmaður umfram")}</span><b>{nf(price(plan.extraPerEmployee))} kr/mán</b></div>}
          {plan.aiQuestions > 0 && <div><span>{t("AI-pakki")}<em>{AI_PACK.questions} {t("spurningar, aðeins ef kveikt")}</em></span><b>{nf(AI_PACK.price)} kr</b></div>}
          <div><span>{t("Undirskrift með rafrænum skilríkjum")}<em>{t("valkvætt")}</em></span><b>{nf(ESIGN_PRICE)} kr</b></div>
          <p>{t("Virkur starfsmaður = átti vakt eða stimplaði sig í mánuðinum. Grunnverðið er greitt fyrirfram; virkir umfram innifalda, AI-pakkar og undirskriftir eru gerð upp eftir á fyrir mánuðinn sem lauk. Árleg greiðsla: 15% afsláttur af grunnverði og verði á starfsmann. Engin binding.")}</p>
        </div>
      </section>

      <section className="card">
        <div className="ch"><div><div className="ct">{t("Greiðslur og kvittanir")}</div><div className="cs">{t("kvittun er send í tölvupósti við hverja greiðslu")}</div></div></div>
        <div className="cb">
          {(data.invoices?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>{t("Engar greiðslur enn.")}</p>
          ) : (
            <div className="bill-inv-wrap"><table className="tbl bill-inv">
              <thead><tr><th>{t("Tímabil")}</th><th>{t("Greitt")}</th><th className="num">{t("Upphæð m. VSK")}</th><th>{t("Staða")}</th><th aria-label={t("Kvittun")} /></tr></thead>
              <tbody>
                {data.invoices!.map((inv) => {
                  const s = INV_STATUS[inv.status] ?? INV_STATUS.pending;
                  return (
                    <tr key={inv.id}>
                      <td>{isoToIs(inv.periodStart)} – {isoToIs(inv.periodEnd)}</td>
                      <td>{inv.paidAt ? isoToIs(inv.paidAt) : "—"}</td>
                      <td className="num">{nf(inv.total)} kr</td>
                      <td><span className={`bill-pill ${s.tone}`}>{t(s.label)}</span></td>
                      <td className="num">{inv.status === "paid" && <a className="bill-link" href={`/kvittun/${inv.id}`} target="_blank" rel="noopener">{t("Kvittun")}</a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
          {canceled ? (
            <div className="bill-foot" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <p className="bill-fine" style={{ marginRight: "auto" }}>{endsAt ? `${t("Áskriftin rennur út")} ${endsAt}. ${t("Ekkert verður rukkað framar.")}` : t("Ekkert verður rukkað framar.")}</p>
              <button className="btn" disabled={busy} onClick={() => cancelSub(false)}>{t("Hætta við uppsögn")}</button>
            </div>
          ) : data.company?.billingStatus !== "free" && (
            <div className="bill-foot">
              <button className="btn ghost" onClick={() => setAsk(true)}>{t("Segja upp áskrift")}</button>
            </div>
          )}
        </div>
      </section>

      {ask && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && !busy && setAsk(false)}>
          <div className="mbg" onClick={() => !busy && setAsk(false)} />
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Segja upp áskrift")}</div><button className="x" onClick={() => setAsk(false)} disabled={busy}>✕</button></div>
            <div className="mb">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                {endsAt
                  ? `${t("Ekkert verður rukkað framar. Aðgangurinn helst opinn til")} ${endsAt} ${t("og lokast þá. Gögnin eru geymd og þú getur hætt við uppsögnina fram að því.")}`
                  : t("Ekkert verður rukkað framar. Aðgangurinn helst opinn út greitt tímabil og lokast þá. Gögnin eru geymd og þú getur hætt við uppsögnina fram að því.")}
              </p>
              <div style={{ display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" }}>
                <button className="btn" disabled={busy} onClick={() => cancelSub(true)} style={{ background: "var(--bad)", borderColor: "var(--bad)" }}>{busy ? t("Augnablik…") : t("Já, segja upp")}</button>
                <button className="btn ghost" disabled={busy} onClick={() => setAsk(false)}>{t("Hætta við")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
