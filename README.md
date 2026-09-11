# klarkanis.cz

Osobní web Kláry Pospíšilové, business analytičky. Statický web bez build kroku,
nasazený přes GitHub Pages na doméně `klarkanis.cz` (soubor `CNAME`).

## Struktura

| Soubor | Účel |
| --- | --- |
| `index.html` | jediná veřejná stránka, obsah, metadata a strukturovaná data (JSON-LD) |
| `404.html` | vlastní chybová stránka (GitHub Pages ji vrací se stavem 404) |
| `styles.css` | design system: tokeny, typografie, layout, komponenty |
| `main.js` | navigace, odhalení při scrollu, kontaktní formulář, efekt na nadpisu |
| `fonts/` | Newsreader a IBM Plex Sans (SIL OFL), podmnožiny latin a latin-ext |
| `img/` | OG obrázek a ikony |
| `robots.txt`, `sitemap.xml`, `site.webmanifest`, `favicon.*` | technické SEO a ikony |
| `tools/` | šablona OG obrázku a skript, který generuje `img/*` a `favicon.ico` |

## Úpravy obsahu

Veškerý text je přímo v `index.html`. Při psaní česky držte pravidla typografie:
pevná mezera (`&nbsp;`) za jednopísmennými předložkami a spojkami (k, s, v, z, o, u, a, i),
české uvozovky „ “ a pomlčka pouze v rozmezích (5–10).

## Kontaktní formulář

Formulář posílá data na Web3Forms (`action` formuláře). Veřejný klíč `access_key`
v `index.html` je svázaný s cílovou e-mailovou adresou; nový klíč vystaví
[web3forms.com](https://web3forms.com). Pole `botcheck` je past na roboty, musí zůstat skryté a nezaškrtnuté.

## Generování obrázků

```
npm i -D playwright && npx playwright install chromium
node tools/render-assets.mjs
```

Skript vyrenderuje `tools/og.html` do `img/og.png` (1200×630) a z `favicon.svg`
vytvoří PNG ikony a `favicon.ico`.

## IndexNow

Soubor `c67a902aedcda3e9514c431b474252bb.txt` v kořeni je ověřovací klíč protokolu IndexNow (Bing, Seznam, Yandex).
Po změně obsahu lze změnu ohlásit jedním požadavkem:

```
curl -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json; charset=utf-8" \
  -d '{"host":"klarkanis.cz","key":"c67a902aedcda3e9514c431b474252bb","keyLocation":"https://klarkanis.cz/c67a902aedcda3e9514c431b474252bb.txt","urlList":["https://klarkanis.cz/"]}'
```

Google IndexNow nepoužívá, tam se o indexaci žádá v Google Search Console.

## Lokální náhled

Jakýkoli statický server v kořeni repozitáře, například `npx serve .`.
