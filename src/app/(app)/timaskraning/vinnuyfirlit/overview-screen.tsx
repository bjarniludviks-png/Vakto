"use client";

// Vinnuyfirlit — stjórnandi: búa til yfirlit tímabilsins fyrir alla, senda til staðfestingar,
// skoða eitt, staðfesta (lokið → PDF í skjalasafn starfsmanns) og sækja PDF.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { AsyncButton } from "@/components/app/async-button";
import { WorkOverviewView, WoStatusPill } from "@/components/app/work-overview-view";
import { dec1, nf } from "@/lib/format";
import { shiftPayPeriod } from "@/lib/periods";
import type { WoRow, WoStatus } from "@/lib/work-overview";
import { generateWorkOverviews, sendWorkOverviews, finalizeWorkOverview, workOverviewPdfUrl, type WoList } from "./actions";

const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}.${m}.${y}`; };

export default function OverviewScreen({ from, to, startDay, list }: { from: string; to: string; startDay: number; list: WoList }) {
  const { t } = useLang();
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<WoRow | null>(null);
  const go = (n: number) => { const p = shiftPayPeriod(from, startDay, n); router.push(`/timaskraning/vinnuyfirlit?from=${p.from}&to=${p.to}`); };
  const count = (s: WoStatus) => list.rows.filter((r) => r.status === s).length;
  const drafts = list.rows.filter((r) => r.status === "draft");
  const sendIds = sel.size ? drafts.filter((r) => sel.has(r.id)).map((r) => r.id) : drafts.map((r) => r.id);

  async function generate() {
    const r = await generateWorkOverviews(from, to);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    toast(`${r.count ?? 0} ${t("yfirlit búin til")}${r.skipped ? ` · ${r.skipped} ${t("óbreytt (send eða staðfest)")}` : ""}`);
    router.refresh();
  }
  async function send() {
    const r = await sendWorkOverviews(sendIds);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    setSel(new Set());
    toast(`${r.count ?? 0} ${t("yfirlit send til staðfestingar")}`);
    router.refresh();
  }

  return (
    <div className="db2">
      <div className="db2-top">
        <div>
          <Link href="/timaskraning" className="wo-back">‹ {t("Tímaskráning")}</Link>
          <h1>{t("Vinnuyfirlit")}</h1>
          <div className="db2-sub">{t("Mánaðaryfirlit per starfsmann sem starfsmaðurinn staðfestir — vistað sem PDF í skjölum hans.")}</div>
        </div>
        <div className="db2-period">
          <button className="btn ghost sm" aria-label={t("Fyrra tímabil")} onClick={() => go(-1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg></button>
          <span className="wo-per">{niceISO(from)} – {niceISO(to)}</span>
          <button className="btn ghost sm" aria-label={t("Næsta tímabil")} onClick={() => go(1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg></button>
        </div>
      </div>

      {list.missing ? (
        <section className="db2-card"><div className="db2-empty" style={{ padding: "34px 24px", textAlign: "center" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--mut)" strokeWidth="1.6"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 14l2 2 4-4" /></svg>
          <div style={{ fontWeight: 650, marginTop: 10 }}>{t("Vinnuyfirlit eru ekki virk enn")}</div>
          <div className="db2-muted" style={{ marginTop: 4 }}>{t("Gagnagrunnsuppfærsla (0084) hefur ekki verið keyrð. Tímaskráningin virkar áfram eins og áður.")}</div>
        </div></section>
      ) : (
        <>
          <div className="db2-row4">
            <section className="db2-card db2-tile"><div className="db2-k">{t("Drög")}</div><div className="db2-v">{count("draft")}</div><div className="db2-s">{list.without.length} {t("án yfirlits")}</div></section>
            <section className="db2-card db2-tile"><div className="db2-k">{t("Bíður starfsmanns")}</div><div className="db2-v">{count("sent")}</div></section>
            <section className="db2-card db2-tile"><div className="db2-k">{t("Bíður þín")}</div><div className="db2-v" style={{ color: count("employee_approved") + count("employee_flagged") ? "var(--warn)" : undefined }}>{count("employee_approved") + count("employee_flagged")}</div><div className="db2-s">{count("employee_flagged")} {t("með athugasemd")}</div></section>
            <section className="db2-card db2-tile"><div className="db2-k">{t("Lokið")}</div><div className="db2-v" style={{ color: count("final") ? "var(--good)" : undefined }}>{count("final")}</div><div className="db2-s">{t("PDF í skjölum starfsmanns")}</div></section>
          </div>

          <section className="db2-card db2-staff">
            <div className="db2-ch">
              <div><div className="db2-ct">{t("Starfsfólk")}</div><div className="db2-cs">{t("Samþykktar stimplanir og birtar vaktir · sami launaútreikningur og launakeyrslan")}</div></div>
              <span className="db2-acts">
                <AsyncButton className="btn ghost sm" onClick={generate}>{list.rows.length ? t("Endurreikna drög") : t("Búa til yfirlit fyrir alla")}</AsyncButton>
                {drafts.length > 0 && <AsyncButton className="btn sm" onClick={send}>{t("Senda til staðfestingar")} ({sendIds.length})</AsyncButton>}
              </span>
            </div>
            {!list.ok && <div className="db2-muted" style={{ padding: "8px 24px", color: "var(--bad)" }}>{list.error}</div>}
            <div className="db2-tblwrap">
              <table>
                <thead><tr>
                  <th style={{ width: 30 }}><input type="checkbox" aria-label={t("Velja öll drög")} checked={drafts.length > 0 && drafts.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(drafts.map((r) => r.id)) : new Set())} /></th>
                  <th>{t("Starfsmaður")}</th><th className="r">{t("Á plani")}</th><th className="r">{t("Unnið")}</th><th className="r">{t("wo:gross")}</th><th>{t("Staða")}</th><th style={{ width: 20 }} />
                </tr></thead>
                <tbody>
                  {list.rows.map((r) => (
                    <tr key={r.id} className="rowlink" onClick={() => setOpen(r)}>
                      <td onClick={(e) => e.stopPropagation()}>{r.status === "draft" && <input type="checkbox" aria-label={r.name} checked={sel.has(r.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.id); else n.delete(r.id); setSel(n); }} />}</td>
                      <td><b>{r.name}</b>{r.dept ? <span className="db2-muted"> · {t(r.dept)}</span> : null}</td>
                      <td className="r">{dec1(r.snapshot.totals.planned)}</td>
                      <td className="r">{dec1(r.snapshot.totals.worked)}</td>
                      <td className="r">{nf(r.snapshot.pay.gross)} kr</td>
                      <td><WoStatusPill status={r.status} />{r.snapshot.pendingPunches > 0 && r.status === "draft" ? <span className="db2-pill warn" style={{ marginLeft: 6 }} title={t("stimplanir biðu samþykktar og eru ekki með í yfirlitinu.")}>{r.snapshot.pendingPunches} {t("óyfirfarnar")}</span> : null}</td>
                      <td className="r muted">›</td>
                    </tr>
                  ))}
                  {list.without.map((e) => (
                    <tr key={e.id}><td /><td><b>{e.name}</b>{e.dept ? <span className="db2-muted"> · {t(e.dept)}</span> : null}</td><td className="r muted">—</td><td className="r muted">—</td><td className="r muted">—</td><td><span className="db2-pill mut">{t("Ekki búið til")}</span></td><td /></tr>
                  ))}
                  {!list.rows.length && !list.without.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 18 }}>{t("Ekkert starfsfólk")}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="db2-muted" style={{ fontSize: 12, padding: "10px 24px 16px" }}>{t("Ferlið: búa til → senda → starfsmaður staðfestir eða gerir athugasemd (í Mitt svæði og appinu) → þú staðfestir. Þá er PDF með fingrafari (SHA-256) og staðfestingarskrá vistað í skjölum starfsmannsins.")}</p>
          </section>
        </>
      )}

      {open && <OverviewModal row={open} from={from} to={to} onClose={() => setOpen(null)} onDone={() => { setOpen(null); router.refresh(); }} />}
    </div>
  );
}

function OverviewModal({ row, from, to, onClose, onDone }: { row: WoRow; from: string; to: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [reply, setReply] = useState("");
  async function finalize() {
    const r = await finalizeWorkOverview(row.id, reply);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    toast(t("Vinnuyfirlit staðfest — PDF vistað í skjölum starfsmanns"));
    onDone();
  }
  async function regenerate() {
    const r = await generateWorkOverviews(from, to, [row.employeeId]);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    toast(t("Endurreiknað — yfirlitið er aftur í drögum"));
    onDone();
  }
  async function send() {
    const r = await sendWorkOverviews([row.id]);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    toast(t("Sent til staðfestingar"));
    onDone();
  }
  async function pdf() {
    const r = await workOverviewPdfUrl(row.id);
    if (r.ok && r.url) window.open(r.url, "_blank"); else toast(r.error ?? t("Villa"), "error");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal wo-modal">
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Vinnuyfirlit")} · {row.name}</div><div className="muted" style={{ fontSize: 12 }}>{niceISO(row.from)} – {niceISO(row.to)} · <WoStatusPill status={row.status} /></div></div>
          <button className="x" aria-label={t("Loka")} onClick={onClose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="mb">
          {row.status === "employee_flagged" && row.employeeComment && (
            <div className="wo-note"><b>{t("Athugasemd starfsmanns")}</b><p>„{row.employeeComment}“</p></div>
          )}
          <WorkOverviewView row={row} />
          {row.status === "employee_flagged" && (
            <div className="field" style={{ marginTop: 14 }}>
              <label>{t("Svar þitt (fer í staðfestingarskrána)")}</label>
              <textarea className="lf-ta" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("T.d. leiðrétt í stimplun 12.10. eða skýring")} />
            </div>
          )}
          <div style={{ display: "flex", gap: 9, marginTop: 16, flexWrap: "wrap" }}>
            {row.status === "draft" && <AsyncButton className="btn" onClick={send}>{t("Senda til staðfestingar")}</AsyncButton>}
            {row.status === "employee_approved" && <AsyncButton className="btn" onClick={finalize}>{t("Staðfesta")}</AsyncButton>}
            {row.status === "employee_flagged" && <AsyncButton className="btn" disabled={!reply.trim()} onClick={finalize}>{t("Staðfesta með svari")}</AsyncButton>}
            {(row.status === "draft" || row.status === "sent" || row.status === "employee_flagged") && <AsyncButton className="btn ghost" onClick={regenerate}>{t("Endurreikna")}</AsyncButton>}
            {row.status === "final" && <AsyncButton className="btn" onClick={pdf}>{t("Sækja PDF")}</AsyncButton>}
            <Link className="btn ghost" href={`/timaskraning/${row.employeeId}`}>{t("Stimplanir")}</Link>
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
