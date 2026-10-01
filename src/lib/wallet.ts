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
  const logo = { sourceUri: { uri: `${APP_URL.replace(/\/$/, "")}/wallet/vakto-logo.png` }, contentDescription: { defaultValue: { language: "is", value: "VAKTO" } } };
  const genericObject = {
    id: objectId, classId,
    logo,
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
    // Flokkurinn fylgir með svo hann verði til við fyrstu vistun (annars hafnar Google passanum).
    payload: { genericClasses: [{ id: classId }], genericObjects: [genericObject] },
    origins: [APP_URL.replace(/\/$/, ""), "https://www.vakto.is", "https://vakto.is"],
  };
  const token = jwt.default.sign(claims, process.env.GOOGLE_WALLET_SA_KEY!.replace(/\\n/g, "\n"), { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}

/** Skírteinisgögn innskráðs starfsmanns (service role — kallandi hefur þegar sannreynt notandann). */
export async function walletEmployee(userId: string): Promise<PassEmployee | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: emp } = await createAdminClient()
    .from("employees")
    .select("id, full_name, department:departments(name), photo_url, clock_token, companies(name), positions(name)")
    .eq("user_id", userId).maybeSingle();
  if (!emp) return null;
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const dept = one(emp.department as { name?: string } | null);
  const pos = one(emp.positions as { name?: string } | null);
  const comp = one(emp.companies as { name?: string } | null);
  return {
    id: emp.id as string,
    name: (emp.full_name as string) ?? "Starfsmaður",
    role: pos?.name ?? "Starfsmaður",
    department: dept?.name ?? "",
    company: comp?.name ?? "VAKTO",
    token: (emp.clock_token as string) ?? (emp.id as string),
    photoUrl: (emp.photo_url as string) ?? null,
  };
}

export { APP_URL };
