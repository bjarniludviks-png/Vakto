import StimplaScreen from "./stimpla-screen";
import { getMyCard } from "@/lib/mycard.server";
import { getMyArea } from "../mitt-svaedi/my.server";

// Stimpla — the employee home screen (clock in/out).
export default async function StimplaPage() {
  const [card, my] = await Promise.all([getMyCard(), getMyArea()]);
  return <StimplaScreen card={card} my={my} />;
}
