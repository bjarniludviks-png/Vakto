// @-merkingar í hópspjalli. Skilaboðin geyma venjulegan texta („@Huyen Thi Ngo takk!“) svo eldri
// útgáfur sýna hann eðlilega; hver var nefndur er fundið út frá nöfnum meðlima þráðarins.
// ATH: sama skrá er í mobile/src/lib/mentions.ts — halda þeim eins.

export type MentionPerson = { userId: string; name: string };
export type MentionPart = { text: string; userId?: string };

const WORD = /[\p{L}\p{N}]/u;
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** @-leit í gangi við bendilinn: „…takk @Hu|“ → { start: index „@“, q: "Hu" }. */
export function mentionQuery(text: string, caret: number): { start: number; q: string } | null {
  const m = /(^|\s)@([\p{L}\p{N}.\-]{0,30})$/u.exec(text.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, q: m[2] } : null;
}

/** Meðlimir sem passa við leitina (fornafn eða hvaða nafnhluti sem er byrjar á henni). */
export function filterMentions<T extends MentionPerson>(people: T[], q: string, limit = 6): T[] {
  const n = norm(q);
  return people.filter((p) => !n || norm(p.name).split(/\s+/).some((w) => w.startsWith(n)) || norm(p.name).startsWith(n)).slice(0, limit);
}

/** Setja „@Fullt Nafn “ í stað leitarinnar; skilar nýjum texta og stöðu bendils. */
export function insertMention(text: string, start: number, caret: number, name: string): { text: string; caret: number } {
  const ins = `@${name} `;
  return { text: text.slice(0, start) + ins + text.slice(caret).replace(/^\s+/, ""), caret: start + ins.length };
}

/** Skipta texta í búta: venjulegan texta og @-merkingar (með userId). Fullt nafn eða einstakt fornafn. */
export function splitMentions(body: string, people: MentionPerson[]): MentionPart[] {
  if (!body.includes("@") || !people.length) return [{ text: body }];
  const firstCount = new Map<string, number>();
  for (const p of people) { const f = norm(p.name.split(/\s+/)[0] ?? ""); firstCount.set(f, (firstCount.get(f) ?? 0) + 1); }
  const toks: { key: string; userId: string }[] = [];
  for (const p of people) {
    toks.push({ key: norm(p.name), userId: p.userId });
    const f = norm(p.name.split(/\s+/)[0] ?? "");
    if (f && firstCount.get(f) === 1 && f !== norm(p.name)) toks.push({ key: f, userId: p.userId });
  }
  toks.sort((a, b) => b.key.length - a.key.length);
  const out: MentionPart[] = [];
  let buf = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "@" && (i === 0 || !WORD.test(body[i - 1]))) {
      const hit = toks.find((t) => {
        const seg = body.slice(i + 1, i + 1 + t.key.length);
        return seg.length === t.key.length && norm(seg) === t.key && !WORD.test(body[i + 1 + t.key.length] ?? "");
      });
      if (hit) {
        if (buf) { out.push({ text: buf }); buf = ""; }
        const end = i + 1 + hit.key.length;
        out.push({ text: body.slice(i, end), userId: hit.userId });
        i = end;
        continue;
      }
    }
    buf += body[i++];
  }
  if (buf) out.push({ text: buf });
  return out;
}

/** Hverjir voru nefndir í skilaboðunum. */
export function mentionedIds(body: string, people: MentionPerson[]): string[] {
  return [...new Set(splitMentions(body, people).map((p) => p.userId).filter((x): x is string => !!x))];
}
