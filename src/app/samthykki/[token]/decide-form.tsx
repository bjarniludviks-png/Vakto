"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideReport } from "./actions";

export function DecideForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(approve: boolean) {
    setBusy(true); setErr("");
    const r = await decideReport(token, approve, name, comment);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Villa"); return; }
    router.refresh();
  }

  return (
    <div className="sam-form">
      <h3>Samþykkja verkskýrslu</h3>
      <label>Nafn<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fullt nafn" autoComplete="name" /></label>
      <label>Athugasemd <span>(valfrjálst)</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Ef eitthvað þarf að laga" /></label>
      {err && <p className="sam-err">{err}</p>}
      <div className="sam-btns">
        <button className="sam-ok" disabled={busy} onClick={() => go(true)}>Samþykkja</button>
        <button className="sam-no" disabled={busy} onClick={() => go(false)}>Biðja um lagfæringu</button>
      </div>
      <p className="sam-fine">Með samþykki staðfestir þú að tímar, efni og upphæðir í skýrslunni séu réttar. Nafn þitt og tími samþykktar eru skráð.</p>
    </div>
  );
}
