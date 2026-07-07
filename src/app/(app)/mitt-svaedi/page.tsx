import EmployeeScreen from "./employee-screen";
import { getMyCard } from "@/lib/mycard.server";
import { getMyArea } from "./my.server";

export default async function MittSvaediPage() {
  const [card, my] = await Promise.all([getMyCard(), getMyArea()]);
  return <EmployeeScreen card={card} my={my} />;
}
