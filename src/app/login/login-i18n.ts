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
    tag: "Velkomin aftur",
    h2: ["Vaktaplan", "stimplun", "laun", "laun% af veltu."],
    desc: "Sama innskráning fyrir stjórnendur og starfsfólk — hver sér sitt. Nokkur atriði sem spara tíma:",
    bullets: [
      "Í síma: opnaðu vakto.is og bættu á heimaskjáinn — þá virkar það eins og app",
      "Stimpilklukka á spjaldtölvu: Stillingar → Samþættingar → afrita slóð",
      "Gleymt lykilorð? Sláðu inn netfangið og smelltu á hlekkinn hér til hliðar",
    ],
    quote: "Þarftu hjálp? hallo@vakto.is eða spjallið neðst á forsíðunni.",
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
    tag: "Welcome back",
    h2: ["Schedule", "clock-in", "payroll", "labor % of revenue."],
    desc: "One sign-in for managers and staff — everyone sees their own. A few time-savers:",
    bullets: [
      "On your phone: open vakto.is and add it to the home screen — it works like an app",
      "Time clock on a tablet: Settings → Integrations → copy link",
      "Forgot your password? Enter your email and tap the link next to it",
    ],
    quote: "Need help? hallo@vakto.is or the chat at the bottom of the homepage.",
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
