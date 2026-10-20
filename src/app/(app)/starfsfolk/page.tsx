import { getEmployees } from "@/lib/employees.server";
import { getMyScope } from "@/lib/scope.server";
import { redirect } from "next/navigation";
import EmployeesScreen from "./employees-screen";
import { getLeavingMap, todayIs } from "@/lib/terminations.server";
import { getContractStatusMap } from "./actions";

export default async function StarfsfolkPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  if (sp.new === "1") redirect("/starfsfolk/nyr");
  const [{ employees, live }, scope, leaving, contractStates] = await Promise.all([getEmployees(), getMyScope(), getLeavingMap(), getContractStatusMap()]);
  // A scoped manager only sees staff in the departments they oversee.
  const scoped = scope.departments.length
    ? employees.filter((e) => !!e.department && scope.departments.includes(e.department))
    : employees;
  return (
    <EmployeesScreen employees={scoped} live={live} leaving={leaving} today={todayIs()} contractStates={contractStates} />
  );
}
