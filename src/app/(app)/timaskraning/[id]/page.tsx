import EmployeeTimesheet from "./timesheet-screen";
import { getEmployeePunches } from "../actions";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function EmployeeTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const data = await getEmployeePunches(id, from, to);
  return <EmployeeTimesheet id={id} name={data.name} initial={data.rows} needsMigration={data.needsMigration} from={from} to={to} />;
}
