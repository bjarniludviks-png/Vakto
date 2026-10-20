import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "./login.css";
import "@/components/site/home.css";
import "@/components/site/auth.css";
import { LoginPage } from "@/components/site/auth-pages";
import { demoConfigured } from "@/lib/demo.server";

// Innskráning í útliti forsíðunnar (IS/EN, okt. 2026). ?lang=en virkar áfram.
// viewport-fit=cover + ljós theme-color fyrir opna vefinn (iOS 26 Safari, sjá components/site/viewport.ts).
export const viewport = siteViewport;
export const metadata: Metadata = { title: "VAKTO: Skrá inn", alternates: { canonical: "/login" } };

export default function Page() {
  return <LoginPage demo={demoConfigured()} />;
}
