"use client";

import React, { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { kr, quoteTotals, LINE_KIND, type Client, type Quote, type QuoteLine } from "@/lib/verk";
import { listQuotes, saveQuote, deleteQuote, sendQuote } from "./actions";

// VAKTO Verk, fasi 2: tilboð — drög (handvirkt eða með VAKTO AI), sending sem hlekkur, samþykkt verður að verki.

const dIS = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])}.${Number(m[2])}.` : iso; };
const STATUS: Record<Quote["status"], string> = { draft: "Drög", sent: "Sent", accepted: "Samþykkt", declined: "Hafnað" };
const plus30 = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
/** Opnar póstforritið með tilbúnum pósti. */
const openMail = (url: string) => window.location.assign(url);
const DEFAULT_TERMS = "Verð á efni er áætlað og getur breyst. Aukaverk eru unnin á tímagjaldi samkvæmt samkomulagi. Greiðsla innan 14 daga frá reikningi.";

export function QuotesPanel({ clients, onOpenJob, onChanged }: { clients: Client[]; onOpenJob: (id: string) => void; onChanged: () => void }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [edit, setEdit] = useState<Quote | "new" | null>(null);
  const reload = async () => setQuotes(await listQuotes());
  useEffect(() => { void listQuotes().then(setQuotes); }, []);

  async function send(q: Quote) {
    const r = await sendQuote(q.id);
    if (!r.ok || !r.url) { toast(r.error ?? "Tókst ekki"); return; }
    await navigator.clipboard?.writeText(r.url).catch(() => {});
    toast("Hlekkur afritaður — sendu viðskiptavininum");
    if (r.email) openMail(`mailto:${r.email}?subject=${encodeURIComponent(`Tilboð: ${q.title}`)}&body=${encodeURIComponent(`Sæl/l,\n\nHér er tilboð í ${q.title}:\n${r.url}\n\nÞú getur samþykkt það beint á síðunni.\n\nKveðja`)}`);
    await reload();
  }

  return (
    <>
      <div className="vk-qhead">
        <p className="muted">Sendu tilboð sem viðskiptavinurinn samþykkir sem verksamning — samþykkt tilboð verður sjálfkrafa að verki.</p>
        <button className="btn" onClick={() => setEdit("new")}>+ Nýtt tilboð</button>
      </div>
      {!quotes ? <div className="card vk-empty">Hleð…</div> : quotes.length === 0 ? (
        <div className="card vk-empty"><b>Engin tilboð enn</b><p className="muted">Lýstu verkinu og láttu VAKTO AI skrifa drög að tilboði, eða skrifaðu það sjálf/ur.</p><button className="btn" onClick={() => setEdit("new")}>+ Nýtt tilboð</button></div>
      ) : (
        <div className="vk-list">
          {quotes.map((q) => {
            const t = quoteTotals(q.items);
            return (
              <div key={q.id} className="card vk-job" role="button" tabIndex={0} onClick={() => (q.jobId ? onOpenJob(q.jobId) : setEdit(q))}>
                <div className="vk-job-t"><b>#{q.number} · {q.title}</b><span className="muted">{[q.client, q.status === "sent" && q.sentAt ? `Sent ${dIS(q.sentAt)}` : null, q.signedName ? `${q.status === "accepted" ? "Samþykkt" : "Hafnað"} af ${q.signedName}` : null].filter(Boolean).join(" · ") || "—"}</span></div>
                <div className="vk-job-n"><b>{kr(t.total)}</b><span className="muted">m. vsk.</span></div>
                <span className={`vk-pill ${q.status === "accepted" ? "approved" : q.status === "declined" ? "rejected" : q.status === "sent" ? "sent" : ""}`}>{STATUS[q.status]}</span>
                {q.status === "draft" ? <button className="btn sm" onClick={(e) => { e.stopPropagation(); void send(q); }}>Senda</button>
                  : q.status === "sent" ? <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); void send(q); }}>Afrita hlekk</button>
                  : q.jobId ? <span className="vk-link">Opna verk ›</span> : null}
              </div>
            );
          })}
        </div>
      )}
      {edit && <QuoteModal quote={edit === "new" ? null : edit} clients={clients} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await reload(); onChanged(); }} />}
    </>
  );
}

function QuoteModal({ quote, clients, onClose, onSaved }: { quote: Quote | null; clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const locked = !!quote && quote.status !== "draft";
  const [title, setTitle] = useState(quote?.title ?? "");
  const [clientId, setClientId] = useState(quote?.clientId ?? "");
  const [address, setAddress] = useState(quote?.address ?? "");
  const [description, setDescription] = useState(quote?.description ?? "");
  const [items, setItems] = useState<QuoteLine[]>(quote?.items ?? [{ kind: "labor", description: "Vinna", quantity: 8, unit: "klst.", unitPrice: 9500 }]);
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? plus30());
  const [terms, setTerms] = useState(quote?.terms ?? DEFAULT_TERMS);
  const [ai, setAi] = useState("");
  const [rate, setRate] = useState("9500");
  const [busy, setBusy] = useState<"" | "ai" | "save">("");
  const t = quoteTotals(items);
  const setLine = (i: number, patch: Partial<QuoteLine>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const n = (v: string) => Number(v.replace(",", ".")) || 0;

  async function draftWithAi() {
    setBusy("ai");
    const r = await fetch("/api/verk/ai-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: ai, rate, address }) })
      .then((x) => x.json() as Promise<{ ok?: boolean; error?: string; draft?: { title: string; description: string; items: QuoteLine[]; assumptions: string } }>).catch(() => null);
    setBusy("");
    if (!r?.ok || !r.draft) { toast(r?.error ?? "VAKTO AI gat ekki skrifað tilboð"); return; }
    if (!title.trim()) setTitle(r.draft.title);
    setDescription(r.draft.description);
    setItems(r.draft.items);
    if (r.draft.assumptions) setTerms(`${r.draft.assumptions}\n\n${DEFAULT_TERMS}`);
    toast("Drög tilbúin — farðu yfir og breyttu");
  }

  async function save(andSend = false) {
    setBusy("save");
    const r = await saveQuote({ id: quote?.id, title, clientId: clientId || null, address, description, items, validUntil, terms });
    if (!r.ok || !r.id) { setBusy(""); toast(r.error ?? "Tókst ekki"); return; }
    if (andSend) {
      const s = await sendQuote(r.id);
      if (s.ok && s.url) {
        await navigator.clipboard?.writeText(s.url).catch(() => {});
        toast("Tilboð sent — hlekkur afritaður");
        if (s.email) openMail(`mailto:${s.email}?subject=${encodeURIComponent(`Tilboð: ${title}`)}&body=${encodeURIComponent(`Sæl/l,\n\nHér er tilboð í ${title}:\n${s.url}\n\nÞú getur samþykkt það beint á síðunni.\n\nKveðja`)}`);
      } else toast(s.error ?? "Sending tókst ekki");
    } else toast("Drög vistuð");
    setBusy("");
    onSaved();
  }

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal vk-qmodal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{quote ? `Tilboð #${quote.number}` : "Nýtt tilboð"}{locked ? ` · ${STATUS[quote!.status]}` : ""}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {!locked && (
            <div className="vk-ai">
              <div className="vk-ai-h"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /></svg> VAKTO AI skrifar drög</div>
              <textarea rows={2} value={ai} onChange={(e) => setAi(e.target.value)} placeholder="Lýstu verkinu, t.d. „Baðherbergi 8 fm: rífa gamlar flísar, vatnsvörn, nýjar flísar á gólf og veggi, nýtt salerni og blöndunartæki“" />
              <div className="vk-ai-r"><label>Tímagjald <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /> kr.</label><button className="btn sm" disabled={busy !== "" || ai.trim().length < 8} onClick={draftWithAi}>{busy === "ai" ? "Skrifa…" : "Skrifa drög"}</button></div>
            </div>
          )}
          <div className="vk-grid2">
            <div className="field"><label>Heiti</label><input value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} placeholder="t.d. Endurnýjun baðherbergis" /></div>
            <div className="field"><label>Viðskiptavinur</label><select value={clientId} disabled={locked} onChange={(e) => setClientId(e.target.value)}><option value="">Enginn</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Heimilisfang verks</label><input value={address} disabled={locked} onChange={(e) => setAddress(e.target.value)} /></div>
            <div className="field"><label>Gildir til</label><input type="date" value={validUntil ?? ""} disabled={locked} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>
          <div className="field"><label>Lýsing fyrir viðskiptavininn</label><textarea rows={3} value={description} disabled={locked} onChange={(e) => setDescription(e.target.value)} /></div>
          <table className="vk-tbl vk-lines">
            <thead><tr><th>Tegund</th><th>Lýsing</th><th className="r">Magn</th><th>Eining</th><th className="r">Verð án vsk.</th><th className="r">Samtals</th><th /></tr></thead>
            <tbody>
              {items.map((l, i) => (
                <tr key={i}>
                  <td><select value={l.kind} disabled={locked} onChange={(e) => setLine(i, { kind: e.target.value as QuoteLine["kind"], unit: e.target.value === "labor" ? "klst." : l.unit })}>{(Object.keys(LINE_KIND) as QuoteLine["kind"][]).map((k) => <option key={k} value={k}>{LINE_KIND[k]}</option>)}</select></td>
                  <td><input value={l.description} disabled={locked} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                  <td className="r"><input className="num" inputMode="decimal" value={String(l.quantity)} disabled={locked} onChange={(e) => setLine(i, { quantity: n(e.target.value) })} /></td>
                  <td><input className="unit" value={l.unit} disabled={locked} onChange={(e) => setLine(i, { unit: e.target.value })} /></td>
                  <td className="r"><input className="num" inputMode="decimal" value={String(l.unitPrice)} disabled={locked} onChange={(e) => setLine(i, { unitPrice: n(e.target.value) })} /></td>
                  <td className="r"><b>{kr(l.quantity * l.unitPrice)}</b></td>
                  <td className="r">{!locked && <button className="vk-x" onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!locked && <button className="vk-link" onClick={() => setItems((xs) => [...xs, { kind: "material", description: "", quantity: 1, unit: "stk.", unitPrice: 0 }])}>+ Bæta við línu</button>}
          <dl className="vk-qsum">
            <dt>Vinna</dt><dd>{kr(t.labor)}</dd><dt>Efni og annað</dt><dd>{kr(t.materials + t.other)}</dd>
            <dt>Vsk. 24 %</dt><dd>{kr(t.vsk)}</dd><dt className="tot">Samtals</dt><dd className="tot">{kr(t.total)}</dd>
          </dl>
          <div className="field"><label>Skilmálar</label><textarea rows={3} value={terms ?? ""} disabled={locked} onChange={(e) => setTerms(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {!locked && <button className="btn" disabled={busy !== "" || !title.trim()} onClick={() => save(true)}>Vista og senda</button>}
            {!locked && <button className="btn ghost" disabled={busy !== "" || !title.trim()} onClick={() => save(false)}>Vista drög</button>}
            {quote && (quote.status === "draft" || quote.status === "declined") && <button className="btn ghost" onClick={async () => { if (!window.confirm("Eyða tilboði?")) return; const r = await deleteQuote(quote.id); if (!r.ok) toast(r.error ?? "Tókst ekki"); else onSaved(); }}>Eyða</button>}
            {locked && <a className="btn ghost" href={`/tilbod/${quote!.token}`} target="_blank" rel="noreferrer">Opna síðu viðskiptavinar</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
