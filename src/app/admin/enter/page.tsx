import TokenExchange from "../token-exchange";

// Same-host impersonation landing: swaps this browser's session for the
// customer user's (token_hash from impersonateUser) and continues to `next`.
export const metadata = { title: "VAKTO Platform — Skrái inn", robots: { index: false, follow: false } };

export default function AdminEnterPage() {
  return <TokenExchange fallbackNext="/maelabord" title="Skrái þig inn sem notanda fyrirtækisins…" />;
}
