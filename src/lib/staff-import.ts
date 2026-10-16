// Les starfsfólk úr Excel-gögnum (read-excel-file skilar öllum flipum: [{ sheet, data }]).
// Hreint fall — notað í Starfsfólk → Flytja inn (Excel) og prófað beint á skrám viðskiptavina.

export type StaffImportRow = {
  fullName: string; kennitala?: string; email?: string; phone?: string; hireDate?: string; active?: boolean;
  role?: string; position?: string; department?: string; location?: string;
  payType?: string; rate?: string; employmentRatio?: string; union?: string; bankAccount?: string;
};
type Sheet = { sheet?: string; data: unknown[][] };

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const NAME_KEYS = ["nafn", "name"];

/** Velur flipann sem er með „Nafn“-dálk í fyrstu línum (sniðmátið hefur líka „Leiðbeiningar“-flipa,
 *  og röð flipa fer eftir því hvernig skráin var vistuð). */
export function pickStaffSheet(out: unknown): unknown[][] {
  const sheets: Sheet[] = Array.isArray(out) && out.length && Array.isArray((out[0] as Sheet)?.data)
    ? (out as Sheet[])
    : [{ data: (out as unknown[][]) ?? [] }];
  const score = (s: Sheet) => {
    const head = (s.data[0] ?? []).map(norm);
    return (head.some((h) => NAME_KEYS.some((k) => h.includes(k))) ? 10 : 0) + head.filter(Boolean).length / 100 + (/starfsf|staff|employ/i.test(s.sheet ?? "") ? 1 : 0);
  };
  return [...sheets].sort((a, b) => score(b) - score(a))[0]?.data ?? [];
}

/** Dálkur eftir heiti: fyrst nákvæm samsvörun, svo „inniheldur“ — en aldrei dálkur sem passar við `not`.
 *  (Dæmi: „laun“ má ekki grípa „Launategund“ þegar Taxta-dálkinn vantar.) */
function finder(header: string[]) {
  return (names: string[], not: string[] = []) => {
    const ok = (h: string) => h && !not.some((n) => h.includes(n));
    const exact = header.findIndex((h) => ok(h) && names.includes(h.replace(/\s*%$/, "")));
    return exact >= 0 ? exact : header.findIndex((h) => ok(h) && names.some((n) => h.includes(n)));
  };
}

/** Kennitala: Excel geymir hana oft sem tölu og sleppir fremsta núllinu (fædd 1.–9. dag mánaðar). */
export function normKennitala(v: unknown): string | undefined {
  const d = String(v ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  return d.length === 9 ? `0${d}` : d;
}

function isoDate(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s); // 1.5.2020
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{5}$/.test(s)) { const t = Date.UTC(1899, 11, 30) + Number(s) * 864e5; return new Date(t).toISOString().slice(0, 10); } // Excel-raðtala
  return undefined;
}

export function parseStaffSheet(out: unknown): { rows: StaffImportRow[]; error?: string } {
  const grid = pickStaffSheet(out);
  const header = (grid[0] ?? []).map(norm);
  const col = finder(header);
  const ci = {
    name: col(["nafn", "fullt nafn", "name"], ["notenda", "deild", "fyrirtæk"]),
    kt: col(["kennitala", "ssn"]),
    phone: col(["sími", "simi", "farsími", "phone"]),
    email: col(["netfang", "tölvupóstur", "tolvupostur", "email", "e-mail"]),
    hire: col(["ráðningardagur", "ráðning", "radning", "hire"]),
    active: col(["virkur", "virk", "active"]),
    role: col(["hlutverk", "role"]),
    position: col(["starfsheiti", "staða", "stada", "position", "title"]),
    department: col(["deild", "department"]),
    location: col(["staður", "stadur", "starfsstöð", "location"], ["starfshlutf"]),
    payType: col(["launategund", "launateg", "pay type", "paytype"]),
    rate: col(["taxti", "tímakaup", "timakaup", "mánaðarlaun", "laun", "rate"], ["launateg", "pay type", "paytype"]),
    ratio: col(["starfshlutfall", "hlutfall", "ratio"]),
    union: col(["stéttarfélag", "stettarfelag", "félag", "union"]),
    bank: col(["bankareikningur", "bankareikning", "banki", "reikning", "bank"]),
  };
  if (ci.name < 0) return { rows: [], error: "Fann ekki 'Nafn' dálk í skránni" };
  const val = (row: unknown[], i: number) => (i >= 0 && row[i] != null ? String(row[i]).trim() : "");
  const rows = grid.slice(1).filter((r) => Array.isArray(r) && val(r, ci.name)).map((r) => {
    const a = val(r, ci.active).toLowerCase();
    return {
      fullName: val(r, ci.name).replace(/\s+/g, " "),
      kennitala: normKennitala(ci.kt >= 0 ? r[ci.kt] : ""),
      phone: val(r, ci.phone) || undefined,
      email: val(r, ci.email).toLowerCase() || undefined,
      hireDate: ci.hire >= 0 ? isoDate(r[ci.hire]) : undefined,
      active: a ? !["nei", "no", "false", "óvirkur", "ovirkur"].includes(a) : true,
      role: val(r, ci.role) || undefined,
      position: val(r, ci.position) || undefined,
      department: val(r, ci.department) || undefined,
      location: val(r, ci.location) || undefined,
      payType: val(r, ci.payType) || undefined,
      rate: val(r, ci.rate) || undefined,
      employmentRatio: val(r, ci.ratio) || undefined,
      union: val(r, ci.union) || undefined,
      bankAccount: val(r, ci.bank).replace(/\s+/g, "") || undefined,
    };
  });
  if (!rows.length) return { rows, error: "Engir starfsmenn í skránni" };
  return { rows };
}
