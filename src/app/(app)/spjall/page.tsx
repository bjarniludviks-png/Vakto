import ChatScreen from "./chat-screen";
import { listChannels } from "./actions";

export default async function SpjallPage() {
  const { ok, channels } = await listChannels();
  return <ChatScreen channels={channels} live={ok} />;
}
