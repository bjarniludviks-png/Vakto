import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VAKTO — Vaktaplan, mæting, laun og arðsemi á einum stað",
  description:
    "Vinnuafls-arðsemi fyrir íslensk fyrirtæki. Vaktaplan, mæting, laun og arðsemi á einum stað.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VAKTO", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#e9700f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="is">
      <body>{children}</body>
    </html>
  );
}
