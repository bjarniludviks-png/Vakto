import type { Metadata, Viewport } from "next";
import "./globals.css";

const DESC = "Framtíð vaktavinnu: AI raðar vöktunum, launin reikna sig sjálf og þú sérð launakostnaðinn í rauntíma. 14 daga frí prufa — ekkert kort.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is"),
  title: "VAKTO — Vaktaplanið gerir sig sjálft. Launin líka.",
  description: DESC,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VAKTO", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "VAKTO",
    title: "VAKTO — Vaktaplanið gerir sig sjálft. Launin líka.",
    description: DESC,
    locale: "is_IS",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "VAKTO", description: DESC },
};

export const viewport: Viewport = {
  themeColor: "#e9700f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // iOS standalone launch images (portrait) for the common iPhone resolutions
  // incl. iPhone 16/17 series. [physicalW, physicalH, devicePixelRatio]
  const splash: [number, number, number][] = [
    [1320, 2868, 3], // 16/17 Pro Max
    [1290, 2796, 3], // 14/15/16 Pro Max & Plus
    [1206, 2622, 3], // 16/17 Pro
    [1284, 2778, 3], // 12/13/14 Pro Max
    [1179, 2556, 3], // 14/15/16 Pro & 16/17
    [1170, 2532, 3], // 12/13/14/15
    [1125, 2436, 3], // X / 11 Pro
    [1080, 2340, 3], // 12/13 mini
    [828, 1792, 2], // XR / 11
    [750, 1334, 2], // SE / 8
  ];
  return (
    <html lang="is">
      <head>
        {/* Legacy iOS flag — required for standalone + startup images (Next only
            emits the newer mobile-web-app-capable). */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
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
