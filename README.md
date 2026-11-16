# ŠK Blava 1928 – návrh webu

Návrh nového webu futbalového klubu ŠK Blava 1928 (Športové kluby Blava 1928 Jaslovské Bohunice). **Nie je to oficiálna stránka klubu.** Ukážka má v hlavičke pás s týmto upozornením a vyhľadávače ju neindexujú (`noindex`).

Ukážka: https://matuslenicky.github.io/sk-blava/ · administrácia (ukážka bez ukladania): https://matuslenicky.github.io/sk-blava/admin/

## Vzhľad

Farby z erbu: žltý kruh, modrá stuha s nápisom ŠK BLAVA, rok 1928. Výsledok zápasu nesie **stuha z erbu** (modrý pás s vystrihnutými koncami), predely sekcií sú **vlnovky potoka Blava** a pásom plynie **pokrik z klubovej hymny** („Malý potok, ale silná riava“). Krémový podklad, písmo Bricolage Grotesque a Figtree. Menu je na počítači rozdelené okolo erbu, na telefóne sa rozbalí pod hlavičkou. Zelená je len pri histórii (prvé dresy z roku 1928 boli biele so zeleným pruhom).

## Obsah a zdroje

- Zápasy, výsledky, strelci, karty, počty divákov, zostavy dospelých, tabuľky a súpisky šiestich tímov zo Sportnetu (Futbalnet), verejné API súťaží (`scripts/sportnet.mjs` → `data/sportnet.json`). Vek hráčov sa neukladá, zostavy len pri dospelých.
- Údaje o klube v `data/klub.json`, každá časť s uvedeným zdrojom: história, hymna, kluby ŠK Blava, kontakt, správna rada, prenájom športovísk a bulletin zo starého webu skblava.sk; pohár so Spartakom Trnava 2024, farby a umiestnenie 2025/26 z Wikipédie; ihrisko zo Sportnetu. Kapacitu štadióna zdroje uvádzajú rozdielne, preto sa neuvádza.
- Erb ŠK Blava a erby súperov zo Sportnetu (`scripts/logos.py`). Patria príslušným klubom. Instagram klub nemá, odkazuje sa na Facebook.
- Písmo Bricolage Grotesque a Figtree, licencia SIL Open Font License 1.1 (`scripts/fonts.py`).
- Texty starého webu (`data/stary-web/`, sťahované len ako zdroj faktov) nie sú v repozitári.

## Zostavenie

Statický generátor bez závislostí (Node 20+, Python 3 s Pillow na erby):

```
node scripts/sportnet.mjs        # zápasy, tabuľky a súpisky (FULL=1 stiahne znova aj detaily zápasov)
python -I scripts/logos.py       # erby súperov a náš erb do src/img (FORCE=1 stiahne znova)
node build.js                    # data/ + src/ -> dist/ (TODAY=2026-11-16 prepíše dnešný dátum)
node scripts/serve.mjs dist 5310 # náhľad na http://127.0.0.1:5310/
node scripts/deploy.mjs          # nasadenie dist/ na vetvu gh-pages (GitHub Pages)
```

Výsledky sa po zápasoch aktualizujú samé cez GitHub Actions (`.github/workflows/sportnet.yml`).
