// Sameiginlegt fyrir streymandi AI-svör (VAKTO AI og „Biðja AI“ á Vaktaplani).
// Þjónninn sendir NDJSON — einn JSON-hlut per línu — svo vafrinn geti sýnt framvindu strax:
// stig („Les vaktaplan…“), texta orð fyrir orð og vaktir jafnóðum og líkanið skrifar þær.

/** Atburður í NDJSON-straumi VAKTO AI (/api/assistant). */
export type AssistantEvent =
  | { t: "ping" }
  | { t: "stage"; stage: "think" | "read" | "plan" | "write" | "summary"; tool?: string }
  | { t: "turn" } // nýtt svar frá líkaninu hefst — texti fyrra svars var milliskref
  | { t: "text"; d: string }
  | { t: "plan"; add: string[]; total?: number; dept?: string }
  | { t: "action"; action: { tool: string; input: Record<string, unknown>; summary: string } }
  | { t: "done"; ok: boolean; [k: string]: unknown };

/** Atburður í NDJSON-straumi „Biðja AI“ (/api/ai/schedule). */
export type ScheduleEvent =
  | { t: "ping" }
  | { t: "stage"; stage: "read" | "think" | "write" }
  | { t: "progress"; shifts: number }
  | { t: "done"; ok: boolean; [k: string]: unknown };

export const NDJSON_HEADERS = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } as const;

/**
 * NDJSON-straumur með hjartslætti (ping á 5 sek. fresti svo milliliðir loki ekki tengingunni á
 * meðan líkanið hugsar). `run` fær `send` og keyrir þar til svarið er tilbúið.
 */
export function ndjsonStream<E extends { t: string }>(run: (send: (ev: E) => void) => Promise<void>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let open = true;
      const send = (ev: E) => { if (!open) return; try { ctrl.enqueue(enc.encode(JSON.stringify(ev) + "\n")); } catch { open = false; } };
      const beat = setInterval(() => send({ t: "ping" } as E), 5000);
      try { await run(send); } finally { clearInterval(beat); open = false; try { ctrl.close(); } catch { /* þegar lokað */ } }
    },
  });
}

/** Les NDJSON-svar í vafranum og kallar á `on` fyrir hvern atburð. */
export async function readNdjson<E>(res: Response, on: (ev: E) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) on(JSON.parse(line) as E);
    }
  }
  if (buf.trim()) on(JSON.parse(buf) as E);
}

export const isNdjson = (res: Response) => (res.headers.get("content-type") ?? "").includes("ndjson");

/** Fullkláraðir vaktastrengir („Nafn|YYYY-MM-DD|HH:MM|HH:MM[|tegund]“) í hálfskrifuðu plan_week-inntaki. */
export function completedShiftStrings(partialJson: string): string[] {
  const at = partialJson.indexOf('"shifts"');
  if (at < 0) return [];
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  re.lastIndex = partialJson.indexOf("[", at) + 1 || at;
  for (let m: RegExpExecArray | null; (m = re.exec(partialJson)); ) {
    let s: string;
    try { s = JSON.parse(`"${m[1]}"`) as string; } catch { continue; }
    if (/^[^|]+\|\d{4}-\d{2}-\d{2}\|\d{1,2}:\d{2}\|\d{1,2}:\d{2}/.test(s)) out.push(s);
  }
  return out;
}

/** Tala sem líkanið gefur upp í hálfskrifuðu inntaki, t.d. "shiftCount": 21. */
export function partialNumber(partialJson: string, key: string): number | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*(\\d+)\\s*[,}]`).exec(partialJson);
  return m ? Number(m[1]) : undefined;
}

/** Hálfskrifaður strengur, t.d. "department": "Eldhús" (aðeins ef hann er fullkláraður). */
export function partialString(partialJson: string, key: string): string | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(partialJson);
  if (!m) return undefined;
  try { return JSON.parse(`"${m[1]}"`) as string; } catch { return undefined; }
}

/** Strengur sem er enn í skrifum, t.d. "notes": "- Truong 40 klst… (skilar því sem komið er, án hálfrar escape-runu). */
export function partialStringOpen(partialJson: string, key: string): string | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*"`).exec(partialJson);
  if (!m) return undefined;
  let raw = partialJson.slice(m.index + m[0].length);
  const end = /(?<!\\)(?:\\\\)*"/.exec(raw);
  if (end) raw = raw.slice(0, end.index + end[0].length - 1);
  raw = raw.replace(/\\u[0-9a-fA-F]{0,3}$|\\$/, "");
  try { return JSON.parse(`"${raw}"`) as string; } catch { return undefined; }
}

/** Fjöldi fullkláraðra vakta („Nafn|dagur|HH:MM|HH:MM“) í hálfskrifuðu JSON-svari „Biðja AI“. */
export function completedShiftCells(partialJson: string): number {
  const at = partialJson.indexOf('"shifts"');
  if (at < 0) return 0;
  return (partialJson.slice(at).match(/"[^"|]+\|[0-6]\|\d{1,2}:\d{2}\|\d{1,2}:\d{2}"/g) ?? []).length;
}
