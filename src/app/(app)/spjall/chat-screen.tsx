"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { listMessages, sendChatMessage, createChannel, type Channel, type ChatMessage } from "./actions";

const TeamIcon = () => (
  <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11v2l11 4V7L3 11ZM14 7l5-2v14l-5-2" /></svg>
);
const PALETTE = ["#5b50e6", "#18a06a", "#1fb6a6", "#e0533f", "#0891b2", "#ca8a04", "#9333ea", "#e11d48"];
const colorOf = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
const initialsOf = (s: string) => s.slice(0, 2).toUpperCase();

export default function ChatScreen({ channels: initialChannels = [], live = false }: { channels?: Channel[]; live?: boolean }) {
  if (!live) return <DemoChat />;
  return <LiveChat initialChannels={initialChannels} />;
}

function LiveChat({ initialChannels }: { initialChannels: Channel[] }) {
  const { t } = useLang();
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [active, setActive] = useState<string>(initialChannels[0]?.id ?? "");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [val, setVal] = useState("");
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  function load(channelId: string) {
    if (!channelId) return;
    listMessages(channelId).then((r) => { if (r.ok) setMsgs(r.messages); });
  }
  useEffect(() => {
    load(active);
    const iv = setInterval(() => load(active), 4000);
    return () => clearInterval(iv);
  }, [active]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function send() {
    const v = val.trim();
    if (!v || !active) return;
    setVal("");
    setMsgs((m) => [...m, { id: `tmp${m.length}`, sender: t("Ég"), me: true, body: v, at: "" }]); // optimistic
    const res = await sendChatMessage(active, v);
    if (!res.ok) toast(res.error === "demo" ? "Spjall virkt þegar Supabase er tengt" : (res.error ?? "Tókst ekki"));
    load(active);
  }
  async function makeGroup() {
    const res = await createChannel(newName);
    if (res.ok && res.channel) {
      setChannels((c) => [...c, res.channel!]); setActive(res.channel.id); setNewName(""); setShowNew(false);
      toast("Grúppa búin til");
    } else toast(res.error ?? "Tókst ekki");
  }

  const activeCh = channels.find((c) => c.id === active);
  return (
    <>
      <PageHeader title="Spjall" subtitle="Skilaboð til starfsfólks og stjórnenda" />
      <div className="chat">
        <div className="clist">
          <div style={{ display: "flex", gap: 6, padding: "0 0 10px" }}>
            {showNew ? (
              <>
                <input autoFocus placeholder={t("Heiti grúppu")} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && makeGroup()} style={{ flex: 1, padding: "7px 10px", fontSize: 13 }} />
                <button className="btn sm" onClick={makeGroup}>{t("Búa til")}</button>
              </>
            ) : (
              <button className="btn ghost sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setShowNew(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>{t("Ný grúppa")}
              </button>
            )}
          </div>
          {channels.map((c) => (
            <div key={c.id} className={`ci${c.id === active ? " on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setActive(c.id)}>
              <span className="avt" style={{ background: c.kind === "general" ? "var(--brand)" : colorOf(c.name) }}>{c.kind === "general" ? <TeamIcon /> : initialsOf(c.name)}</span>
              <div className="tx"><b># {c.name}</b><span>{c.kind === "general" ? t("Allir í fyrirtækinu") : t("Grúppa")}</span></div>
            </div>
          ))}
        </div>
        <div className="cmain">
          <div className="chd">
            <span className="avt" style={{ background: "var(--brand)" }}><TeamIcon /></span> # {activeCh?.name ?? ""}
            <select className="chsel" value={active} onChange={(e) => setActive(e.target.value)}>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="cmsgs">
            {msgs.length ? msgs.map((m) => (
              <div key={m.id} className={`bub ${m.me ? "me" : "them"}`}>
                {!m.me && <><b style={{ fontSize: 11, color: colorOf(m.sender) }}>{m.sender}</b><br /></>}
                {m.body}
                {m.at && <span className="tm">{m.at}</span>}
              </div>
            )) : <div className="muted" style={{ textAlign: "center", padding: 30, fontSize: 13 }}>{t("Engin skilaboð enn — byrjaðu spjallið!")}</div>}
            <div ref={endRef} />
          </div>
          <div className="cinput">
            <input placeholder={t("chat:ph")} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn sm" onClick={send}>{t("chat:send")}</button>
          </div>
        </div>
      </div>
    </>
  );
}

type Msg = { who?: string; whoColor?: string; me?: boolean; text: string; tm: string };
function DemoChat() {
  const { t } = useLang();
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: "Jón", whoColor: "var(--brand)", text: "Góðan dag öll! Munið að skrá ykkur á sumarfríin fyrir föstudag.", tm: "09:14" },
    { me: true, text: "Skráð mig á viku 28", tm: "09:22" },
    { who: "Mína", whoColor: "#18a06a", text: "Sama hér, takk!", tm: "09:25" },
  ]);
  const [val, setVal] = useState("");
  function send() { const v = val.trim(); if (!v) return; setMsgs((m) => [...m, { me: true, text: v, tm: t("chat:now") }]); setVal(""); }
  return (
    <>
      <PageHeader title="Spjall" subtitle="Skilaboð til starfsfólks og stjórnenda" />
      <div className="chat">
        <div className="clist">
          <div className="ci on"><span className="avt" style={{ background: "var(--brand)" }}><TeamIcon /></span><div className="tx"><b>{t("chat:channel")}</b><span>Jón: Munið uppvaskið</span></div></div>
        </div>
        <div className="cmain">
          <div className="chd"><span className="avt" style={{ background: "var(--brand)" }}><TeamIcon /></span> {t("chat:channelFull")}</div>
          <div className="cmsgs">
            {msgs.map((m, i) => (
              <div key={i} className={`bub ${m.me ? "me" : "them"}`}>
                {m.who && <><b style={{ fontSize: 11, color: m.whoColor }}>{m.who}</b><br /></>}{m.text}<span className="tm">{m.tm}</span>
              </div>
            ))}
          </div>
          <div className="cinput">
            <input placeholder={t("chat:ph")} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn sm" onClick={send}>{t("chat:send")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
