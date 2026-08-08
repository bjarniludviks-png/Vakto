import { redirect } from "next/navigation";

// Merged into Innsýn (Rekstur & framlegð tab) — keep old bookmarks working.
export default function FrammistadaPage() {
  redirect("/innsyn");
}
