# Handbók: markaðsvefur í stíl vakto.is

Þessi handbók lýsir því hvernig nýi vefur VAKTO (vakto.is, okt. 2026) var byggður, svo hægt sé að gera
sambærilegan vef fyrir annað kerfi (t.d. Inventra). Kóðinn sjálfur er fyrirmyndin; lestu hann.

## Fyrirmyndin: lestu þessar skrár fyrst

Allt er í `~/vakto-live` (git-worktree af VAKTO, grein `live-fixes`).

| Skrá | Hvað |
|---|---|
| `src/components/site/home-client.tsx` | Forsíðan öll: hetja með myndbandi, eiginleika-bento, glærusýning, ljóst/dökkt-samanburður, samningur, Wallet-skírteini, verð |
| `src/components/site/home-text.ts` | Allur texti forsíðunnar, IS og EN (sama lögun, `typeof is`) |
| `src/components/site/home.css` | Allir stílar, afmarkaðir undir `.ah` |
| `src/components/site/lang.tsx` | IS/EN: `useSiteLang`, `setSiteLang`, `LangToggle`, `?lang=en` |
| `src/components/site/site-nav.tsx` | Efsta valmynd + þrjú strik í síma |
| `src/components/site/ah-footer.tsx` | Fótur (IS/EN), netfang, samfélagsmiðlar, lögfræði |
| `src/components/site/about-client.tsx` + `um.css` | „Um okkur“ með mynd af stofnanda og sögu hans |
| `src/components/site/auth-pages.tsx` + `auth.css` | Innskráning og nýskráning í sama útliti (formin sjálf óbreytt) |
| `src/components/site/ah-legal.tsx` + `legal.css` | Lögfræðisíður (texti í `src/components/legal/*`) |
| `src/components/site/home-chat.tsx` | Spjallgluggi í horninu (appelsínugul kúla) |
| `scripts/shots-forsida.mjs`, `shots-forsida-app.mjs`, `shots-forsida-kiosk.mjs`, `shots-forsida-ai.mjs` | Skjámyndir teknar sjálfvirkt úr alvöru kerfinu (Playwright, demo-fyrirtæki á staging) |
| `scripts/video-forsida.mjs` | Myndbandið í hetjunni: alvöru notkun tekin upp (CDP-screencast + ffmpeg), mús teiknuð inn |

Lifandi útgáfa: https://www.vakto.is (prófaðu líka https://www.vakto.is/?lang=en, /um-okkur, /login, /nyskraning).

## Hönnunarmálið

- **Apple-legt og ljóst.** Bakgrunnur `#fbfbfd`, texti `#1d1d1f`, gráir tónar `#6e6e73`/`#86868b`. Eitt áherslulit
  (vörumerkislitur kerfisins). Daufur bjarmi í áherslulitnum í bakgrunni sem færist og fyllir síðuna við skrun (`Glow`).
- **Eitt letur** (General Sans hjá VAKTO), feitt og þétt í fyrirsögnum (`letter-spacing:-.035em`), stórar fyrirsagnir.
- **Sýna kerfið, ekki lýsa því.** Allar myndir eru alvöru skjámyndir og upptökur úr kerfinu og appinu. Ekkert teiknað
  upp á nýtt, engin gervigreindarmyndbönd, ekkert falskt viðmót.
- **Mac-gluggi** (þrír punktar + slóð) utan um skjámyndir af vefkerfinu; **iPhone-rammi** utan um appið.
- **Hreyfing:** einn rAF-skrunhlustari á kafla, virkur aðeins á meðan kaflinn sést (IntersectionObserver), skrifar
  `transform`/`opacity` beint á DOM (ekkert React-state við skrun). Allt slökkt með `prefers-reduced-motion`.
- **Kaflarnir á forsíðunni:**
  1. Hetja: fyrirsögn + CTA; Mac-gluggi með **myndbandi** rennur upp yfir fyrirsögnina og stækkar við skrun (sticky).
  2. „Allt sem … þarf.“: bento-reitir (breiður / hár / venjulegir) með skjámyndum. Einn reitur sýnir mús draga hlut
     á milli reita (klippt úr sömu skjámynd með `background-position`), einn sýnir app með lifandi teljara.
  3. „Kynntu þér …“: glærur sem fletta sjálfkrafa, framvindustika í punktinum + hlé-hnappur (eins og apple.com).
  4. Dökkur kafli: dragðu-til-að-bera-saman ljóst/dökkt + símar með appinu.
  5. Sérstaða kerfisins (hjá VAKTO: ráðningarsamningur með stimpli, Wallet-skírteini með mynd og kennitölum).
  6. Verð: eitt kort, stór tala, lítill texti.
  7. Fótur með netfangi.
- **Sími:** allt fellur í einn dálk, þrjú strik hægra megin opna valmynd, styttri bil á milli kafla (72px).

## Það sem eigandinn hefur sagt (fylgdu þessu)

- Vill **sýna kerfið sem mest**, í ljósu og dökku, „summað inn“ í kerfið. Ekki AI-myndbönd.
- **Engin emoji**, línuíkon. Ekkert sem „lítur út eins og AI“: engir merkimiðar í hástöfum fyrir ofan fyrirsagnir, engin
  litaðir randar vinstra megin á spjöldum, engir gradient-textar, engin „—“ í texta, engar kúlur með punktum.
- Aðdráttur alla leið inn í mynd var of mikið; **myndband sem stækkar** við skrun virkaði betur.
- Smáatriði skipta máli: bil sem er of stórt, texti sem er skorinn, mús sem dregur vitlaust → allt lagað.
- Vinnulagið sem virkaði: byggja á **forskoðunarslóð/grein** (ekki á lifandi vef), senda skjámyndir, laga eftir hans
  athugasemdum, og setja í loftið þegar hann segir það.

## Vinnulag

1. Lestu CLAUDE.md og vinnureglur þíns verkefnis fyrst (útgáfuferli, hvaða grein, staging vs prod).
2. Lærðu vöruna úr kóðanum: hvaða skjáir, hvaða gögn, hvað er sérstakt. Skrifaðu textann út frá því, ekki ágiskunum.
3. Settu upp demo-gögn sem líta raunverulega út og taktu skjámyndir/myndband sjálfvirkt (afritaðu og aðlagaðu scriptin).
4. Byggðu á sér grein + preview, sendu eigandanum skjámyndir (tölva + sími), lagaðu, endurtaktu.
5. IS og EN frá upphafi (allur texti í einni orðabók).
