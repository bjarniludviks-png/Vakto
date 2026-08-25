"use client";

import React, { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import {
  listConversations, listMessages, sendChatMessage, createGroup, startDM, searchPeople,
  listMembers, addMembers, removeMember, leaveChannel, uploadChatMedia,
  renameChannel, setChannelPhoto, setMessageReaction, deleteMessage,
  type Conversation, type ChatMessage, type Person, type Members,
} from "./actions";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "👏", "😅", "😮", "😢", "💪", "✅", "🤝", "☕", "🍕", "🚀"];
const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

/** "Í dag" / "Í gær" / "24. ágúst" day separators between messages. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toDateString();
  const yest = new Date(now.getTime() - 864e5).toDateString();
  if (d.toDateString() === today) return "Í dag";
  if (d.toDateString() === yest) return "Í gær";
  const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
  return `${d.getDate()}. ${MO[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? " " + d.getFullYear() : ""}`;
}

/** Messenger-style grouping: consecutive messages from the same sender within
 * 5 minutes merge — avatar/name only once, tighter radii inside the group. */
function groupFlags(msgs: ChatMessage[], i: number): { first: boolean; last: boolean; newDay: boolean } {
  const m = msgs[i], prev = msgs[i - 1], next = msgs[i + 1];
  const near = (a?: ChatMessage, b?: ChatMessage) =>
    !!a && !!b && a.senderId === b.senderId &&
    Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < 5 * 60e3 &&
    new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString();
  const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
  return { first: newDay || !near(prev, m), last: !near(m, next) || (!!next && new Date(next.createdAt).toDateString() !== new Date(m.createdAt).toDateString()), newDay };
}

/** Group/DM avatar — photo when set, else colored initials. */
function ConvAvatar({ c, size = 40 }: { c: Conversation; size?: number }) {
  if (c.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avt-img" src={c.photo} alt="" style={{ width: size, height: size }} />;
  }
  return <span className="avt" style={{ background: c.color, width: size, height: size, fontSize: c.kind === "general" ? size * 0.45 : size * 0.33 }}>{c.av}</span>;
}

export default function ChatScreen({ initial }: { initial?: { ok: boolean; items: Conversation[]; meId: string } }) {
  if (!initial?.ok) return <DemoChat />;
  return <Messenger initial={initial} />;
}

// Last-seen timestamps per conversation (client-side unread markers).
const SEEN_KEY = "vakto-chat-seen";
function readSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
}
/** "13:45" today, else "24.6." */
function convTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function Messenger({ initial }: { initial: { ok: boolean; items: Conversation[]; meId: string } }) {
  const { t } = useLang();
  const [convs, setConvs] = useState<Conversation[]>(initial.items);
  const [active, setActive] = useState<Conversation | null>(initial.items[0] ?? null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [val, setVal] = useState("");
  const [search, setSearch] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [rec, setRec] = useState(false);
  const [modal, setModal] = useState<null | "group" | "info">(null);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  function reloadConvs() {
    listConversations().then((r) => {
      if (!r.ok) return;
      setConvs(r.items);
      // keep the open thread's name/photo fresh after rename or photo change
      setActive((a) => (a ? r.items.find((x) => x.id === a.id) ?? a : a));
    });
  }
  function loadMsgs(id?: string) { if (id) listMessages(id).then((r) => { if (r.ok) setMsgs(r.messages); }); }
  function markSeen(id: string) {
    setSeen(() => {
      const next = { ...readSeen(), [id]: new Date().toISOString() };
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  useEffect(() => { setSeen(readSeen()); }, []);
  useEffect(() => {
    loadMsgs(active?.id);
    if (active?.id) markSeen(active.id);
    // Realtime does the heavy lifting; polling is only a 10s safety net.
    const iv = setInterval(() => { loadMsgs(active?.id); reloadConvs(); if (active?.id) markSeen(active.id); }, 10000);
    return () => clearInterval(iv);
  }, [active?.id]);

  const activeRef = useRef<string | null>(null);
  useEffect(() => { activeRef.current = active?.id ?? null; }, [active?.id]);

  // Instant delivery: subscribe to new messages (RLS-scoped) — reload the open
  // thread and the list the moment anything lands, instead of waiting to poll.
  useEffect(() => {
    const supabase = createBrowserClient();
    const ch = supabase
      .channel("chat-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { channel_id?: string };
        if (row.channel_id && row.channel_id === activeRef.current) {
          loadMsgs(activeRef.current ?? undefined);
          if (activeRef.current) markSeen(activeRef.current);
        }
        reloadConvs();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channels" }, () => reloadConvs())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // People search — suggestions from the FIRST character (Messenger-style).
  useEffect(() => {
    const q = search.trim();
    if (!q) { setPeople([]); return; }
    const id = setTimeout(() => searchPeople(q).then(setPeople), 150);
    return () => clearTimeout(id);
  }, [search]);

  async function openDM(p: Person) {
    setSearch("");
    const r = await startDM(p.userId);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    const c = await listConversations();
    if (c.ok) {
      setConvs(c.items);
      const found = c.items.find((x) => x.id === r.id);
      if (found) { setActive(found); markSeen(found.id); }
    }
  }
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const unread = (c: Conversation) => !!c.lastAt && c.id !== active?.id && (!seen[c.id] || c.lastAt > seen[c.id]);

  async function send(kind: "text" | "image" | "audio" = "text", url?: string, body?: string) {
    const text = body ?? val;
    if (kind === "text" && !text.trim()) return;
    if (kind === "text") setVal("");
    setEmoji(false);
    if (!active) return;
    const reply = replyTo;
    setReplyTo(null);
    // Optimistic: show the message instantly; the reload reconciles the real row.
    const now = new Date();
    setMsgs((ms) => [...ms, {
      id: `tmp-${now.getTime()}`, sender: "Ég", senderId: initial.meId, me: true,
      body: text, at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      kind, url: url ?? null, reactions: [], createdAt: now.toISOString(),
      replyTo: reply ? { sender: reply.sender, body: reply.body } : null,
    }]);
    const res = await sendChatMessage(active.id, text, kind, url, reply?.id);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); }
    loadMsgs(active.id); reloadConvs();
  }

  async function react(m: ChatMessage, emoji: string) {
    setReactFor(null);
    const mine = m.reactions.find((r) => r.mine);
    const r = await setMessageReaction(m.id, mine?.emoji === emoji ? null : emoji);
    if (!r.ok) toast(r.error ?? "Tókst ekki");
    loadMsgs(active?.id);
  }

  async function unsend(m: ChatMessage) {
    if (!window.confirm(t("Eyða skilaboðum?"))) return;
    const r = await deleteMessage(m.id);
    if (!r.ok) toast(r.error ?? "Tókst ekki");
    loadMsgs(active?.id); reloadConvs();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !active) return;
    if (fileRef.current) fileRef.current.value = "";
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

  const shown = convs.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className={`msgr full${active ? " thread-open" : ""}`}>
        {/* conversation list */}
        <div className="msgr-list">
          <div className="msgr-head" style={{ gap: 8 }}>
            <div className="srchbox" style={{ flex: 1 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg><input placeholder={t("Leitaðu að spjalli eða manneskju…")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="iconbtn" title={t("Ný grúppa")} onClick={() => setModal("group")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {search.trim() && (
              <div className="chat-sec">{t("Samtöl")}</div>
            )}
            {search.trim() && shown.length === 0 && (
              <div className="muted" style={{ fontSize: 12.5, padding: "4px 14px 10px" }}>{t("Ekkert samtal fannst")}</div>
            )}
            {shown.map((c) => {
              const un = unread(c);
              return (
                <div key={c.id} className={`conv${active?.id === c.id ? " on" : ""}`} onClick={() => { setActive(c); markSeen(c.id); }}>
                  <ConvAvatar c={c} />
                  <div className="tx">
                    <b style={un ? { fontWeight: 800 } : undefined}>{c.kind === "general" ? "# " + c.name : c.name}</b>
                    <span style={un ? { color: "var(--ink)", fontWeight: 600 } : undefined}>{c.last || (c.dm ? t("Bein skilaboð") : t("Grúppa"))}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, marginLeft: "auto", flexShrink: 0 }}>
                    <span className="muted" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{convTime(c.lastAt)}</span>
                    {un && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--brand)", display: "inline-block" }} />}
                  </div>
                </div>
              );
            })}
            {search.trim() && people.length > 0 && (
              <>
                <div className="chat-sec">{t("Byrja nýtt spjall")}</div>
                {people
                  .filter((p) => !convs.some((c) => c.dm && c.name === p.name))
                  .map((p) => (
                    <div key={p.userId} className="conv" onClick={() => openDM(p)}>
                      <span className="avt" style={{ background: p.color, width: 40, height: 40, fontSize: 13 }}>{p.av}</span>
                      <div className="tx">
                        <b>{p.name}</b>
                        <span>{t("Senda skilaboð")}</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" style={{ marginLeft: "auto", flexShrink: 0 }}><path d="M12 5v14M5 12h14" /></svg>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        {/* thread */}
        <div className="msgr-thread">
          {active ? (
            <>
              <div className="msgr-head">
                <button className="iconbtn mob-back" onClick={() => setActive(null)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6" /></svg></button>
                <ConvAvatar c={active} size={34} />
                <div
                  style={{ flex: 1, minWidth: 0, cursor: active.dm ? undefined : "pointer" }}
                  onClick={() => !active.dm && setModal("info")}
                  title={active.dm ? undefined : t("Upplýsingar")}
                >
                  {active.kind === "general" ? "# " + active.name : active.name}
                </div>
                {!active.dm && <button className="iconbtn" title={t("Upplýsingar")} onClick={() => setModal("info")}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg></button>}
              </div>
              <div className="msgr-msgs">
                {msgs.length ? msgs.map((m, mi) => {
                  const g = groupFlags(msgs, mi);
                  return (
                  <React.Fragment key={m.id}>
                  {g.newDay && <div className="day-sep"><span>{dayLabel(m.createdAt)}</span></div>}
                  <div className={`mrow ${m.me ? "me" : "them"}${m.reactions.length ? " hasre" : ""}${g.first ? " g-first" : ""}${g.last ? " g-last" : " g-mid"}`}>
                    {!m.me && (
                      <span className="m-ava" style={{ visibility: g.last ? "visible" : "hidden" }}>
                        <span className="avt" style={{ background: "var(--brand-soft)", color: "var(--brand)", width: 28, height: 28, fontSize: 10.5, fontWeight: 700 }}>
                          {m.sender.slice(0, 2).toUpperCase()}
                        </span>
                      </span>
                    )}
                    <div className={`mbub ${m.me ? "me" : "them"}`}>
                      {!m.me && !active.dm && g.first && <span className="who" style={{ color: "var(--brand)" }}>{m.sender}</span>}
                      {m.replyTo && (
                        <span className="mreply"><b>{m.replyTo.sender}</b><span>{m.replyTo.body}</span></span>
                      )}
                      {m.kind === "image" && m.url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.url} alt="" />
                        : m.kind === "audio" && m.url ? <audio controls src={m.url} style={{ height: 36 }} />
                          : m.body}
                      {g.last && <span className="tm">{m.at}</span>}
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
                  </React.Fragment>
                  );
                }) : <div className="muted" style={{ textAlign: "center", margin: "auto", fontSize: 13 }}>{t("Engin skilaboð enn — byrjaðu spjallið!")}</div>}
                <div ref={endRef} />
              </div>
              {replyTo && (
                <div className="replybar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 17l-5-5 5-5" /><path d="M4 12h11a5 5 0 0 1 5 5v2" /></svg>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    <b>{t("Svarar")} {replyTo.sender}:</b> {replyTo.kind === "image" ? "📷" : replyTo.kind === "audio" ? "🎤" : replyTo.body}
                  </span>
                  <button className="iconbtn" onClick={() => setReplyTo(null)} style={{ width: 24, height: 24 }}>✕</button>
                </div>
              )}
              {emoji && <div className="emojibar">{EMOJIS.map((e) => <button key={e} onClick={() => { setVal((v) => v + e); }}>{e}</button>)}</div>}
              <div className="msgr-input">
                <button className="iconbtn" title={t("Tákn")} onClick={() => setEmoji((v) => !v)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg></button>
                <button className="iconbtn" title={t("Mynd")} onClick={() => fileRef.current?.click()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button>
                <button className="iconbtn" title={t("Talskilaboð")} style={rec ? { color: "var(--bad)" } : undefined} onClick={toggleRec}>
                  {rec ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
                </button>
                <input className="txt" placeholder={rec ? t("Tek upp… smelltu til að stöðva") : t("chat:ph")} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="msgr-send" disabled={!val.trim() && !rec} onClick={() => send()} aria-label={t("chat:send")}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*,image/gif" hidden onChange={onFile} />
              </div>
            </>
          ) : <div className="muted" style={{ margin: "auto", fontSize: 14 }}>{t("Veldu spjall")}</div>}
        </div>
      </div>

      {modal === "group" && <NewGroupModal onClose={() => setModal(null)} onDone={(id) => { setModal(null); listConversations().then((c) => { if (c.ok) { setConvs(c.items); const f = c.items.find((x) => x.id === id); if (f) setActive(f); } }); }} />}
      {modal === "info" && active && <InfoModal conv={active} onClose={() => setModal(null)} onLeft={() => { setModal(null); setActive(null); reloadConvs(); }} onChanged={reloadConvs} />}
    </>
  );
}

function PeoplePicker({ selected, onToggle }: { selected: Set<string>; onToggle: (p: Person) => void }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => { const id = setTimeout(() => searchPeople(q).then(setPeople), 200); return () => clearTimeout(id); }, [q]);
  return (
    <>
      <div className="srchbox" style={{ marginBottom: 10 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg><input autoFocus placeholder={t("Leita að starfsmanni")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="att" style={{ maxHeight: "44vh", overflowY: "auto" }}>
        {people.length ? people.map((p) => (
          <div className="it rowlink" key={p.userId} onClick={() => onToggle(p)}>
            <span className="avt" style={{ background: p.color, width: 34, height: 34, fontSize: 12 }}>{p.av}</span>
            <div className="tx"><b>{p.name}</b></div>
            {selected.has(p.userId) ? <span className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)", marginLeft: "auto" }}>✓</span> : <span className="tag mut" style={{ marginLeft: "auto" }}>+</span>}
          </div>
        )) : <div className="muted" style={{ padding: 14, textAlign: "center", fontSize: 13 }}>{t("Enginn starfsmaður fannst")}</div>}
      </div>
    </>
  );
}

function NewGroupModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [sel, setSel] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const ids = new Set(sel.map((p) => p.userId));
  function toggle(p: Person) { setSel((s) => ids.has(p.userId) ? s.filter((x) => x.userId !== p.userId) : [...s, p]); }
  async function create() {
    if (!name.trim()) { toast("Sláðu inn heiti"); return; }
    setBusy(true);
    const r = await createGroup(name, sel.map((p) => p.userId));
    setBusy(false);
    if (r.ok && r.id) onDone(r.id); else toast(r.error ?? "Villa");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Ný grúppa")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="field"><label>{t("Heiti grúppu")}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Eldhús, Kvöldvakt…")} /></div>
          {sel.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{sel.map((p) => <span key={p.userId} className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{p.name} ✕</span>)}</div>}
          <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>{t("Veldu meðlimi")}</label>
          <PeoplePicker selected={ids} onToggle={toggle} />
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            <button className="btn" disabled={busy} onClick={create}>{t("Búa til grúppu")}</button>
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
  const admin = m.adminId === m.meId;
  const group = conv.kind === "group";
  async function remove(p: Person) { const r = await removeMember(conv.id, p.userId); if (r.ok) reload(); else toast(r.error ?? "Villa"); }
  async function leave() { if (!window.confirm(`Hætta í „${conv.name}"?`)) return; const r = await leaveChannel(conv.id); if (r.ok) onLeft(); else toast(r.error ?? "Villa"); }
  async function add(p: Person) { const r = await addMembers(conv.id, [p.userId]); if (r.ok) { reload(); setAdding(false); } else toast(r.error ?? "Villa"); }
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
                <span className="muted" style={{ fontSize: 12 }}>{t("Grúppa")} · {m.members.length} {t("meðlimir")}</span>
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
                    <span className="avt" style={{ background: p.color, width: 32, height: 32, fontSize: 12 }}>{p.av}</span>
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
        <div className="cb"><p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{t("Spjallið virkjast þegar þú ert innskráð/ur og Supabase er tengt (migrations 0012 + 0014).")}</p></div>
      </div>
    </>
  );
}
