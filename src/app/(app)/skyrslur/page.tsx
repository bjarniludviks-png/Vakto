import { redirect } from "next/navigation";

// Merged into Innsýn (Tímar & mæting tab) — keep old bookmarks working.
export default function SkyrslurPage() {
  redirect("/innsyn?tab=timar");
}
