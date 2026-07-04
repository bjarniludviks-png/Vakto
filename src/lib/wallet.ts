import "server-only";

// Digital staff ID card for Apple Wallet (PassKit) + Google Wallet.
// Pass generation is gated on the provider certs/keys below — until they're set the
// endpoints return a friendly "not configured" state so the UI still works.
//
// APPLE (PassKit) — set as base64-encoded PEM in env:
//   APPLE_PASS_TYPE_ID       e.g. pass.is.vakto.staff
//   APPLE_TEAM_ID            your Apple Developer Team ID
//   APPLE_PASS_CERT_B64      Pass Type ID certificate (PEM)
//   APPLE_PASS_KEY_B64       its private key (PEM)
//   APPLE_PASS_KEY_PASS      key passphrase (if any)
//   APPLE_WWDR_B64           Apple WWDR intermediate certificate (PEM)
// GOOGLE Wallet:
//   GOOGLE_WALLET_ISSUER_ID  your Google Wallet issuer id
//   GOOGLE_WALLET_SA_EMAIL   service-account email
//   GOOGLE_WALLET_SA_KEY     service-account private key (PEM)
//   GOOGLE_WALLET_CLASS      class id (e.g. issuerId.vakto_staff)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";

export function appleConfigured(): boolean {
  return !!(process.env.APPLE_PASS_TYPE_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_PASS_CERT_B64 && process.env.APPLE_PASS_KEY_B64 && process.env.APPLE_WWDR_B64);
}
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SA_EMAIL && process.env.GOOGLE_WALLET_SA_KEY);
}

export type PassEmployee = { id: string; name: string; role: string; department: string; company: string; token: string; photoUrl?: string | null };

const b64 = (v?: string) => (v ? Buffer.from(v, "base64") : Buffer.alloc(0));

/** Signed Apple Wallet .pkpass (Buffer). Throws if certs aren't configured. */
export async function buildApplePass(e: PassEmployee): Promise<Buffer> {
  if (!appleConfigured()) throw new Error("apple-not-configured");
  const { PKPass } = await import("passkit-generator");
  const pass = new PKPass({}, {
    wwdr: b64(process.env.APPLE_WWDR_B64),
    signerCert: b64(process.env.APPLE_PASS_CERT_B64),
    signerKey: b64(process.env.APPLE_PASS_KEY_B64),
    signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASS,
  }, {
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
    teamIdentifier: process.env.APPLE_TEAM_ID!,
    organizationName: "VAKTO",
    description: `${e.company} — starfsmannaskírteini`,
    serialNumber: e.id,
    foregroundColor: "rgb(255,255,255)",
    backgroundColor: "rgb(233,112,15)", // brand orange
    labelColor: "rgb(255,255,255)",
  });
  pass.type = "generic";
  pass.setBarcodes({ message: e.token, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: e.name });
  pass.primaryFields.push({ key: "name", label: "STARFSMAÐUR", value: e.name });
  pass.secondaryFields.push({ key: "role", label: "STAÐA", value: e.role }, { key: "dept", label: "DEILD", value: e.department || "—" });
  pass.auxiliaryFields.push({ key: "company", label: "FYRIRTÆKI", value: e.company });
  pass.backFields.push({ key: "info", label: "Um skírteinið", value: "Sýndu QR-kóðann á stimpilklukkunni til að stimpla inn eða út." });
  return pass.getAsBuffer();
}

/** "Save to Google Wallet" URL (a signed JWT link). Throws if not configured. */
export async function buildGoogleSaveUrl(e: PassEmployee): Promise<string> {
  if (!googleConfigured()) throw new Error("google-not-configured");
  const jwt = await import("jsonwebtoken");
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const classId = process.env.GOOGLE_WALLET_CLASS || `${issuer}.vakto_staff`;
  const objectId = `${issuer}.${e.id.replace(/[^\w.-]/g, "")}`;
  const genericObject = {
    id: objectId, classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#e9700f",
    cardTitle: { defaultValue: { language: "is", value: "VAKTO" } },
    header: { defaultValue: { language: "is", value: e.name } },
    subheader: { defaultValue: { language: "is", value: e.company } },
    textModulesData: [
      { id: "role", header: "Staða", body: e.role },
      { id: "dept", header: "Deild", body: e.department || "—" },
    ],
    barcode: { type: "QR_CODE", value: e.token, alternateText: e.name },
  };
  const claims = {
    iss: process.env.GOOGLE_WALLET_SA_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { genericObjects: [genericObject] },
  };
  const token = jwt.default.sign(claims, process.env.GOOGLE_WALLET_SA_KEY!.replace(/\\n/g, "\n"), { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}

export { APP_URL };
