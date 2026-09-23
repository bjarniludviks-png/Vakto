import "server-only";

/** Cloudflare Turnstile. Ekki stillt (engin TURNSTILE_SECRET_KEY) → alltaf í lagi,
 * svo staging/local virka án lykla. Stillt → token verður að standast siteverify. */
export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const j = (await r.json()) as { success?: boolean };
    return !!j.success;
  } catch {
    return false;
  }
}
