// „Á vakt“ og gróf virkni samstarfsmanns (coworker_status, 0099) → texti og litur. Hreint; appið á afrit
// (mobile/src/lib/presence.ts) — breyttu báðum saman. Aldrei nákvæmur tími, aðeins „núna“/„í dag“/„í gær“.
export type CoworkerStatus = {
  userId: string;
  employeeId: string;
  active: string | null;     // 'now' | 'today' | 'yesterday' | 'days:N' | null
  onShift: boolean;
  shiftEnd: string | null;   // "16:00:00"
  nextStart: string | null;  // "2026-10-29T08:00:00"
};
export type PresenceTone = "shift" | "online" | "idle" | "none";

const DOW = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];

/** Það sem skiptir mestu í vaktavinnu fyrst: á vakt núna → virk(ur) núna → næsta vakt → síðast virk(ur). */
export function presenceLabel(s: CoworkerStatus | null | undefined, now = new Date()): { text: string; tone: PresenceTone; dot: boolean } {
  if (!s) return { text: "", tone: "none", dot: false };
  if (s.onShift) return { text: s.shiftEnd ? `Á vakt til ${s.shiftEnd.slice(0, 5)}` : "Á vakt núna", tone: "shift", dot: true };
  if (s.active === "now") return { text: "Virk(ur) núna", tone: "online", dot: true };
  if (s.nextStart) {
    const d = new Date(s.nextStart);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const when = diff === 0 ? `í dag kl. ${hm}` : diff === 1 ? `á morgun kl. ${hm}` : `${DOW[d.getDay()]} kl. ${hm}`;
    if (diff <= 1) return { text: `Á vakt ${when}`, tone: "idle", dot: false };
  }
  if (s.active === "today") return { text: "Virk(ur) í dag", tone: "idle", dot: false };
  if (s.active === "yesterday") return { text: "Virk(ur) í gær", tone: "idle", dot: false };
  if (s.active?.startsWith("days:")) return { text: `Virk(ur) fyrir ${s.active.slice(5)} dögum`, tone: "idle", dot: false };
  return { text: "", tone: "none", dot: false };
}
