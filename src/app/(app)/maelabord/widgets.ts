// Spjöld mælaborðsins sem notandi getur falið og raðað (0077, users.dashboard_prefs).
export const DASH_WIDGETS = ["labor", "hours", "cost", "onnow", "daily", "attention", "onshift", "staff"] as const;
export type DashWidget = (typeof DASH_WIDGETS)[number];
export type DashPrefs = { order: DashWidget[]; hidden: DashWidget[] };

export const WIDGET_LABEL: Record<DashWidget, string> = {
  labor: "Laun sem hlutfall af veltu",
  hours: "Unnir tímar",
  cost: "Launakostnaður",
  onnow: "Á vakt núna (tala)",
  daily: "Áætlað og unnið, dag fyrir dag",
  attention: "Þarf athygli",
  onshift: "Á vakt núna (listi)",
  staff: "Starfsfólk á tímabilinu",
};

/** Röð með öllum spjöldum (ný spjöld bætast aftast) og falin spjöld. */
export function resolvePrefs(p: Partial<DashPrefs> | null | undefined): DashPrefs {
  const ok = (x: unknown): x is DashWidget => (DASH_WIDGETS as readonly string[]).includes(String(x));
  const order = [...new Set((p?.order ?? []).filter(ok))];
  for (const w of DASH_WIDGETS) if (!order.includes(w)) order.push(w);
  return { order, hidden: [...new Set((p?.hidden ?? []).filter(ok))] };
}
