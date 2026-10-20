export type Lang = "is" | "en" | "vi" | "pl";

export function pickLang(v: string | string[] | undefined): Lang {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "en" || s === "vi" || s === "pl" ? s : "is";
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
  errCreds: string;
  errClosed: string;
  needEmail: string;
  sendingReset: string;
  resetSent: string;
  tryDemo: string;
  errDemo: string;
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
    remember: "Muna eftir mér",
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
    errCreds: "Rangt netfang eða lykilorð.",
    errClosed: "Aðgangur að VAKTO er lokaður. Ráðningu þinni er lokið og lesaðgangurinn sem vinnuveitandinn veitti er runninn út. Hafðu samband við vinnuveitandann ef þig vantar gögn.",
    needEmail: "Sláðu netfangið þitt inn fyrst — smelltu svo aftur á hlekkinn.",
    sendingReset: "Sendi…",
    resetSent: "Ef aðgangur er til fyrir netfangið er póstur með hlekk á leiðinni.",
    tryDemo: "Prófa demo-fyrirtæki",
    errDemo: "Demo-innskráning tókst ekki",
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
    errCreds: "Wrong email or password.",
    errClosed: "Your access to VAKTO is closed. Your employment has ended and the read-only access your employer granted has expired. Contact your employer if you need your records.",
    needEmail: "Type your email above first, then tap this link again.",
    sendingReset: "Sending…",
    resetSent: "If an account exists for that email, a reset link is on its way.",
    tryDemo: "Try the demo company",
    errDemo: "Demo sign-in failed",
  },
  vi: {
    metaTitle: "VAKTO — Đăng nhập",
    tag: "Chào mừng trở lại",
    h2: ["Hệ thống xếp ca đơn giản nhất,", "mà làm được nhiều hơn."],
    desc: "Một lần đăng nhập cho cả quản lý và nhân viên — mỗi người thấy phần của mình.",
    bullets: [],
    quote: "Cần hỗ trợ? hallo@vakto.is",
    quoteBy: "",
    welcome: "Chào mừng trở lại",
    welcomeSub: "Đăng nhập — công việc đang chờ bạn.",
    emailLabel: "Email",
    emailPh: "ban@congty.com",
    passwordLabel: "Mật khẩu",
    forgot: "Quên mật khẩu?",
    remember: "Ghi nhớ tôi",
    signIn: "Đăng nhập",
    signingIn: "Đang đăng nhập…",
    or: "hoặc",
    withApple: "Tiếp tục với Apple",
    withGoogle: "Tiếp tục với Google",
    withMicrosoft: "Tiếp tục với Microsoft",
    withAudkenni: "Định danh điện tử (Auðkenni)",
    noAccount: "Chưa có tài khoản?",
    createAccount: "Tạo tài khoản",
    errOauth: "Đăng nhập không thành công. Hãy thử lại hoặc dùng email của bạn.",
    errConnect: "Không thể kết nối — vui lòng thử lại sau giây lát.",
    errAudkenni: "Định danh điện tử (Auðkenni) sắp ra mắt.",
    errCreds: "Email hoặc mật khẩu không đúng.",
    errClosed: "Quyền truy cập VAKTO của bạn đã đóng. Công việc của bạn đã kết thúc và quyền chỉ xem do chủ lao động cấp đã hết hạn. Hãy liên hệ chủ lao động nếu bạn cần hồ sơ.",
    needEmail: "Hãy nhập email ở trên trước, rồi bấm lại vào liên kết này.",
    sendingReset: "Đang gửi…",
    resetSent: "Nếu email này có tài khoản, liên kết đặt lại mật khẩu đang được gửi đến.",
    tryDemo: "Dùng thử công ty demo",
    errDemo: "Đăng nhập demo không thành công",
  },
  pl: {
    metaTitle: "VAKTO — Logowanie",
    tag: "Witaj ponownie",
    h2: ["Najprostszy system grafików,", "który robi więcej."],
    desc: "Jedno logowanie dla kierowników i pracowników — każdy widzi swoje.",
    bullets: [],
    quote: "Potrzebujesz pomocy? hallo@vakto.is",
    quoteBy: "",
    welcome: "Witaj ponownie",
    welcomeSub: "Zaloguj się — firma czeka.",
    emailLabel: "E-mail",
    emailPh: "ty@firma.pl",
    passwordLabel: "Hasło",
    forgot: "Nie pamiętasz hasła?",
    remember: "Zapamiętaj mnie",
    signIn: "Zaloguj się",
    signingIn: "Logowanie…",
    or: "lub",
    withApple: "Kontynuuj z Apple",
    withGoogle: "Kontynuuj z Google",
    withMicrosoft: "Kontynuuj z Microsoft",
    withAudkenni: "Identyfikator elektroniczny (Auðkenni)",
    noAccount: "Nie masz konta?",
    createAccount: "Załóż konto",
    errOauth: "Logowanie nie powiodło się. Spróbuj ponownie lub użyj adresu e-mail.",
    errConnect: "Nie udało się połączyć — spróbuj ponownie za chwilę.",
    errAudkenni: "Identyfikator elektroniczny (Auðkenni) już wkrótce.",
    errCreds: "Nieprawidłowy e-mail lub hasło.",
    errClosed: "Twój dostęp do VAKTO jest zamknięty. Zatrudnienie się zakończyło, a dostęp tylko do odczytu przyznany przez pracodawcę wygasł. Skontaktuj się z pracodawcą, jeśli potrzebujesz swoich dokumentów.",
    needEmail: "Najpierw wpisz swój e-mail powyżej, a potem kliknij ten link ponownie.",
    sendingReset: "Wysyłanie…",
    resetSent: "Jeśli istnieje konto dla tego adresu, link do zmiany hasła jest już w drodze.",
    tryDemo: "Wypróbuj firmę demo",
    errDemo: "Logowanie demo nie powiodło się",
  },
};
