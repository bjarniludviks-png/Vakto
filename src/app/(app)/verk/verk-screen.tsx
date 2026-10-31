"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { hrs, jobTotals, kr, type Client, type JobDetail } from "@/lib/verk";
import {
  listJobs, getJob, saveClient, saveJob, setJobStatus, startTimer, stopTimer, addEntry, deleteEntry,
  addItem, deleteItem, addPhoto, deletePhoto, createReport,
} from "./actions";

// VAKTO Verk (0102): verk, viðskiptavinir, tímataka (með staðsetningu), efni, myndir og verkskýrsla til samþykktar.

type List = Awaited<ReturnType<typeof listJobs>>;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const dIS = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])}.${Number(m[2])}.` : iso; };
const hm = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/** Staðsetning úr vafranum (null ef ekki leyft / tekst ekki á 6 sek.). */
function position(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 6000, maximumAge: 60000 });
  });
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return <>{`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`}</>;
}

export default function VerkScreen() {
  const [list, setList] = useState<List | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [modal, setModal] = useState<"job" | null>(null);

  const reload = useCallback(async () => setList(await listJobs()), []);
  useEffect(() => { void listJobs().then(setList); }, []);

  const running = list?.running ?? null;
  const runningJob = running ? list?.jobs.find((j) => j.id === running.jobId) : null;
  const jobs = (list?.jobs ?? []).filter((j) => filter === "all" ? j.status !== "archived" : j.status === filter);

  async function stop() {
    const km = window.prompt("Akstur á verkið (km) — sleppa = 0", "0");
    if (km === null) return;
    const r = await stopTimer({ km, pos: await position() });
    if (!r.ok) toast(r.error ?? "Tókst ekki"); else { toast("Tímataka stöðvuð"); void reload(); }
  }

  if (openId) return <JobView id={openId} companyId={list?.companyId ?? ""} clients={list?.clients ?? []} running={running} onBack={() => { setOpenId(null); void reload(); }} onChanged={reload} />;

  return (
    <div className="page">
      <PageHeader title="Verk" subtitle="Verk, tímar, myndir og verkskýrslur til samþykktar" actions={<button className="btn" onClick={() => setModal("job")}>+ Nýtt verk</button>} />

      {running && runningJob && (
        <div className="vk-run">
          <span className="vk-dot" />
          <div className="vk-run-t"><b>{runningJob.title}</b><span>{runningJob.client ?? runningJob.address ?? ""}</span></div>
          <div className="vk-run-c"><Elapsed since={running.startedAt} /></div>
          <button className="btn" onClick={stop}>Stöðva</button>
        </div>
      )}

      <div className="vk-tabs">
        {(["open", "done", "all"] as const).map((f) => <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "open" ? "Opin" : f === "done" ? "Lokið" : "Öll"}</button>)}
      </div>

      {!list ? <div className="card vk-empty">Hleð…</div> : jobs.length === 0 ? (
        <div className="card vk-empty">
          <b>{filter === "open" ? "Engin opin verk" : "Ekkert hér"}</b>
          <p className="muted">Stofnaðu verk, byrjaðu tímatöku á staðnum og sendu viðskiptavininum verkskýrslu til samþykktar.</p>
          <button className="btn" onClick={() => setModal("job")}>+ Nýtt verk</button>
        </div>
      ) : (
        <div className="vk-list">
          {jobs.map((j) => (
            <button key={j.id} className={`card vk-job${j.running ? " live" : ""}`} onClick={() => setOpenId(j.id)}>
              <div className="vk-job-t"><b>{j.title}</b><span className="muted">{[j.client, j.address].filter(Boolean).join(" · ") || "—"}</span></div>
              <div className="vk-job-n"><b>{hrs(j.hoursMonth)}</b><span className="muted">í mánuðinum</span></div>
              <div className="vk-job-n"><b>{hrs(j.hoursTotal)}</b><span className="muted">samtals</span></div>
              {j.running ? <span className="vk-pill live">Í gangi</span> : j.status === "done" ? <span className="vk-pill">Lokið</span> : null}
            </button>
          ))}
        </div>
      )}

      {modal === "job" && <JobModal clients={list?.clients ?? []} onClose={() => setModal(null)} onSaved={(id) => { setModal(null); void reload(); setOpenId(id); }} />}
    </div>
  );
}

function JobModal({ job, clients, onClose, onSaved }: { job?: JobDetail; clients: Client[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState(job?.title ?? "");
  const [clientId, setClientId] = useState(job?.client?.id ?? "");
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", kennitala: "" });
  const [address, setAddress] = useState(job?.address ?? "");
  const [rate, setRate] = useState(job?.hourlyRate != null ? String(job.hourlyRate) : "");
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(job?.lat != null && job?.lng != null ? { lat: job.lat, lng: job.lng } : null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    let cid = clientId === "new" ? "" : clientId;
    if (clientId === "new") {
      const c = await saveClient(newClient);
      if (!c.ok) { setBusy(false); toast(c.error ?? "Tókst ekki"); return; }
      cid = c.id ?? "";
    }
    const r = await saveJob({ id: job?.id, title, clientId: cid || null, address, hourlyRate: rate, notes, lat: pos?.lat ?? null, lng: pos?.lng ?? null });
    setBusy(false);
    if (!r.ok || !r.id) { toast(r.error ?? "Tókst ekki"); return; }
    onSaved(r.id);
  }

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{job ? "Breyta verki" : "Nýtt verk"}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="field"><label>Heiti verks</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.d. Baðherbergi, Laugavegi 5" autoFocus /></div>
          <div className="field">
            <label>Viðskiptavinur</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Enginn</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ Nýr viðskiptavinur</option>
            </select>
          </div>
          {clientId === "new" && (
            <div className="vk-grid2">
              <div className="field"><label>Nafn</label><input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></div>
              <div className="field"><label>Netfang</label><input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /></div>
              <div className="field"><label>Sími</label><input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></div>
              <div className="field"><label>Kennitala</label><input value={newClient.kennitala} onChange={(e) => setNewClient({ ...newClient, kennitala: e.target.value })} /></div>
            </div>
          )}
          <div className="field">
            <label>Heimilisfang verkstaðar</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Gata og númer, bær" />
            <button type="button" className="vk-link" onClick={async () => { const p = await position(); if (p) { setPos(p); toast("Staðsetning vistuð"); } else toast("Fékk ekki staðsetningu"); }}>
              {pos ? "✓ Staðsetning verkstaðar vistuð — uppfæra" : "Nota núverandi staðsetningu sem verkstað"}
            </button>
          </div>
          <div className="field"><label>Tímagjald (kr. án vsk.)</label><input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="t.d. 9500" /></div>
          <div className="field"><label>Athugasemdir</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" disabled={busy || !title.trim()} onClick={save}>{job ? "Vista" : "Stofna verk"}</button>
            <button className="btn ghost" onClick={onClose}>Hætta við</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobView({ id, companyId, clients, running, onBack, onChanged }: { id: string; companyId: string; clients: Client[]; running: List["running"]; onBack: () => void; onChanged: () => void }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [tab, setTab] = useState<"time" | "items" | "photos" | "reports">("time");
  const [edit, setEdit] = useState(false);
  const [entry, setEntry] = useState({ date: today(), start: "08:00", end: "16:00", km: "", note: "" });
  const [item, setItem] = useState({ kind: "material" as "material" | "expense", description: "", quantity: "1", unitPrice: "" });
  const [period, setPeriod] = useState({ from: monthStart(), to: today() });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { const r = await getJob(id); if (r.ok && r.job) setJob(r.job); else toast(r.error ?? "Verk fannst ekki"); }, [id]);
  useEffect(() => { void getJob(id).then((r) => (r.ok && r.job ? setJob(r.job) : toast(r.error ?? "Verk fannst ekki"))); }, [id]);
  const after = async (r: { ok: boolean; error?: string }, msg?: string) => { if (!r.ok) toast(r.error ?? "Tókst ekki"); else { if (msg) toast(msg); await load(); onChanged(); } };

  if (!job) return <div className="page"><button className="vk-back" onClick={onBack}>‹ Verk</button><div className="card vk-empty">Hleð…</div></div>;
  const isRunning = running?.jobId === job.id;
  const t = jobTotals(job.entries, job.items, job.hourlyRate);

  async function upload(file: File) {
    if (!companyId) return;
    setBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${companyId}/verk/${job!.id}/${Date.now()}.${ext}`;
    const sb = createBrowserClient();
    const { error } = await sb.storage.from("chat").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) { setBusy(false); toast(error.message); return; }
    const url = sb.storage.from("chat").getPublicUrl(path).data.publicUrl;
    const caption = window.prompt("Lýsing á mynd (valfrjálst)", "") ?? "";
    setBusy(false);
    await after(await addPhoto({ jobId: job!.id, url, caption }), "Mynd vistuð");
  }

  async function send() {
    setBusy(true);
    const r = await createReport({ jobId: job!.id, ...period });
    setBusy(false);
    if (!r.ok || !r.url) { toast(r.error ?? "Tókst ekki"); return; }
    await navigator.clipboard?.writeText(r.url).catch(() => {});
    toast("Hlekkur afritaður — sendu viðskiptavininum");
    if (job!.client?.email) window.location.href = `mailto:${job!.client.email}?subject=${encodeURIComponent(`Verkskýrsla: ${job!.title}`)}&body=${encodeURIComponent(`Sæl/l,\n\nHér er verkskýrsla fyrir ${job!.title} til samþykktar:\n${r.url}\n\nKveðja`)}`;
    await load();
  }

  return (
    <div className="page">
      <button className="vk-back" onClick={onBack}>‹ Verk</button>
      <div className="vk-head">
        <div>
          <h1>{job.title}</h1>
          <div className="muted">{[job.client?.name, job.address].filter(Boolean).join(" · ") || "Enginn viðskiptavinur"}{job.hourlyRate ? ` · ${kr(job.hourlyRate)}/klst.` : ""}</div>
        </div>
        <div className="vk-head-a">
          {isRunning
            ? <button className="btn" onClick={async () => { const km = window.prompt("Akstur (km)", "0"); if (km === null) return; await after(await stopTimer({ km, pos: await position() }), "Tímataka stöðvuð"); }}>■ Stöðva <Elapsed since={running!.startedAt} /></button>
            : <button className="btn" onClick={async () => { const r = await startTimer(job.id, await position()); await after(r, r.onSite === true ? "Byrjað — staðfest á verkstað" : r.onSite === false ? "Byrjað — utan verkstaðar" : "Tímataka hafin"); }}>▶ Byrja tímatöku</button>}
          <button className="btn ghost" onClick={() => setEdit(true)}>Breyta</button>
          <button className="btn ghost" onClick={async () => after(await setJobStatus(job.id, job.status === "done" ? "open" : "done"), job.status === "done" ? "Verk opnað" : "Verki lokið")}>{job.status === "done" ? "Opna aftur" : "Ljúka verki"}</button>
        </div>
      </div>

      <div className="kpis vk-kpis">
        <div className="kpi"><div className="lab">Tímar</div><div className="val">{hrs(t.hours)}</div></div>
        <div className="kpi"><div className="lab">Vinna</div><div className="val">{kr(t.labor)}</div></div>
        <div className="kpi"><div className="lab">Efni og útlagt</div><div className="val">{kr(t.materials + t.expenses)}</div></div>
        <div className="kpi"><div className="lab">Akstur</div><div className="val">{t.km.toLocaleString("is-IS")} km</div></div>
      </div>

      <div className="vk-tabs">
        {([["time", "Tímar"], ["items", "Efni og kostnaður"], ["photos", "Myndir"], ["reports", "Verkskýrslur"]] as const).map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "time" && (
        <div className="card vk-sec">
          <div className="vk-add">
            <input type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
            <input type="time" value={entry.start} onChange={(e) => setEntry({ ...entry, start: e.target.value })} />
            <input type="time" value={entry.end} onChange={(e) => setEntry({ ...entry, end: e.target.value })} />
            <input inputMode="decimal" placeholder="km" value={entry.km} onChange={(e) => setEntry({ ...entry, km: e.target.value })} style={{ width: 70 }} />
            <input placeholder="Hvað var gert?" value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
            <button className="btn sm" onClick={async () => { await after(await addEntry({ jobId: job.id, ...entry }), "Tími skráður"); setEntry({ ...entry, note: "", km: "" }); }}>Skrá tíma</button>
          </div>
          {job.entries.length === 0 ? <p className="muted">Engir tímar enn.</p> : (
            <table className="vk-tbl">
              <tbody>
                {job.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{dIS(e.startedAt)}</td>
                    <td>{hm(e.startedAt)}–{e.endedAt ? hm(e.endedAt) : "…"}{e.onSite ? <span className="vk-geo" title="Staðfest á verkstað"> ● á staðnum</span> : null}</td>
                    <td className="r">{hrs(e.hours)}</td>
                    <td className="muted">{[e.note, e.km ? `${e.km} km` : null, e.who].filter(Boolean).join(" · ")}</td>
                    <td className="r"><button className="vk-x" title="Eyða" onClick={async () => { if (window.confirm("Eyða tímaskráningu?")) await after(await deleteEntry(e.id)); }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "items" && (
        <div className="card vk-sec">
          <div className="vk-add">
            <select value={item.kind} onChange={(e) => setItem({ ...item, kind: e.target.value as "material" })}><option value="material">Efni</option><option value="expense">Útlagt</option></select>
            <input placeholder="Lýsing, t.d. Flísar 60×60" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} style={{ flex: 1, minWidth: 180 }} />
            <input inputMode="decimal" placeholder="Magn" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} style={{ width: 70 }} />
            <input inputMode="decimal" placeholder="Einingaverð" value={item.unitPrice} onChange={(e) => setItem({ ...item, unitPrice: e.target.value })} style={{ width: 110 }} />
            <button className="btn sm" onClick={async () => { await after(await addItem({ jobId: job.id, ...item }), "Skráð"); setItem({ ...item, description: "", quantity: "1", unitPrice: "" }); }}>Bæta við</button>
          </div>
          {job.items.length === 0 ? <p className="muted">Ekkert efni skráð.</p> : (
            <table className="vk-tbl">
              <tbody>
                {job.items.map((i) => (
                  <tr key={i.id}>
                    <td>{dIS(i.date)}</td><td>{i.description}{i.kind === "expense" ? <span className="muted"> · útlagt</span> : null}</td>
                    <td className="r">{i.quantity.toLocaleString("is-IS")} × {kr(i.unitPrice)}</td><td className="r"><b>{kr(i.quantity * i.unitPrice)}</b></td>
                    <td className="r"><button className="vk-x" onClick={async () => { if (window.confirm("Eyða?")) await after(await deleteItem(i.id)); }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "photos" && (
        <div className="card vk-sec">
          <label className="btn sm" style={{ cursor: "pointer" }}>{busy ? "Hleð upp…" : "+ Bæta við mynd"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label>
          {job.photos.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>Engar myndir enn. Myndir fylgja verkskýrslunni.</p> : (
            <div className="vk-photos">
              {job.photos.map((p) => (
                <figure key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption ?? ""} /></a>
                  <figcaption>{p.caption || dIS(p.createdAt)} <button className="vk-x" onClick={async () => { if (window.confirm("Eyða mynd?")) await after(await deletePhoto(p.id)); }}>✕</button></figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="card vk-sec">
          <p className="muted" style={{ marginTop: 0 }}>Veldu tímabil. Viðskiptavinurinn fær hlekk þar sem hann sér tíma, efni, myndir og upphæðir — og samþykkir með einum smelli.</p>
          <div className="vk-add">
            <input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
            <span className="muted">til</span>
            <input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
            <button className="btn sm" disabled={busy} onClick={send}>Búa til og senda skýrslu</button>
          </div>
          {job.reports.length === 0 ? <p className="muted">Engar skýrslur sendar.</p> : (
            <table className="vk-tbl">
              <tbody>
                {job.reports.map((r) => (
                  <tr key={r.id}>
                    <td>{dIS(r.from)}–{dIS(r.to)}</td>
                    <td><span className={`vk-pill ${r.status}`}>{r.status === "approved" ? "Samþykkt" : r.status === "rejected" ? "Athugasemd" : "Bíður"}</span></td>
                    <td className="muted">{r.signedName ? `${r.signedName}${r.comment ? `: „${r.comment}“` : ""}` : `Send ${dIS(r.createdAt)}`}</td>
                    <td className="r"><a className="vk-link" href={`/samthykki/${r.token}`} target="_blank" rel="noreferrer">Opna</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {edit && <JobModal job={job} clients={clients} onClose={() => setEdit(false)} onSaved={async () => { setEdit(false); await load(); onChanged(); }} />}
    </div>
  );
}
