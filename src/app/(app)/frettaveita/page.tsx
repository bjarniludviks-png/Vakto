import FeedScreen from "./feed-screen";

// Company news feed — its own surface in the sidebar (Facebook-style).
// Posts are fetched client-side with light polling, same as chat.
export default function FrettaveitaPage() {
  return <FeedScreen />;
}
