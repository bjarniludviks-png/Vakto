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
  // iOS standalone launch images (portrait) for the common iPhone resolutions.
  const splash: [number, number, number][] = [
    [1290, 2796, 3], [1284, 2778, 3], [1179, 2556, 3], [1170, 2532, 3],
    [1125, 2436, 3], [828, 1792, 2], [750, 1334, 2],
  ];
  return (
    <html lang="is">
      <head>
        {splash.map(([pw, ph, r]) => (
          <link
            key={`${pw}x${ph}`}
            rel="apple-touch-startup-image"
            href={`/api/splash?w=${pw}&h=${ph}`}
            media={`(device-width: ${pw / r}px) and (device-height: ${ph / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
