"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";

type L = { is: string; en: string };
const tx = (lang: string, v: L) => (lang === "en" ? v.en : v.is);

const STEPS: { n: string; t: L; d: L; href: string }[] = [
  { n: "1", t: { is: "Bættu við stað", en: "Add a location" }, d: { is: "Stilling → Staðir. Hver staður hefur eigin starfsfólk og vaktaplan.", en: "Settings → Locations. Each location has its own staff and schedule." }, href: "/stillingar?new=location" },
  { n: "2", t: { is: "Skráðu starfsfólk", en: "Add your staff" }, d: { is: "Starfsfólk → Nýr starfsmaður. Taxti og kjarasamningur fylgja hverjum.", en: "Employees → New employee. Rate and union agreement per person." }, href: "/starfsfolk?new=1" },
  { n: "3", t: { is: "Gerðu vaktaplan", en: "Build a schedule" }, d: { is: "Vaktaplan → dragðu vaktir eða 'Biðja AI'. Smelltu 'Birta plan'.", en: "Schedule → drag shifts or 'Ask AI'. Then 'Publish schedule'." }, href: "/vaktaplan" },
  { n: "4", t: { is: "Sjáðu laun vs velta", en: "See labor vs revenue" }, d: { is: "Tengdu Inventra eða skráðu veltu handvirkt — laun% birtist á mælaborði.", en: "Connect Inventra or enter revenue manually — labor% shows on the dashboard." }, href: "/stillingar?new=revenue" },
];

const FAQ: { q: L; a: L }[] = [
  { q: { is: "Hvað er „laun af tekjum“ (laun%)?", en: "What is labor % of revenue?" }, a: { is: "Launakostnaður (með launatengdum gjöldum) deilt með veltu. Lægra er betra — VAKTO litakóðar það á mælaborðinu.", en: "Labor cost (incl. on-costs) divided by revenue. Lower is better — VAKTO color-codes it on the dashboard." } },
  { q: { is: "Hvernig stofna ég launakeyrslu?", en: "How do I run payroll?" }, a: { is: "Launakeyrslur → 'Keyra launakeyrslu'. VAKTO reiknar skv. íslenskum kjarasamningum; Payday sér um skil.", en: "Payroll → 'Run payroll'. VAKTO computes per Icelandic agreements; Payday handles filing." } },
  { q: { is: "Hver sér hvað?", en: "Who sees what?" }, a: { is: "Stjórnandi sér allt; vaktstjóri sér vaktir/tíma/starfsfólk/skýrslur; starfsmaður og verktaki sjá sitt svæði og spjall.", en: "Owner sees everything; manager sees scheduling/time/staff/reports; employee and contractor see their own area and chat." } },
  { q: { is: "Virkar AI-vaktaplanið?", en: "Does AI scheduling work?" }, a: { is: "Já — 'Biðja AI' býr til tillögu sem þú samþykkir. Þú þarft ANTHROPIC_API_KEY fyrir raun-AI, annars keyrir demo-tillaga.", en: "Yes — 'Ask AI' proposes a plan you approve. Needs ANTHROPIC_API_KEY for real AI, otherwise a demo proposal." } },
  { q: { is: "Get ég stimplað inn án innskráningar?", en: "Can staff clock in without logging in?" }, a: { is: "Já — Kiosk-skjárinn (/kiosk) notar PIN fyrir sameiginlega stimpilklukku á staðnum.", en: "Yes — the Kiosk screen (/kiosk) uses a PIN for a shared on-site clock." } },
];

export default function HelpScreen() {
  const { lang, t } = useLang();
  return (
    <>
      <PageHeader title="Hjálp" subtitle={lang === "en" ? "Guides, FAQ and support" : "Leiðbeiningar, algengar spurningar og aðstoð"} />

      <div className="card">
        <div className="ch"><div className="ct">{tx(lang, { is: "Komdu þér af stað", en: "Get started" })}</div><div className="cs">{tx(lang, { is: "fjögur skref", en: "four steps" })}</div></div>
        <div className="cb att">
          {STEPS.map((s) => (
            <Link key={s.n} className="it rowlink" href={s.href}>
              <div className="ic info" style={{ fontWeight: 700 }}>{s.n}</div>
              <div className="tx"><b>{tx(lang, s.t)}</b><span>{tx(lang, s.d)}</span></div>
              <span className="tag info" style={{ marginLeft: "auto" }}>{tx(lang, { is: "opna", en: "open" })}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div className="ct">{tx(lang, { is: "Algengar spurningar", en: "FAQ" })}</div></div>
        <div className="cb">
          {FAQ.map((f, i) => (
            <details key={i} style={{ borderBottom: "1px solid var(--line2)", padding: "12px 0" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>{tx(lang, f.q)}</summary>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>{tx(lang, f.a)}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div className="ct">{tx(lang, { is: "Þarftu meiri aðstoð?", en: "Need more help?" })}</div></div>
        <div className="cb att">
          <div className="it rowlink" onClick={() => { window.location.href = "mailto:hjalp@vakto.is"; }}>
            <div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></div>
            <div className="tx"><b>hjalp@vakto.is</b><span>{tx(lang, { is: "sendu okkur línu — við svörum samdægurs", en: "email us — same-day reply" })}</span></div>
          </div>
          <div className="it rowlink" onClick={() => toast(tx(lang, { is: "Opna spjall við aðstoð", en: "Opening support chat" }))}>
            <div className="ic good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
            <div className="tx"><b>{tx(lang, { is: "Spjall við aðstoð", en: "Live chat" })}</b><span>{tx(lang, { is: "neðst í hægra horni", en: "bottom-right corner" })}</span></div>
          </div>
        </div>
        <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
          <p className="muted" style={{ fontSize: 12.5 }}>{t("VAKTO")} · {tx(lang, { is: "útgáfa", en: "version" })} 1.0 · vakto.is</p>
        </div>
      </div>
    </>
  );
}
