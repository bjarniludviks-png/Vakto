"use client";

import React, { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { hrs, kr, STAGE_LABEL, stageOf, type ClientCard, type JobListItem } from "@/lib/verk";
import { listClientCards, saveClient, saveClientNotes } from "./actions";

// VAKTO Verk, fasi 2: létt CRM — viðskiptavinir með verkum, opnum tilboðum, tímum, rukkuðu og ógreiddu.

const dIS = (iso: string | null) => { if (!iso) return "—"; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso; };

export function ClientsPanel({ jobs, onOpenJob, onChanged }: { jobs: JobListItem[]; onOpenJob: (id: string) => void; onChanged: () => void }) {
  const [cards, setCards] = useState<ClientCard[] | null>(null);
  const [open, setOpen] = useState<ClientCard | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const reload = async () => { const c = await listClientCards(); setCards(c); setOpen((o) => (o ? c.find((x) => x.id === o.id) ?? null : null)); };
  useEffect(() => { void listClientCards().then(setCards); }, []);

  const list = (cards ?? []).filter((c) => !q || `${c.name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const unpaid = (cards ?? []).reduce((a, c) => a + c.unpaid, 0);
  const toInvoice = jobs.filter((j) => stageOf(j) === "done").length;

  return (
    <>
      <div className="kpis vk-kpis">
        <div className="kpi"><div className="lab">Viðskiptavinir</div><div className="val">{cards?.length ?? "—"}</div></div>
        <div className="kpi"><div className="lab">Opin tilboð</div><div className="val">{(cards ?? []).reduce((a, c) => a + c.quotesOpen, 0)}</div></div>
        <div className="kpi"><div className="lab">Lokið, órukkað</div><div className="val">{toInvoice}</div></div>
        <div className="kpi"><div className="lab">Ógreitt</div><div className="val">{kr(unpaid)}</div></div>
      </div>
      <div className="vk-qhead">
        <input className="vk-search" placeholder="Leita að viðskiptavini…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setAdding(true)}>+ Nýr viðskiptavinur</button>
      </div>
      {!cards ? <div className="card vk-empty">Hleð…</div> : list.length === 0 ? <div className="card vk-empty"><b>Engir viðskiptavinir</b><p className="muted">Viðskiptavinir bætast við þegar þú stofnar verk eða tilboð.</p></div> : (
        <div className="vk-list">
          {list.map((c) => (
            <button key={c.id} className="card vk-job" onClick={() => setOpen(c)}>
              <div className="vk-job-t"><b>{c.name}</b><span className="muted">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</span></div>
              <div className="vk-job-n"><b>{c.jobs}</b><span className="muted">verk</span></div>
              <div className="vk-job-n"><b>{hrs(c.hours)}</b><span className="muted">tímar</span></div>
              <div className="vk-job-n"><b>{kr(c.billed)}</b><span className="muted">rukkað</span></div>
              {c.unpaid > 0 ? <span className="vk-pill sent">Ógreitt {kr(c.unpaid)}</span> : c.quotesOpen > 0 ? <span className="vk-pill">{c.quotesOpen} tilboð opin</span> : null}
            </button>
          ))}
        </div>
      )}
      {open && <ClientDrawer c={open} jobs={jobs.filter((j) => j.clientId === open.id)} onClose={() => setOpen(null)} onOpenJob={onOpenJob} onSaved={async () => { await reload(); onChanged(); }} />}
      {adding && <NewClient onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await reload(); onChanged(); }} />}
    </>
  );
}

function ClientDrawer({ c, jobs, onClose, onOpenJob, onSaved }: { c: ClientCard; jobs: JobListItem[]; onClose: () => void; onOpenJob: (id: string) => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(c.notes ?? "");
  const [f, setF] = useState({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", kennitala: c.kennitala ?? "", address: c.address ?? "" });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const [a, b] = await Promise.all([saveClient({ id: c.id, ...f }), saveClientNotes(c.id, notes)]);
    setBusy(false);
    if (!a.ok || !b.ok) { toast(a.error ?? b.error ?? "Tókst ekki"); return; }
    toast("Vistað"); onSaved();
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal vk-qmodal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="vk-cstats">
            <div><b>{c.jobs}</b><span>Verk ({c.openJobs} opin)</span></div>
            <div><b>{hrs(c.hours)}</b><span>Tímar</span></div>
            <div><b>{kr(c.billed)}</b><span>Rukkað</span></div>
            <div><b>{kr(c.unpaid)}</b><span>Ógreitt</span></div>
          </div>
          <h4 className="vk-h4">Verk</h4>
          {jobs.length === 0 ? <p className="muted">Engin verk.</p> : (
            <table className="vk-tbl"><tbody>
              {jobs.map((j) => (
                <tr key={j.id} style={{ cursor: "pointer" }} onClick={() => { onClose(); onOpenJob(j.id); }}>
                  <td><b>{j.title}</b></td><td className="muted">{hrs(j.hoursTotal)}</td>
                  <td className="r"><span className={`vk-pill ${stageOf(j) === "paid" ? "approved" : stageOf(j) === "invoiced" ? "sent" : ""}`}>{STAGE_LABEL[stageOf(j)]}</span></td>
                </tr>
              ))}
            </tbody></table>
          )}
          <h4 className="vk-h4">Upplýsingar</h4>
          <div className="vk-grid2">
            <div className="field"><label>Nafn</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="field"><label>Kennitala</label><input value={f.kennitala} onChange={(e) => setF({ ...f, kennitala: e.target.value })} /></div>
            <div className="field"><label>Netfang</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="field"><label>Sími</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="field"><label>Heimilisfang</label><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="field"><label>Minnispunktar</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="t.d. hringja eftir kl. 16, kóði að hurð 1234, vill fá reikning á fyrirtækið" /></div>
          <p className="muted" style={{ fontSize: 12.5 }}>Síðasta skráning: {dIS(c.lastAt)}</p>
          <div style={{ display: "flex", gap: 9 }}><button className="btn" disabled={busy} onClick={save}>Vista</button><button className="btn ghost" onClick={onClose}>Loka</button></div>
        </div>
      </div>
    </div>
  );
}

function NewClient({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", kennitala: "", address: "" });
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>Nýr viðskiptavinur</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="vk-grid2">
            <div className="field"><label>Nafn</label><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="field"><label>Kennitala</label><input value={f.kennitala} onChange={(e) => setF({ ...f, kennitala: e.target.value })} /></div>
            <div className="field"><label>Netfang</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="field"><label>Sími</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="field"><label>Heimilisfang</label><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" disabled={!f.name.trim()} onClick={async () => { const r = await saveClient(f); if (!r.ok) toast(r.error ?? "Tókst ekki"); else onSaved(); }}>Vista</button>
            <button className="btn ghost" onClick={onClose}>Hætta við</button>
          </div>
        </div>
      </div>
    </div>
  );
}
