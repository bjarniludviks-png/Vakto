import "server-only";
import { createHash } from "crypto";
import { passwordStrength } from "@/lib/password";

/** Have I Been Pwned — k-anonymity: aðeins fyrstu 5 stafir SHA-1 hakksins fara út.
 * Bilar „opið“ (false) ef þjónustan svarar ekki, svo nýskráning stoppar aldrei á henni. */
export async function isPwnedPassword(pw: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(pw).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5), suffix = sha1.slice(5);
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "VAKTO-signup" },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });
    if (!r.ok) return false;
    const text = await r.text();
    for (const line of text.split("\n")) {
      const [suf, count] = line.trim().split(":");
      if (suf === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Lengd/mynstur (sama og styrkmælirinn) + leka-athugun. Skilar villutexta eða null. */
export async function validatePassword(pw: string): Promise<string | null> {
  const s = passwordStrength(pw);
  if (!s.ok) return s.reason ?? "Lykilorðið er of veikt";
  if (await isPwnedPassword(pw)) return "Þetta lykilorð hefur birst í þekktum gagnaleka — veldu annað.";
  return null;
}
