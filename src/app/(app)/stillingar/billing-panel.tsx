"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { nf } from "@/lib/format";
import { PLANS, ESIGN_PRICE, AI_ADDON_PRICE, AI_ADDON_QUESTIONS, AI_FREE_QUESTIONS } from "@/lib/pricing";
import { setBillingInterval, startCardChange, setAiAddon } from "./actions";
import type { SettingsData } from "./settings.server";
import { CardBrandLogo, brandName, brandOf } from "./card-brand";
import "./billing.css";

const STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "mut" }> = {
  paying: { label: "Virk áskrift", tone: "good" },
  trial: { label: "Prufutími", tone: "warn" },
  unpaid: { label: "Ógreitt", tone: "bad" },
  suspended: { label: "Lokað", tone: "bad" },
  free: { label: "Frí áskrift", tone: "mut" },
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
  const plan = PLANS[pr?.plan ?? "v2"];
  const st = STATUS[data.company?.billingStatus ?? "trial"] ?? STATUS.trial;
  const card = data.card ?? null;
  const brand = brandOf(card?.brand);

  async function changeCard() {
    const r = await startCardChange(window.location.origin);
    if (r.ok && r.url) window.location.assign(r.url);
    else toast(r.error ?? t("Tókst ekki"));
  }
  async function toggleAi(on: boolean) {
    const r = await setAiAddon(on);
    toast(r.ok ? (on ? t("Kveikt á VAKTO AI") : t("Slökkt á VAKTO AI-viðbótinni")) : (r.error ?? t("Tókst ekki")));
    if (r.ok) router.refresh();
  }
  async function pickInterval(iv: "month" | "year") {
    const r = await setBillingInterval(iv);
    toast(r.ok ? (iv === "year" ? t("Árleg greiðsla tekur gildi á næsta gjalddaga") : t("Mánaðarleg greiðsla vistuð")) : (r.error ?? t("Tókst ekki")));
    if (r.ok) router.refresh();
  }

  const intervalNote = !pr ? null
    : pr.paidYearUntil
      ? (yearly ? `${t("Árið er greitt til")} ${pr.paidYearUntil}.` : `${t("Greitt ár gildir til")} ${pr.paidYearUntil}${t("; mánaðarleg greiðsla tekur við eftir það.")}`)
      : yearly
        ? `${t("Árgjaldið")} (${nf(pr.yearFeeTotal)} kr ${t("m. VSK")}) ${t("verður tekið á næsta gjalddaga")}${pr.nextDue ? ` (${pr.nextDue})` : ""}. ${t("Virkir umfram 5 eru gerðir upp mánaðarlega á árlegum kjörum.")}`
        : `${t("Árleg greiðsla sparar um 15%. Hún tekur gildi á næsta gjalddaga, svo mánuðurinn sem þú hefur greitt nýtist að fullu.")}`;

  return (
    <div className="bill owner-only">
      <div className="bill-top">
        <section className="card bill-plan">
          <div className="bill-plan-head">
            <div>
              <div className="bill-eyebrow">{t("Áskrift")}</div>
              <div className="bill-plan-name">VAKTO · {yearly ? t("Árleg greiðsla") : t("Mánaðarleg greiðsla")}</div>
            </div>
            <span className={`bill-pill ${st.tone}`}>{t(st.label)}</span>
          </div>
          {pr && (
            <div className="bill-amount">
              <b>{nf(pr.estimateTotal)} kr</b>
              <span>{t("á mánuði m. VSK, áætlað")}</span>
            </div>
          )}
          <div className="bill-facts">
            {pr?.nextDue && data.company?.billingStatus === "paying" && <div><span>{t("Næsti gjalddagi")}</span><b>{pr.nextDue}</b></div>}
            {data.company?.trialEndsAt && data.company?.billingStatus !== "paying" && <div><span>{t("Prufa gildir til")}</span><b>{data.company.trialEndsAt}</b></div>}
            {pr?.plan === "v1"
              ? <div><span>{t("Notendur núna")}</span><b>{data.users.length}</b></div>
              : <div><span>{t("Virkir síðustu 30 daga")}</span><b>{pr?.units ?? "—"}</b></div>}
            {pr?.plan === "v1" && pr.v1Until && <div><span>{t("Eldra verð gildir til")}</span><b>{pr.v1Until}</b></div>}
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

      {data.ai && (
        <section className="card bill-ai" id="vakto-ai">
          <div className="ch">
            <div><div className="ct">VAKTO AI</div><div className="cs">{t("aðstoðarmaðurinn í horninu: tölur, vaktaplan og breytingar sem þú staðfestir")}</div></div>
            <span className={`bill-pill ${data.ai.on ? "good" : data.ai.mode === "trial" ? "warn" : "mut"}`}>{data.ai.on ? t("Viðbót á") : data.ai.mode === "trial" ? t("Opið í prufu") : t("Frí útgáfa")}</span>
          </div>
          <div className="cb">
            <div className="bill-ai-use">
              <div><span>{t("Spurningar í þessum mánuði")}</span><b>{nf(data.ai.used)} / {nf(data.ai.limit)}</b></div>
              <div className="bill-meter" aria-hidden><i style={{ width: `${Math.min(100, Math.round((data.ai.used / Math.max(1, data.ai.limit)) * 100))}%` }} /></div>
            </div>
            <p className="bill-ai-note">
              {data.ai.on
                ? `${t("Viðbótin kostar")} ${nf(AI_ADDON_PRICE)} kr/mán ${t("án VSK og bætist á mánaðarreikninginn. Allt að")} ${nf(AI_ADDON_QUESTIONS)} ${t("spurningar á mánuði.")}`
                : `${t("Án viðbótar fylgja")} ${AI_FREE_QUESTIONS} ${t("spurningar á mánuði frítt")}${data.ai.mode === "trial" ? t(" (í prufu allt að 500)") : ""}. ${t("Viðbótin kostar")} ${nf(AI_ADDON_PRICE)} kr/mán ${t("án VSK, allt að")} ${nf(AI_ADDON_QUESTIONS)} ${t("spurningar á mánuði, engin binding.")}`}
            </p>
            <div className="bill-foot" style={{ justifyContent: "flex-start", marginTop: 4 }}>
              {data.ai.on
                ? <button className="btn ghost" onClick={() => toggleAi(false)}>{t("Slökkva á viðbót")}</button>
                : <button className="btn" onClick={() => toggleAi(true)}>{t("Kveikja á VAKTO AI")} · {nf(AI_ADDON_PRICE)} kr/mán</button>}
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="ch"><div><div className="ct">{t("Verðskrá")}</div><div className="cs">{t("öll verð án VSK")}</div></div></div>
        <div className="cb bill-price">
          <div><span>{t("Grunngjald")}<em>{plan.included} {pr?.plan === "v1" ? t("notendur innifaldir") : t("virkir starfsmenn innifaldir")}</em></span><b>{nf(yearly ? plan.baseYear : plan.base)} kr/mán</b></div>
          <div><span>{pr?.plan === "v1" ? t("Hver notandi umfram") : t("Hver virkur starfsmaður umfram")}</span><b>{nf(yearly ? plan.extraYear : plan.extra)} kr/mán</b></div>
          <div><span>{t("Undirritun með rafrænum skilríkjum")}<em>{t("valkvætt")}</em></span><b>{nf(ESIGN_PRICE)} kr</b></div>
          <div><span>VAKTO AI<em>{t("valkvæð viðbót, allt að")} {nf(AI_ADDON_QUESTIONS)} {t("spurningar á mánuði")}</em></span><b>{nf(AI_ADDON_PRICE)} kr/mán</b></div>
          {pr?.plan !== "v1" && <p>{t("Virkur starfsmaður = átti vakt eða stimplaði sig á tímabilinu. Grunngjaldið er greitt fyrirfram; virkir umfram 5 og undirskriftir eru gerð upp eftir á fyrir mánuðinn sem lauk. Engin binding.")}</p>}
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
          <div className="bill-foot">
            <a className="btn ghost" href="mailto:hallo@vakto.is?subject=Uppsögn%20áskriftar">{t("Segja upp áskrift")}</a>
          </div>
        </div>
      </section>
    </div>
  );
}
