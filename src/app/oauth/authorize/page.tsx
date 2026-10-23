import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eligibility, getClient } from "@/lib/mcp.server";
import { VaktoLogo } from "@/components/brand/vakto-logo";
import { decide } from "./actions";

// Samþykki tengds forrits (OAuth). Middleware sér um innskráningu (/login?next=…) áður en hingað er komið.
export const metadata: Metadata = { title: "VAKTO: Tengja forrit", robots: { index: false } };

const C = { ink: "#1a1a1f", ink2: "#5f6470", ink3: "#9296a6", line: "#e6e6e9", bg: "#f4f4f6", brand: "#e9700f", bad: "#d8483a" };

const CAN = [
  "Vaktaplan, mætingu og hverjir eru á vakt",
  "Unna tíma, yfirvinnu og launakostnað",
  "Veltu og laun sem hlutfall af veltu",
  "Launakeyrslur, veikindahlutfall og beiðnir starfsfólks",
];
const CANNOT = [
  "Breytt neinu: vöktum, launum, stimplunum eða stillingum",
  "Séð kennitölur, bankareikninga eða heimilisföng",
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: C.bg, display: "grid", placeItems: "center", padding: "32px 16px", fontFamily: "var(--font-sans, 'General Sans', system-ui, sans-serif)", color: C.ink }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 10px 40px rgba(20,20,30,.08)", padding: "28px 26px" }}>
        <div style={{ marginBottom: 22 }}><VaktoLogo /></div>
        {children}
      </div>
    </main>
  );
}

function Problem({ title, text }: { title: string; text: string }) {
  return <Shell><h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{title}</h1><p style={{ color: C.ink2, lineHeight: 1.5, margin: 0 }}>{text}</p></Shell>;
}

const Check = ({ ok }: { ok: boolean }) => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={ok ? "#1f9d6b" : C.bad} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 3 }}>
    {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
  </svg>
);

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const client = await getClient(q.client_id ?? "");
  const redirectUri = q.redirect_uri ?? "";
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return <Problem title="Ógild beiðni" text="Forritið sem sendi þig hingað er ekki skráð rétt hjá VAKTO. Reyndu að tengja það aftur úr forritinu sjálfu." />;
  }
  if (q.response_type !== "code" || q.code_challenge_method !== "S256" || !q.code_challenge) {
    return <Problem title="Ógild beiðni" text="Forritið bað um innskráningu á formi sem VAKTO styður ekki (krafist er OAuth með PKCE)." />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Problem title="Skráðu þig inn" text="Skráðu þig inn í VAKTO og reyndu svo aftur." />;
  const el = await eligibility(user.id);
  if (!el.ok) return <Problem title="Ekki hægt að tengja" text={el.reason} />;
  const { data: me } = await createAdminClient().from("users").select("full_name").eq("id", user.id).maybeSingle();
  const host = new URL(redirectUri).host;

  return (
    <Shell>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.25 }}>{client.name} vill fá aðgang að VAKTO</h1>
      <p style={{ color: C.ink2, margin: "0 0 20px", lineHeight: 1.5 }}>
        Gögn <b style={{ color: C.ink }}>{el.companyName}</b>, sem {(me?.full_name as string) || user.email}. Svörin fara til {host}.
      </p>

      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink3, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8 }}>Getur lesið</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "grid", gap: 8 }}>
        {CAN.map((t) => <li key={t} style={{ display: "flex", gap: 10, lineHeight: 1.45 }}><Check ok />{t}</li>)}
      </ul>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink3, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8 }}>Getur ekki</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 8 }}>
        {CANNOT.map((t) => <li key={t} style={{ display: "flex", gap: 10, lineHeight: 1.45 }}><Check ok={false} />{t}</li>)}
      </ul>

      <form action={decide}>
        {(["client_id", "redirect_uri", "state", "code_challenge"] as const).map((k) => <input key={k} type="hidden" name={k} value={q[k] ?? ""} />)}
        {!el.enabled && el.role === "owner" && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fdf1e6", borderRadius: 12, padding: "12px 14px", marginBottom: 18, lineHeight: 1.45, fontSize: 14.5, cursor: "pointer" }}>
            <input type="checkbox" name="enable" value="1" required style={{ marginTop: 3, accentColor: C.brand }} />
            <span>Leyfa gervigreindarforrit hjá {el.companyName}. Stjórnendur og vaktstjórar geta þá tengt sín forrit. Þú getur slökkt á þessu í Stillingum → Tengingar.</span>
          </label>
        )}
        {!el.enabled && el.role !== "owner" ? (
          <p style={{ background: "#fdecea", color: C.bad, borderRadius: 12, padding: "12px 14px", lineHeight: 1.45, fontSize: 14.5, margin: "0 0 18px" }}>
            Eigandi fyrirtækisins þarf fyrst að leyfa gervigreindarforrit (Stillingar → Tengingar).
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 10 }}>
          <button name="choice" value="deny" formNoValidate style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Hætta við</button>
          {(el.enabled || el.role === "owner") && (
            <button name="choice" value="allow" style={{ flex: 1, height: 46, borderRadius: 12, border: 0, background: C.brand, color: "#fff", fontWeight: 650, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Leyfa aðgang</button>
          )}
        </div>
      </form>
      <p style={{ color: C.ink3, fontSize: 13, lineHeight: 1.5, margin: "18px 0 0" }}>
        Þú getur aftengt forritið hvenær sem er í Stillingum → Tengingar. Gögnin sem forritið les fara til fyrirtækisins sem rekur það og gilda þá skilmálar þess.
      </p>
    </Shell>
  );
}
