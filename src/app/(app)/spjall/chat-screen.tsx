"use client";

import { presenceLabel, type CoworkerStatus } from "@/lib/presence";
import { getCoworkerStatus } from "./presence-actions";
import { ProfileModal } from "./profile-modal";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { CHAT_READ_EVENT } from "@/components/app/chat-badge";
import {
  AssistantComposer, AssistantHistoryList, AssistantMessages, Spark, useAssistantChat, type AssistantChat,
} from "@/components/app/assistant-chat";
import {
  listConversations, listMessages, sendChatMessage, createGroup, startDM, searchPeople,
  listMembers, addMembers, removeMember, leaveChannel, uploadChatMedia,
  renameChannel, setChannelPhoto, setMessageReaction, deleteMessage, listTeamPicks,
  markChannelRead, listChannelReads, listChatMedia, searchChannelMessages,
  type Conversation, type ChatMessage, type Person, type Members, type TeamPick, type ChannelRead, type ChatMedia, type ChatHit,
} from "./actions";

import { REACTIONS } from "@/lib/reactions";
const EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "👏", "😅", "😮", "😢", "💪", "✅", "🤝", "☕", "🍕", "🚀"];

type ChatInitial = { ok: boolean; items: Conversation[]; meId: string; meName?: string };
type SupabaseBrowser = ReturnType<typeof createBrowserClient>;
/** VAKTO AI í samtalalistanum: aðeins stjórnendur og vaktstjórar (sjá page.tsx). */
type AiAccess = { enabled: boolean; demo: boolean };

/** Mynd? Líka skjal með myndarendingu (sent úr appinu sem skrá). */
const IMG_RE = /\.(jpe?g|png|gif|webp|heic|heif)(\?|$)/i;
const isImage = (kind: string, url: string | null, body: string) => !!url && (kind === "image" || (kind === "file" && (IMG_RE.test(url) || IMG_RE.test(body))));
/** Tímaskil í þræðinum: nýr dagur eða hlé ≥ 30 mín (eins og í Messenger). */
const SEP_GAP = 30 * 60e3;

const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const firstName = (s: string) => s.split(/\s+/)[0] || s;
const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

/** Messenger-style grouping: consecutive messages from the same sender within
 * 5 minutes merge — avatar/name only once, tighter radii inside the group. */
function groupFlags(msgs: ChatMessage[], i: number): { first: boolean; last: boolean; sep: boolean } {
  const m = msgs[i], prev = msgs[i - 1], next = msgs[i + 1];
  const near = (a?: ChatMessage, b?: ChatMessage) =>
    !!a && !!b && a.senderId === b.senderId &&
    Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < 5 * 60e3 &&
    new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString();
  const gap = (a?: ChatMessage, b?: ChatMessage) => !a || !b ||
    new Date(a.createdAt).toDateString() !== new Date(b.createdAt).toDateString() ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() >= SEP_GAP;
  return { first: gap(prev, m) || !near(prev, m), last: !near(m, next) || gap(m, next), sep: gap(prev, m) };
}

/** Person avatar — profile photo when set, else colored initials. */
/** Mynd opnast yfir spjallinu; Cmd/Ctrl/Shift/miðsmellur opnar enn í nýjum flipa. */
function openImage(e: React.MouseEvent, url: string, view: (url: string) => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  view(url);
}

/** Supabase Storage: ?download setur Content-Disposition: attachment (download-eigindið virkar ekki milli léna). */
function downloadUrl(url: string) {
  try { const u = new URL(url); u.searchParams.set("download", ""); return u.toString(); } catch { return url; }
}

function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="imgview" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="imgview-bar" onClick={(e) => e.stopPropagation()}>
        <a className="imgview-btn" href={downloadUrl(url)} download aria-label={t("Hlaða niður")} title={t("Hlaða niður")}>{I.download}</a>
        <button type="button" className="imgview-btn" aria-label={t("Loka")} autoFocus onClick={onClose}>{I.close}</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function PersonAvatar({ p, size }: { p: Person; size: number }) {
  if (p.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avt-img" src={p.photo} alt="" style={{ width: size, height: size }} />;
  }
  return <span className="avt" style={{ background: p.color, width: size, height: size, fontSize: Math.round(size * 0.36) }}>{p.av}</span>;
}

/** Group/DM avatar — photo when set, else colored initials. */
function ConvAvatar({ c, size = 40 }: { c: Conversation; size?: number }) {
  if (c.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avt-img" src={c.photo} alt="" style={{ width: size, height: size }} />;
  }
  return <span className="avt" style={{ background: c.color, width: size, height: size, fontSize: c.kind === "general" ? size * 0.45 : size * 0.33 }}>{c.av}</span>;
}

/** VAKTO AI avatar — orange spark badge. */
function AiAvatar({ size = 44 }: { size?: number }) {
  return <span className="ai-ava" style={{ width: size, height: size }}><Spark /></span>;
}

/* line icons (lucide style) */
const I = {
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6" /></svg>,
  info: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>,
  compose: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14" /></svg>,
  download: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6 6 18" /></svg>,
  image: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>,
  mic: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
  file: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>,
  settings: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>,
  chat: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" /></svg>,
  // sími (Messenger-útlit)
  plusC: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9.5" /><path d="M12 8v8M8 12h8" /></svg>,
  camera: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  imageL: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>,
  micL: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
  chevR: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 6 6 6-6 6" /></svg>,
  backL: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 19l-7-7 7-7" /></svg>,
  leave: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>,
  reply: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M9 17l-5-5 5-5" /><path d="M4 12h11a5 5 0 0 1 5 5v2" /></svg>,
  trash: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></svg>,
  copy: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>,
};

/** `embedded`: rendered inside another page (Laun & spjall tabs) — inline
 * instead of the fixed full-bleed panel, so the page's own chrome stays visible. */
export default function ChatScreen({ initial, embedded = false, ai = { enabled: false, demo: false } }: { initial?: ChatInitial; embedded?: boolean; ai?: AiAccess }) {
  if (!initial?.ok) return <DemoChat />;
  return <Messenger initial={initial} embedded={embedded} ai={ai} />;
}

const TYPING_SEND_EVERY = 2000; // throttle: at most one "typing" broadcast per 2 s
const TYPING_IDLE_STOP = 3000;  // "stop" after 3 s without a keystroke
const TYPING_EXPIRE = 4500;     // drop a typer we have not heard from in 4.5 s

type Typer = { name: string; at: number };

function Messenger({ initial, embedded = false, ai }: { initial: ChatInitial; embedded?: boolean; ai: AiAccess }) {
  const { t } = useLang();
  const router = useRouter();
  const [convs, setConvs] = useState<Conversation[]>(initial.items);
  const [active, setActive] = useState<Conversation | null>(initial.items[0] ?? null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [reads, setReads] = useState<ChannelRead[]>([]);
  const [typers, setTypers] = useState<Record<string, Typer>>({});
  const [val, setVal] = useState("");
  const [search, setSearch] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [rec, setRec] = useState(false);
  const [modal, setModal] = useState<null | "new" | "group" | "info">(null);
  // „Á vakt“ / virk(ur) hjá viðmælendum í beinum skilaboðum (0099) og léttur prófíll.
  const [presence, setPresence] = useState<Record<string, CoworkerStatus>>({});
  const [profileUser, setProfileUser] = useState<string | null>(null);
  const peerKey = convs.map((c) => c.peerId).filter(Boolean).sort().join(",");
  useEffect(() => {
    if (!peerKey) return;
    let live = true;
    const load = () => getCoworkerStatus(peerKey.split(",")).then((m) => { if (live) setPresence(m); }).catch(() => {});
    load();
    const iv = window.setInterval(load, 60_000);
    return () => { live = false; window.clearInterval(iv); };
  }, [peerKey]);
  const presOf = (c: Conversation) => (c.peerId ? presenceLabel(presence[c.peerId]) : null);
  const [people, setPeople] = useState<Person[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  // VAKTO AI as a pinned conversation (thread column uses the shared assistant UI).
  const [aiOpen, setAiOpen] = useState(false);
  const aiChat = useAssistantChat({ demo: ai.demo });
  // Details panel: docked as a 3rd column at ≥1100px (remembered per user), a slide-over below.
  const sideKey = `vakto-chat-details:${initial.meId}`;
  const [wide, setWide] = useState(true);
  const [sideDocked, setSideDocked] = useState(true);
  const [sideOver, setSideOver] = useState(false);
  const [infoVer, setInfoVer] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  // Sími (≤900px): Messenger-útlit — fastir hringir efst, þráður á heilum skjá, aðgerðir með löngu ýti.
  const [phone, setPhone] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sheetFor, setSheetFor] = useState<ChatMessage | null>(null);
  const pressRef = useRef<{ t: ReturnType<typeof setTimeout> | null; x: number; y: number; fired?: boolean }>({ t: null, x: 0, y: 0 });
  const [viewer, setViewer] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  // Relative times ("5 mín") render only after mount — server and browser clocks/time zones differ.
  const [now, setNow] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Thread cache: clicking a conversation paints its last-known messages
  // instantly, the network refresh reconciles in the background.
  const cacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  // Per thread: are there older messages than the ones loaded ("Sýna eldri skilaboð")?
  const moreRef = useRef<Map<string, boolean>>(new Map());
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // Follow new messages only while the reader sits at the bottom of the thread.
  const atBottomRef = useRef(true);
  // Scroll anchor while older messages are prepended (keeps the view still).
  const anchorRef = useRef<{ h: number; top: number } | null>(null);
  const activeRef = useRef<string | null>(null);
  const sbRef = useRef<SupabaseBrowser | null>(null);
  const sb = () => { if (!sbRef.current) sbRef.current = createBrowserClient(); return sbRef.current; };
  const meName = initial.meName || t("Einhver");

  // Phone: land on the conversation LIST, not inside the first thread.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- needs the viewport, only known in the browser
    if (window.matchMedia("(max-width: 760px)").matches) setActive(null);
  }, []);

  // Layout mode, remembered details-panel preference and the relative-time clock.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const onMq = () => { setWide(mq.matches); if (mq.matches) setSideOver(false); };
    onMq();
    mq.addEventListener("change", onMq);
    const pq = window.matchMedia("(max-width: 900px)");
    const onPq = () => setPhone(pq.matches);
    onPq();
    pq.addEventListener("change", onPq);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- viewport/localStorage/clock exist only after mount (hydration-safe)
    try { if (localStorage.getItem(sideKey) === "0") setSideDocked(false); } catch { /* private mode */ }
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSideOver(false); };
    window.addEventListener("keydown", onKey);
    return () => { mq.removeEventListener("change", onMq); pq.removeEventListener("change", onPq); clearInterval(iv); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function toggleSide() {
    if (wide) setSideDocked((d) => { try { localStorage.setItem(sideKey, d ? "0" : "1"); } catch { /* private mode */ } return !d; });
    else setSideOver((o) => !o);
  }
  const sideShown = wide ? sideDocked : sideOver;

  // Messenger-style keyboard handling: when the iOS keyboard opens it shrinks
  // the visual viewport — raise the fixed panel's bottom by the keyboard height
  // and keep the newest messages pinned right above the composer.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (wrapRef.current) {
        wrapRef.current.style.bottom = `${kb}px`;
        wrapRef.current.classList.toggle("kb-open", kb > 0);
      }
      if (kb > 0) window.scrollTo(0, 0); // stop iOS from panning the page instead
      endRef.current?.scrollIntoView({ block: "end" });
    };
    // iOS fires several resizes while the keyboard animates — settle at the end too.
    const late = () => { apply(); setTimeout(apply, 250); };
    vv.addEventListener("resize", late);
    vv.addEventListener("scroll", apply);
    return () => { vv.removeEventListener("resize", late); vv.removeEventListener("scroll", apply); };
  }, []);

  function reloadConvs() {
    listConversations().then((r) => {
      if (!r.ok) return;
      // The open thread is being read right now — never flash a count on it.
      const openId = visible() ? activeRef.current : null;
      const items = r.items.map((x) => (x.id === openId ? { ...x, unread: 0 } : x));
      setConvs(items);
      // keep the open thread's name/photo fresh after rename or photo change
      setActive((a) => (a ? items.find((x) => x.id === a.id) ?? a : a));
    });
  }
  /** Fetch a thread into the cache; paint it only if it is still the open one. */
  function loadMsgs(id?: string) {
    if (!id) return;
    listMessages(id).then((r) => {
      if (!r.ok) return;
      // The refresh brings the NEWEST page; keep any older pages already loaded.
      const merged = r.hasMore && r.messages.length
        ? [...(cacheRef.current.get(id) ?? []).filter((m) => !m.id.startsWith("tmp-") && m.createdAt < r.messages[0].createdAt), ...r.messages]
        : r.messages;
      if (merged.length === r.messages.length) moreRef.current.set(id, r.hasMore);
      cacheRef.current.set(id, merged);
      if (activeRef.current === id) { setMsgs(merged); setMore(moreRef.current.get(id) ?? false); setReads(r.reads); setLoadedFor(id); }
    });
  }
  /** "Sýna eldri skilaboð": prepend the page before the oldest loaded message. */
  async function loadOlder() {
    const id = activeRef.current;
    const oldest = msgs.find((m) => !m.id.startsWith("tmp-"));
    if (!id || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    const r = await listMessages(id, { createdAt: oldest.createdAt, id: oldest.id });
    setLoadingOlder(false);
    if (!r.ok || activeRef.current !== id) return;
    const prepend = (ms: ChatMessage[]) => {
      const seen = new Set(ms.map((m) => m.id));
      return [...r.messages.filter((m) => !seen.has(m.id)), ...ms];
    };
    moreRef.current.set(id, r.hasMore);
    cacheRef.current.set(id, prepend(cacheRef.current.get(id) ?? []));
    const box = boxRef.current;
    anchorRef.current = box ? { h: box.scrollHeight, top: box.scrollTop } : null;
    setMsgs(prepend);
    setMore(r.hasMore);
  }
  /** Search hit → show that message: page back (same cursor as "Sýna eldri") until it is loaded. */
  async function jumpTo(msgId: string) {
    const cid = activeRef.current;
    if (!cid) return;
    let list = cacheRef.current.get(cid) ?? msgs;
    let hasMore = moreRef.current.get(cid) ?? more;
    for (let guard = 0; !list.some((m) => m.id === msgId) && hasMore && guard < 10; guard++) {
      const oldest = list.find((m) => !m.id.startsWith("tmp-"));
      if (!oldest) break;
      const r = await listMessages(cid, { createdAt: oldest.createdAt, id: oldest.id });
      if (!r.ok || activeRef.current !== cid) return;
      const seen = new Set(list.map((m) => m.id));
      list = [...r.messages.filter((m) => !seen.has(m.id)), ...list];
      hasMore = r.hasMore;
    }
    cacheRef.current.set(cid, list); moreRef.current.set(cid, hasMore);
    atBottomRef.current = false;
    setMsgs(list); setMore(hasMore);
    if (!wide) setSideOver(false);
    setFlash(msgId);
    setTimeout(() => boxRef.current?.querySelector(`[data-mid="${msgId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    setTimeout(() => setFlash((f) => (f === msgId ? null : f)), 2400);
  }
  /** Apply a change to one message both on screen and in the thread cache
   * (older pages are not re-fetched by the reconcile, so they update locally). */
  function patchMsg(id: string, fn: (m: ChatMessage) => ChatMessage | null) {
    const apply = (ms: ChatMessage[]) => ms.flatMap((m) => (m.id === id ? (fn(m) ?? []) : [m]));
    setMsgs(apply);
    const cid = activeRef.current;
    const cached = cid ? cacheRef.current.get(cid) : undefined;
    if (cid && cached) cacheRef.current.set(cid, apply(cached));
  }
  /** Advance my read cursor (only while the tab is actually visible). */
  function read(id?: string | null) {
    if (!id || !visible()) return;
    setConvs((cs) => cs.map((x) => (x.id === id && x.unread ? { ...x, unread: 0 } : x)));
    markChannelRead(id).then((r) => { if (r.ok) window.dispatchEvent(new Event(CHAT_READ_EVENT)); });
  }
  /** Open a thread: paint the cached messages in the same render; the
   * `active?.id` effect below does the network refresh + read cursor. */
  function open(c: Conversation) {
    activeRef.current = c.id;
    setAiOpen(false);
    setActive(c);
    setMsgs(cacheRef.current.get(c.id) ?? []);
    setMore(moreRef.current.get(c.id) ?? false);
    atBottomRef.current = true;
    setReads([]);
    setTypers({});
    setReplyTo(null);
    setReactFor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function openAi() {
    activeRef.current = null;
    setActive(null);
    setAiOpen(true);
    setReplyTo(null);
    setReactFor(null);
    aiChat.focus();
  }
  function closeThread() { setActive(null); setAiOpen(false); setSideOver(false); }

  useEffect(() => { activeRef.current = active?.id ?? null; activeConvRef.current = active; }, [active]);
  const activeConvRef = useRef<Conversation | null>(null);
  // Coalesce the reconcile fetch after a burst of realtime events (names,
  // reply quotes and read cursors arrive with it; the bubble is already painted).
  const reloadT = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleReload(id: string) {
    if (reloadT.current) clearTimeout(reloadT.current);
    reloadT.current = setTimeout(() => loadMsgs(id), 400);
  }

  useEffect(() => {
    if (active?.id) {
      setMsgs(cacheRef.current.get(active.id) ?? []); setMore(moreRef.current.get(active.id) ?? false);
      atBottomRef.current = true;
      loadMsgs(active.id); read(active.id);
    }
    // Realtime does the heavy lifting; polling is only a 10s safety net — and
    // a hidden tab does not poll at all (it catches up on visibilitychange).
    const iv = setInterval(() => {
      if (!visible()) return;
      loadMsgs(active?.id); reloadConvs();
    }, 10000);
    return () => clearInterval(iv);
  }, [active?.id]);

  // Sími: „Grúppa · 6“ í haus þráðarins (fjöldi meðlima sóttur aðeins þar).
  const countFor = phone && active && !active.dm && active.kind !== "general" ? active.id : null;
  useEffect(() => {
    if (!countFor) return;
    let alive = true;
    listMembers(countFor).then((m) => { if (alive) setMemberCount(m.members.length || null); });
    return () => { alive = false; setMemberCount(null); };
  }, [countFor, infoVer]);

  // Coming back to the tab: refresh + mark the open thread read.
  useEffect(() => {
    const onVis = () => {
      if (!visible()) return;
      loadMsgs(activeRef.current ?? undefined); reloadConvs(); read(activeRef.current);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Prefetch the three most recent threads so they open instantly.
  useEffect(() => {
    for (const c of initial.items.slice(0, 3)) {
      if (cacheRef.current.has(c.id)) continue;
      listMessages(c.id).then((r) => {
        if (r.ok && !cacheRef.current.has(c.id)) { cacheRef.current.set(c.id, r.messages); moreRef.current.set(c.id, r.hasMore); }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Instant delivery: subscribe to new messages (RLS-scoped) — reload the open
  // thread and the list the moment anything lands, instead of waiting to poll.
  // Read cursors stream too, so "Séð" appears the moment the other side looks.
  useEffect(() => {
    const supabase = sb();
    const ch = supabase
      .channel("chat-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { id: string; channel_id?: string; sender_id?: string; body?: string; kind?: string; attachment_url?: string | null; created_at?: string };
        if (row.channel_id && row.channel_id === activeRef.current) {
          // Paint straight from the event — the bubble shows before any round trip.
          setMsgs((ms) => {
            if (ms.some((m) => m.id === row.id)) return ms;
            const mine = row.sender_id === initial.meId;
            if (mine) {
              const i = ms.findIndex((m) => m.id.startsWith("tmp-") && m.body === (row.body ?? ""));
              if (i >= 0) { const c = ms.slice(); c[i] = { ...c[i], id: row.id }; return c; }
            }
            const known = ms.find((m) => m.senderId === row.sender_id && !m.id.startsWith("tmp-"));
            const conv = activeConvRef.current;
            const d = new Date(row.created_at ?? Date.now());
            return [...ms, {
              id: row.id, senderId: row.sender_id ?? "", me: mine,
              sender: mine ? "Ég" : (known?.sender ?? (conv?.dm ? conv.name.split(/\s+/)[0] : "…")),
              body: row.body ?? "", at: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
              kind: row.kind ?? "text", url: row.attachment_url ?? null, reactions: [],
              createdAt: row.created_at ?? d.toISOString(), replyTo: null, photo: known?.photo ?? null,
            }];
          });
          scheduleReload(row.channel_id);
          read(activeRef.current);
        }
        reloadConvs();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channels" }, () => reloadConvs())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_reads" }, (payload) => {
        const row = (payload.new ?? payload.old) as { channel_id?: string; user_id?: string };
        if (row.user_id === initial.meId) return;
        if (row.channel_id && row.channel_id === activeRef.current) listChannelReads(row.channel_id).then(setReads);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing indicator: Realtime broadcast on `typing:<channelId>` — no DB.
  const typingRef = useRef<{ ch: ReturnType<SupabaseBrowser["channel"]> | null; lastSent: number; stop: ReturnType<typeof setTimeout> | null }>({ ch: null, lastSent: 0, stop: null });
  useEffect(() => {
    const id = active?.id;
    if (!id) return;
    const supabase = sb();
    const ch = supabase.channel(`typing:${id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { userId?: string; name?: string; stop?: boolean };
      if (!p.userId || p.userId === initial.meId) return;
      setTypers((tp) => {
        const next = { ...tp };
        if (p.stop) delete next[p.userId!]; else next[p.userId!] = { name: p.name || t("Einhver"), at: Date.now() };
        return next;
      });
    }).subscribe();
    typingRef.current = { ch, lastSent: 0, stop: null };
    // expire typers we stopped hearing from (lost "stop" packets)
    const iv = setInterval(() => {
      setTypers((tp) => {
        const now = Date.now();
        const keep = Object.entries(tp).filter(([, v]) => now - v.at < TYPING_EXPIRE);
        return keep.length === Object.keys(tp).length ? tp : Object.fromEntries(keep);
      });
    }, 1000);
    return () => {
      clearInterval(iv);
      const cur = typingRef.current;
      if (cur.stop) clearTimeout(cur.stop);
      if (cur.lastSent) void ch.send({ type: "broadcast", event: "typing", payload: { userId: initial.meId, stop: true } });
      typingRef.current = { ch: null, lastSent: 0, stop: null };
      void supabase.removeChannel(ch);
      setTypers({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);
  function sendTyping(stop = false) {
    const cur = typingRef.current;
    if (!cur.ch) return;
    if (cur.stop) { clearTimeout(cur.stop); cur.stop = null; }
    if (stop) {
      if (!cur.lastSent) return;
      cur.lastSent = 0;
      void cur.ch.send({ type: "broadcast", event: "typing", payload: { userId: initial.meId, stop: true } });
      return;
    }
    const now = Date.now();
    if (now - cur.lastSent >= TYPING_SEND_EVERY) {
      cur.lastSent = now;
      void cur.ch.send({ type: "broadcast", event: "typing", payload: { userId: initial.meId, name: firstName(meName) } });
    }
    cur.stop = setTimeout(() => sendTyping(true), TYPING_IDLE_STOP);
  }

  // People search — suggestions from the FIRST character (Messenger-style).
  useEffect(() => {
    const q = search.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the suggestions with the query
    if (!q) { setPeople([]); return; }
    const id = setTimeout(() => searchPeople(q).then(setPeople), 150);
    return () => clearTimeout(id);
  }, [search]);

  async function openDM(p: Person) {
    setSearch("");
    const r = await startDM(p.userId);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    await openById(r.id);
  }
  async function openById(id?: string) {
    const c = await listConversations();
    if (c.ok) {
      setConvs(c.items);
      const found = c.items.find((x) => x.id === id);
      if (found) open(found);
    }
  }
  useLayoutEffect(() => {
    const box = boxRef.current;
    const a = anchorRef.current;
    if (box && a) { anchorRef.current = null; box.scrollTop = box.scrollHeight - a.h + a.top; return; }
    if (atBottomRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, typers]);

  async function send(kind: "text" | "image" | "audio" = "text", url?: string, body?: string) {
    const text = body ?? val;
    if (kind === "text" && !text.trim()) return;
    if (kind === "text") { setVal(""); setToolsOpen(false); }
    setEmoji(false);
    if (!active) return;
    sendTyping(true);
    const reply = replyTo;
    setReplyTo(null);
    atBottomRef.current = true; // sending always jumps to the newest message
    // Optimistic: show the message instantly; the reload reconciles the real row.
    const now = new Date();
    setMsgs((ms) => [...ms, {
      id: `tmp-${now.getTime()}`, sender: "Ég", senderId: initial.meId, me: true,
      body: text, at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      kind, url: url ?? null, reactions: [], createdAt: now.toISOString(),
      replyTo: reply ? { sender: reply.sender, body: reply.body } : null,
      photo: null,
    }]);
    const res = await sendChatMessage(active.id, text, kind, url, reply?.id);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); loadMsgs(active.id); return; }
    // Swap the optimistic id for the real one so the realtime echo dedups;
    // the debounced reconcile brings names/reads without a second full fetch.
    const realId = res.id;
    if (realId) setMsgs((ms) => ms.map((m) => (m.id === `tmp-${now.getTime()}` ? { ...m, id: realId } : m)));
    scheduleReload(active.id);
  }

  async function react(m: ChatMessage, emoji: string) {
    setReactFor(null);
    const mine = m.reactions.find((r) => r.mine);
    const next = mine?.emoji === emoji ? null : emoji;
    const r = await setMessageReaction(m.id, next);
    if (!r.ok) toast(r.error ?? "Tókst ekki");
    else patchMsg(m.id, (x) => {
      let rs = x.reactions.map((y) => (y.mine ? { ...y, count: y.count - 1, mine: false } : y)).filter((y) => y.count > 0);
      if (next) rs = rs.some((y) => y.emoji === next)
        ? rs.map((y) => (y.emoji === next ? { ...y, count: y.count + 1, mine: true } : y))
        : [...rs, { emoji: next, count: 1, mine: true }];
      return { ...x, reactions: rs.sort((a, b) => b.count - a.count) };
    });
    loadMsgs(active?.id);
  }

  async function unsend(m: ChatMessage) {
    if (!window.confirm(t("Eyða skilaboðum?"))) return;
    const r = await deleteMessage(m.id);
    if (!r.ok) toast(r.error ?? "Tókst ekki");
    else patchMsg(m.id, () => null);
    loadMsgs(active?.id); reloadConvs();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !active) return;
    e.target.value = ""; // myndasafn eða myndavél (sími)
    const r = new FileReader();
    r.onload = async () => {
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const up = await uploadChatMedia(r.result as string, ext);
      if (up.ok && up.url) send("image", up.url, "Mynd"); else toast(up.error ?? "Tókst ekki að hlaða mynd");
    };
    r.readAsDataURL(f);
  }

  async function toggleRec() {
    if (rec) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (ev) => chunks.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRec(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        const r = new FileReader();
        r.onload = async () => {
          const up = await uploadChatMedia(r.result as string, "webm");
          if (up.ok && up.url) send("audio", up.url, "Talskilaboð"); else toast(up.error ?? "Tókst ekki");
        };
        r.readAsDataURL(blob);
      };
      recRef.current = mr; mr.start(); setRec(true);
    } catch { toast("Fékk ekki aðgang að hljóðnema"); }
  }

  /** "núna" · "5 mín" · "2 klst" · "3 d" · "2 v" — Messenger-style relative age. */
  function relTime(iso: string | null): string {
    if (!iso || now === null) return "";
    const d = new Date(iso);
    const mins = Math.max(0, Math.floor((now - d.getTime()) / 60e3));
    if (mins < 1) return t("chat:now");
    if (mins < 60) return `${mins} ${t("rt:min")}`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h} ${t("rt:h")}`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} ${t("rt:d")}`;
    if (days < 365) return `${Math.floor(days / 7)} ${t("rt:w")}`;
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  }
  function dayLabel(iso: string): string {
    const d = new Date(iso);
    const n = new Date();
    if (d.toDateString() === n.toDateString()) return t("Í dag");
    if (d.toDateString() === new Date(n.getTime() - 864e5).toDateString()) return t("Í gær");
    return `${d.getDate()}. ${MO[d.getMonth()]}${d.getFullYear() !== n.getFullYear() ? " " + d.getFullYear() : ""}`;
  }

  const q = search.trim().toLowerCase();
  const shown = convs.filter((c) => !q || c.name.toLowerCase().includes(q));
  const aiShown = ai.enabled && (!q || "vakto ai".includes(q) || q.includes("ai"));
  // Ekkert fest nema VAKTO AI — samtölin koma raðað eftir nýjustu virkni.
  const subtitleOf = (c: Conversation) => c.dm ? (presOf(c)?.text ? t(presOf(c)!.text) : t("Bein skilaboð")) : c.kind === "general" ? t("Allt starfsfólkið") : t("Grúppa");
  const nameOf = (c: Conversation) => (c.kind === "general" ? "# " + c.name : c.name);
  const aiLast = [...aiChat.msgs].reverse().find((m) => m.content.trim());

  // Read receipt goes under the LAST message I sent (a real row, not the optimistic one).
  let lastMineIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].me && !msgs[i].id.startsWith("tmp-")) { lastMineIdx = i; break; }
  const seenBy = lastMineIdx >= 0 ? reads.filter((r) => r.lastReadAt >= msgs[lastMineIdx].createdAt) : [];
  const seenText = seenBy.length === 0 ? null
    : active?.dm ? `${t("Séð")} ${hhmm(seenBy[0].lastReadAt)}`
      : `${t("Séð")} · ${seenBy.slice(0, 3).map((r) => firstName(r.name)).join(", ")}${seenBy.length > 3 ? ` +${seenBy.length - 3}` : ""}`;

  const typerNames = Object.values(typers).map((x) => x.name);
  const typingText = typerNames.length === 0 ? "" : typerNames.length === 1 ? `${typerNames[0]} ${t("er að skrifa…")}` : `${typerNames.length} ${t("eru að skrifa…")}`;

  function convRow(c: Conversation) {
    const un = c.id !== active?.id && c.unread > 0;
    const kindIcon = c.lastKind === "image" ? I.image : c.lastKind === "audio" ? I.mic : c.lastKind === "file" ? I.file : null;
    const preview = c.last ? (c.lastKind === "image" || c.lastKind === "audio" ? t(c.last) : c.last) : (c.dm ? t("Bein skilaboð") : t("Grúppa"));
    return (
      <div key={c.id} className={`conv${active?.id === c.id ? " on" : ""}${un ? " un" : ""}`} onClick={() => open(c)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") open(c); }} title={un ? `${c.unread} ${t("ólesin")}` : undefined}>
        <span className="pr-wrap"><ConvAvatar c={c} size={phone ? 56 : 44} />{presOf(c)?.dot && <i className={`pr-dot pr-${presOf(c)!.tone}`} aria-label={t(presOf(c)!.text)} />}</span>
        <div className="tx">
          <div className="tl">
            <b>{nameOf(c)}</b>
            {c.lastAt && now !== null && <time className="tm-r">{relTime(c.lastAt)}</time>}
          </div>
          <span className="pv">
            <span className="pv-t">
              {c.last && c.lastMine && <>{t("Þú")}: </>}
              {kindIcon && <span className="pv-i">{kindIcon}</span>}
              {preview}
            </span>
            {c.lastAt && now !== null && <span className="pv-d">· {relTime(c.lastAt)}</span>}
          </span>
        </div>
        {un && <span className="udot" aria-label={`${c.unread} ${t("ólesin")}`} />}
      </div>
    );
  }

  /** Sími: langt ýti á bólu opnar aðgerðablað (viðbrögð, svara, afrita, eyða) í stað hover-hnappa. */
  function pressStart(m: ChatMessage, e: React.PointerEvent) {
    if (!phone || e.pointerType === "mouse") return;
    const p = pressRef.current;
    if (p.t) clearTimeout(p.t);
    p.x = e.clientX; p.y = e.clientY; p.fired = false;
    p.t = setTimeout(() => { p.t = null; p.fired = true; navigator.vibrate?.(8); setSheetFor(m); }, 420);
  }
  function pressMove(e: React.PointerEvent) {
    const p = pressRef.current;
    if (p.t && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { clearTimeout(p.t); p.t = null; }
  }
  function pressEnd() { const p = pressRef.current; if (p.t) { clearTimeout(p.t); p.t = null; } }

  // Hringir efst (sími): VAKTO AI, svo nýjustu samtölin.
  const pins: ({ ai: true } | Conversation)[] = q ? [] : [
    ...(aiShown ? [{ ai: true as const }] : []),
    ...shown.slice(0, 8),
  ];
  const pinLabel = (c: Conversation) => (c.dm ? firstName(c.name) : c.name);
  // Sími + texti í innslætti: táknin falla saman í ör (eins og Messenger) þar til ýtt er á hana.
  const toolsCompact = phone && !!val.trim() && !toolsOpen;

  const threadOpen = !!active || aiOpen;
  return (
    <>
      <div ref={wrapRef} className={`msgr${embedded ? "" : " full"}${threadOpen ? " thread-open" : ""}${sideDocked ? " side-docked" : ""}${sideOver ? " side-over" : ""}`} style={embedded ? { height: "calc(100dvh - 215px)" } : undefined}>
        {/* (a) conversation list */}
        <div className="msgr-list">
          <div className="msgr-lhead">
            <h2>{t("Spjall")}</h2>
            <button className="iconbtn soft" title={t("Nýtt spjall")} aria-label={t("Nýtt spjall")} onClick={() => setModal("new")}>{I.compose}</button>
          </div>
          <div className="msgr-lsearch">
            <div className="srchbox">{I.search}<input placeholder={t("Leitaðu að spjalli eða manneskju…")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div className="msgr-convs">
            {pins.length > 0 && (
              <div className="msgr-pins" role="list" aria-label={t("Fest")}>
                {pins.map((c) => "ai" in c ? (
                  <button key="ai" role="listitem" className="mpin" onClick={openAi}>
                    <AiAvatar size={60} />
                    <span>VAKTO AI</span>
                  </button>
                ) : (
                  <button key={c.id} role="listitem" className={`mpin${c.unread > 0 ? " un" : ""}`} onClick={() => open(c)}>
                    <span className="mpin-a"><ConvAvatar c={c} size={60} />{c.unread > 0 && <i className="mpin-dot" aria-label={`${c.unread} ${t("ólesin")}`} />}</span>
                    <span>{pinLabel(c)}</span>
                  </button>
                ))}
              </div>
            )}
            {aiShown && <div className="chat-sec">{t("Fest")}</div>}
            {aiShown && (
              <div className={`conv conv-ai${aiOpen ? " on" : ""}`} onClick={openAi} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") openAi(); }}>
                <AiAvatar size={phone ? 56 : 44} />
                <div className="tx">
                  <b>VAKTO AI</b>
                  <span className="pv"><span className="pv-t">{aiLast ? (aiLast.role === "user" ? `${t("Þú")}: ` : "") + aiLast.content.replace(/[*#]/g, "").slice(0, 90) : t("Spyrðu um laun, vaktir og tíma")}</span></span>
                </div>
              </div>
            )}
            {shown.length > 0 && aiShown && <div className="chat-sec">{t("Samtöl")}</div>}
            {shown.map(convRow)}
            {!q && convs.length === 0 && (
              <div className="msgr-empty msgr-none">
                <span className="msgr-empty-ic">{I.chat}</span>
                <b>{t("Engin samtöl enn")}</b>
                <span className="side-sub">{t("Búðu til hóp eða sendu einhverjum skilaboð.")}</span>
                <div className="msgr-none-acts">
                  <button className="btn sm" onClick={() => setModal("group")}>{I.plus}{t("Nýr hópur")}</button>
                  <button className="btn ghost sm" onClick={() => setModal("new")}>{t("Ný skilaboð")}</button>
                </div>
              </div>
            )}
            {q && shown.length === 0 && !aiShown && (
              <div className="muted" style={{ fontSize: 12.5, padding: "4px 16px 10px" }}>{t("Ekkert samtal fannst")}</div>
            )}
            {q && people.length > 0 && (
              <>
                <div className="chat-sec">{t("Byrja nýtt spjall")}</div>
                {people
                  .filter((p) => !convs.some((c) => c.dm && c.name === p.name))
                  .map((p) => (
                    <div key={p.userId} className="conv" onClick={() => openDM(p)} role="button" tabIndex={0}>
                      <PersonAvatar p={p} size={phone ? 56 : 44} />
                      <div className="tx">
                        <b>{p.name}</b>
                        <span className="pv"><span className="pv-t">{t("Senda skilaboð")}</span></span>
                      </div>
                      <span style={{ marginLeft: "auto", color: "var(--ink3)", display: "flex" }}>{I.plus}</span>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        {/* (b) thread */}
        <div className="msgr-thread">
          {aiOpen ? (
            <>
              <div className="msgr-head">
                <button className="iconbtn mob-back" onClick={closeThread} aria-label={t("Til baka")}>{phone ? I.backL : I.back}</button>
                <AiAvatar size={phone ? 36 : 40} />
                <div className="msgr-title" onClick={toggleSide}>
                  <b>VAKTO AI</b>
                  <span>{t("Aðstoðarmaður fyrir reksturinn")}</span>
                </div>
                {aiChat.msgs.length > 0 && <button className="iconbtn" title={aiChat.s.reset} aria-label={aiChat.s.reset} onClick={() => { aiChat.fresh(); aiChat.focus(); }}>{I.plus}</button>}
                <button className={`iconbtn msgr-info${sideShown ? " on" : ""}`} aria-pressed={sideShown} title={t("Upplýsingar")} aria-label={t("Upplýsingar")} onClick={toggleSide}>{I.info}</button>
              </div>
              <AssistantMessages chat={aiChat} className="vai-list msgr-ai-list" onUpgrade={() => router.push("/stillingar?tab=askrift#vakto-ai")} />
              <div className="msgr-ai-foot"><AssistantComposer chat={aiChat} placeholder={phone ? t("Spyrðu VAKTO AI…") : undefined} /></div>
            </>
          ) : active ? (
            <>
              <div className="msgr-head">
                <button className="iconbtn mob-back" onClick={closeThread} aria-label={t("Til baka")}>{phone ? I.backL : I.back}</button>
                <span className="pr-wrap" onClick={() => { if (active.dm && active.peerId) setProfileUser(active.peerId); }} style={{ cursor: active.dm && active.peerId ? "pointer" : undefined }}>
                  <ConvAvatar c={active} size={phone ? 36 : 40} />{presOf(active)?.dot && <i className={`pr-dot pr-${presOf(active)!.tone}`} />}
                </span>
                <div className="msgr-title" onClick={() => { if (active.dm && active.peerId) setProfileUser(active.peerId); else toggleSide(); }} title={active.dm ? t("Sjá prófíl") : t("Upplýsingar")}>
                  <b>{nameOf(active)}</b>
                  <span>{typingText && phone ? typingText : `${subtitleOf(active)}${phone && memberCount ? ` · ${memberCount}` : ""}`}</span>
                </div>
                <button className={`iconbtn msgr-info${sideShown ? " on" : ""}`} aria-pressed={sideShown} title={t("Upplýsingar")} aria-label={t("Upplýsingar")} onClick={toggleSide}>{I.info}</button>
              </div>
              <div
                className="msgr-msgs" ref={boxRef}
                onScroll={(e) => { const b = e.currentTarget; atBottomRef.current = b.scrollHeight - b.scrollTop - b.clientHeight < 80; }}
              >
                {more && msgs.length > 0 && (
                  <button className="btn ghost sm" style={{ alignSelf: "center", marginBottom: 6, flexShrink: 0 }} disabled={loadingOlder} onClick={loadOlder}>
                    {loadingOlder ? t("Hleð…") : t("Sýna eldri skilaboð")}
                  </button>
                )}
                {msgs.length ? msgs.map((m, mi) => {
                  const g = groupFlags(msgs, mi);
                  const img = isImage(m.kind, m.url, m.body);
                  return (
                  <React.Fragment key={m.id}>
                  {g.sep && <div className="day-sep"><span>{dayLabel(m.createdAt)} {hhmm(m.createdAt)}</span></div>}
                  {!m.me && !active.dm && g.first && <div className="m-who">{m.sender}</div>}
                  <div data-mid={m.id} className={`mrow ${m.me ? "me" : "them"}${m.reactions.length ? " hasre" : ""}${g.first ? " g-first" : ""}${g.last ? " g-last" : " g-mid"}${flash === m.id ? " flash" : ""}`}>
                    {!m.me && (
                      <span className="m-ava" style={{ visibility: g.last ? "visible" : "hidden" }}>
                        {m.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="avt-img" src={m.photo} alt="" style={{ width: phone ? 28 : 30, height: phone ? 28 : 30 }} />
                        ) : (
                          <span className="avt" style={{ background: "var(--brand-soft)", color: "var(--brand)", width: phone ? 28 : 30, height: phone ? 28 : 30, fontSize: phone ? 10.5 : 11, fontWeight: 700 }}>
                            {m.sender.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </span>
                    )}
                    <div className={`mbub ${m.me ? "me" : "them"}${img ? " media" : ""}`} title={phone ? undefined : `${dayLabel(m.createdAt)} ${hhmm(m.createdAt)}`}
                      onPointerDown={(e) => pressStart(m, e)} onPointerMove={pressMove} onPointerUp={pressEnd} onPointerCancel={pressEnd}
                      onContextMenu={(e) => { if (phone) { e.preventDefault(); pressEnd(); setSheetFor(m); } }}>
                      {m.replyTo && (
                        <span className="mreply"><b>{m.replyTo.sender}</b><span>{m.replyTo.body}</span></span>
                      )}
                      {img
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <a href={m.url!} target="_blank" rel="noreferrer" onClick={(e) => { if (pressRef.current.fired) e.preventDefault(); else openImage(e, m.url!, setViewer); }}><img src={m.url!} alt="" /></a>
                        : m.kind === "audio" && m.url ? <audio controls src={m.url} style={{ height: 36 }} />
                          : m.kind === "file" && m.url ? <a className="mfile" href={m.url} target="_blank" rel="noreferrer">{I.file}<span>{m.body || t("Skjal")}</span></a>
                            : m.body}
                      {m.reactions.length > 0 && (
                        <span className="mreacts" onClick={() => react(m, m.reactions[0].emoji)}>
                          {m.reactions.map((r) => <span key={r.emoji}>{r.emoji}{r.count > 1 ? <b>{r.count}</b> : null}</span>)}
                        </span>
                      )}
                    </div>
                    <div className="mact">
                      <button title={t("Bregðast við")} onClick={() => setReactFor(reactFor === m.id ? null : m.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>
                      </button>
                      <button title={t("Svara")} onClick={() => { setReplyTo(m); setReactFor(null); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 17l-5-5 5-5" /><path d="M4 12h11a5 5 0 0 1 5 5v2" /></svg>
                      </button>
                      {m.me && (
                        <button title={t("Eyða")} onClick={() => unsend(m)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></svg>
                        </button>
                      )}
                      {reactFor === m.id && (
                        <div className="rpal" onMouseLeave={() => setReactFor(null)}>
                          {REACTIONS.map((e) => <button key={e} onClick={() => react(m, e)}>{e}</button>)}
                        </div>
                      )}
                    </div>
                  </div>
                  {mi === lastMineIdx && seenText && (
                    <div className="m-seen" style={{ marginTop: m.reactions.length ? 6 : 0 }}>{seenText}</div>
                  )}
                  </React.Fragment>
                  );
                }) : loadedFor === active.id ? (
                  <div className="msgr-empty">
                    <ConvAvatar c={active} size={76} />
                    <b>{nameOf(active)}</b>
                    <span className="side-sub">{subtitleOf(active)}</span>
                    <p>{t("Engin skilaboð enn — byrjaðu spjallið!")}</p>
                  </div>
                ) : (
                  <div className="msgr-skel" aria-hidden="true">
                    <i className="sk-line" style={{ width: "42%" }} /><i className="sk-line me" style={{ width: "34%" }} /><i className="sk-line" style={{ width: "55%" }} />
                  </div>
                )}
                <div ref={endRef} />
              </div>
              {/* typing indicator — fixed height so the composer never jumps */}
              <div className="msgr-typing" aria-live="polite">{typingText}</div>
              {replyTo && (
                <div className="replybar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 17l-5-5 5-5" /><path d="M4 12h11a5 5 0 0 1 5 5v2" /></svg>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    <b>{t("Svarar")} {replyTo.sender}:</b> {replyTo.kind === "image" ? t("Mynd") : replyTo.kind === "audio" ? t("Talskilaboð") : replyTo.body}
                  </span>
                  <button className="iconbtn" onClick={() => setReplyTo(null)} style={{ width: 24, height: 24 }} aria-label={t("Loka")}>{I.close}</button>
                </div>
              )}
              {emoji && <div className="emojibar">{EMOJIS.map((e) => <button key={e} onClick={() => { setVal((v) => v + e); sendTyping(); }}>{e}</button>)}</div>}
              <div className={`msgr-input${phone ? " mob" : ""}`}>
                {phone ? (
                  // Sími: + (tákn) · myndavél · myndasafn · hljóðnemi — falla saman í ör meðan skrifað er.
                  toolsCompact ? (
                    <button className="iconbtn mi-ic" aria-label={t("Fleiri valkostir")} onPointerDown={(e) => e.preventDefault()} onClick={() => setToolsOpen(true)}>{I.chevR}</button>
                  ) : (
                    <>
                      <button className={`iconbtn mi-ic${emoji ? " on" : ""}`} aria-label={t("Tákn")} aria-pressed={emoji} onClick={() => setEmoji((v) => !v)}>{I.plusC}</button>
                      <button className="iconbtn mi-ic" aria-label={t("Myndavél")} onClick={() => camRef.current?.click()}>{I.camera}</button>
                      <button className="iconbtn mi-ic" aria-label={t("Mynd")} onClick={() => fileRef.current?.click()}>{I.imageL}</button>
                      <button className={`iconbtn mi-ic${rec ? " rec" : ""}`} aria-label={t("Talskilaboð")} onClick={toggleRec}>
                        {rec ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : I.micL}
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <button className="iconbtn" title={t("Tákn")} onClick={() => setEmoji((v) => !v)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg></button>
                    <button className="iconbtn" title={t("Mynd")} onClick={() => fileRef.current?.click()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button>
                    <button className="iconbtn" title={t("Talskilaboð")} style={rec ? { color: "var(--bad)" } : undefined} onClick={toggleRec}>
                      {rec ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
                    </button>
                  </>
                )}
                <input
                  ref={inputRef} className="txt" placeholder={rec ? t("Tek upp… smelltu til að stöðva") : phone ? "Aa" : t("chat:ph")} value={val}
                  onFocus={() => setToolsOpen(false)}
                  onChange={(e) => { setVal(e.target.value); if (e.target.value) sendTyping(); else { sendTyping(true); setToolsOpen(false); } }}
                  onBlur={() => sendTyping(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); inputRef.current?.focus(); } }}
                />
                <button className="msgr-send" disabled={!val.trim() && !rec} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => { send(); inputRef.current?.focus(); }} aria-label={t("chat:send")}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*,image/gif" hidden onChange={onFile} />
                <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
              </div>
            </>
          ) : (
            <div className="msgr-empty">
              <span className="msgr-empty-ic">{I.chat}</span>
              <p>{t("Veldu spjall")}</p>
            </div>
          )}
        </div>

        {/* (c) details panel */}
        {threadOpen && (
          <>
            <div className="msgr-scrim" onClick={() => setSideOver(false)} />
            <aside className="msgr-side" aria-label={t("Upplýsingar")}>
              <button className="iconbtn msgr-side-x" onClick={() => (wide ? toggleSide() : setSideOver(false))} aria-label={t("Loka")}>{I.close}</button>
              {/* sími: upplýsingaskjár á heilum skjá með til-baka-ör (eins og Messenger) */}
              <div className="msgr-side-top">
                <button className="iconbtn mob-back" onClick={() => setSideOver(false)} aria-label={t("Til baka")}>{I.backL}</button>
                <b>{aiOpen ? "VAKTO AI" : active ? nameOf(active) : ""}</b>
              </div>
              {aiOpen
                ? <AiDetails chat={aiChat} show={sideShown} onOpened={() => setSideOver(false)} />
                : active && <ConvDetails key={active.id} conv={active} subtitle={subtitleOf(active)} name={nameOf(active)} version={infoVer} show={sideShown}
                  onManage={() => setModal("info")} onJump={jumpTo} onView={setViewer} dayLabel={dayLabel}
                  onLeave={async () => {
                    if (!window.confirm(`${t("Hætta í grúppu")}: „${active.name}“?`)) return;
                    const r = await leaveChannel(active.id);
                    if (!r.ok) { toast(r.error ?? "Villa"); return; }
                    closeThread(); reloadConvs();
                  }} />}
            </aside>
          </>
        )}

        {/* sími: aðgerðablað eftir langt ýti á skilaboð */}
        {sheetFor && (
          <div className="msheet-wrap" onClick={() => setSheetFor(null)}>
            <div className="msheet" role="dialog" aria-label={t("Fleiri aðgerðir")} onClick={(e) => e.stopPropagation()}>
              <div className="msheet-re">
                {REACTIONS.map((e) => (
                  <button key={e} className={sheetFor.reactions.find((r) => r.emoji === e)?.mine ? "on" : ""} onClick={() => { const m = sheetFor; setSheetFor(null); void react(m, e); }}>{e}</button>
                ))}
              </div>
              <div className="msheet-list">
                <button onClick={() => { setReplyTo(sheetFor); setSheetFor(null); inputRef.current?.focus(); }}>{I.reply}{t("Svara")}</button>
                {sheetFor.kind === "text" && sheetFor.body && (
                  <button onClick={() => { void navigator.clipboard?.writeText(sheetFor.body).then(() => toast(t("Afritað"))).catch(() => {}); setSheetFor(null); }}>{I.copy}{t("Afrita")}</button>
                )}
                {sheetFor.me && !sheetFor.id.startsWith("tmp-") && (
                  <button className="danger" onClick={() => { const m = sheetFor; setSheetFor(null); void unsend(m); }}>{I.trash}{t("Eyða")}</button>
                )}
              </div>
              <button className="msheet-x" onClick={() => setSheetFor(null)}>{t("Hætta við")}</button>
            </div>
          </div>
        )}
      </div>

      {(modal === "new" || modal === "group") && <NewChatModal group={modal === "group"} onClose={() => setModal(null)} onDone={(id) => { setModal(null); void openById(id); }} />}
      {profileUser && <ProfileModal userId={profileUser} onClose={() => setProfileUser(null)} onMessage={() => setProfileUser(null)} />}
      {modal === "info" && active && <InfoModal conv={active} onClose={() => setModal(null)} onLeft={() => { setModal(null); setActive(null); reloadConvs(); }} onChanged={() => { reloadConvs(); setInfoVer((v) => v + 1); }} />}
      {viewer && <ImageViewer url={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

/** Details for a channel: big avatar, search in the thread, members, media & files. */
function ConvDetails({ conv, name, subtitle, version, show, onManage, onJump, onView, dayLabel, onLeave }: {
  conv: Conversation; name: string; subtitle: string; version: number; show: boolean;
  onManage: () => void; onJump: (id: string) => void; onView: (url: string) => void; dayLabel: (iso: string) => string; onLeave: () => void;
}) {
  const { t } = useLang();
  const [members, setMembers] = useState<Members | null>(null);
  const [media, setMedia] = useState<ChatMedia[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ChatHit[] | null>(null);
  const group = !conv.dm && conv.kind !== "general";
  const manageable = conv.kind === "group";

  // Loaded only while the panel is visible — closed panels cost no queries.
  useEffect(() => {
    if (!show) return;
    if (group) listMembers(conv.id).then(setMembers);
    listChatMedia(conv.id).then(setMedia);
  }, [show, conv.id, group, version]);
  useEffect(() => {
    const term = q.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the hits with the query
    if (term.length < 2) { setHits(null); return; }
    const id = setTimeout(() => searchChannelMessages(conv.id, term).then(setHits), 250);
    return () => clearTimeout(id);
  }, [q, conv.id]);

  const pics = (media ?? []).filter((m) => isImage(m.kind, m.url, m.name));
  const files = (media ?? []).filter((m) => !isImage(m.kind, m.url, m.name));
  return (
    <div className="side-in">
      <div className="side-hero">
        <ConvAvatar c={conv} size={80} />
        <b>{name}</b>
        <span className="side-sub">{subtitle}{members ? ` · ${members.members.length} ${t("meðlimir")}` : ""}</span>
      </div>
      <div className="side-acts">
        <button className={searching ? "on" : ""} onClick={() => { setSearching((s) => !s); setQ(""); }}>
          <span>{I.search}</span>{t("Leita")}
        </button>
        {manageable && <button onClick={onManage}><span>{I.settings}</span>{t("Stjórna grúppu")}</button>}
      </div>
      {searching && (
        <div className="side-sec side-search">
          <div className="srchbox">{I.search}<input autoFocus placeholder={t("Leita í samtali")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {hits && (hits.length ? (
            <div className="side-hits">
              {hits.map((h) => (
                <button key={h.id} className="side-hit" onClick={() => onJump(h.id)}>
                  <small>{h.sender === "Ég" ? t("Þú") : h.sender} · {dayLabel(h.createdAt)}</small>
                  <span>{h.body}</span>
                </button>
              ))}
            </div>
          ) : <p className="side-muted">{t("Engar niðurstöður")}</p>)}
        </div>
      )}
      {group && (
        <div className="side-sec side-members">
          <div className="side-h">{t("Meðlimir")}{members ? ` · ${members.members.length}` : ""}</div>
          {members === null ? <i className="sk-line" style={{ height: 34, display: "block" }} /> : (
            <div className="side-people">
              {members.members.map((p) => (
                <div key={p.userId} className="side-person">
                  <PersonAvatar p={p} size={34} />
                  <span>{p.name}{p.userId === members.adminId ? <small> · {t("stofnandi")}</small> : null}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="side-sec side-media">
        <div className="side-h">{t("Myndir og skrár")}</div>
        {media === null ? <i className="sk-line" style={{ height: 70, display: "block" }} />
          : media.length === 0 ? <p className="side-muted">{t("Engar myndir eða skrár enn")}</p> : (
            <>
              {pics.length > 0 && (
                <div className="side-grid">
                  {pics.map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={m.id} href={m.url} target="_blank" rel="noreferrer" onClick={(e) => openImage(e, m.url, onView)}><img src={m.url} alt="" loading="lazy" /></a>
                  ))}
                </div>
              )}
              {files.map((m) => (
                <a key={m.id} className="side-file" href={m.url} target="_blank" rel="noreferrer">
                  <span>{m.kind === "audio" ? I.mic : I.file}</span>
                  <b>{m.kind === "audio" ? t("Talskilaboð") : (m.name || t("Skjal"))}</b>
                  <small>{dayLabel(m.createdAt)}</small>
                </a>
              ))}
            </>
          )}
      </div>
      {/* sími: aðgerðalisti neðst (aðeins það sem virkar) — falinn á tölvu */}
      <div className="side-sec side-list">
        <button onClick={() => { setSearching(true); setQ(""); document.querySelector(".msgr-side")?.scrollTo({ top: 0, behavior: "smooth" }); }}>{I.search}<span>{t("Leita í samtali")}</span></button>
        {manageable && <button onClick={onManage}>{I.settings}<span>{t("Stjórna grúppu")}</span></button>}
        {manageable && <button className="danger" onClick={onLeave}>{I.leave}<span>{t("Hætta í grúppu")}</span></button>}
      </div>
    </div>
  );
}

/** Details for VAKTO AI: new conversation + earlier conversations (history). */
function AiDetails({ chat, show, onOpened }: { chat: AssistantChat; show: boolean; onOpened?: () => void }) {
  const { t } = useLang();
  const { s } = chat;
  useEffect(() => { if (show) void chat.loadHistory(); }, [show]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="side-in">
      <div className="side-hero">
        <AiAvatar size={80} />
        <b>VAKTO AI</b>
        <span className="side-sub">{t("Aðstoðarmaður fyrir reksturinn")}</span>
      </div>
      <div className="side-acts">
        <button onClick={() => { chat.fresh(); chat.focus(); onOpened?.(); }}><span>{I.plus}</span>{s.reset}</button>
      </div>
      <div className="side-sec">
        <div className="side-h">{s.history}</div>
        <div className="vai-hist side-ai-hist"><AssistantHistoryList chat={chat} onOpened={onOpened} /></div>
      </div>
      <p className="side-muted" style={{ padding: "0 18px" }}>{s.note}</p>
    </div>
  );
}

function PeoplePicker({ selected, onToggle }: { selected: Set<string>; onToggle: (p: Person) => void }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => { const id = setTimeout(() => searchPeople(q).then(setPeople), 200); return () => clearTimeout(id); }, [q]);
  return (
    <>
      <div className="srchbox" style={{ marginBottom: 10 }}>{I.search}<input autoFocus placeholder={t("Leita að starfsmanni")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="att" style={{ maxHeight: "44vh", overflowY: "auto" }}>
        {people.length ? people.map((p) => (
          <div className="it rowlink" key={p.userId} onClick={() => onToggle(p)}>
            <PersonAvatar p={p} size={34} />
            <div className="tx"><b>{p.name}</b></div>
            {selected.has(p.userId) ? <span className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)", marginLeft: "auto" }}>✓</span> : <span className="tag mut" style={{ marginLeft: "auto" }}>+</span>}
          </div>
        )) : <div className="muted" style={{ padding: 14, textAlign: "center", fontSize: 13 }}>{t("Enginn starfsmaður fannst")}</div>}
      </div>
    </>
  );
}

/** Sjálfgefið heiti hóps eins og í Messenger: „Anna og Jón“, „Anna, Jón og Gunna“, „Anna, Jón og 3 fleiri“. */
function defaultGroupName(sel: Person[], t: (s: string) => string): string {
  const f = sel.map((p) => firstName(p.name));
  if (f.length <= 1) return f[0] ?? "";
  if (f.length <= 3) return `${f.slice(0, -1).join(", ")} ${t("chat:and")} ${f[f.length - 1]}`;
  return `${f.slice(0, 2).join(", ")} ${t("chat:and")} ${f.length - 2} ${t("fleiri")}`;
}

/** New chat: one person → direct message; several (or „Nýr hópur“) → a group. Heiti er valfrjálst. */
function NewChatModal({ group = false, onClose, onDone }: { group?: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [sel, setSel] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [teams, setTeams] = useState<TeamPick[]>([]);
  useEffect(() => { listTeamPicks().then(setTeams); }, []);
  const ids = new Set(sel.map((p) => p.userId));
  const isGroup = group || sel.length > 1;
  const fallbackName = defaultGroupName(sel, t);
  function toggle(p: Person) { setSel((s) => ids.has(p.userId) ? s.filter((x) => x.userId !== p.userId) : [...s, p]); }
  /** „+ Allir í Eldhúsi“: bætir öllum í deildinni/staðnum við valið (þeir sem eru þegar valdir haldast). */
  function addTeam(tp: TeamPick) { setSel((s) => [...s, ...tp.people.filter((p) => !s.some((x) => x.userId === p.userId))]); }
  async function create() {
    if (!sel.length) { toast(t("Veldu meðlimi")); return; }
    setBusy(true);
    const r = isGroup ? await createGroup(name.trim() || fallbackName, sel.map((p) => p.userId)) : await startDM(sel[0].userId);
    setBusy(false);
    if (r.ok && r.id) onDone(r.id); else toast(r.error ?? "Villa");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{group ? t("Nýr hópur") : t("Nýtt spjall")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {sel.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{sel.map((p) => <span key={p.userId} className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)", cursor: "pointer" }} onClick={() => toggle(p)}>{p.name} ✕</span>)}</div>}
          {isGroup && <div className="field"><label>{t("Heiti grúppu")} <span className="muted">({t("valfrjálst")})</span></label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={fallbackName || t("t.d. Eldhús, Kvöldvakt…")} /></div>}
          <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>{t("Veldu meðlimi")}</label>
          {teams.length > 0 && (
            <div className="team-picks">
              {teams.map((tp) => {
                const all = tp.people.every((p) => ids.has(p.userId));
                return (
                  <button key={tp.key} type="button" className={`tpick${all ? " on" : ""}`} disabled={all} onClick={() => addTeam(tp)} title={`${tp.people.length} ${t("manns")}`}>
                    {all ? "✓" : "+"} {tp.kind === "dept" ? t("Allir í") : t("Allir á")} {tp.name}
                  </button>
                );
              })}
            </div>
          )}
          <PeoplePicker selected={ids} onToggle={toggle} />
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            <button className="btn" disabled={busy || !sel.length} onClick={create}>{isGroup ? t("Búa til grúppu") : t("Senda skilaboð")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoModal({ conv, onClose, onLeft, onChanged }: { conv: Conversation; onClose: () => void; onLeft: () => void; onChanged: () => void }) {
  const { t } = useLang();
  const [m, setM] = useState<Members>({ members: [], adminId: null, meId: "" });
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(conv.name);
  const photoRef = useRef<HTMLInputElement | null>(null);
  function reload() { listMembers(conv.id).then(setM); }
  useEffect(reload, [conv.id]);
  const admin = !!m.adminId && m.adminId === m.meId;
  const group = conv.kind === "group";
  const kindLabel = t("Grúppa");
  async function remove(p: Person) { const r = await removeMember(conv.id, p.userId); if (r.ok) { reload(); onChanged(); } else toast(r.error ?? "Villa"); }
  async function leave() { if (!window.confirm(`Hætta í „${conv.name}"?`)) return; const r = await leaveChannel(conv.id); if (r.ok) onLeft(); else toast(r.error ?? "Villa"); }
  async function add(p: Person) { const r = await addMembers(conv.id, [p.userId]); if (r.ok) { reload(); setAdding(false); onChanged(); } else toast(r.error ?? "Villa"); }
  async function saveName() {
    const r = await renameChannel(conv.id, nameVal);
    if (r.ok) { setEditingName(false); onChanged(); toast(t("Heiti breytt")); } else toast(r.error ?? "Villa");
  }
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (photoRef.current) photoRef.current.value = "";
    const r = new FileReader();
    r.onload = async () => {
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const up = await setChannelPhoto(conv.id, r.result as string, ext);
      if (up.ok) { onChanged(); toast(t("Grúppumynd vistuð")); } else toast(up.error ?? "Villa");
    };
    r.readAsDataURL(f);
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{conv.name}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {group && !adding && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <button className="gphoto" title={t("Setja grúppumynd")} onClick={() => photoRef.current?.click()}>
                <ConvAvatar c={conv} size={64} />
                <span className="cam">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" /><circle cx="12" cy="13" r="4" /></svg>
                </span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingName ? (
                  <div style={{ display: "flex", gap: 7 }}>
                    <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn sm" onClick={saveName}>{t("Vista")}</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 15 }}>{conv.name}</b>
                    <button className="iconbtn" title={t("Breyta heiti")} onClick={() => { setNameVal(conv.name); setEditingName(true); }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9" /><path d="M16.5 3.5a2 2 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" /></svg>
                    </button>
                  </div>
                )}
                <span className="muted" style={{ fontSize: 12 }}>{kindLabel} · {m.members.length} {t("meðlimir")}</span>
              </div>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto} />
            </div>
          )}
          {adding ? (
            <>
              <PeoplePicker selected={new Set(m.members.map((x) => x.userId))} onToggle={add} />
              <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setAdding(false)}>{t("Til baka")}</button>
            </>
          ) : (
            <>
              <div className="ch" style={{ padding: 0, marginBottom: 8 }}><div className="ct" style={{ fontSize: 13 }}>{t("Meðlimir")} · {m.members.length}</div>{admin && <button className="btn ghost sm" onClick={() => setAdding(true)}>{t("Bæta við fólki")}</button>}</div>
              <div className="att" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                {m.members.map((p) => (
                  <div className="it" key={p.userId}>
                    <PersonAvatar p={p} size={32} />
                    <div className="tx"><b>{p.name}{p.userId === m.adminId ? ` · ${t("stofnandi")}` : ""}</b></div>
                    {admin && p.userId !== m.meId && <button className="btn ghost sm" style={{ marginLeft: "auto", color: "var(--bad)" }} onClick={() => remove(p)}>{t("Fjarlægja")}</button>}
                  </div>
                ))}
              </div>
              <button className="btn ghost" style={{ marginTop: 14, color: "var(--bad)" }} onClick={leave}>{t("Hætta í grúppu")}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoChat() {
  const { t } = useLang();
  return (
    <>
      <PageHeader title="Spjall" subtitle="Innra spjall fyrirtækisins" />
      <div className="card" style={{ marginTop: 16 }}>
        <div className="cb"><p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{t("Spjallið er ekki tiltækt núna — reyndu að endurhlaða síðuna.")}</p></div>
      </div>
    </>
  );
}
