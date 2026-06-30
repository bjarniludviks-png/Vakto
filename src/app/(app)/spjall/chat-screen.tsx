"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import {
  listConversations, listMessages, sendChatMessage, createGroup, startDM, searchPeople,
  listMembers, addMembers, removeMember, leaveChannel, uploadChatMedia,
  type Conversation, type ChatMessage, type Person, type Members,
} from "./actions";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "👏", "😅", "😮", "😢", "💪", "✅", "🤝", "☕", "🍕", "🚀"];

export default function ChatScreen({ initial }: { initial?: { ok: boolean; items: Conversation[]; meId: string } }) {
  if (!initial?.ok) return <DemoChat />;
  return <Messenger initial={initial} />;
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
  const [modal, setModal] = useState<null | "dm" | "group" | "info">(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  function reloadConvs() { listConversations().then((r) => { if (r.ok) setConvs(r.items); }); }
  function loadMsgs(id?: string) { if (id) listMessages(id).then((r) => { if (r.ok) setMsgs(r.messages); }); }
  useEffect(() => {
    loadMsgs(active?.id);
    const iv = setInterval(() => loadMsgs(active?.id), 4000);
    return () => clearInterval(iv);
  }, [active?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function send(kind: "text" | "image" | "audio" = "text", url?: string, body?: string) {
    const text = body ?? val;
    if (kind === "text" && !text.trim()) return;
    if (kind === "text") setVal("");
    setEmoji(false);
    if (!active) return;
    const res = await sendChatMessage(active.id, text, kind, url);
    if (!res.ok) toast(res.error ?? "Tókst ekki");
    loadMsgs(active.id); reloadConvs();
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
            <div className="srchbox" style={{ flex: 1 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg><input placeholder={t("Leita")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="iconbtn" title={t("Nýtt spjall")} onClick={() => setModal("dm")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9" /><path d="M16.5 3.5a2 2 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" /></svg></button>
            <button className="iconbtn" title={t("Ný grúppa")} onClick={() => setModal("group")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {shown.map((c) => (
              <div key={c.id} className={`conv${active?.id === c.id ? " on" : ""}`} onClick={() => setActive(c)}>
                <span className="avt" style={{ background: c.color, width: 40, height: 40, fontSize: c.kind === "general" ? 18 : 13 }}>{c.av}</span>
                <div className="tx"><b>{c.kind === "general" ? "# " + c.name : c.name}</b><span>{c.last || (c.dm ? t("Bein skilaboð") : t("Grúppa"))}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* thread */}
        <div className="msgr-thread">
          {active ? (
            <>
              <div className="msgr-head">
                <button className="iconbtn mob-back" onClick={() => setActive(null)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6" /></svg></button>
                <span className="avt" style={{ background: active.color, width: 34, height: 34, fontSize: 12 }}>{active.av}</span>
                <div style={{ flex: 1, minWidth: 0 }}>{active.kind === "general" ? "# " + active.name : active.name}</div>
                {!active.dm && <button className="iconbtn" title={t("Upplýsingar")} onClick={() => setModal("info")}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg></button>}
              </div>
              <div className="msgr-msgs">
                {msgs.length ? msgs.map((m) => (
                  <div key={m.id} className={`mbub ${m.me ? "me" : "them"}`}>
                    {!m.me && !active.dm && <span className="who" style={{ color: m.me ? "#fff" : "var(--brand)" }}>{m.sender}</span>}
                    {m.kind === "image" && m.url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.url} alt="" />
                      : m.kind === "audio" && m.url ? <audio controls src={m.url} style={{ height: 36 }} />
                        : m.body}
                    <span className="tm">{m.at}</span>
                  </div>
                )) : <div className="muted" style={{ textAlign: "center", margin: "auto", fontSize: 13 }}>{t("Engin skilaboð enn — byrjaðu spjallið!")}</div>}
                <div ref={endRef} />
              </div>
              {emoji && <div className="emojibar">{EMOJIS.map((e) => <button key={e} onClick={() => { setVal((v) => v + e); }}>{e}</button>)}</div>}
              <div className="msgr-input">
                <button className="iconbtn" title={t("Tákn")} onClick={() => setEmoji((v) => !v)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg></button>
                <button className="iconbtn" title={t("Mynd")} onClick={() => fileRef.current?.click()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button>
                <button className="iconbtn" title={t("Talskilaboð")} style={rec ? { color: "var(--bad)" } : undefined} onClick={toggleRec}>
                  {rec ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
                </button>
                <input className="txt" placeholder={rec ? t("Tek upp… smelltu til að stöðva") : t("chat:ph")} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="btn sm" onClick={() => send()}>{t("chat:send")}</button>
                <input ref={fileRef} type="file" accept="image/*,image/gif" hidden onChange={onFile} />
              </div>
            </>
          ) : <div className="muted" style={{ margin: "auto", fontSize: 14 }}>{t("Veldu spjall")}</div>}
        </div>
      </div>

      {modal === "dm" && <NewDMModal onClose={() => setModal(null)} onPick={async (p) => { const r = await startDM(p.userId); setModal(null); if (r.ok) { reloadConvs(); listConversations().then((c) => { const found = c.items.find((x) => x.id === r.id); if (found) setActive(found); }); } else toast(r.error ?? "Villa"); }} />}
      {modal === "group" && <NewGroupModal onClose={() => setModal(null)} onDone={(id) => { setModal(null); listConversations().then((c) => { if (c.ok) { setConvs(c.items); const f = c.items.find((x) => x.id === id); if (f) setActive(f); } }); }} />}
      {modal === "info" && active && <InfoModal conv={active} onClose={() => setModal(null)} onLeft={() => { setModal(null); setActive(null); reloadConvs(); }} />}
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

function NewDMModal({ onClose, onPick }: { onClose: () => void; onPick: (p: Person) => void }) {
  const { t } = useLang();
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Nýtt spjall")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb"><PeoplePicker selected={new Set()} onToggle={onPick} /></div>
      </div>
    </div>
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

function InfoModal({ conv, onClose, onLeft }: { conv: Conversation; onClose: () => void; onLeft: () => void }) {
  const { t } = useLang();
  const [m, setM] = useState<Members>({ members: [], adminId: null, meId: "" });
  const [adding, setAdding] = useState(false);
  function reload() { listMembers(conv.id).then(setM); }
  useEffect(reload, [conv.id]);
  const admin = m.adminId === m.meId;
  async function remove(p: Person) { const r = await removeMember(conv.id, p.userId); if (r.ok) reload(); else toast(r.error ?? "Villa"); }
  async function leave() { if (!window.confirm(`Hætta í „${conv.name}"?`)) return; const r = await leaveChannel(conv.id); if (r.ok) onLeft(); else toast(r.error ?? "Villa"); }
  async function add(p: Person) { const r = await addMembers(conv.id, [p.userId]); if (r.ok) { reload(); setAdding(false); } else toast(r.error ?? "Villa"); }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{conv.name}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
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
