import { permanentRedirect } from "next/navigation";

// The /ny preview design was promoted to the root homepage.
export default function NyPage() {
  permanentRedirect("/");
}
