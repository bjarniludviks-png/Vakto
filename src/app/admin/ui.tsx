// Sameiginlegir bitar fyrir admin-skjáina (dagsetningar, stöðumerki, aðgerðaskrá).
// Engin "use client" — nothæft bæði í server- og client-hlutum.
import type { AdminCompany, BillingStatus, PlatformAuditEntry } from "@/lib/vakto-admin.server";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad = (n: number) => String(n).padStart(2, "0");
export const niceDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${d.getFullYear()}`;
};
export const niceDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const shortDate = (d: Date) => `${d.getDate()}. ${MONTHS_IS[d.getMonth()]}`;
export const relDate = (iso: string | null) => {
  if (!iso) return "aldrei";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "í dag";
  if (days === 1) return "í gær";
  if (days < 30) return `fyrir ${days} d.`;
  return niceDate(iso);
};

export const STATUS_UI: Record<BillingStatus, { label: string; bg: string; fg: string; dot: string }> = {
  paying: { label: "Borgar", bg: "var(--good-soft)", fg: "var(--good)", dot: "var(--good)" },
  trial: { label: "Prufa", bg: "var(--brand-soft)", fg: "var(--brand)", dot: "var(--brand)" },
  trial_expired: { label: "Prufa útrunnin", bg: "var(--bad-soft)", fg: "var(--bad)", dot: "var(--bad)" },
  unpaid: { label: "Borgar ekki", bg: "var(--bad-soft)", fg: "var(--bad)", dot: "var(--warn)" },
  free: { label: "Frítt", bg: "var(--line2)", fg: "var(--ink2)", dot: "var(--teal)" },
  suspended: { label: "Lokað", bg: "var(--ink)", fg: "var(--panel)", dot: "var(--ink)" },
  none: { label: "Ekkert plan", bg: "var(--line2)", fg: "var(--ink3)", dot: "var(--ink3)" },
};
export const ROLE_IS: Record<string, string> = { owner: "Stjórnandi", manager: "Vaktstjóri", employee: "Starfsmaður", contractor: "Verktaki", kiosk: "Stimpilklukka" };
export const ACTION_IS: Record<string, string> = {
  "billing.set": "Greiðslustaða",
  "trial.extend": "Prufa framlengd",
  suspend: "Aðgangi lokað",
  unsuspend: "Aðgangur opnaður",
  "impersonate.start": "Skráði inn sem",
  "impersonate.end": "Aftur í admin",
  "note.save": "Athugasemd",
  "login_link.send": "Innskráningarhlekkur",
  "team.invite": "Boðið í teymið",
  "team.remove": "Fjarlægt úr teymi",
  "team.role": "Hlutverk í teymi",
};
const PLAN_IS: Record<string, string> = { vakto: "VAKTO", free: "Frítt (eldra)", pro: "Pro (eldra)", standard: "Standard", starter: "Starter" };
export const planLabel = (p: string | null) => (p ? PLAN_IS[p] ?? p : "Ekkert plan");
export const CARD_BRANDS: Record<string, string> = { VI: "Visa", VISA: "Visa", MC: "Mastercard", MASTERCARD: "Mastercard", AX: "Amex", AMEX: "Amex", MAESTRO: "Maestro" };
export const INVOICE_IS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Greiddur", cls: "good" }, pending: { label: "Í bið", cls: "info" }, failed: { label: "Mistókst", cls: "bad" },
  refunded: { label: "Endurgreiddur", cls: "mut" }, void: { label: "Ógildur", cls: "mut" },
};

export function StatusBadge({ s }: { s: BillingStatus }) {
  const u = STATUS_UI[s];
  return <span className="tag" style={{ background: u.bg, color: u.fg }}>{u.label}</span>;
}

/** "5 d. eftir" / "rann út fyrir 3 d." — the trial clock in words. */
export function TrialClock({ c }: { c: AdminCompany }) {
  if (c.billingStatus !== "trial" && c.billingStatus !== "trial_expired") return null;
  if (c.trialDaysLeft === null) return null;
  const d = c.trialDaysLeft;
  const urgent = d <= 7 && d >= 0;
  return (
    <div style={{ fontSize: 11, color: urgent ? "var(--warn)" : d < 0 ? "var(--bad)" : "var(--ink3)", fontWeight: urgent ? 650 : 500 }}>
      {d < 0 ? `rann út fyrir ${Math.abs(d)} d.` : d === 0 ? "rennur út í dag" : `${d} d. eftir · til ${niceDate(c.trialEndsAt)}`}
    </div>
  );
}

export function AuditRows({ rows, showCompany }: { rows: PlatformAuditEntry[]; showCompany: boolean }) {
  if (!rows.length) return <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Engar færslur enn.</p>;
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            <th style={{ width: 120 }}>Hvenær</th><th>Aðgerð</th>{showCompany && <th>Fyrirtæki</th>}<th>Hverjum</th><th>Lýsing</th><th>Admin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{niceDateTime(a.at)}</td>
              <td><b>{ACTION_IS[a.action] ?? a.action}</b></td>
              {showCompany && <td>{a.companyId ? <a href={`/admin/fyrirtaeki/${a.companyId}`} style={{ color: "inherit" }}>{a.companyName ?? "—"}</a> : "—"}</td>}
              <td className="muted" style={{ fontSize: 12 }}>{a.target ?? "—"}</td>
              <td className="muted" style={{ fontSize: 12, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>{a.detail ?? ""}</td>
              <td className="muted" style={{ fontSize: 11.5 }}>{a.adminEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ein lituð súluröð með tölu á sveimi (nýskráningar per viku, eyðsla per dag). */
export function MiniBars({ vals, labels, tips, height = 150 }: { vals: number[]; labels: string[]; tips: string[]; height?: number }) {
  const max = Math.max(...vals, 1);
  return (
    <div className="adm-bars" style={{ height }}>
      {vals.map((v, i) => (
        <div className={`b${v === 0 ? " z" : ""}`} key={i}>
          <span className="t">{tips[i]}</span>
          <div className="c" style={{ height: `${Math.round((v / max) * 100)}%` }} />
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
}
