// Wallet pass endpoint — scaffold for Phase 2 (Apple Wallet .pkpass / Google Wallet).
//
// Real passes require credentials that must be provisioned in the Apple/Google
// developer consoles and set as env vars:
//   Apple  — APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT (.p12/.pem),
//            APPLE_PASS_CERT_PASSWORD, APPLE_WWDR_CERT
//   Google — GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_KEY
//
// Until those exist this returns 501 so the client can show a friendly message.
// When configured: build the pass with `passkit-generator` (Apple) or a signed
// JWT save-link (Google) from getMyCard() and stream/redirect it here.

export async function GET(request: Request) {
  const platform = new URL(request.url).searchParams.get("platform") === "google" ? "google" : "apple";
  const appleReady = !!process.env.APPLE_PASS_TYPE_ID && !!process.env.APPLE_PASS_CERT;
  const googleReady = !!process.env.GOOGLE_WALLET_ISSUER_ID && !!process.env.GOOGLE_WALLET_SA_KEY;
  const ready = platform === "google" ? googleReady : appleReady;

  if (!ready) {
    return Response.json(
      {
        ok: false,
        platform,
        error: "wallet_not_configured",
        message:
          platform === "google"
            ? "Google Wallet er ekki uppsett enn — vantar Google Cloud issuer-aðgang og þjónustureikning."
            : "Apple Wallet er ekki uppsett enn — vantar Apple Developer Pass Type ID + undirritunarskírteini.",
      },
      { status: 501 },
    );
  }

  // TODO Phase 2: generate + return the signed pass.
  return Response.json({ ok: false, error: "not_implemented" }, { status: 501 });
}
