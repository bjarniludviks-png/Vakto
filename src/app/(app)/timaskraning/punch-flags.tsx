"use client";

// Deviation tags for a punch row (late, left early, over plan, forgot to clock
// out, …) plus the row accent that makes them easy to spot while skimming a
// month. Shared by the employee timesheet page and the quick-look modal.

import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import type { PunchFlag, PunchRow } from "./actions";

export function flagLabel(f: PunchFlag, t: (k: string) => string): string {
  switch (f.code) {
    case "open_long": return `${t("Vantar útstimplun")} · ${f.n} ${t("klst")}`;
    case "long": return `${t("Óvenju löng vakt")} · ${dec1(f.n)} ${t("klst")}`;
    case "short": return `${t("Óvenju stutt vakt")} · ${f.n} ${t("mín")}`;
    case "late": return `${f.n} ${t("mín of seint")}`;
    case "early": return `${t("fór")} ${f.n} ${t("mín fyrr")}`;
    case "over": return `+${dec1(f.n)} ${t("klst yfir áætlun")}`;
    case "unscheduled": return t("óáætluð vakt");
  }
}

export function PunchFlags({ flags }: { flags: PunchFlag[] }) {
  const { t } = useLang();
  if (!flags.length) return null;
  return (
    <>
      {flags.map((f, i) => (
        <span key={i} className={`tag ${f.kind}`} style={{ whiteSpace: "nowrap" }}>{flagLabel(f, t)}</span>
      ))}
    </>
  );
}

/** Worst severity of a row's flags — drives the left accent bar. */
export function rowSeverity(p: Pick<PunchRow, "flags">): "bad" | "warn" | null {
  if (p.flags.some((f) => f.kind === "bad")) return "bad";
  if (p.flags.length) return "warn";
  return null;
}

/** Inline style for an `.att .it` row: colored accent on the left when flagged. */
export function rowAccent(sev: "bad" | "warn" | null): React.CSSProperties {
  if (!sev) return {};
  return { boxShadow: `inset 3px 0 0 var(--${sev})`, paddingLeft: 12, marginLeft: -12, paddingRight: 12, marginRight: -12, borderRadius: 4 };
}

/** "08:00 – 02:15 (+1)" when a shift crossed midnight. */
export function spanText(p: Pick<PunchRow, "in" | "out" | "outDate" | "date">, openWord: string): string {
  const out = p.out ?? openWord;
  if (!p.out || !p.outDate) return `${p.in} – ${out}`;
  const days = Math.round((Date.parse(p.outDate) - Date.parse(p.date)) / 864e5);
  return `${p.in} – ${out} (+${days})`;
}
