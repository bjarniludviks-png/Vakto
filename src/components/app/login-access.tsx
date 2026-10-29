"use client";

// Innskráning notanda sem er þegar með aðgang: staða (hefur skráð sig inn / ekki enn),
// „Senda boð aftur“ eða „Senda innskráningartengil“, og „Breyta netfangi“ sem færir innskráninguna.
// Sama eining á starfsmannaspjaldinu (Vinna) og í Stillingar → Notendur.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";

type Status = { signedIn: boolean; email: string | null } | null;
type Res = { ok: boolean; error?: string; sentTo?: string; kind?: "invite" | "login" };

export function LoginAccess({ load, resend, changeEmail }: {
  load: () => Promise<Status>;
  resend: () => Promise<Res>;
  changeEmail: (email: string) => Promise<Res>;
}) {
  const { t } = useLang();
  const router = useRouter();
  const [st, setSt] = useState<Status | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { let live = true; load().then((s) => { if (live) setSt(s); }); return () => { live = false; }; }, []);

  async function doResend() {
    setBusy(true);
    const r = await resend();
    setBusy(false);
    toast(r.ok ? `${r.kind === "invite" ? t("Boð sent aftur á") : t("Innskráningartengill sendur á")} ${r.sentTo}` : (r.error ?? t("Villa")));
  }
  async function doChange() {
    if (!email.trim()) return;
    setBusy(true);
    const r = await changeEmail(email);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? t("Villa")); return; }
    toast(r.sentTo ? `${t("Netfangi breytt — tengill sendur á")} ${r.sentTo}` : t("Netfangi breytt"));
    setSt((s) => s && { ...s, email: email.trim().toLowerCase() });
    setEditing(false);
    router.refresh();
  }

  const pill = st === undefined ? null : st === null
    ? <span className="db2-pill good">{t("Virkur aðgangur")}</span>
    : st.signedIn
      ? <span className="db2-pill good">{t("Virkur aðgangur")}</span>
      : <span className="db2-pill warn">{t("Boð sent · ekki skráð(ur) inn enn")}</span>;

  return (
    <div className="statline" style={{ flexWrap: "wrap", gap: 8 }}>
      <span className="k">{t("Innskráning")}{st?.email && <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}> · {st.email}</span>}</span>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {pill}
        {st && !editing && <>
          <button type="button" className="btn sm ghost" disabled={busy} onClick={doResend}>{busy ? t("Sendi…") : st.signedIn ? t("Senda innskráningartengil") : t("Senda boð aftur")}</button>
          <button type="button" className="btn sm ghost" disabled={busy} onClick={() => { setEmail(st.email ?? ""); setEditing(true); }}>{t("Breyta netfangi")}</button>
        </>}
      </span>
      {editing && (
        <div style={{ flexBasis: "100%", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netfang@daemi.is" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doChange(); } if (e.key === "Escape") setEditing(false); }}
            style={{ flex: 1, minWidth: 200, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, font: "inherit", fontSize: 13.5 }} />
          <button type="button" className="btn sm" disabled={busy} onClick={doChange}>{busy ? t("Vista…") : t("Vista og senda tengil")}</button>
          <button type="button" className="btn sm ghost" disabled={busy} onClick={() => setEditing(false)}>{t("Hætta við")}</button>
          <p className="muted" style={{ flexBasis: "100%", fontSize: 11.5, margin: 0 }}>{t("Innskráningin færist á nýja netfangið og tengill til að velja lykilorð er sendur þangað.")}</p>
        </div>
      )}
    </div>
  );
}
