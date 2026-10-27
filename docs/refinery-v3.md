# Deepwell Refinery v3 – plan for nivå 2 (Story og brett, 27.10, KUN PLAN)

Kart: `docs/refinery-v3.png`. Generator og selvsjekk (samme PIL-metode som v2): `python3 reviews/story-tools/refinery-v3.py`. v2-filene er ikke endret. Ingenting er bygd, og game/ er ikke rørt.

## Endret fra v2
- Brettet er lengre: 142 × 32 ruter mot 96 × 36, med seks seksjoner mot fem. Størrelsen på rommene varierer nå med vilje (liten, stor, middels, liten, stor, middels). I v2 var alle fem rom omtrent like store (14–20 × 16–26).
- Nytt: **S5 The Bulwark** er en forsvarsstilling som Warden angriper. Fiendene står på plass fra første sekund og kommer ikke i bølger.
- Coveret er tegnet for hånd, ikke lagt i et jevnt rutenett. Tettheten varierer med vilje (se tabellen).
- Det er to nye typer smale rom: en korridor med blind sving (S1) og to parallelle rørganger med én tverrforbindelse (S4).
- Holdet ved FUEL 01 er beholdt som finale (S6). Bølgen er den samme som 2-6 i v2.

## Seksjoner
| Seksjon (navn i spillet) | Størrelse | Rolle | Fiender | Cover (stk / per 100 ruter²) |
|---|---|---|---|---|
| S1 Intake Line | LITEN, 5 bred, L-sving | Korridor, blind sving | Husk 3, Lurcher 2 (fra svingen) | 7 / 3,3, spredt |
| S2 Cracking Hall | STOR 30 × 24 | Åpen hall med lange siktlinjer | Husk 6 på avstand, Spitter 1 | 14 / 1,9, **glissen** |
| S3 Pump Room | MIDDELS 16 × 14 | Nærkamp med tett cover, to utganger | Kiln 1, Husk 3, Hunker 1 | 11 / 4,9, **tett** |
| S4 Pipe Gallery | LITEN, 2 løp à 4 | Bakhold i parallelle rørganger | Lurcher 3, Husk 2 | 7 / 3,1, lave rør og ventiler |
| S5 The Bulwark | STOR 20 × 14 + flankeganger 3 brede | **ANGREP** på nedgravd linje | Hunker 3, Husk 2, Spitter 1 (sitter fast); Lurcher 2 + Husk 2 (presser) | 15 / 3,5 |
| S6 Fuel Tank | MIDDELS 16 × 22 | Hold i 75 s (som v2) | Som 2-6 i v2, med Kiln Alpha | 8 / 2,3 |

Bare eksisterende objekttyper er brukt (arena/index.js TYPE): wall, container, tank, building, pipeline, water, barrier, sandbag, crates, barrels, pipes, valve. Fiendetypene er grunt/flanker/heavy/grenadier/hunker (levels/data.js ENEMY_TYPES), og Kiln Alpha er heavy med variant 'alpha'.

## Rytmen
**Trangt → åpent → middels → trangt → angrep → hold.**
- S1: kort avstand og blinde hjørner. Lurcher er farligst her.
- S2: avstand og siktlinjer. Husk-skytterne dominerer, og spilleren må hoppe 4–6 ruter mellom coverene. Flankeruten går langs sørkanten bak containerne.
- S3: et pusterom med tett cover og Kiln på nært hold. Rommet har to utganger, så spilleren velger løp inn i S4.
- S4: trangt igjen. Lurcherne kommer rundt tverrforbindelsen og fra trakta i øst.
- S5: spilleren tar initiativet selv (se under).
- S6: spilleren forsvarer, og brettet ender som før.

Fargebåndet øverst på kartet viser rytmen.

## The Bulwark – slik spilles den
1. **Oppsett.** Når S4 er ryddet, åpnes trakta: en port på 4 ruter inn til en tilnærmingssone på ca. 13 ruter.
   - Hunker b1–b3 (W-vendt) står i sandsekklinja ved x 116, med Husk 2 og Spitter 1 bak (brear).
   - Alle spawner med delay 0–1 s, så stillingen er bemannet før Warden ser den.
   - Hunker velger lavt cover nær spawn (coverBias), og ryggskjoldet halverer skaden forfra (±60°).
2. **Trakta.** Siktlinjene fra linja går rett ned midten. Containeren i midten (107,11, høy) er den første trygge pausen. Det lave coveret i midten er mellomtett, med 3–5 ruter mellom.
3. **Angrep forfra.** Det går, men det er tregt: skjoldet tar halve skaden, og Spitter lobber granater mot containeren.
4. **Flanken er løsningen.** Det er to ganger på 3 ruter, mot nord og mot sør, bak containerveggen. Begge har blinde hjørner og et par lave stykker (barrels/crates).
   - Gangene kommer ut **bak** linja ved x 117–121.
   - Når Warden ser en Hunker mer enn 70° fra coverfronten, forlater den coveret og må velge nytt (dette finnes i hunker.js). Da er den sårbar, og linja går i oppløsning.
5. **Hvem presser.** Lurcher 2 kommer ut gjennom den flankegangen Warden *ikke* bruker (bnorth/bsouth, ~12 s). Husk 2 kommer ved ~25 s. Dette er et motangrep fra stillingen, ikke en ny bølge.
6. **Mål og avslutning.** Målet er clear. Bølgen består av én enkelt wave med maxAlive 10 (alt er på banen samtidig), og det kommer ingen nye spawner etter ~25 s. Porten til S6 åpnes ved sectionClear. Ved død starter stillingen på nytt, og oppgraderingene beholdes (låst regel).

Wave-forslag (data.js-format):
`{ id: '2-5', name: 'The Bulwark', section: 'S5', objective: { type: 'clear' }, maxAlive: 10, breakAfter: 6, upgradeAfter: true, groups: [g('hunker',1,'b1',0,0), g('hunker',1,'b2',0,0), g('hunker',1,'b3',0,0), g('grunt',2,'brear',0,1), g('grenadier',1,'brear',1,0), g('flanker',2,'bnorth',12,1.5), g('grunt',2,'bsouth',25,1.2)] }` (trussel 14,4)

## Vanskelighetskurve (trussel = sum THREAT)
S1 ~6 → S2 ~8 → S3 ~7,8 → S4 ~6,5 → S5 14,4 → S6 27,6 (v2 2-6).
- S4 er bevisst lavere. Det er et pust før toppen, og trangheten gjør det likevel farlig.
- Det betyr at trusselkurven ikke lenger stiger strengt slik den gjorde i v2. Det er et valg.
- Oppgraderingskort etter S2, S3 og S5.

## Selvsjekk (refinery-v3.py, alle består)
- Alle starter, spawner og holdsonen er nåbare.
- Minste cover-hopp er **2,55 ruter** (krav ≥ 2,2). Snittet er 4,25.
- Største avstand til nærmeste cover er **6,74 ruter**. Det er under dash-radiusen på 10 ruter (tuning.js dashRadius 320 px), så det går an å komme fra cover til cover overalt. Dette lukker det åpne punktet fra yard v2.
- Hver seksjonsstart har cover innen 4,5 ruter.
- Ikke sjekket ennå (gjøres i byggefasen, som for v2): klaring 1,25, Kiln-korridor og blokkert sikt fra spawn til seksjonsstart.

## Krever mer enn nivådata (ærlig liste)
- **Porter/seksjoner (`gate`, `section`, `sectionClear`)** er ikke i koden i dag. Det var de heller ikke i v2. Uten dem kan bølgene kjøres i rekkefølge med fiender fra seksjonsspawner, men da kan spilleren løpe forbi.
- **Forsvarsstillingen kommer fra coveroppførselen.** Det finnes ikke noe «hold posisjon»-flagg i bølgedataene. Husk kan derfor rykke frem fra linja. createEnemy har `aware: false` (vakt som ikke vekkes), men levels/index.js sender den ikke videre. Hvis den skal brukes, trengs én linje i spawn (`g(..., { aware:false })`). Det er valgfritt, ikke nødvendig.
- **«Høyere stilling»** finnes ikke som mekanikk, siden alt er på samme høyde. Stillingen bruker derfor trakt, siktlinjer og ryggskjold.
- Fuel integrity i holdet (fra v2) er fortsatt nytt. Uten den er S6 et vanlig hold.

## Åpne spørsmål til Alexander
1. Er brettet for langt? 142 ruter gir ca. 8–10 min mot 6–7 i v2.
2. Skal S5 ha `aware:false`-vakter (én linje kode), eller holder coveroppførselen?
3. Er det greit at S4 har lavere trussel enn S3?
