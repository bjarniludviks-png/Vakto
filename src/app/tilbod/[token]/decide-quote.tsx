"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideQuote } from "./actions";

export function DecideQuote({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(accept: boolean) {
    setBusy(true); setErr("");
    const r = await decideQuote(token, accept, name, comment);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Villa"); return; }
    router.refresh();
  }

  return (
    <div className="sam-form">
      <h3>Samþykkja tilboð</h3>
      <label>Nafn<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fullt nafn" autoComplete="name" /></label>
      <label>Athugasemd <span>(valfrjálst)</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="t.d. hvenær má hefja verkið" /></label>
      <label className="sam-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Ég samþykki tilboðið og skilmála þess sem verksamning.</label>
      {err && <p className="sam-err">{err}</p>}
      <div className="sam-btns">
        <button className="sam-ok" disabled={busy || !agree} onClick={() => go(true)}>Samþykkja tilboð</button>
        <button className="sam-no" disabled={busy} onClick={() => go(false)}>Hafna</button>
      </div>
      <p className="sam-fine">Nafn þitt, tími og athugasemd eru skráð og verktakinn fær staðfestingu.</p>
    </div>
  );
}
