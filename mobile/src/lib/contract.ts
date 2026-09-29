// AFRIT af parseContract/splitLang/contractSummary/visibleRows í src/lib/contract-pdf.ts (vefurinn). Breyta báðum saman.
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

export const isBlank = (v: string) => /^_{6,}$/.test(v.trim());

/** Prentuð/lesin útgáfa: tómir valkvæðir reitir („—“) falla út svo samningurinn sé
 *  hnitmiðaður; skyldureitir (líka auðir) standa alltaf. Kafli sem tæmist fær eina línu. */
export function visibleRows(rows: [string, string][]): [string, string][] {
  const keep = rows.filter(([, v]) => v.trim() !== "—" && v.trim() !== "");
  return rows.length && !keep.length ? [["Skráning / Record", "Ekkert skráð / None recorded"]] : keep;
}

export type ContractSummary = {
  sentence: [string, string] | null;             // IS, EN
  tiles: { label: string; value: string }[];     // 4 lykiltölur (tómar = „—“)
};

/** Samantekt fyrir hausinn — lesin úr reitunum (sniðmát vmst-2021). Eldri samningar fá bara reiti sem finnast. */
export function contractSummary(sections: Section[]): ContractSummary {
  const find = (sec: string, label: string) => {
    for (const s of sections) {
      if (!splitLang(s.title)[0].startsWith(sec)) continue;
      const r = s.rows.find(([k]) => splitLang(k)[0].startsWith(label));
      if (r && !isBlank(r[1]) && r[1].trim() && r[1].trim() !== "—") return r[1].trim();
    }
    return "";
  };
  const is = (v: string) => splitLang(v)[0];
  const employer = find("Vinnuveitandi", "Nafn");
  const name = [find("Starfsmaður", "Skírnarnafn"), find("Starfsmaður", "Eftirnafn")].filter(Boolean).join(" ");
  const start = find("Ráðningartími", "Fyrsti starfsdagur");
  const role = is(find("Starfssvið", "Starfsheiti"));
  const ratio = is(find("Vinnutími", "Starfshlutfall")).replace(/^(Fullt starf|Hlutastarf)\s*/, "");
  const arr = is(find("Vinnutími", "Fyrirkomulag")).toLowerCase();
  const pay = find("Laun", "Dagvinna");
  const monthly = find("Laun", "Laun kr.");
  const agreement = find("Kjarasamningur", "Kjarasamningur");
  const sentence: [string, string] | null = employer && name
    ? [`${employer} ræður ${name} til starfa${start ? ` frá ${start}` : ""} á þeim kjörum sem hér fara á eftir.`,
       `${employer} employs ${name}${start ? ` from ${start}` : ""} on the terms set out below.`]
    : null;
  return {
    sentence,
    tiles: [
      { label: "Starf · Role", value: role || "—" },
      { label: "Starfshlutfall · Ratio", value: [ratio, arr].filter(Boolean).join(" · ") || "—" },
      monthly ? { label: "Laun · Monthly", value: `${monthly}/mán.` } : { label: "Dagvinna · Hourly", value: pay ? `${pay}/klst.` : "—" },
      { label: "Kjarasamningur · Agreement", value: agreement || "—" },
    ],
  };
}

