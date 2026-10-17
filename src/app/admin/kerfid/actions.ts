"use server";

import { isVaktoAdmin } from "@/lib/vakto-admin.server";
import { pingTaktikal, type TaktikalPing } from "@/lib/taktikal.server";

// Prófar Taktikal-lyklana í þessu umhverfi. Les aðeins flæðalistann — kostar ekkert.
export async function testTaktikal(): Promise<TaktikalPing | { ok: false; error: string }> {
  if (!(await isVaktoAdmin())) return { ok: false, error: "Ekki aðgangur" };
  return pingTaktikal();
}
