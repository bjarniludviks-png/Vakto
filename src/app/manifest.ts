import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VAKTO",
    short_name: "VAKTO",
    description: "Vaktaplan, mæting, laun og arðsemi á einum stað.",
    start_url: "/maelabord",
    display: "standalone",
    background_color: "#e9700f",
    theme_color: "#e9700f",
    lang: "is",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180", purpose: "maskable" },
    ],
  };
}
