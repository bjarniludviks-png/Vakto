export type Lang = "is" | "en";

export function pickLang(v: string | string[] | undefined): Lang {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "en" ? "en" : "is";
}

export const LOGIN_I18N: Record<Lang, {
  metaTitle: string;
  // right panel
  tag: string;
  h2: [string, string]; // two lines
  desc: string;
  bullets: string[];
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
    tag: "Velkomin aftur",
    h2: ["Einfaldasta vaktakerfið,", "sem gerir meira."],
    desc: "Sama innskráning fyrir stjórnendur og starfsfólk — hver sér sitt.",
    bullets: [],
    quote: "Þarftu aðstoð? hallo@vakto.is",
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
    errConnect: "Tókst ekki að tengjast — reyndu aftur eftir augnablik.",
    errAudkenni: "Rafræn skilríki (Auðkenni) eru rétt handan við hornið.",
  },
  en: {
    metaTitle: "VAKTO — Sign in",
    tag: "Welcome back",
    h2: ["The simplest scheduling system,", "and it does more."],
    desc: "One sign-in for managers and staff — everyone sees their own.",
    bullets: [],
    quote: "Need help? hallo@vakto.is",
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
    errConnect: "Couldn't connect — please try again in a moment.",
    errAudkenni: "Electronic ID (Auðkenni) is just around the corner.",
  },
};
