import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { computeLine, totals as sumTotals, BURDEN, type PayLine } from "@/lib/payroll";
import { initials } from "@/lib/employees";
import { nf, dec1 } from "@/lib/format";

export type PayrollRow = { n: string; av: string; c: string; h: string; g: string; w: string; p: string; net: string };
export type PayrollTotalsView = { count: number; hours: string; gross: string; withholding: string; pensionUnion: string; net: string; cost: string; grossM: string; netM: string; costM: string; withholdingM: string };
export type PayrollView = { rows: PayrollRow[]; totals: PayrollTotalsView; live: boolean };

// Demo rows mirror the prototype (5 shown) — used before Supabase is connected.
const DEMO: PayrollView = {
  rows: [
    { n: "Mína", av: "MÍ", c: "#5b50e6", h: "171,0", g: "651.000", w: "−142.300", p: "−32.550", net: "468.150" },
    { n: "Bach", av: "BA", c: "#1fb6a6", h: "160,0", g: "496.000", w: "−96.400", p: "−24.800", net: "374.800" },
    { n: "Phong", av: "PH", c: "#18a06a", h: "158,0", g: "489.800", w: "−94.900", p: "−24.490", net: "370.410" },
    { n: "Jón", av: "JÓ", c: "#8b7bff", h: "160,0", g: "560.000", w: "−118.600", p: "−28.000", net: "413.400" },
    { n: "Ómar", av: "ÓM", c: "#e0533f", h: "148,0", g: "528.700", w: "−110.300", p: "−26.435", net: "391.965" },
  ],
  totals: { count: 12, hours: "1.968", gross: "5.676.918", withholding: "−986.300", pensionUnion: "−283.846", net: "4.460.772", cost: "7.389.405", grossM: "5,68", netM: "4,46", costM: "7,39", withholdingM: "0,99" },
  live: false,
};

const million = (n: number) => dec1(Math.round(n / 100000) / 10);

function rowFrom(line: PayLine, color: string): PayrollRow {
  return {
    n: line.name.split(/\s+/)[0],
    av: initials(line.name),
    c: color,
    h: dec1(line.hours),
    g: nf(line.gross),
    w: "−" + nf(line.withholding),
    p: "−" + nf(line.pension + line.union),
    net: nf(line.net),
  };
}

/** Payroll rows: latest persisted run if any, else computed from real employees. */
export async function getPayroll(): Promise<PayrollView> {
  if (!isSupabaseConfigured()) return DEMO;
  try {
    const { employees, live } = await getEmployees();
    if (!live || employees.length === 0) return DEMO;
    const colorOf = (id: string) => employees.find((e) => e.id === id)?.avatarColor ?? "#5b50e6";

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;

    let lines: PayLine[] | null = null;
    if (company) {
      const { data: run } = await supabase
        .from("payroll_runs").select("id").eq("company_id", company)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (run) {
        const { data: pl } = await supabase
          .from("payroll_lines")
          .select("employee_id, hours, gross, withholding, pension, union_fee, net, employees(full_name, avatar_color)")
          .eq("run_id", run.id);
        if (pl && pl.length) {
          lines = pl.map((l) => {
            const emp = (Array.isArray(l.employees) ? l.employees[0] : l.employees) as { full_name?: string; avatar_color?: string } | null;
            return {
              employeeId: l.employee_id as string,
              name: emp?.full_name ?? "Starfsmaður",
              hours: Number(l.hours), gross: Number(l.gross), dayPay: 0, premiums: 0, overtime: 0,
              withholding: Number(l.withholding), pension: Number(l.pension), union: Number(l.union_fee),
              net: Number(l.net), cost: Math.round(Number(l.gross) * (1 + BURDEN)),
            };
          });
        }
      }
    }

    // Fall back to computing from real employees when there is no persisted run.
    if (!lines) lines = employees.map((e) => computeLine(e));

    const rows = lines.map((l) => rowFrom(l, colorOf(l.employeeId)));
    const t = sumTotals(lines);
    return {
      rows,
      totals: {
        count: lines.length,
        hours: dec1(t.hours),
        gross: nf(t.gross),
        withholding: "−" + nf(t.withholding),
        pensionUnion: "−" + nf(t.pension + t.union),
        net: nf(t.net),
        cost: nf(t.cost),
        grossM: million(t.gross),
        netM: million(t.net),
        costM: million(t.cost),
        withholdingM: million(t.withholding),
      },
      live: true,
    };
  } catch {
    return DEMO;
  }
}
