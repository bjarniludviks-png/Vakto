import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { nf } from "@/lib/format";
import { getAdminOverview, getAdminPulse, getPlatformIdentity, type AdminCompany, type BillingStatus } from "@/lib/vakto-admin.server";
import { AuditRows, MiniBars, STATUS_UI, StatusBadge, TrialClock, relDate, shortDate } from "./ui";

export const dynamic = "force-dynamic";

const WEEKS = 12;
const ORDER: BillingStatus[] = ["paying", "trial", "free", "trial_expired", "unpaid", "suspended", "none"];

async function load() {
  const [data, pulse] = await Promise.all([getAdminOverview(), getAdminPulse()]);
  return { data, pulse, now: Date.now() };
}

// Mælaborð VAKTO — stóra myndin: vöxtur, tekjur og það sem þarf að sinna í dag.
// Only VAKTO staff get in; everyone else is bounced without a trace of the route existing.
export default async function AdminDashboardPage() {
  const me = await getPlatformIdentity();
  if (!me) redirect("/maelabord");
  const { data, pulse, now } = await load();
  const t = data.totals;

  // Nýskráningar per viku — síðustu 12 vikur, elsta fyrst.
  const buckets = Array.from({ length: WEEKS }, () => 0);
  for (const c of data.companies) {
    const age = Math.floor((now - new Date(c.createdAt).getTime()) / (7 * 86400000));
    if (age >= 0 && age < WEEKS) buckets[WEEKS - 1 - age]++;
  }
  const weekStart = (i: number) => new Date(now - (WEEKS - i) * 7 * 86400000 + 86400000);
  const labels = buckets.map((_, i) => (i % 2 === 1 || i === WEEKS - 1 ? shortDate(weekStart(i)) : ""));
  const tips = buckets.map((v, i) => `${v} ${v === 1 ? "nýskráning" : "nýskráningar"} · vikan frá ${shortDate(weekStart(i))}`);
  const signups30 = data.companies.filter((c) => now - new Date(c.createdAt).getTime() < 30 * 86400000).length;

  const byStatus = new Map<BillingStatus, number>();
  for (const c of data.companies) byStatus.set(c.billingStatus, (byStatus.get(c.billingStatus) ?? 0) + 1);
  const active7d = data.companies.filter((c) => c.lastActivity && now - new Date(c.lastActivity).getTime() < 7 * 86400000).length;
  const conversion = t.companies > 0 ? Math.round((t.paying / t.companies) * 100) : 0;

  // Þarf athygli: prufur á lokametrunum, útrunnið/ógreitt, og nýskráningar sem festust.
  const ending = data.companies.filter((c) => c.billingStatus === "trial" && c.trialDaysLeft !== null && c.trialDaysLeft <= 7).sort((a, b) => (a.trialDaysLeft ?? 0) - (b.trialDaysLeft ?? 0));
  const lapsed = data.companies.filter((c) => c.billingStatus === "trial_expired" || c.billingStatus === "unpaid");
  const stuck = data.companies.filter((c) => now - new Date(c.createdAt).getTime() < 30 * 86400000 && c.users <= 1 && !c.hasPunches30d && !c.hasRevenue30d && c.billingStatus !== "suspended");
  const attention: { c: AdminCompany; why: string; tone: "warn" | "bad" | "mut" }[] = [
    ...ending.map((c) => ({ c, why: "Prufa að renna út", tone: "warn" as const })),
    ...lapsed.map((c) => ({ c, why: c.billingStatus === "unpaid" ? "Borgar ekki" : "Prufa útrunnin", tone: "bad" as const })),
    ...stuck.filter((c) => !ending.includes(c) && !lapsed.includes(c)).map((c) => ({ c, why: "Föst í uppsetningu?", tone: "mut" as const })),
  ];

  const first = (me.name ?? "").split(/\s+/)[0];
  return (
    <>
      <PageHeader title={first ? `Góðan dag, ${first}` : "Mælaborð"} subtitle="Staðan á VAKTO í dag — vöxtur, tekjur og það sem þarf að sinna" />

      {!data.ok ? (
        <div className="card"><div className="cb"><p className="muted" style={{ fontSize: 13.5 }}>Gögn fundust ekki — er Supabase tengt?</p></div></div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="lab">Fyrirtæki</div><div className="val">{t.companies}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{active7d} virk síðustu 7 daga · {t.users} notendur</div></div>
            <div className="kpi"><div className="lab">Borga áskrift</div><div className="val" style={{ color: t.paying > 0 ? "var(--good)" : undefined }}>{t.paying}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{conversion}% af fyrirtækjum · {t.trials} í prufu</div></div>
            <div className="kpi"><div className="lab">MRR — mánaðartekjur</div><div className="val">{nf(t.mrr)} <small>kr</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{nf(t.mrr * 12)} kr á ári · án VSK</div></div>
            <div className="kpi"><div className="lab">Innheimt síðustu 30 daga</div><div className="val">{nf(pulse.paid30d)} <small>kr</small></div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>með VSK · {pulse.cardsOnFile} með kort á skrá</div></div>
          </div>

          <div className="adm-grid c2">
            <div className="card">
              <div className="ch"><div><div className="ct">Nýskráningar</div><div className="cs">Ný fyrirtæki á viku, síðustu {WEEKS} vikur</div></div><span className="badge">{signups30} síðustu 30 daga</span></div>
              <div className="cb"><MiniBars vals={buckets} labels={labels} tips={tips} /></div>
            </div>
            <div className="card">
              <div className="ch"><div><div className="ct">Staða fyrirtækja</div><div className="cs">Hvar í ferlinu hvert fyrirtæki er</div></div></div>
              <div className="cb">
                <div className="adm-split">
                  {ORDER.filter((s) => byStatus.get(s)).map((s) => <i key={s} title={`${STATUS_UI[s].label}: ${byStatus.get(s)}`} style={{ width: `${((byStatus.get(s) ?? 0) / Math.max(1, t.companies)) * 100}%`, background: STATUS_UI[s].dot }} />)}
                </div>
                <div className="adm-legend">
                  {ORDER.filter((s) => byStatus.get(s)).map((s) => <span key={s}><i style={{ background: STATUS_UI[s].dot }} />{STATUS_UI[s].label} <b style={{ color: "var(--ink)" }}>{byStatus.get(s)}</b></span>)}
                </div>
                <div className="adm-kv" style={{ marginTop: 18 }}>
                  <dt>Starfsmenn í kerfinu</dt><dd>{nf(t.employees)}</dd>
                  <dt>Prufur sem renna út</dt><dd>{t.trialsEnding7d} á næstu 7 dögum</dd>
                  <dt>Tilkynnt efni</dt><dd>{pulse.openReports ? `${pulse.openReports} óafgreitt hjá fyrirtækjum` : "Ekkert óafgreitt"}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="adm-grid c2">
            <div className="card">
              <div className="ch"><div><div className="ct">Þarf athygli</div><div className="cs">Prufur á lokametrunum, ógreitt og nýskráningar sem festust</div></div><span className="badge">{attention.length + pulse.failedInvoices.length}</span></div>
              <div className="cb" style={{ paddingTop: 6 }}>
                <div className="adm-list">
                  {pulse.failedInvoices.map((i) => (
                    <a key={i.id} href={`/admin/fyrirtaeki/${i.companyId}`}>
                      <div className="gr"><b>{i.companyName}</b><small>Greiðsla mistókst · {nf(i.total)} kr · {i.attempts} tilraunir{i.lastError ? ` · ${i.lastError}` : ""}</small></div>
                      <span className="tag bad">Reikningur</span>
                    </a>
                  ))}
                  {attention.map(({ c, why, tone }) => (
                    <a key={c.id + why} href={`/admin/fyrirtaeki/${c.id}`}>
                      <div className="gr"><b>{c.name}</b><small>{c.users} notendur · {c.employees} starfsmenn · síðast virkt {relDate(c.lastActivity)}</small><TrialClock c={c} /></div>
                      <span className={`tag ${tone}`}>{why}</span>
                    </a>
                  ))}
                  {!attention.length && !pulse.failedInvoices.length && <p className="muted" style={{ fontSize: 13, padding: "10px 0" }}>Ekkert sem þarf að sinna núna.</p>}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="ch"><div><div className="ct">Spjall sem bíður</div><div className="cs">Gestir á vakto.is sem bíða svars</div></div><a className="btn ghost sm" href="/admin/spjall">Opna spjall</a></div>
              <div className="cb" style={{ paddingTop: 6 }}>
                <div className="adm-list">
                  {pulse.supportOpen.map((s) => (
                    <a key={s.id} href={`/admin/spjall?t=${s.id}`}>
                      <div className="gr"><b>{s.name || s.email || "Gestur"}</b><small>{s.last}</small></div>
                      <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{relDate(s.updatedAt)}</span>
                    </a>
                  ))}
                  {!pulse.supportOpen.length && <p className="muted" style={{ fontSize: 13, padding: "10px 0" }}>Enginn bíður svars.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch"><div><div className="ct">Nýjustu aðgerðir</div><div className="cs">Það sem teymið hefur gert í admin</div></div><a className="btn ghost sm" href="/admin/stillingar#adgerdaskra">Öll aðgerðaskráin</a></div>
            <div className="cb" style={{ paddingTop: 8 }}>
              {data.needsPlatformMigration
                ? <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Aðgerðaskráin birtist þegar migration 0047 hefur verið keyrð.</p>
                : <AuditRows rows={data.platformAudit.slice(0, 8)} showCompany />}
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="ch"><div><div className="ct">Nýjustu fyrirtækin</div><div className="cs">Síðustu fimm sem skráðu sig</div></div><Link className="btn ghost sm" href="/admin/fyrirtaeki">Öll fyrirtæki</Link></div>
            <div className="cb" style={{ paddingTop: 6 }}>
              <div className="adm-list">
                {[...data.companies].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5).map((c) => (
                  <a key={c.id} href={`/admin/fyrirtaeki/${c.id}`}>
                    <div className="gr"><b>{c.name}</b><small>Skráð {relDate(c.createdAt)} · {c.users} notendur · {c.employees} starfsmenn</small></div>
                    <StatusBadge s={c.billingStatus} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
