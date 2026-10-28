"use client";

// Hlutverk í VAKTO sem spjöld (Nýr starfsmaður, Bjóða notanda, Breyta aðgangi) — eitt orðalag alls staðar:
// Starfsmaður · Vaktstjóri · Stjórnandi (eigandi) · Verktaki, hvert með einni línu um hvað það sér.

import { useLang } from "@/components/app/lang";

export type RoleKey = "employee" | "manager" | "owner" | "contractor";

export const ROLE_CARDS: { key: RoleKey; title: string; en: string; pl: string; desc: string; icon: React.ReactNode }[] = [
  { key: "employee", en: "Employee", pl: "Pracownik", title: "Starfsmaður", desc: "Appið: eigið plan, stimpilklukka, spjall og launaseðlar", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  { key: "manager", en: "Shift manager", pl: "Kierownik zmiany", title: "Vaktstjóri", desc: "Stjórnendasvæði sem þú velur: vaktaplan, tímar, starfsfólk …", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="m16 11 2 2 4-4" /></> },
  { key: "owner", en: "Owner / admin", pl: "Właściciel / administrator", title: "Eigandi", desc: "Allt, líka laun, áskrift og aðgangur annarra", icon: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></> },
  { key: "contractor", en: "Contractor", pl: "Wykonawca", title: "Verktaki", desc: "Sendir reikning — engin launakeyrsla, orlof eða staðgreiðsla", icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></> },
];

export function RolePicker({ value, onChange, allowOwner = true }: { value: RoleKey; onChange: (r: RoleKey) => void; allowOwner?: boolean }) {
  const { t, lang } = useLang();
  const L = (is: string, en: string, pl: string) => (lang === "en" ? en : lang === "pl" ? pl : t(is));
  return (
    <div className="ne-roles" role="radiogroup">
      {ROLE_CARDS.filter((r) => allowOwner || r.key !== "owner").map((r) => (
        <button type="button" role="radio" aria-checked={value === r.key} key={r.key} className={`ne-role${value === r.key ? " on" : ""}`} onClick={() => onChange(r.key)}>
          <span className="ne-ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{r.icon}</svg></span>
          <b>{L(r.title, r.en, r.pl)}</b><span>{t(r.desc)}</span>
        </button>
      ))}
    </div>
  );
}
