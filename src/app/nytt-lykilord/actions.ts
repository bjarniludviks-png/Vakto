"use server";

import { validatePassword } from "@/lib/password.server";

/** Sömu reglur og við nýskráningu: lengd/mynstur + leka-athugun (HIBP). */
export async function checkNewPassword(pw: string): Promise<{ ok: boolean; error?: string }> {
  const err = await validatePassword(pw);
  return err ? { ok: false, error: err } : { ok: true };
}
