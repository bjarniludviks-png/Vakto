import { redirect } from "next/navigation";
// Old route — the employee area is now /stimpla (clock), /vaktir (shifts) and /mitt (pay & chat).
export default function Page() { redirect("/stimpla"); }
