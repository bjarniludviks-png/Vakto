import { getEmployees } from "@/lib/employees.server";
import { getMyScope } from "@/lib/scope.server";
import { redirect } from "next/navigation";
import EmployeesScreen from "./employees-screen";

export default async function StarfsfolkPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  if (sp.new === "1") redirect("/starfsfolk/nyr");
  const [{ employees, live }, scope] = await Promise.all([getEmployees(), getMyScope()]);
  // A scoped manager only sees staff in the departments they oversee.
  const scoped = scope.departments.length
    ? employees.filter((e) => !!e.department && scope.departments.includes(e.department))
    : employees;
  return (
    <EmployeesScreen employees={scoped} live={live} />
  );
}
