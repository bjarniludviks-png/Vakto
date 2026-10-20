import type { Viewport } from "next";

/**
 * Viewport fyrir opna vefinn (forsíða, um okkur, innskráning/nýskráning, lögfræðisíður, fjárfestar).
 * Sameinast rót-viewport-inu í src/app/layout.tsx (Next sameinar lykil fyrir lykil), svo width/scale haldast.
 *
 * - viewportFit "cover": síðan teiknast líka bak við stöðustikuna og fljótandi „liquid glass“ slána
 *   í iOS 26 Safari, í stað þess að Safari máli heila hvíta rönd þar. Stílarnir í home.css/auth.css
 *   bæta env(safe-area-inset-*) við þar sem efni má ekki lenda undir hakinu eða slánni.
 * - themeColor = bakgrunnur síðunnar (#fbfbfd) í stað appelsínugula litarins, svo vafrar sem lita
 *   slána eftir theme-color mála ekki litaða rönd yfir síðuna.
 * Innskráða appið ((app)/) notar áfram rót-viewport-ið óbreytt.
 */
export const siteViewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#fbfbfd",
};
