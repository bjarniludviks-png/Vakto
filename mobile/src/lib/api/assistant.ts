// VAKTO AI í appinu — sami bakendi og á vefnum (/api/assistant) undir /api/app/assistant,
// innskráð með Supabase-aðgangslykli (Bearer). Svarið streymir sem NDJSON: stig, texti orð
// fyrir orð, tillögur, og loks „done“. expo/fetch styður streymi (venjulegt fetch í RN gerir það ekki).
import { fetch as streamFetch } from "expo/fetch";
import { supabase } from "../supabase";
import { getLang } from "../i18n";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/\/$/, "");

export type AiAction = { tool: string; input: Record<string, unknown>; summary: string; state?: "pending" | "busy" | "done" | "cancelled" | "error"; error?: string };
export type AiMsg = { id?: string; role: "user" | "assistant"; content: string; actions?: AiAction[]; upgrade?: boolean };
export type AiConversation = { id: string; title: string; updated_at: string };
export type AiEvent =
  | { t: "ping" }
  | { t: "stage"; stage: string; tool?: string }
  | { t: "turn" }
  | { t: "text"; d: string }
  | { t: "plan"; add: string[]; total?: number; dept?: string }
  | { t: "action"; action: AiAction }
  | { t: "done"; ok: boolean; reply?: string; actions?: AiAction[]; conversationId?: string; messageId?: string; error?: string; limit?: { canUpgrade?: boolean } };

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Record<string, unknown> | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${API}/api/app/assistant${path}`, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    return (await r.json()) as Record<string, unknown>;
  } catch { return null; }
}

/** Spyr VAKTO AI; `on` fær hvern atburð jafnóðum. Skilar „done“-atburðinum. */
export async function ask(messages: AiMsg[], conversationId: string | null, on: (ev: AiEvent) => void): Promise<Extract<AiEvent, { t: "done" }>> {
  const fail = (error: string) => ({ t: "done" as const, ok: false, error });
  const t = await token();
  if (!t) return fail("Ekki innskráð(ur)");
  let res: Awaited<ReturnType<typeof streamFetch>>;
  try {
    res = await streamFetch(`${API}/api/app/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ path: "/app", lang: getLang(), conversationId, messages: messages.map(({ role, content }) => ({ role, content })) }),
    });
  } catch { return fail("Engin tenging — reyndu aftur"); }
  if (!(res.headers.get("content-type") ?? "").includes("ndjson")) {
    try { const d = (await res.json()) as Extract<AiEvent, { t: "done" }>; return { ...d, t: "done", ok: !!d.ok }; } catch { return fail("VAKTO AI svaraði ekki"); }
  }
  let done: Extract<AiEvent, { t: "done" }> | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let ev: AiEvent;
    try { ev = JSON.parse(line) as AiEvent; } catch { return; }
    if (ev.t === "done") done = ev; else on(ev);
  };
  try {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
    }
    handle(buf);
  } catch { return fail("Tengingin rofnaði — reyndu aftur"); }
  return done ?? fail("VAKTO AI svaraði ekki");
}

/** Framkvæmir tillögu sem notandinn staðfesti (þjónninn athugar hlutverk og inntak aftur). */
export async function execute(a: AiAction): Promise<{ ok: boolean; error?: string }> {
  const d = await call("/execute", { method: "POST", body: { tool: a.tool, input: a.input, lang: getLang() } });
  return d ? { ok: !!d.ok, error: d.error as string | undefined } : { ok: false, error: "Engin tenging — reyndu aftur" };
}

export async function listConversations(): Promise<AiConversation[]> {
  return ((await call("/conversations"))?.conversations as AiConversation[] | undefined) ?? [];
}

export async function getConversation(id: string): Promise<AiMsg[]> {
  const rows = ((await call(`/conversations?id=${id}`))?.messages as { id: string; role: AiMsg["role"]; content: string; actions: AiAction[] | null }[] | undefined) ?? [];
  return rows.map((m) => ({ id: m.id, role: m.role, content: m.content, actions: m.actions ?? undefined }));
}

export async function deleteConversation(id: string): Promise<void> {
  await call(`/conversations?id=${id}`, { method: "DELETE" });
}

/** Vistar stöðu tillögu svo hún sé rétt þegar samtalið er opnað aftur. */
export async function saveActionState(messageId: string, index: number, state: "done" | "cancelled" | "error"): Promise<void> {
  await call("/conversations", { method: "PATCH", body: { messageId, index, state } });
}
