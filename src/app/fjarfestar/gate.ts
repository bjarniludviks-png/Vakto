import { createHash, createHmac, timingSafeEqual } from "crypto";

// Aðgangur að fjárfestasíðunni: aðeins fingrafar (SHA-256) lykilorðsins er í kóðanum, aldrei lykilorðið sjálft.
const PW_SHA256 = "7771eb86d40685afc4c11fb16ac0f3acb04d0d7feac753565d852eaf578a59e8";
export const COOKIE = "vk_fj";

export function passwordOk(pw: string): boolean {
  const a = Buffer.from(createHash("sha256").update(pw).digest("hex")), b = Buffer.from(PW_SHA256);
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Kökugildi: HMAC af fingrafarinu með leyndarmáli þjónsins — breytist ef lykilorði eða leyndarmáli er breytt. */
export const token = () =>
  createHmac("sha256", process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "vakto").update("fjarfestar:" + PW_SHA256).digest("base64url");
