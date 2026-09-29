// AFRIT af parseContract/splitLang í src/lib/contract-pdf.ts (vefurinn). Breyta báðum saman.
export type Section = { title: string; rows: [string, string][]; paras: string[] };

/** "Íslenska / English" → ["Íslenska", "English"] (aðeins bil-afmarkað " / "). */
export function splitLang(s: string): [string, string] {
  const i = s.indexOf(" / ");
  return i < 0 ? [s, ""] : [s.slice(0, i).trim(), s.slice(i + 3).trim()];
}

export function parseContract(content: string): { title: string; sections: Section[] } {
  let title = "Ráðningarsamningur / Employment contract";
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("# ")) { title = line.slice(2); continue; }
    if (line.startsWith("## ")) { cur = { title: line.slice(3), rows: [], paras: [] }; sections.push(cur); continue; }
    if (/^_?Undirritun/.test(line)) break;
    if (/^(Vinnuveitandi|Starfsmaður)\s*:\s*_+/.test(line)) continue;
    const kv = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!cur) { cur = { title: "", rows: [], paras: [] }; sections.push(cur); }
    if (kv) cur.rows.push([kv[1], kv[2]]);
    else {
      const txt = line.replace(/^_|_$/g, "");
      if (cur.paras.length) cur.paras[cur.paras.length - 1] += " " + txt;
      else cur.paras.push(txt);
    }
  }
  return { title, sections };
}
