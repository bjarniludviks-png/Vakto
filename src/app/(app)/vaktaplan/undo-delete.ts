"use client";

import { toast } from "@/components/app/toast";
import { restoreShifts, type ShiftSnap } from "./actions";

// Eyðingar sem gerast í hraðri röð (t.d. strokleður á marga reiti) safnast í EINA afturköllun:
// „5 vöktum eytt · Afturkalla“ setur allar fimm aftur inn.
const WINDOW_MS = 9000;
let buf: ShiftSnap[] = [];
let last = 0;

type T = (s: string) => string;

export function offerUndo(deleted: ShiftSnap[] | undefined, t: T, onRestored: () => void) {
  if (!deleted?.length) return;
  const now = Date.now();
  if (now - last > WINDOW_MS) buf = [];
  last = now;
  buf = [...buf, ...deleted];
  const batch = buf;
  const n = batch.length;
  toast(n === 1 ? t("Vakt eydd") : `${n} ${t("vöktum eytt")}`, "ok", {
    label: t("Afturkalla eyðingu"),
    onClick: async () => {
      if (buf === batch) { buf = []; last = 0; }
      const res = await restoreShifts(batch);
      if (!res.ok) { toast(res.error ?? t("Tókst ekki að afturkalla")); return; }
      toast(`${res.count ?? 0} ${t("vaktir settar aftur inn")}`);
      onRestored();
    },
  });
}
