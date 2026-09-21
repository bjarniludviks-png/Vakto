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
    tag: "Reksturinn þinn í rauntíma",
    h2: ["Vaktaplan", "stimplun", "laun", "laun% af veltu."],
    desc: "Þú sérð planið, mætinguna og launakostnaðinn á meðan vaktin er enn í gangi — sem hlutfall af veltunni, ekki eftir mánaðamót. Starfsfólkið sér vaktirnar sínar, launin og skírteinið í símanum.",
    bullets: [
      "Laun sem % af veltu í rauntíma — grænt, gult, rautt",
      "Tímafrávik sem sýna strax hvað þau kosta",
      "Spjall, fréttaveita, skírteini og ráðningarsamningar í appinu",
    ],
    quote: "Íslensk laun eftir kjarasamningum — staðgreiðsla, tryggingagjald, lífeyrir — flutt beint í Payday.",
    quoteBy: "",
    welcome: "Velkomin aftur",
    welcomeSub: "Skráðu þig inn — reksturinn bíður.",
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
    errOauth: "Innskráningin tókst ekki. Reyndu aftur eða notaðu netfangið þitt.",
    errConnect: "Tókst ekki að tengjast — er Supabase stillt í .env.local?",
    errAudkenni: "Rafræn skilríki (Auðkenni) eru rétt handan við hornið.",
  },
  en: {
    metaTitle: "VAKTO — Sign in",
    tag: "Your business in real time",
    h2: ["Schedule", "clock-in", "payroll", "labor % of revenue."],
    desc: "You see the schedule, attendance and labor cost while the shift is still running — as a share of revenue, not after month-end. Your team sees their shifts, pay and ID on their phone.",
    bullets: [
      "Labor as % of revenue in real time — green, amber, red",
      "Time deviations that show what they cost, instantly",
      "Chat, news feed, ID card and employment contracts in the app",
    ],
    quote: "Icelandic payroll by union agreement — withholding, insurance levy, pension — exported straight to Payday.",
    quoteBy: "",
    welcome: "Welcome back",
    welcomeSub: "Sign in — your business is waiting.",
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
    errOauth: "That sign-in didn't work. Try again or use your email.",
    errConnect: "Couldn't connect — is Supabase configured in .env.local?",
    errAudkenni: "Electronic ID (Auðkenni) is just around the corner.",
  },
};
