import { notFound } from "next/navigation";
import { getEmployees } from "@/lib/employees.server";
import { getTermination, todayIs } from "@/lib/terminations.server";
import EmployeeProfile from "../employee-profile";
import { TerminationBanner } from "../termination/banner";
import { TerminateButton } from "../termination/wizard";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ employees, live }, term] = await Promise.all([getEmployees(), getTermination(id)]);
  const employee = employees.find((e) => e.id === id);
  if (!employee) notFound();
  // Starfslok (0088): borði ef skráð, annars „Ljúka ráðningu“ (ekki fyrir eiganda).
  const banner = term ? <TerminationBanner term={term} today={todayIs()} /> : null;
  const action = !term && live && employee.role !== "owner" ? <TerminateButton employeeId={employee.id} employeeName={employee.fullName} /> : null;
  return <EmployeeProfile employee={employee} banner={banner} action={action} />;
}
