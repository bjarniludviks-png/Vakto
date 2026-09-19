import { redirect } from "next/navigation";
// Old route — the team schedule now lives at /vaktir.
export default function Page() { redirect("/vaktir"); }
