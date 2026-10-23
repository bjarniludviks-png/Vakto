import { NextResponse } from "next/server";
import { okRedirect, registerClient } from "@/lib/mcp.server";

// RFC 7591 Dynamic Client Registration — Claude/ChatGPT skrá sig sjálf. Aðeins opinber forrit (PKCE, ekkert leyndarmál).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const bad = (d: string) => NextResponse.json({ error: "invalid_client_metadata", error_description: d }, { status: 400, headers: CORS });

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return bad("Ógilt JSON"); }
  const uris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || uris.length > 10 || !uris.every(okRedirect)) return bad("redirect_uris verða að vera https (eða localhost)");
  const name = typeof body.client_name === "string" ? body.client_name.trim() : "";
  try {
    const c = await registerClient(name || new URL(uris[0]).hostname, uris);
    return NextResponse.json({
      client_id: c.id, client_name: c.name, redirect_uris: c.redirect_uris, client_id_issued_at: Math.floor(Date.now() / 1000),
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none",
    }, { status: 201, headers: CORS });
  } catch (e) {
    console.error("[oauth] register", e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: CORS });
  }
}
