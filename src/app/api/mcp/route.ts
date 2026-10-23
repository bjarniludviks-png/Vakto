import { NextResponse } from "next/server";
import { READ_TOOLS, runReadTool } from "@/lib/ai/assistant-tools";
import { rateLimited } from "@/lib/ai/assistant-auth";
import { mcpCaller, origins } from "@/lib/mcp.server";
import { actAs } from "@/lib/supabase/server";

// MCP-þjónn VAKTO (Streamable HTTP, svör sem JSON, engin lota). Aðeins LEStól — sömu og VAKTO AI notar,
// keyrð sem notandi tengingarinnar svo RLS og hlutverk gilda eins og á vefnum. Engin skrif eru í boði.
export const maxDuration = 60;

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

const INSTRUCTIONS = [
  "VAKTO is an Icelandic workforce management system (shift schedules, time clock, payroll, labor cost as % of revenue).",
  "These tools are READ-ONLY: they cannot change shifts, pay or anything else. To make changes, the user must use vakto.is or VAKTO AI there.",
  "Tool descriptions and data are in Icelandic. Amounts are ISK (kr). Dates are YYYY-MM-DD. Call `about` first to get today's date and the company.",
  "Answer in the user's language.",
].join(" ");

// Vörn óháð verkfærunum: þessir reitir fara aldrei út, þótt þeir slæðist inn í svar.
const SECRET = /^(kennitala|kt|cokt|companyKt|bank_?account|bankAccount|clock_?token|clockToken|address|postal_code|pin|pay_settings|paySettings)$/i;
function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !SECRET.test(k)).map(([k, x]) => [k, scrub(x)]));
  return v;
}

const TOOLS = [
  {
    name: "about",
    description: "Fyrirtækið, notandinn sem tengdi forritið og dagurinn í dag (Ísland). Kallaðu á þetta fyrst til að vita hvaða dagur er.",
    inputSchema: { type: "object", properties: {} },
  },
  ...READ_TOOLS.map((t) => ({ name: t.name, description: t.description ?? "", inputSchema: t.input_schema })),
].map((t) => ({ ...t, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }));
const NAMES = new Set(TOOLS.map((t) => t.name));

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Atlantic/Reykjavik" }).format(new Date());

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export function GET() { return new NextResponse(null, { status: 405, headers: { ...CORS, Allow: "POST" } }); }

export async function POST(req: Request) {
  const { origin } = origins(req);
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  const caller = await mcpCaller(bearer);
  if ("error" in caller) {
    // Hausar mega aðeins vera ASCII — íslenski textinn fer í meginmálið.
    const www = caller.status === 401
      ? `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", error="invalid_token", error_description="Sign in to VAKTO again"`
      : `Bearer error="insufficient_scope", error_description="Access to VAKTO is not allowed"`;
    return NextResponse.json({ error: caller.error }, { status: caller.status, headers: { ...CORS, "WWW-Authenticate": www } });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json(fail(null, -32700, "Parse error"), { status: 400, headers: CORS }); }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Rpc[];

  const handle = async (m: Rpc): Promise<object | null> => {
    if (!m || typeof m !== "object" || typeof m.method !== "string") return fail(m?.id, -32600, "Invalid request");
    const isNote = m.id === undefined || m.id === null;
    switch (m.method) {
      case "initialize": {
        const want = String(m.params?.protocolVersion ?? "");
        return ok(m.id, {
          protocolVersion: VERSIONS.includes(want) ? want : VERSIONS[1],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "VAKTO", title: "VAKTO", version: "1.0.0" },
          instructions: INSTRUCTIONS,
        });
      }
      case "ping": return ok(m.id, {});
      case "tools/list": return ok(m.id, { tools: TOOLS });
      case "tools/call": {
        const name = String(m.params?.name ?? "");
        const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
        if (!NAMES.has(name)) return fail(m.id, -32602, `Óþekkt verkfæri: ${name}`);
        if (rateLimited(`mcp:${caller.userId}`, 120)) return ok(m.id, { content: [{ type: "text", text: "Of margar fyrirspurnir — reyndu aftur eftir nokkrar mínútur." }], isError: true });
        let text: string;
        if (name === "about") {
          text = JSON.stringify({ company: caller.companyName, today: today(), timezone: "Atlantic/Reykjavik", currency: "ISK", connectedApp: caller.clientName, access: "read-only" });
        } else {
          text = await actAs.run(caller.sbAccess, () => runReadTool(name, args));
          try { text = JSON.stringify(scrub(JSON.parse(text))); } catch { /* ekki JSON — óbreytt */ }
        }
        const isError = /^\{"error":/.test(text);
        return ok(m.id, { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) });
      }
      default:
        if (m.method.startsWith("notifications/")) return null;
        return isNote ? null : fail(m.id, -32601, `Method not found: ${m.method}`);
    }
  };

  const out = (await Promise.all(msgs.map(handle))).filter((x): x is object => x !== null);
  if (!out.length) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(batch ? out : out[0], { headers: CORS });
}
