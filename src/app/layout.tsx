import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VAKTO — Vaktaplan, mæting, laun og arðsemi á einum stað",
  description:
    "Vinnuafls-arðsemi fyrir íslensk fyrirtæki. Vaktaplan, mæting, laun og arðsemi á einum stað.",
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
