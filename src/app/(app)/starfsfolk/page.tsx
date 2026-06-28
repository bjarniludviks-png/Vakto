import { getEmployees } from "@/lib/employees.server";
import EmployeesScreen from "./employees-screen";

export default async function StarfsfolkPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { employees, live } = await getEmployees();
  const sp = await searchParams;
  return (
    <EmployeesScreen employees={employees} live={live} openNew={sp.new === "1"} />
  );
}
