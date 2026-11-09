// Áminningar um verkefni dagsins (0111) — staðbundnar tilkynningar á símanum, enginn þjónn þarf.
// Listi með tíma: 30 mín fyrir. Stakt verkefni með tíma: 15 mín fyrir. Endurraðað í hvert sinn sem Heim hleðst
// (hök fjarlægja áminninguna). Biður aldrei um leyfi sjálft — notar það sem push-skráningin fékk.
import * as Notifications from "expo-notifications";
import { tr, trf } from "./i18n";
import type { DayTasks } from "./tasks";

const KIND = "vakto-task";

function at(date: string, hm: string, minusMin: number): Date {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m - minusMin, 0, 0);
  return d;
}

export async function scheduleTaskReminders(day: DayTasks | null): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    const old = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of old) if ((n.content.data as { kind?: string } | undefined)?.kind === KIND) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    if (!perm.granted || !day) return;
    const now = Date.now();
    const plan: { when: Date; title: string; body: string }[] = [];
    for (const l of day.lists) {
      const left = l.items.filter((i) => !i.done).length;
      if (!l.due_time || !left || l.remind === false) continue;
      plan.push({ when: at(day.date, l.due_time, 30), title: l.name, body: trf("{n} atriði eftir — klárast fyrir kl. {x}", left, l.due_time) });
    }
    for (const a of day.adhoc) {
      if (!a.due_time || a.done) continue;
      plan.push({ when: at(day.date, a.due_time, 15), title: tr("Verkefni"), body: trf("{t} — fyrir kl. {x}", a.title, a.due_time) });
    }
    for (const p of plan) {
      if (p.when.getTime() <= now + 30_000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { kind: KIND, url: "/verkefni" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.when },
      });
    }
  } catch { /* vefur / tæki án tilkynninga */ }
}
