import { Suspense } from "react";
import MittScreen from "./mitt-screen";
import { getMyCard } from "@/lib/mycard.server";
import { getMyArea } from "../mitt-svaedi/my.server";
import { listConversations } from "../spjall/actions";

// Laun & spjall — chat, news and my pay in one place.
export default async function MittPage() {
  const [card, my, chat] = await Promise.all([getMyCard(), getMyArea(), listConversations()]);
  return <Suspense><MittScreen card={card} my={my} chatInitial={chat} /></Suspense>;
}
