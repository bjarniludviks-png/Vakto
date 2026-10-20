"use server";

import { getSickRate } from "@/lib/sickrate.server";
import type { SickRate } from "@/lib/sickrate";
import type { Gran } from "@/lib/periods";

/** Veikindahlutfall fyrir valda tímabilsgerð (stjórnendur; RLS + deildaafmörkun í getSickRate). */
export async function fetchSickRate(gran: Gran): Promise<SickRate> {
  const g: Gran = gran === "period" || gran === "quarter" || gran === "year" ? gran : "month";
  return getSickRate(g);
}
