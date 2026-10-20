"use client";

import { useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast, ToastHost } from "@/components/app/toast";
import { ContractView } from "@/components/app/contract-view";
import { VaktoLogo } from "@/components/brand/vakto-logo";
import { downloadContractPdf } from "@/lib/contract-pdf";
import { isDate } from "@/lib/termination";
import { createClient } from "@/lib/supabase/client";
import { requestContractCode, signContractWithCode } from "@/app/(app)/mitt-svaedi/actions";
import { myContractSignatures, openMyDocument } from "./actions";

export type RoDoc = { id: string; name: string; type: string | null; created: string };
export type RoContract = { id: string; title: string; content: string; status: string; signedVia: string | null; date: string };

const DocIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>;

export default function ReadonlyScreen({ name, company, lastDay, accessUntil, docs, contracts }: { name: string; company: string; lastDay: string | null; accessUntil: string | null; docs: RoDoc[]; contracts: RoContract[] }) {
  const { t } = useLang();
  const [signing, setSigning] = useState<RoContract | null>(null);
  const payslips = docs.filter((d) => /launase/i.test(`${d.type ?? ""} ${d.name}`));
  const other = docs.filter((d) => !payslips.includes(d));

  async function open(id: string) {
    const r = await openMyDocument(id);
    if (r.url) window.open(r.url, "_blank", "noopener"); else toast(r.error ?? t("Tókst ekki að opna skjalið"), "error");
  }
  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }
  const list = (rows: RoDoc[]) => rows.length
    ? <div className="docs">{rows.map((d) => (
      <div className="docrow" key={d.id}><DocIcon /><span>{d.name}</span><span className="dl">{isDate(d.created)}</span><button className="btn ghost sm" type="button" onClick={() => open(d.id)}>{t("Opna")}</button></div>
    ))}</div>
    : <p className="muted" style={{ fontSize: 13 }}>{t("Ekkert skráð.")}</p>;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "28px 16px 48px" }}>
      <ToastHost />
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <VaktoLogo size={22} />
          <button className="btn ghost sm" type="button" onClick={signOut}>{t("Skrá út")}</button>
        </div>
        <section className="db2-card" style={{ padding: "22px 24px" }}>
          <h1 style={{ fontSize: 21, margin: "0 0 6px" }}>{t("Takk fyrir samstarfið")}{name ? `, ${name.split(/\s+/)[0]}` : ""}</h1>
          <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.6, margin: 0 }}>
            {t("Ráðningu þinni hjá")} <b>{company || t("vinnuveitandanum")}</b> {t("lauk")} {isDate(lastDay)}. {t("Þú getur áfram skoðað og sótt launaseðla, samninga og skjöl til og með")} <b>{isDate(accessUntil)}</b>. {t("Eftir það lokast aðgangurinn — sæktu það sem þú vilt eiga.")}
          </p>
        </section>

        <section className="db2-card" style={{ padding: "18px 24px" }}>
          <div className="sec" style={{ marginTop: 0 }}>{t("Launaseðlar")}</div>
          {list(payslips)}
        </section>

        <section className="db2-card" style={{ padding: "18px 24px" }}>
          <div className="sec" style={{ marginTop: 0 }}>{t("Samningar")}</div>
          {contracts.length ? <div className="docs">{contracts.map((c) => (
            <div className="docrow" key={c.id}>
              <DocIcon /><span>{c.title}</span>
              <span className={`tag ${c.status === "signed" ? "good" : "info"}`}>{c.status === "signed" ? t("undirritað") : t("bíður undirritunar")}</span>
              <span className="dl">{isDate(c.date)}</span>
              <button className="btn ghost sm" type="button" onClick={async () => downloadContractPdf(c.title, c.content, await myContractSignatures(c.id))}>PDF</button>
              {c.status === "sent" && c.signedVia !== "taktikal" && <button className="btn sm" type="button" onClick={() => setSigning(c)}>{t("Skoða & undirrita")}</button>}
            </div>
          ))}</div> : <p className="muted" style={{ fontSize: 13 }}>{t("Ekkert skráð.")}</p>}
        </section>

        <section className="db2-card" style={{ padding: "18px 24px" }}>
          <div className="sec" style={{ marginTop: 0 }}>{t("Skjöl")}</div>
          {list(other)}
        </section>
        <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>{t("Aðeins til skoðunar. Spurningar um laun eða starfslok fara til vinnuveitandans.")}</p>
      </div>
      {signing && <SignModal c={signing} onClose={() => setSigning(null)} />}
    </div>
  );
}

function SignModal({ c, onClose }: { c: RoContract; onClose: () => void }) {
  const { t } = useLang();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true); const r = await requestContractCode(c.id); setBusy(false);
    if (!r.ok) { toast(r.error ?? t("Tókst ekki að senda kóða"), "error"); return; }
    setSentTo(r.sentTo ?? "");
  }
  async function sign() {
    setBusy(true); const r = await signContractWithCode(c.id, code); setBusy(false);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    toast(t("Undirritað — afrit er sent á netfangið þitt."));
    window.location.reload();
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="mh"><div style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</div><button className="x" type="button" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div style={{ maxHeight: "42vh", overflowY: "auto", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}><ContractView content={c.content} /></div>
          {sentTo == null
            ? <button className="btn" type="button" disabled={busy} onClick={send}>{t("Senda kóða á netfangið mitt")}</button>
            : <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>{t("Kóði sendur á")} {sentTo}</span>
              <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "8px 10px", width: 120 }} />
              <button className="btn" type="button" disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={sign}>{t("Undirrita")}</button>
            </div>}
        </div>
      </div>
    </div>
  );
}
