import type { Metadata } from "next";
import "./login.css";
import LoginForm from "./login-form";
import { LOGIN_I18N, pickLang } from "./login-i18n";

export const metadata: Metadata = {
  title: "VAKTO — Skrá inn",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const sp = await searchParams;
  const lang = pickLang(sp.lang);
  const s = LOGIN_I18N[lang];

  return (
    <div className="wrap">
      <div className="left">
        <LoginForm lang={lang} />
      </div>

      <div className="right">
        <span className="sky" aria-hidden>
          <i className="st s1" />
          <i className="st s2" />
          <i className="ry r1" />
          <i className="ry r2" />
          <i className="hz" />
        </span>
        <div className="tag">{s.tag}</div>
        <div className="mid">
          <h2>
            {s.h2[0]} <span className="arr">→</span> {s.h2[1]}{" "}
            <span className="arr">→</span> {s.h2[2]} <span className="arr">→</span>{" "}
            {s.h2[3]}
          </h2>
          <p className="desc">{s.desc}</p>
          <div className="bullets">
            {s.bullets.map((b, i) => (
              <div className="bullet" key={i}>
                <span className="ck">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5l4 4 10-10" />
                  </svg>
                </span>{" "}
                {b}
              </div>
            ))}
          </div>
        </div>
        <div className="quote">
          {s.quote} {s.quoteBy}
        </div>
      </div>
    </div>
  );
}
