export type Lang = "is" | "en";

export function pickLang(v: string | string[] | undefined): Lang {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "en" ? "en" : "is";
}

export const LOGIN_I18N: Record<Lang, {
  metaTitle: string;
  // right panel
  tag: string;
  h2: [string, string, string, string]; // words joined by arrows
  desc: string;
  bullets: [string, string, string];
  quote: string;
  quoteBy: string;
  // form
  welcome: string;
  welcomeSub: string;
  emailLabel: string;
  emailPh: string;
  passwordLabel: string;
  forgot: string;
  remember: string;
  signIn: string;
  signingIn: string;
  or: string;
  withApple: string;
  withGoogle: string;
  withMicrosoft: string;
  withAudkenni: string;
  noAccount: string;
  createAccount: string;
  errOauth: string;
  errConnect: string;
  errAudkenni: string;
}> = {
  is: {
    metaTitle: "VAKTO — Skrá inn",
    tag: "Vinnuafls-arðsemi fyrir fyrirtæki",
    h2: ["Vaktaplan", "mæting", "laun", "arðsemi."],
    desc: "Vakto sýnir þér laun sem hlutfall af veltu í rauntíma, ber áætlað vaktaplan saman við raunverulega tíma, og hjálpar þér að halda launakostnaði í skefjum — áður en mánuðurinn er búinn.",
    bullets: [
      "Laun vs velta í rauntíma",
      "Íslensk launalógík — kjarasamningar, staðgreiðsla, tryggingagjald",
      "Vaktaplan, stimpilklukka og starfsmannaapp á einum stað",
    ],
    quote: "„Vakto sýndi okkur strax hvar launin voru að éta framlegðina — við lækkuðum launahlutfallið um 4% á tveimur mánuðum.“",
    quoteBy: "— veitingahúsaeigandi",
    welcome: "Velkomin aftur",
    welcomeSub: "Skráðu þig inn til að halda áfram.",
    emailLabel: "Netfang",
    emailPh: "netfang@fyrirtaeki.is",
    passwordLabel: "Lykilorð",
    forgot: "Gleymt lykilorð?",
    remember: "Muna mig",
    signIn: "Skrá inn",
    signingIn: "Skrái inn…",
    or: "eða",
    withApple: "Halda áfram með Apple",
    withGoogle: "Halda áfram með Google",
    withMicrosoft: "Halda áfram með Microsoft",
    withAudkenni: "Rafræn skilríki (Auðkenni)",
    noAccount: "Ertu ekki með aðgang?",
    createAccount: "Stofna aðgang",
    errOauth: "Innskráning með þjónustunni tókst ekki. Reyndu aftur eða notaðu netfang.",
    errConnect: "Tókst ekki að tengjast — er Supabase stillt í .env.local?",
    errAudkenni: "Rafræn skilríki (Auðkenni) eru væntanleg.",
  },
  en: {
    metaTitle: "VAKTO — Sign in",
    tag: "Workforce profitability for businesses",
    h2: ["Scheduling", "attendance", "pay", "profit."],
    desc: "Vakto shows you labor as a percentage of revenue in real time, compares your planned schedule against actual hours, and helps you keep labor cost in check — before the month is over.",
    bullets: [
      "Labor vs revenue in real time",
      "Icelandic payroll logic — union rates, withholding tax, insurance levy",
      "Scheduling, time clock and staff app in one place",
    ],
    quote: "“Vakto showed us right away where labor was eating our margin — we cut our labor ratio by 4% in two months.”",
    quoteBy: "— restaurant owner",
    welcome: "Welcome back",
    welcomeSub: "Sign in to continue.",
    emailLabel: "Email",
    emailPh: "you@company.com",
    passwordLabel: "Password",
    forgot: "Forgot password?",
    remember: "Remember me",
    signIn: "Sign in",
    signingIn: "Signing in…",
    or: "or",
    withApple: "Continue with Apple",
    withGoogle: "Continue with Google",
    withMicrosoft: "Continue with Microsoft",
    withAudkenni: "Electronic ID (Auðkenni)",
    noAccount: "Don't have an account?",
    createAccount: "Create account",
    errOauth: "Sign-in with that service failed. Try again or use email.",
    errConnect: "Couldn't connect — is Supabase configured in .env.local?",
    errAudkenni: "Electronic ID (Auðkenni) is coming soon.",
  },
};
