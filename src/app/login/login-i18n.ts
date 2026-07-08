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
    h2: ["Vaktaplan", "mæting", "laun", "arðsemi."],
    desc: "Allt sem gerist á gólfinu birtist hjá þér í rauntíma: mætingin, yfirvinnan, launakostnaðurinn. Þú sérð stöðuna á meðan enn er hægt að breyta henni.",
    bullets: [
      "Laun% af veltu í rauntíma",
      "Íslensk laun — kjarasamningar, staðgreiðsla, tryggingagjald",
      "Plan, klukka, app og spjall á einum stað",
    ],
    quote: "„VAKTO sýndi okkur strax hvar launin voru að éta framlegðina. Við lækkuðum launahlutfallið um 4% á tveimur mánuðum.“",
    quoteBy: "— veitingahúsaeigandi",
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
    h2: ["Schedule", "attendance", "payroll", "profit."],
    desc: "Everything that happens on the floor shows up for you in real time: attendance, overtime, labor cost. You see it while there's still time to act on it.",
    bullets: [
      "Labor % of revenue in real time",
      "Icelandic payroll — union rates, withholding, insurance levy",
      "Scheduling, clock, app and chat in one place",
    ],
    quote: "“VAKTO showed us right away where labor was eating our margin. We cut our labor ratio by 4% in two months.”",
    quoteBy: "— restaurant owner",
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
