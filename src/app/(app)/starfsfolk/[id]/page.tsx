import { notFound } from "next/navigation";
import { getEmployees } from "@/lib/employees.server";
import EmployeeProfile from "../employee-profile";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { employees } = await getEmployees();
  const employee = employees.find((e) => e.id === id);
  if (!employee) notFound();
  return <EmployeeProfile employee={employee} />;
}
