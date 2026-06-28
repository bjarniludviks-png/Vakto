import ScheduleScreen from "./schedule-screen";
import { getPendingRequests } from "./requests.server";
import { getSchedule } from "./schedule.server";

export default async function VaktaplanPage() {
  const [{ items }, initial] = await Promise.all([getPendingRequests(), getSchedule()]);
  return <ScheduleScreen requests={items} initial={initial} />;
}
