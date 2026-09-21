import type { Metadata } from "next";
import LegalShell from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "VAKTO — Vafrakökur", description: "Hvaða vafrakökur og geymslu vakto.is notar." };

export default function CookiesPage() {
  return (
    <LegalShell title="Vafrakökur" updated="21. september 2026">
      <div className="lg-note">Stutta útgáfan: vakto.is notar <b>engar greiningar- eða auglýsingavafrakökur</b> og enga rakningu þriðju aðila. Aðeins það sem þarf til að þú getir skráð þig inn og til að muna stillingarnar þínar.</div>

      <h2>1. Nauðsynlegar vafrakökur</h2>
      <table>
        <thead><tr><th>Nafn</th><th>Tilgangur</th><th>Líftími</th></tr></thead>
        <tbody>
          <tr><td>sb-*-auth-token</td><td>Innskráning (Supabase Auth). Heldur þér innskráðum og endurnýjar lotuna.</td><td>Þar til þú skráir þig út, að hámarki nokkrar vikur</td></tr>
          <tr><td>vakto-impersonating, vakto-impersonating-ui</td><td>Aðeins þegar VAKTO-stuðningur skráir sig inn sem fyrirtæki til að aðstoða; sýnir borða efst og leið til baka.</td><td>Lota</td></tr>
        </tbody>
      </table>
      <p>Þessar kökur eru forsenda þess að þjónustan virki og krefjast ekki samþykkis samkvæmt lögum um fjarskipti.</p>

      <h2>2. Geymsla í vafranum (localStorage)</h2>
      <p>Til að muna stillingar geymum við nokkur gildi í vafranum þínum. Þau fara aldrei til þriðju aðila og innihalda ekki persónuupplýsingar.</p>
      <table>
        <thead><tr><th>Lykill</th><th>Tilgangur</th></tr></thead>
        <tbody>
          <tr><td>vakto-lang</td><td>Valið tungumál (íslenska/enska)</td></tr>
          <tr><td>vakto-theme</td><td>Ljóst eða dökkt þema</td></tr>
          <tr><td>vakto-rail, vakto-dash-*, vakto:period:*</td><td>Hvernig þú síðast stilltir hliðarstiku, mælaborð og tímabil</td></tr>
          <tr><td>vakto-onb-hidden</td><td>Að þú hafir lokað byrjunarleiðbeiningum</td></tr>
          <tr><td>vakto-kiosk-mode, vakto-kiosk-lang</td><td>Stillingar stimpilklukku á spjaldtölvu</td></tr>
          <tr><td>vakto-home-chat</td><td>Auðkenni samtals í spjallinu á heimasíðunni svo þú getir haldið því áfram</td></tr>
        </tbody>
      </table>

      <h2>3. Þriðju aðilar</h2>
      <p>Við notum hvorki Google Analytics, Meta Pixel né sambærilega þjónustu á vakto.is. Innbyggð myndbönd eða ytri efnishlutar eru ekki notaðir. Sé starfsmannaskírteini bætt í Apple Wallet eða Google Wallet gilda skilmálar Apple/Google um það í símanum.</p>

      <h2>4. Hvernig þú stjórnar þessu</h2>
      <p>Þú getur eytt vafrakökum og geymslu í stillingum vafrans. Sé nauðsynlegum kökum eytt þarftu að skrá þig inn aftur. Ef við bætum við einhverju sem krefst samþykkis (t.d. greiningum) verður beðið um það sérstaklega áður en það er virkjað og þessi síða uppfærð.</p>

      <h2>5. Samband</h2>
      <p>Spurningar um vafrakökur og persónuvernd: <a href="mailto:hallo@vakto.is">hallo@vakto.is</a>. Sjá einnig <a href="/personuvernd">persónuverndarstefnu</a>.</p>
    </LegalShell>
  );
}
