import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { planAllows } from "@/lib/plan-features";
import { companyPlan } from "@/lib/plan.server";

// Tengd forrit (MCP). Claude, ChatGPT o.fl. tengjast með OAuth (PKCE) og fá OKKAR lykla (vk_at_/vk_rt_),
// geymda sem SHA-256. Hver tenging fær eigin Supabase-lotu (ekki vafralotu notandans) sem er dulkóðuð í
// grunninum og fer aldrei út — svo forritið kemst ekki framhjá /api/mcp og þeim LEStólum sem þar eru.

export const ACCESS_TTL = 3600;
const CODE_TTL = 600;

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const token = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;

// AES-256-GCM. Lykill: MCP_TOKEN_KEY ef hann er settur, annars leiddur af þjónustulyklinum.
function key(): Buffer {
  const src = process.env.MCP_TOKEN_KEY || `${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:mcp-v1`;
  if (src.length < 20) throw new Error("mcp-key-missing");
  return createHash("sha256").update(src).digest();
}
function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}
function open(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

/** Ný, sjálfstæð Supabase-lota fyrir notandann (magic link búinn til og innleystur á þjóninum). */
async function mintSession(userId: string): Promise<{ access: string; refresh: string; exp: number }> {
  const admin = createAdminClient();
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u.user?.email;
  if (!email) throw new Error("user-missing");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) throw new Error(error?.message ?? "link-failed");
  const { data: v, error: vErr } = await anon().auth.verifyOtp({ type: "magiclink", token_hash: hash });
  if (vErr || !v.session) throw new Error(vErr?.message ?? "verify-failed");
  return { access: v.session.access_token, refresh: v.session.refresh_token, exp: v.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600 };
}
const anon = () => createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- OAuth: forrit (DCR) ----------

export type OAuthClient = { id: string; name: string; redirect_uris: string[] };

export function okRedirect(u: string): boolean {
  try {
    const x = new URL(u);
    if (x.hash) return false;
    return x.protocol === "https:" || (x.protocol === "http:" && (x.hostname === "localhost" || x.hostname === "127.0.0.1"));
  } catch { return false; }
}

export async function registerClient(name: string, redirectUris: string[]): Promise<OAuthClient> {
  const c: OAuthClient = { id: `vk_c_${randomBytes(16).toString("base64url")}`, name: name.slice(0, 80) || "Forrit", redirect_uris: redirectUris };
  const { error } = await createAdminClient().from("oauth_clients").insert(c);
  if (error) throw new Error(error.message);
  return c;
}

export async function getClient(id: string): Promise<OAuthClient | null> {
  if (!id || id.length > 200) return null;
  const { data } = await createAdminClient().from("oauth_clients").select("id, name, redirect_uris").eq("id", id).maybeSingle();
  return (data as OAuthClient | null) ?? null;
}

// ---------- Hver má tengja ----------

export type Eligibility = { ok: true; companyName: string; role: "owner" | "manager"; enabled: boolean } | { ok: false; reason: string };

/** Stjórnandi eða vaktstjóri í fyrirtæki með VAKTO AI í áskrift (ekki opna demoið). `enabled` = kveikt á tengdum forritum. */
export async function eligibility(userId: string): Promise<Eligibility & { companyId?: string }> {
  const db = createAdminClient();
  const { data: u } = await db.from("users").select("role, company_id").eq("id", userId).maybeSingle();
  if (!u?.company_id) return { ok: false, reason: "Aðgangurinn er ekki tengdur fyrirtæki." };
  if (u.role !== "owner" && u.role !== "manager") return { ok: false, reason: "Aðeins stjórnendur og vaktstjórar geta tengt gervigreindarforrit." };
  if (process.env.DEMO_COMPANY_ID && u.company_id === process.env.DEMO_COMPANY_ID) return { ok: false, reason: "Ekki í boði í opna demoinu." };
  const { data: co } = await db.from("companies").select("name, ai_external, billing_status").eq("id", u.company_id).maybeSingle();
  if (!co) return { ok: false, reason: "Fyrirtæki fannst ekki." };
  if (co.billing_status === "suspended") return { ok: false, reason: "Aðgangi fyrirtækisins hefur verið lokað." };
  if (!planAllows((await companyPlan(u.company_id as string)).features, "ai")) return { ok: false, reason: "Tengd forrit fylgja Grunni og ofar — sjá vakto.is/verd." };
  return { ok: true, companyId: u.company_id as string, companyName: (co.name as string) ?? "", role: u.role, enabled: !!co.ai_external };
}

// ---------- Kóðar og lyklar ----------

export async function issueCode(p: { clientId: string; userId: string; companyId: string; redirectUri: string; challenge: string }): Promise<string> {
  const code = token("vk_code_");
  const { error } = await createAdminClient().from("oauth_codes").insert({
    code_hash: sha(code), client_id: p.clientId, user_id: p.userId, company_id: p.companyId,
    redirect_uri: p.redirectUri, code_challenge: p.challenge, expires_at: new Date(Date.now() + CODE_TTL * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export type TokenResult = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string };
type TokenError = { error: string; error_description?: string };

function pkceOk(verifier: string, challenge: string): boolean {
  if (!/^[\w.~-]{43,128}$/.test(verifier)) return false;
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url")), b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function newTokens(): Promise<{ at: string; rt: string; row: Record<string, string> }> {
  const at = token("vk_at_"), rt = token("vk_rt_");
  return { at, rt, row: { access_hash: sha(at), refresh_hash: sha(rt), access_expires_at: new Date(Date.now() + ACCESS_TTL * 1000).toISOString() } };
}
const result = (at: string, rt: string): TokenResult => ({ access_token: at, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: rt, scope: "read" });

/** authorization_code → ný tenging. Kóðinn er einnota. */
export async function exchangeCode(p: { code: string; clientId: string; redirectUri: string; verifier: string }): Promise<TokenResult | TokenError> {
  const db = createAdminClient();
  const { data: c } = await db.from("oauth_codes").delete().eq("code_hash", sha(p.code)).select("*").maybeSingle();
  if (!c || new Date(c.expires_at as string).getTime() < Date.now()) return { error: "invalid_grant", error_description: "Kóðinn er útrunninn eða ógildur" };
  if (c.client_id !== p.clientId || c.redirect_uri !== p.redirectUri) return { error: "invalid_grant", error_description: "client_id eða redirect_uri passar ekki" };
  if (!pkceOk(p.verifier, c.code_challenge as string)) return { error: "invalid_grant", error_description: "PKCE-staðfesting mistókst" };
  const el = await eligibility(c.user_id as string);
  if (!el.ok || !el.enabled || el.companyId !== c.company_id) return { error: "access_denied", error_description: el.ok ? "Tengd forrit eru ekki virk hjá fyrirtækinu" : el.reason };
  const client = await getClient(p.clientId);
  const sb = await mintSession(c.user_id as string);
  const t = await newTokens();
  const { error } = await db.from("mcp_grants").insert({
    client_id: p.clientId, client_name: client?.name ?? "Forrit", user_id: c.user_id, company_id: c.company_id, ...t.row,
    sb_refresh_enc: seal(sb.refresh), sb_access_enc: seal(sb.access), sb_access_exp: new Date(sb.exp * 1000).toISOString(),
  });
  if (error) { console.error("[mcp] grant", error.message); return { error: "server_error" }; }
  await db.from("audit_log").insert({ company_id: c.company_id, user_id: c.user_id, action: "ai_app.connect", entity: "mcp_grant", detail: `Tengdi ${client?.name ?? "forrit"} (lesaðgangur)` });
  return result(t.at, t.rt);
}

/** refresh_token → nýir lyklar (snúið við hverja notkun). */
export async function refreshTokens(p: { refresh: string; clientId: string }): Promise<TokenResult | TokenError> {
  const db = createAdminClient();
  const { data: g } = await db.from("mcp_grants").select("id, client_id").eq("refresh_hash", sha(p.refresh)).maybeSingle();
  if (!g || (p.clientId && g.client_id !== p.clientId)) return { error: "invalid_grant", error_description: "Tengingin finnst ekki — tengdu forritið aftur" };
  const t = await newTokens();
  const { error } = await db.from("mcp_grants").update(t.row).eq("id", g.id).eq("refresh_hash", sha(p.refresh));
  if (error) return { error: "server_error" };
  return result(t.at, t.rt);
}

// ---------- /api/mcp: hver er að kalla ----------

export type McpCaller = { grantId: string; userId: string; companyId: string; companyName: string; clientName: string; sbAccess: string };

/** Sannreynir lykil, réttindi og að kveikt sé á tengdum forritum; skilar gildum Supabase-lykli notandans. */
export async function mcpCaller(bearer: string | null): Promise<McpCaller | { error: string; status: number }> {
  if (!bearer?.startsWith("vk_at_")) return { error: "Vantar aðgangslykil", status: 401 };
  const db = createAdminClient();
  const { data: g } = await db.from("mcp_grants")
    .select("id, user_id, company_id, client_name, access_expires_at, sb_refresh_enc, sb_access_enc, sb_access_exp")
    .eq("access_hash", sha(bearer)).maybeSingle();
  if (!g || new Date(g.access_expires_at as string).getTime() < Date.now()) return { error: "Lykillinn er útrunninn", status: 401 };
  const el = await eligibility(g.user_id as string);
  if (!el.ok) return { error: el.reason, status: 403 };
  if (el.companyId !== g.company_id) return { error: "Notandinn er ekki lengur í fyrirtækinu", status: 403 };
  if (!el.enabled) return { error: "Stjórnandi fyrirtækisins hefur slökkt á tengdum forritum (Stillingar → Tengingar).", status: 403 };

  let sbAccess: string | null = null;
  if (g.sb_access_enc && g.sb_access_exp && new Date(g.sb_access_exp as string).getTime() > Date.now() + 60_000) {
    try { sbAccess = open(g.sb_access_enc as string); } catch { sbAccess = null; }
  }
  if (!sbAccess) {
    const { data: s, error } = await anon().auth.refreshSession({ refresh_token: open(g.sb_refresh_enc as string) });
    if (error || !s.session) { console.error("[mcp] refresh", error?.message); return { error: "Tengingin rann út — tengdu forritið aftur", status: 401 }; }
    sbAccess = s.session.access_token;
    await db.from("mcp_grants").update({
      sb_refresh_enc: seal(s.session.refresh_token), sb_access_enc: seal(sbAccess),
      sb_access_exp: new Date((s.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
    }).eq("id", g.id);
  }
  // last_used_at: í mesta lagi einu sinni á mínútu.
  void db.from("mcp_grants").update({ last_used_at: new Date().toISOString() }).eq("id", g.id)
    .or(`last_used_at.is.null,last_used_at.lt.${new Date(Date.now() - 60_000).toISOString()}`).then(() => {});
  return { grantId: g.id as string, userId: g.user_id as string, companyId: g.company_id as string, companyName: el.companyName, clientName: g.client_name as string, sbAccess };
}

/** Eyðir tengingu og lokar Supabase-lotu hennar. */
export async function deleteGrant(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: g } = await db.from("mcp_grants").delete().eq("id", id).select("sb_access_enc").maybeSingle();
  if (g?.sb_access_enc) {
    try { await db.auth.admin.signOut(open(g.sb_access_enc as string), "local"); } catch { /* lotan rennur út af sjálfu sér */ }
  }
}

/** Slóð MCP-þjónsins og OAuth-lýsigagna fyrir þennan hýsil. */
export function origins(req: Request): { origin: string; resource: string } {
  const origin = new URL(req.url).origin;
  return { origin, resource: `${origin}/api/mcp` };
}
