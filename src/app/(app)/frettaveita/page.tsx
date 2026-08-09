import FeedScreen from "./feed-screen";
import { checkBirthdays } from "@/lib/birthday.server";

// Company news feed — its own surface in the sidebar (Facebook-style).
// Posts are fetched client-side with light polling, same as chat.
export default function FrettaveitaPage() {
  // 🎂 auto-posts fire here too, so birthdays never wait for the nightly cron.
  void checkBirthdays();
  return <FeedScreen />;
}
