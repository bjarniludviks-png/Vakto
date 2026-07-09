# Prompt: Byggðu Inventra-vefinn eins og VAKTO-vefinn (grænn í stað appelsínuguls)

Ég er með annan vef í rekstri — **vakto.is** (vaktakerfi) — og ég vil að Inventra-vefurinn
fylgi NÁKVÆMLEGA sömu uppbyggingu, sömu köflum og sama gæðastigi, nema með grænu
litakerfi Inventra. **MIKILVÆGT: hero-kaflinn sem við erum búin að gera (græni boginn og
hreyfanlegu norðurljósin) á að halda sér ÓBREYTTUR** — þetta prompt á við allt hitt:
kaflana fyrir neðan hero, innskráningarsíðuna og nýskráningarsíðuna.

---

## Grunn-designkerfi (eins og VAKTO, grænt í stað appelsínuguls)

- **Leturgerð:** General Sans (Fontshare), fallback -apple-system/system-ui.
  Fyrirsagnir: font-weight 600, letter-spacing -.035em, line-height 1.05.
  Body: letter-spacing -.011em, line-height 1.55.
- **Bakgrunnur alls staðar:** mjög dökkt, nálægt `#060607`. Texti `#f4f2ee`,
  dempaður texti `rgba(244,242,238,.62)`, enn daufari `.38`.
- **Accent-litur:** ykkar Inventra-grænn alls staðar þar sem VAKTO notar appelsínugult
  (#e9700f/#f59331). Notaðu tvo tóna: aðal + ljósari fyrir glóð og hover.
- **Spjöld (cards):** `background:rgba(255,255,255,.04)`, `border:1px solid rgba(255,255,255,.09)`,
  `border-radius:18px`, texti inni með h3 (17px/600) + p (14px dempaður).
- **Hnappar, tvær gerðir:**
  - `ghost`: `background:rgba(255,255,255,.05)`, border línulitur, hvítur texti,
    hover: bakgrunnur `.09` + `translateY(-1px)`.
  - `glow` (aðal-CTA): dökkur gradient-grunnur `linear-gradient(180deg,#1c1c1f,#0c0c0e)`,
    border í accent-lit (55% opacity), `box-shadow:0 0 22px -4px <accent-glóð>`,
    hover: sterkari glóð. `border-radius:12px`, padding 11px 20px (lg: 14px 26px).
  - Allir hnappar: `:active{transform:scale(.97)}`, transition 160ms.
- **Easing alls staðar:** `cubic-bezier(.23,1,.32,1)`.
- **Hreyfingar:** eingöngu transform/opacity (GPU). `prefers-reduced-motion` slekkur allt.
  - Scroll-reveal: hver kafli fade-ar upp (opacity 0→1, translateY 22px→0, .7s)
    með IntersectionObserver (threshold .15).
  - First-load: hero-elementin koma inn í röð með animation-delay (350/480/620/760/900ms).
- **Engin emoji** — línu-íkonar (lucide-stíll, stroke 1.7–2).
- **Tvítyngt IS/EN:** allur texti í einu `T`-dict objecti `{is:{...},en:{...}}`,
  globe-hnappur í nav (sýnir "EN" þegar íslenska er virk, "IS" þegar enska),
  valið geymt í localStorage. Innskráningar-/nýskráningarhlekkir fá `?lang=en` þegar enska er valin.

---

## Nav (fljótandi gler-pilla, eins og VAKTO)

Fixed efst, miðjuð, `width:min(880px,calc(100% - 32px))`, `border-radius:999px`,
`background:rgba(12,12,14,.55)`, `backdrop-filter:blur(18px) saturate(150%)`,
border + mjúkur skuggi. Innihald: logo vinstra megin · 3 miðju-hlekkir (Eiginleikar,
Svona virkar það, Verð) · hægra megin: globe-hnappur, "Innskráning" (ghost),
"Byrja frítt" (glow). Rennur inn ofan frá við fyrstu hleðslu.
**Mobile (≤900px):** hlekkir + CTA hverfa, hamborgarahnappur (2 línur → X) opnar
gler-dropdown undir pillunni með öllum hlekkjum + tungumálahnapp + báðum CTA-hnöppum.

## Kaflaröð fyrir neðan hero (nákvæmlega þessi röð)

1. **Treyst-borði:** lítil uppercase-lína ("Fyrirtæki um allt Ísland keyra á Inventra")
   + logo-veggur viðskiptavina sem **rennur til hliðar í endalausri lykkju** (marquee):
   tvö eins sett í track sem translate-ar -50% á ~28s, mask-fade á báðum jöðrum,
   pásar á hover, virðir reduced-motion. Logo í hvítu einslitu (~46px há, opacity .6).

2. **Yfirlýsing + snúandi hnöttur:** stór setning (clamp 21–30px, weight 500) þar sem
   lykilfrasinn er í accent-lit, við hliðina á glansandi kúlu (220px) með conic-gradient
   sem snýst hægt og skiptir á 2,4s fresti milli atvinnugreina/notkunartilvika
   (íkon + heiti fade-skiptast). Mobile: kúlan fyrir ofan textann, miðjað.

3. **Eiginleikar (bento):** kaflafyrirsögn + undirlína, svo 6 gler-spjöld í grid
   (2 dálkar; fyrsta spjaldið "big" spannar báða, síðasta "wide" spannar báða).
   Hvert spjald: lítil CSS-teiknuð mynd/mockup efst (mælir, mini-grid, púls-klukka,
   kort, raðir, spjallbólur — teiknað með divum, ekki myndum) + titill + stutt lýsing.

4. **Sýning á kerfinu (carousel):** "Sjáðu kerfið í alvöru" + ALVÖRU skjámyndir
   úr Inventra í dökku þema. Scroll-snap slider: hver slide 84% breidd, snap-center,
   nágrannar kíkja inn á jöðrunum, örvahnappar (42px hringir, gler) + punktar undir.
   Skjámyndir með `border-radius:14px`, border `rgba(255,255,255,.13)` og djúpum
   skugga + smá accent-glóð. Undir hverri: titill + ein lína. Mobile: swipe, örvar faldar.
   **Ef til eru EN-skjámyndir: skipta eftir tungumáli.**

5. **Þrjú skref:** "Þrjú skref. Korter. Búið." — 3 spjöld með númeri (01/02/03 í
   accent-lit, mono-tilfinning), titli og 1–2 línum.

6. **App-kynning (ef á við):** "Væntanlegt"-badge (uppercase, accent-border pilla),
   fyrirsögn + undirlína + gátlisti (checkmark-íkonar í accent) vinstra megin;
   hægra megin sími: alvöru renderaður símarammi (mynd) með lifandi HTML-UI lagt
   yfir skjásvæðið, svífur hægt upp/niður (7s), accent-drop-shadow glóð.

7. **Ummæli:** "Rekstrarfólk elskar Inventra" + undirlína. Eitt stórt featured-spjald
   (mynd vinstra megin 340px + tilvitnun) og tvö minni spjöld í grid undir
   (tilvitnun + lítil hringmynd + nafn + hlutverk).

8. **Verð:** "Eitt verð. Allt innifalið." / "Engin þrep. Ekkert falið. Engin binding."
   EITT verðspjald miðjað (max-width ~460px) með accent-glóð á bak við: stór upphæð
   + lítil eining, 4 punktar með accent-doppum, glow-CTA, smáletur
   ("14 daga frí prufa. Ekkert kort.").

9. **Loka-CTA:** ein stór setning miðjuð + tveir hnappar (glow + ghost "Bóka kynningu").

10. **Fótur:** 5 dálkar (brand-lýsing breiðust + Vara / Fyrirtækið / Lögfræði /
    Fylgdu okkur), dauf accent-"aurora"-glóð efst í fótnum, botnröð
    ("© 2026 … ehf." · "Hannað og þróað á Íslandi") og — signature-atriðið —
    **risastórt hálfgegnsætt vörumerkið** neðst (clamp(120px,22vw,330px),
    gradient-texti sem fade-ar niður). Mobile: 2 dálkar.

---

## Innskráningarsíðan (/login) — sama dökka útlit

Split-layout `grid-template-columns:1fr 1fr`, allt á `#060607`:
- **Vinstri (form):** logo + "Velkomin aftur" (30px/700) + undirlína.
  Input: `background:rgba(255,255,255,.04)`, border línulitur, `border-radius:11px`,
  padding 13px 15px; focus: accent-border + mjúkur accent-outline.
  Aðalhnappur: accent-gradient með glóð. Social-hnappar (Apple/Google/Microsoft):
  gler-útgáfa með íkon-kubbi. "eða"-skil með línum. Neðst: "Ertu ekki með aðgang? Stofna aðgang".
- **Hægri (kynningar-panell):** hér notið þið YKKAR grænu norðurljós/boga-stíl —
  stjörnuhiminn (tvö hreyfanleg radial-gradient dot-lög með twinkle), daufir
  ljósgeislar og glóandi sjóndeildarbogi neðst (risastór hringur með box-shadow upp).
  Innihald: lítil uppercase-merkilína efst, stór fyrirsögn með →-örvum milli 4 orða
  (ferlið ykkar), lýsing, 3 punktar með check-hringjum, tilvitnun neðst (ítalík).
  Hverfur á ≤900px (formið eitt á mobile).

## Nýskráningarsíðan (/nyskraning eða /signup) — tvö skref

Sama split-layout og login. Skref-vísir efst ("1 · Aðgangur → 2 · Áskrift").
- **Skref 1:** Fullt nafn, Fyrirtæki, Land (select, dökk stíluð), Netfang, Lykilorð
  → "Halda áfram" + social-hnappar.
- **Skref 2:** "Veldu áskrift" + verðspjald (valið með accent-border + ring) +
  kortareitir (nafn/númer/gildir/CVC með sjálfvirku formatti) →
  "Byrja frí prufu" + smáletur um örugga greiðslu + "Sleppa í bili"-hlekkur.
- Hægri panell: sama cosmic-uppsetning með sölutexta fyrir nýskráningu
  ("14 daga frí prufa … á nokkrum mínútum").

---

## Tónn í texta (mjög mikilvægt)

Premium SaaS-rödd eins og Apple/Linear/Stripe — seldu ÚTKOMU, ekki virkni:
stuttar, sjálfsöruggar setningar; "X gerir sig sjálft", "Allt á einum stað. Loksins.",
"Sjáðu reksturinn í rauntíma"; aldrei "kerfið styður...". Hnappar segja "Byrja frítt".
Allur texti til á IS og EN.

## Tæknilegt

- Öll hreyfing transform/opacity-only; `@media(prefers-reduced-motion:reduce)` slekkur.
- Hover-effektar bara `@media(hover:hover) and (pointer:fine)`.
- Allar tölur með íslensku sniði (punktur í þúsundum, komma í brotum) — deterministic,
  ekki toLocaleString.
- Responsive brotpunktar: 900px (grid → 1 dálkur, hamborgari) og 560px (fínstillingar).
- `overflow-x:clip` á rótinni svo ekkert leki út til hliðar.
