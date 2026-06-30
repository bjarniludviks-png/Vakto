import ChatScreen from "./chat-screen";
import { listConversations } from "./actions";

export default async function SpjallPage() {
  const initial = await listConversations();
  return <ChatScreen initial={initial} />;
}
