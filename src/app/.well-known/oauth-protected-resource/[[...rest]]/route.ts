import { NextResponse } from "next/server";
import { origins } from "@/lib/mcp.server";

// RFC 9728: MCP-þjónninn (/api/mcp) og hvar á að skrá sig inn. Svarar líka á …/api/mcp-slóðinni.
export function GET(req: Request) {
  const { origin, resource } = origins(req);
  return NextResponse.json({
    resource,
    authorization_servers: [origin],
    scopes_supported: ["read"],
    bearer_methods_supported: ["header"],
    resource_name: "VAKTO",
    resource_documentation: `${origin}/hjalp`,
  }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
}
