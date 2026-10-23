import { NextResponse } from "next/server";
import { exchangeCode, refreshTokens } from "@/lib/mcp.server";

// OAuth token-endapunktur: authorization_code (+ PKCE) og refresh_token. Tekur form-kóðun (staðall) eða JSON.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization" };
const out = (body: object, status = 200) => NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: Request) {
  let p: Record<string, string> = {};
  try {
    if ((req.headers.get("content-type") ?? "").includes("json")) p = (await req.json()) as Record<string, string>;
    else p = Object.fromEntries(new URLSearchParams(await req.text()));
  } catch { return out({ error: "invalid_request" }, 400); }
  const s = (k: string) => (typeof p[k] === "string" ? p[k] : "");
  try {
    const r = s("grant_type") === "authorization_code"
      ? (s("code") && s("code_verifier") ? await exchangeCode({ code: s("code"), clientId: s("client_id"), redirectUri: s("redirect_uri"), verifier: s("code_verifier") }) : { error: "invalid_request" })
      : s("grant_type") === "refresh_token"
        ? (s("refresh_token") ? await refreshTokens({ refresh: s("refresh_token"), clientId: s("client_id") }) : { error: "invalid_request" })
        : { error: "unsupported_grant_type" };
    return "error" in r ? out(r, r.error === "server_error" ? 500 : 400) : out(r);
  } catch (e) {
    console.error("[oauth] token", e);
    return out({ error: "server_error" }, 500);
  }
}
