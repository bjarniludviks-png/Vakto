import PlanScreen from "./plan-screen";
import { getMyCard } from "@/lib/mycard.server";
import { getMyArea } from "../mitt-svaedi/my.server";

// Vaktir — my shifts, the team's week, open shifts and requests (one button).
export default async function VaktirPage() {
  const [card, my] = await Promise.all([getMyCard(), getMyArea()]);
  return <PlanScreen my={my} perms={card.perms} />;
}
