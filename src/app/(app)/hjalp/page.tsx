import HelpScreen from "./help-screen";
import { getMyScope } from "@/lib/scope.server";

// Guides are filtered by role: employees/contractors see only what they use.
export default async function HjalpPage() {
  const { role } = await getMyScope();
  return <HelpScreen role={role} />;
}
