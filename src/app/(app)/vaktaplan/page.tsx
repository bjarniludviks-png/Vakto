import ScheduleScreen from "./schedule-screen";
import { getPendingRequests } from "./requests.server";
import { getSchedule } from "./schedule.server";
import { getMyScope } from "@/lib/scope.server";

export default async function VaktaplanPage() {
  const [{ items }, initial, scope] = await Promise.all([getPendingRequests(), getSchedule(), getMyScope()]);
  return <ScheduleScreen requests={items} initial={initial} scopeDepts={scope.departments} />;
}
