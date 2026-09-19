import FeedScreen from "./feed-screen";

// Company news feed — its own surface in the sidebar (Facebook-style).
// Posts are fetched client-side with light polling, same as chat.
// Birthday auto-posts are handled by the cron (/api/cron/punch-check), not per render.
export default function FrettaveitaPage() {
  return <FeedScreen />;
}
