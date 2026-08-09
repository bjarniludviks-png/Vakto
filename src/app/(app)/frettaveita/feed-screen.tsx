"use client";

// Fréttaveita — the company feed as its own screen. Facebook-style:
// composer with image/document attach, posts with media, emoji reactions
// (one per user, pick from a small palette) and comment threads.

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import {
  listPosts, createPost, setPostReaction, addPostComment, uploadChatMedia,
  type FeedPost,
} from "../spjall/actions";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"];

export default function FeedScreen() {
  const { t } = useLang();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState<{ imageUrl?: string; fileUrl?: string; fileName?: string } | null>(null);
  const [openC, setOpenC] = useState<Record<string, boolean>>({});
  const [cVal, setCVal] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function reload() { listPosts().then((r) => { if (r.ok) setPosts(r.posts); setLoaded(true); }); }
  useEffect(() => { reload(); const iv = setInterval(reload, 10000); return () => clearInterval(iv); }, []);

  function pickFile(kind: "image" | "file") {
    (kind === "image" ? imgRef : fileRef).current?.click();
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "file") {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.size > 8 * 1024 * 1024) { toast(t("Skráin má mest vera 8 MB")); return; }
    const r = new FileReader();
    r.onload = async () => {
      setBusy(true);
      const ext = (f.name.split(".").pop() || "bin").toLowerCase();
      const up = await uploadChatMedia(r.result as string, ext);
      setBusy(false);
      if (!up.ok || !up.url) { toast(up.error === "demo" ? t("Virkar þegar Supabase er tengt") : (up.error ?? "Villa")); return; }
      setAttach(kind === "image" ? { imageUrl: up.url } : { fileUrl: up.url, fileName: f.name });
    };
    r.readAsDataURL(f);
  }

  async function post() {
    if (!val.trim() && !attach) return;
    setBusy(true);
    const r = await createPost(val, attach ?? undefined);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    setVal(""); setAttach(null); reload();
  }

  async function react(p: FeedPost, emoji: string) {
    const next = p.myReaction === emoji ? null : emoji;
    setPicker(null);
    setPosts((ps) => ps.map((x) => {
      if (x.id !== p.id) return x;
      const counts = new Map(x.reactions.map((rr) => [rr.emoji, rr.count]));
      if (x.myReaction) counts.set(x.myReaction, Math.max(0, (counts.get(x.myReaction) ?? 1) - 1));
      if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
      return { ...x, myReaction: next, reactions: [...counts.entries()].filter(([, n]) => n > 0).map(([emoji2, count]) => ({ emoji: emoji2, count })).sort((a, b) => b.count - a.count) };
    }));
    await setPostReaction(p.id, next);
  }

  async function comment(p: FeedPost) {
    const body = (cVal[p.id] ?? "").trim();
    if (!body) return;
    setCVal((v) => ({ ...v, [p.id]: "" }));
    const r = await addPostComment(p.id, body);
    if (!r.ok) toast(r.error ?? "Villa"); else reload();
  }

  return (
    <>
      <PageHeader title="Fréttaveita" subtitle="Fréttir, tilkynningar og stemning fyrirtækisins" />
      <div className="feedwrap">
        {/* composer */}
        <div className="feed-post" style={{ marginBottom: 16 }}>
          <textarea className="fc-input" rows={2} placeholder={t("Deildu fréttum með teyminu…")} value={val} onChange={(e) => setVal(e.target.value)} />
          {attach?.imageUrl && (
            <div style={{ position: "relative", marginTop: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="fp-img" src={attach.imageUrl} alt="" />
              <button className="x" style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 8, padding: "2px 8px" }} onClick={() => setAttach(null)}>✕</button>
            </div>
          )}
          {attach?.fileUrl && (
            <div className="fp-file" style={{ marginTop: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
              <span style={{ flex: 1 }}>{attach.fileName}</span>
              <button className="x" onClick={() => setAttach(null)}>✕</button>
            </div>
          )}
          <div className="fc-bar">
            <button className="fc-act" onClick={() => pickFile("image")} disabled={busy}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
              {t("Mynd")}
            </button>
            <button className="fc-act" onClick={() => pickFile("file")} disabled={busy}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.4 11.05 12.6 19.9a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.83 1.83 0 0 1-2.6-2.6l8-7.9" /></svg>
              {t("Skjal")}
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn sm" disabled={busy || (!val.trim() && !attach)} onClick={post}>{t("Birta")}</button>
          </div>
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e, "image")} />
          <input ref={fileRef} type="file" hidden onChange={(e) => onFile(e, "file")} />
        </div>

        {loaded && posts.length === 0 && (
          <div className="muted" style={{ textAlign: "center", padding: 40, fontSize: 13.5 }}>{t("Engar fréttir enn — skrifaðu fyrstu færsluna!")}</div>
        )}

        {posts.map((p) => (
          <div className="feed-post" key={p.id} style={{ marginBottom: 14 }}>
            <div className="fp-head">
              <span className="avt" style={{ background: p.color, width: 38, height: 38, fontSize: 13 }}>{p.av}</span>
              <div><b>{p.sender}</b><span className="muted" style={{ fontSize: 11.5, display: "block" }}>{p.at}</span></div>
            </div>
            {p.body && <p className="fp-body">{p.body}</p>}
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="fp-img" src={p.imageUrl} alt="" loading="lazy" onClick={() => window.open(p.imageUrl!, "_blank")} />
            )}
            {p.fileUrl && (
              <a className="fp-file" href={p.fileUrl} target="_blank" rel="noreferrer">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                {p.fileName ?? t("Skjal")}
              </a>
            )}
            {p.reactions.length > 0 && (
              <div className="fp-sum">{p.reactions.map((rr) => <span key={rr.emoji}>{rr.emoji} {rr.count}</span>)}</div>
            )}
            <div className="fp-actions" style={{ position: "relative" }}>
              <button className={p.myReaction ? "on" : ""} onClick={() => setPicker(picker === p.id ? null : p.id)}>
                {p.myReaction ?? "👍"} {p.myReaction ? t("Þín viðbrögð") : t("Bregðast við")}
              </button>
              <button onClick={() => setOpenC((v) => ({ ...v, [p.id]: !v[p.id] }))}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" /></svg>
                {p.comments.length > 0 ? `${p.comments.length} ${t("athugasemdir")}` : t("Athugasemd")}
              </button>
              {picker === p.id && (
                <div className="fp-picker">
                  {REACTIONS.map((e) => (
                    <button key={e} className={p.myReaction === e ? "on" : ""} onClick={() => react(p, e)}>{e}</button>
                  ))}
                </div>
              )}
            </div>
            {(openC[p.id] || p.comments.length > 0) && (
              <div className="fp-comments">
                {p.comments.map((cm) => (
                  <div className="fp-c" key={cm.id}>
                    <span className="avt" style={{ background: cm.color, width: 26, height: 26, fontSize: 10 }}>{cm.av}</span>
                    <div className="fp-cb"><b>{cm.sender}</b> {cm.body} <span className="muted" style={{ fontSize: 10.5 }}>{cm.at}</span></div>
                  </div>
                ))}
                {openC[p.id] && (
                  <div className="fp-cin">
                    <input placeholder={t("Skrifaðu athugasemd…")} value={cVal[p.id] ?? ""} onChange={(e) => setCVal((v) => ({ ...v, [p.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && comment(p)} />
                    <button className="btn ghost sm" onClick={() => comment(p)}>{t("Senda")}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
