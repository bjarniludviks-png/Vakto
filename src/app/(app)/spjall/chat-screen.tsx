"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";

type Msg = { who?: string; whoColor?: string; me?: boolean; text: string; tm: string };

const TeamIcon = () => (
  <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11v2l11 4V7L3 11ZM14 7l5-2v14l-5-2" /></svg>
);

export default function ChatScreen() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: "Jón", whoColor: "var(--brand)", text: "Góðan dag öll! Munið að skrá ykkur á sumarfríin fyrir föstudag.", tm: "09:14" },
    { who: "Jón", whoColor: "var(--brand)", text: "Og munið uppvaskið um helgina", tm: "09:15" },
    { me: true, text: "Skráð mig á viku 28", tm: "09:22" },
    { who: "Mína", whoColor: "#18a06a", text: "Sama hér, takk!", tm: "09:25" },
  ]);
  const [val, setVal] = useState("");
  const { t } = useLang();

  function send() {
    const v = val.trim();
    if (!v) return;
    setMsgs((m) => [...m, { me: true, text: v, tm: t("chat:now") }]);
    setVal("");
  }

  return (
    <>
      <PageHeader title="Spjall" subtitle="Skilaboð til starfsfólks og stjórnenda" />
      <div className="chat">
        <div className="clist">
          <div className="ci on"><span className="avt" style={{ background: "var(--brand)" }}><TeamIcon /></span><div className="tx"><b>{t("chat:channel")}</b><span>Jón: Munið uppvaskið um helgina</span></div></div>
          <div className="ci"><span className="avt" style={{ background: "#5b50e6" }}>MÍ</span><div className="tx"><b>Mína</b><span>Get ég skipt á laugardag?</span></div></div>
          <div className="ci"><span className="avt" style={{ background: "#1fb6a6" }}>BA</span><div className="tx"><b>Bach</b><span>Takk fyrir!</span></div></div>
          <div className="ci"><span className="avt" style={{ background: "#e0533f" }}>ÓM</span><div className="tx"><b>Ómar</b><span>Ég er aðeins of seinn í dag</span></div></div>
        </div>
        <div className="cmain">
          <div className="chd"><span className="avt" style={{ background: "var(--brand)" }}><TeamIcon /></span> {t("chat:channelFull")}</div>
          <div className="cmsgs">
            {msgs.map((m, i) => (
              <div key={i} className={`bub ${m.me ? "me" : "them"}`}>
                {m.who && <><b style={{ fontSize: 11, color: m.whoColor }}>{m.who}</b><br /></>}
                {m.text}
                <span className="tm">{m.tm}</span>
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
