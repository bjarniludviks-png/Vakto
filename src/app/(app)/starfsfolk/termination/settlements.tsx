"use client";

// Launakeyrslur: lokauppgjör launa og orlofs sem bíða (starfslok, 0088). Hverfur þegar merkt er afgreitt.

import "./termination.css";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { REASON_SHORT, isDate } from "@/lib/termination";
import type { SettlementDue } from "@/lib/terminations.server";
import { setSettled } from "./actions";

export function SettlementsCard({ items }: { items: SettlementDue[] }) {
  const { t } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function done(id: string) {
    setBusy(id);
    const r = await setSettled(id, true);
    setBusy(null);
    toast(r.ok ? t("Lokauppgjör merkt afgreitt") : (r.error ?? t("Villa")), r.ok ? "ok" : "error");
    if (r.ok) router.refresh();
  }
  return (
    <section className="db2-card tl-settle">
      <div className="db2-ch"><div>
        <div className="db2-ct">{t("Lokauppgjör vegna starfsloka")}</div>
        <div className="db2-cs">{t("Laun til og með síðasta degi, áunnið og ótekið orlof. Mánaðarlaun eru ekki hlutfölluð sjálfkrafa — farðu yfir línuna í síðustu launakeyrslunni.")}</div>
      </div></div>
      <div className="db2-list">
        {items.map((s) => (
          <div className="db2-it" key={s.id}>
            <span className={`db2-ic ${s.past ? "warn" : "info"}`}><svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg></span>
            <span className="db2-tx">
              <b><Link href={`/starfsfolk/${s.employeeId}`}>{s.name}</Link></b>
              <span>{s.past ? t("Hætti") : t("Hættir")} {isDate(s.lastDay)} · {t(REASON_SHORT[s.reason])} · {s.payType === "monthly" ? t("mánaðarlaun") : t("tímakaup")}</span>
            </span>
            <button type="button" className="btn ghost sm" disabled={busy === s.id} onClick={() => done(s.id)}>{t("Merkja afgreitt")}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
