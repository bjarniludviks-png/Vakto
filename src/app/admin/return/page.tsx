import TokenExchange from "../token-exchange";

// "Aftur í VAKTO Admin" landing: verifies the admin's own magic-link token
// (minted by endImpersonation) and drops the owner back on /admin.
export const metadata = { title: "VAKTO Platform — Aftur í admin", robots: { index: false, follow: false } };

export default function AdminReturnPage() {
  return <TokenExchange fallbackNext="/admin" title="Skrái þig aftur inn í VAKTO Admin…" />;
}
