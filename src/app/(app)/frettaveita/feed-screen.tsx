"use client";

// Fréttaveita — the company feed as its own screen. Facebook-style:
// composer with image/document attach, posts with media, emoji reactions
// (one per user, pick from a small palette) and comment threads.

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import {
  listPosts, createPost, setPostReaction, addPostComment, uploadChatMedia, setPostPinned,
  type FeedPost,
} from "../spjall/actions";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"];

export default function FeedScreen() {
  const { t } = useLang();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [canPin, setCanPin] = useState(false);
  const [mePhoto, setMePhoto] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState<{ imageUrl?: string; fileUrl?: string; fileName?: string } | null>(null);
  const [openC, setOpenC] = useState<Record<string, boolean>>({});
  const [cVal, setCVal] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function reload() { listPosts().then((r) => { if (r.ok) { setPosts(r.posts); setCanPin(r.canPin); setMePhoto(r.mePhoto); } setLoaded(true); }); }
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
        {/* composer — FB-style: avatar + pill that grows into a textarea */}
        <div className="feed-post fc2" style={{ marginBottom: 16 }}>
          <div className="fc2-row">
            {mePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avt-img" src={mePhoto} alt="" style={{ width: 40, height: 40 }} />
            ) : (
              <span className="avt fc2-me">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
              </span>
            )}
            <textarea className="fc-input" rows={val || attach ? 3 : 1} placeholder={t("Hvað er að frétta hjá þér?")} value={val} onChange={(e) => setVal(e.target.value)} />
          </div>
          {attach?.imageUrl && (
            <div style={{ position: "relative", marginTop: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="fp-img" style={{ borderRadius: 12 }} src={attach.imageUrl} alt="" />
              <button className="x" style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 999, width: 28, height: 28, border: 0, cursor: "pointer" }} onClick={() => setAttach(null)}>✕</button>
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
            <button className="fc-act img" onClick={() => pickFile("image")} disabled={busy}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
              {t("Mynd")}
            </button>
            <button className="fc-act doc" onClick={() => pickFile("file")} disabled={busy}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.4 11.05 12.6 19.9a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.83 1.83 0 0 1-2.6-2.6l8-7.9" /></svg>
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

        {posts.map((p) => {
          const totalReacts = p.reactions.reduce((a, r) => a + r.count, 0);
          const showC = openC[p.id] || p.comments.length > 0;
          return (
            <div className={`feed-post fp2${p.pinned ? " pinned" : ""}`} key={p.id} style={{ marginBottom: 14 }}>
              {p.pinned && (
                <div className="fp-pinbadge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-6 2-4 8-2-2-5 5-1-1 5-5-2-2 8-4z" /></svg>
                  {t("Fest tilkynning")}
                </div>
              )}
              <div className="fp-head">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="avt-img" src={p.photo} alt="" style={{ width: 42, height: 42 }} />
                ) : (
                  <span className="avt" style={{ background: p.color, width: 42, height: 42, fontSize: p.system ? 19 : 14 }}>{p.av}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14.5 }}>{p.sender}</b>
                  <span className="muted" style={{ fontSize: 12, display: "block", marginTop: 1 }}>{p.at}</span>
                </div>
                {canPin && !p.system && (
                  <button className="fp-pin" title={p.pinned ? t("Losa tilkynningu") : t("Festa efst sem tilkynningu")}
                    onClick={async () => { const r = await setPostPinned(p.id, !p.pinned); if (r.ok) reload(); else toast(r.error ?? "Villa"); }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={p.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path d="M16 3l5 5-6 2-4 8-2-2-5 5-1-1 5-5-2-2 8-4z" /></svg>
                  </button>
                )}
              </div>
              {p.body && <p className="fp-body">{p.body}</p>}
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fp-img full" src={p.imageUrl} alt="" loading="lazy" onClick={() => window.open(p.imageUrl!, "_blank")} />
              )}
              {p.fileUrl && (
                <a className="fp-file" href={p.fileUrl} target="_blank" rel="noreferrer">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                  {p.fileName ?? t("Skjal")}
                </a>
              )}

              {/* summary row: overlapping reaction emojis + counts (FB-style) */}
              {(totalReacts > 0 || p.comments.length > 0) && (
                <div className="fp-sum2">
                  {totalReacts > 0 && (
                    <span className="emo">
                      <span className="stack">{p.reactions.slice(0, 3).map((rr) => <i key={rr.emoji}>{rr.emoji}</i>)}</span>
                      {totalReacts}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  {p.comments.length > 0 && (
                    <button className="lnk" onClick={() => setOpenC((v) => ({ ...v, [p.id]: !v[p.id] }))}>
                      {p.comments.length} {t("athugasemdir")}
                    </button>
                  )}
                </div>
              )}

              {/* action row: two equal, borderless buttons with hover picker */}
              <div className="fp-actrow" style={{ position: "relative" }}
                onMouseLeave={() => picker === p.id && setPicker(null)}>
                <button
                  className={p.myReaction ? "on" : ""}
                  onMouseEnter={() => setPicker(p.id)}
                  onClick={() => (p.myReaction ? react(p, p.myReaction) : setPicker(picker === p.id ? null : p.id))}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{p.myReaction ?? "👍"}</span>
                  {p.myReaction ? t("Þín viðbrögð") : t("Bregðast við")}
                </button>
                <button onClick={() => setOpenC((v) => ({ ...v, [p.id]: !v[p.id] }))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" /></svg>
                  {t("Athugasemd")}
                </button>
                {picker === p.id && (
                  <div className="fp-picker pop">
                    {REACTIONS.map((e) => (
                      <button key={e} className={p.myReaction === e ? "on" : ""} onClick={() => react(p, e)}>{e}</button>
                    ))}
                  </div>
                )}
              </div>

              {showC && (
                <div className="fp-comments">
                  {p.comments.map((cm) => (
                    <div className="fp-c" key={cm.id}>
                      {cm.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="avt-img" src={cm.photo} alt="" style={{ width: 28, height: 28 }} />
                      ) : (
                        <span className="avt" style={{ background: cm.color, width: 28, height: 28, fontSize: 10.5 }}>{cm.av}</span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="fp-cb"><b>{cm.sender}</b><span className="cm-body">{cm.body}</span></div>
                        <span className="muted" style={{ fontSize: 10.5, marginLeft: 12 }}>{cm.at}</span>
                      </div>
                    </div>
                  ))}
                  <div className="fp-cin">
                    <input placeholder={t("Skrifaðu athugasemd…")} value={cVal[p.id] ?? ""} onChange={(e) => setCVal((v) => ({ ...v, [p.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && comment(p)} />
                    <button className="fp-send" disabled={!(cVal[p.id] ?? "").trim()} onClick={() => comment(p)} aria-label={t("Senda")}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
