"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/app/toast";
import { replySupport, setSupportStatus, markSupportSeen } from "./actions";

export type SupportThread = {
  id: string; name: string; email: string; lang: string; status: "bot" | "human" | "closed"; page: string;
  createdAt: string; updatedAt: string; unread: boolean;
  messages: { id: string; role: "user" | "assistant" | "owner"; body: string; at: string }[];
};

const when = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  bot: { label: "AI svarar", bg: "#eef0f4", fg: "#556" },
  human: { label: "Bíður þín", bg: "#fdebd9", fg: "#b4530a" },
  closed: { label: "Lokað", bg: "#e8f5ef", fg: "#1f9d6b" },
};

export default function SupportScreen({ threads, initialId, needsMigration }: { threads: SupportThread[]; initialId: string | null; needsMigration: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(initialId ?? threads[0]?.id ?? null);
  const [val, setVal] = useState("");
  const [pending, start] = useTransition();
  const cur = useMemo(() => threads.find((t) => t.id === sel) ?? null, [threads, sel]);

  // Ný skilaboð birtast án þess að endurhlaða handvirkt.
  useEffect(() => { const iv = setInterval(() => router.refresh(), 8000); return () => clearInterval(iv); }, [router]);
  useEffect(() => { if (cur?.unread) void markSupportSeen(cur.id); }, [cur?.id, cur?.unread]);

  function reply() {
    if (!cur || !val.trim()) return;
    const body = val; setVal("");
    start(async () => {
      const r = await replySupport(cur.id, body);
      if (!r.ok) { toast(r.error ?? "Tókst ekki"); setVal(body); return; }
      router.refresh();
    });
  }
  function setStatus(s: "human" | "closed") {
    if (!cur) return;
    start(async () => { await setSupportStatus(cur.id, s); router.refresh(); });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Spjall af heimasíðunni</h1>
        <a href="/admin" style={{ fontSize: 13, color: "var(--brand)" }}>← Yfirlit</a>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ink3)" }}>{threads.filter((t) => t.status === "human").length} bíða · {threads.length} samtöl</span>
      </div>
      {needsMigration && <div className="card" style={{ padding: 14, marginBottom: 14, color: "var(--bad)" }}>Töflurnar vantar — keyra þarf migration 0049_support_chat.sql.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, minHeight: 520 }}>
        <div className="card" style={{ padding: 0, overflow: "auto", maxHeight: "72vh" }}>
          {threads.length === 0 && <div style={{ padding: 18, color: "var(--ink3)", fontSize: 13.5 }}>Engin samtöl enn.</div>}
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            const st = STATUS[t.status];
            return (
              <button key={t.id} onClick={() => setSel(t.id)} style={{
                display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", border: 0, borderBottom: "1px solid var(--line)",
                background: t.id === sel ? "var(--brand-soft, #fdf1e7)" : "transparent", padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 13.5 }}>{t.name || t.email || "Gestur"}</b>
                  {t.unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--brand)" }} />}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink3)" }}>{when(t.updatedAt)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last?.body ?? "—"}</div>
                <span className="tag" style={{ marginTop: 6, background: st.bg, color: st.fg, fontSize: 10.5 }}>{st.label}</span>
              </button>
            );
          })}
        </div>
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: "72vh" }}>
          {!cur ? <div style={{ padding: 18, color: "var(--ink3)" }}>Veldu samtal.</div> : (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <b style={{ fontSize: 14.5 }}>{cur.name || "Gestur"}</b>
                  {cur.email && <a href={`mailto:${cur.email}`} style={{ marginLeft: 8, fontSize: 12.5, color: "var(--brand)" }}>{cur.email}</a>}
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{cur.lang.toUpperCase()} · {cur.page || "/"} · byrjaði {when(cur.createdAt)}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {cur.status !== "human" && <button className="btn ghost" style={{ fontSize: 12.5 }} disabled={pending} onClick={() => setStatus("human")}>Taka við samtali</button>}
                  {cur.status !== "closed" && <button className="btn ghost" style={{ fontSize: 12.5 }} disabled={pending} onClick={() => setStatus("closed")}>Loka</button>}
                </div>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {cur.messages.map((m) => (
                  <div key={m.id} style={{
                    alignSelf: m.role === "owner" ? "flex-end" : "flex-start", maxWidth: "78%", fontSize: 13.5, lineHeight: 1.5, padding: "8px 12px", borderRadius: 14, whiteSpace: "pre-wrap",
                    background: m.role === "owner" ? "var(--brand)" : m.role === "assistant" ? "#f1f1f4" : "#fff", color: m.role === "owner" ? "#fff" : "var(--ink)",
                    border: m.role === "user" ? "1px solid var(--line)" : "0",
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", opacity: .7, marginBottom: 2 }}>{m.role === "owner" ? "ÞÚ" : m.role === "assistant" ? "AI" : (cur.name || "GESTUR").toUpperCase()} · {when(m.at)}</div>
                    {m.body}
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); reply(); }} style={{ borderTop: "1px solid var(--line)", padding: 12, display: "flex", gap: 8 }}>
                <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={cur.status === "closed" ? "Samtalinu er lokað — svar opnar það aftur" : "Skrifaðu svar… (gesturinn sér það strax og fær póst)"} style={{ flex: 1, font: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)" }} />
                <button className="btn" type="submit" disabled={pending || !val.trim()}>Senda</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
