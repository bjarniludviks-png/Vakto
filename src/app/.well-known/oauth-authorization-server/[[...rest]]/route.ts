import { NextResponse } from "next/server";
import { origins } from "@/lib/mcp.server";

// RFC 8414: OAuth-þjónn VAKTO fyrir tengd forrit (aðeins authorization_code + PKCE og refresh_token).
export function GET(req: Request) {
  const { origin } = origins(req);
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read"],
    service_documentation: `${origin}/hjalp`,
  }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
}
