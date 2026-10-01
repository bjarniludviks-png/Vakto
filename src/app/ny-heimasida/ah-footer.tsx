// Fótur nýju forsíðunnar (líka á lögfræðisíðunum). Engir client-hlutir.
const H = "/ny-heimasida";

export function AhLogo() {
  return (
    <span className="ah-logo" translate="no">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1.3" /><rect x="10" y="8" width="4" height="12" rx="1.3" /><rect x="17" y="4" width="4" height="16" rx="1.3" /></svg>
      VAKTO
    </span>
  );
}

const COLS: { h: string; links: [string, string, boolean?][] }[] = [
  { h: "Vara", links: [[`${H}#kerfid`, "Eiginleikar"], [`${H}#kynning`, "Kynntu þér VAKTO"], [`${H}#samningar`, "Samningar"], [`${H}#verd`, "Verð"], [`${H}/prufa`, "Prófa frítt"]] },
  { h: "Fyrirtækið", links: [[`${H}/um-okkur`, "Um okkur"], ["mailto:hallo@vakto.is", "Hafa samband"], [`${H}/innskraning`, "Innskráning"]] },
  { h: "Lögfræði", links: [[`${H}/personuvernd`, "Persónuvernd"], [`${H}/skilmalar`, "Skilmálar"], [`${H}/vafrakokur`, "Vafrakökur"]] },
  { h: "Fylgdu okkur", links: [["https://www.instagram.com/vakto.is", "Instagram", true], ["https://www.facebook.com/vakto.is", "Facebook", true], ["https://www.linkedin.com/company/vakto", "LinkedIn", true]] },
];

export default function AhFooter() {
  return (
    <footer className="ah-foot">
      <div className="ah-foot-grid">
        <div className="ah-foot-brand">
          <a href={H} aria-label="VAKTO forsíða"><AhLogo /></a>
          <p>Vaktaplan, stimpilklukka, laun og ráðningarsamningar. Og launin sem hlutfall af veltu í rauntíma. Hannað fyrir íslenska vinnustaði.</p>
          <a className="ah-foot-mail" href="mailto:hallo@vakto.is">hallo@vakto.is</a>
        </div>
        {COLS.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <h2>{c.h}</h2>
            {c.links.map(([href, label, ext]) => <a key={label} href={href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}>{label}</a>)}
          </nav>
        ))}
      </div>
      <div className="ah-foot-bot">
        <span>© 2026 VAKTO ehf. · kt. 490806-0400</span>
        <span>Hannað og þróað á Íslandi</span>
      </div>
    </footer>
  );
}
