import EmployeeScreen from "./employee-screen";
import { getMyCard } from "@/lib/mycard.server";

export default async function MittSvaediPage() {
  const card = await getMyCard();
  return <EmployeeScreen card={card} />;
}
