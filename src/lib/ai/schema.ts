// Hjálparföll fyrir structured outputs (output_config.format json_schema).
// API-ið krefst additionalProperties:false á hverjum hlut, leyfir mest 24 valkvæða reiti
// og mest 16 „nullable“ reiti. Við gerum því ALLA reiti að skyldu og notum „ekki sett“-gildi
// í stað valkvæðra: -1 fyrir tölur, "" fyrir texta. stripUnset fjarlægir þau úr svarinu
// svo kóðinn fái sama form og áður (reitur sem vantar = ekki í samningnum).

type Json = Record<string, unknown>;
const UNSET_NUM = -1;

export function strictSchema<T>(node: T): T {
  if (Array.isArray(node)) return node.map(strictSchema) as T;
  if (!node || typeof node !== "object") return node;
  const o: Json = Object.fromEntries(Object.entries(node as Json).map(([k, v]) => [k, strictSchema(v)]));
  if (o.type === "object" && o.properties && typeof o.properties === "object") {
    const props = o.properties as Record<string, Json>;
    const req = new Set((o.required as string[] | undefined) ?? []);
    for (const [k, p] of Object.entries(props)) {
      if (req.has(k)) continue;
      const hint = p.type === "number" || p.type === "integer" ? `${UNSET_NUM} ef ekki tilgreint` : p.type === "string" ? "tómur strengur ef ekki tilgreint" : "";
      if (hint) p.description = p.description ? `${p.description} (${hint})` : hint;
    }
    o.required = Object.keys(props);
    o.additionalProperties = false;
  }
  return o as T;
}

/** Fjarlægir „ekki sett“-gildi (-1, "", null) og tóma hluti sem verða eftir. */
export function stripUnset<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripUnset) as T;
  if (v && typeof v === "object") {
    const out: Json = {};
    for (const [k, x] of Object.entries(v as Json)) {
      if (x === null || x === "" || x === UNSET_NUM) continue;
      const c = stripUnset(x);
      if (c && typeof c === "object" && !Array.isArray(c) && Object.keys(c).length === 0) continue;
      out[k] = c;
    }
    return out as T;
  }
  return v;
}
