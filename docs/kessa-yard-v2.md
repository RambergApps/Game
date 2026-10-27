# Kessa Yard v2 – planskisse (Story og brett, 27.10)

Skisse: `docs/kessa-yard-v2.png` (tegnet fra dataene under). Generator + selvsjekk: `python3 reviews/story-tools/yard-v2.py` (skriver også `reviews/story-tools/yard-v2.js.txt`).

## Intensjon
- Kaiområde, ikke firkant: vannkant i sør med pir (x 14–18) og innbuktning (vann x 26–32, y 22–30). Nisjer i vest (B2-bygget stikker inn) og nordvest/nordøst (B1/B3).
- Hevet plattform øst (x 32–39, y 4–14,5, +1 nivå) med rampe fra vest (x 30–32, y 9–12). Kanten (`ledge`) er lav: gir dekning og siktlinje, men er ikke gangbar.
- Inne i banen kun lav dekning (36 tupler: barrier, sandbag, crates/paller, barrels). Høye ting (bygg, containere) bare inntil ytterkanten. Ingen extraction-sone/port (`exit` fjernet).
- Størrelse 40 × 30 ruter (1 rute = 32 px), samme som i dag.

## Innganger (navn → spawn-nøkkel)
| Inngang | nøkkel | spawn (ruter) |
|---|---|---|
| North Gate (åpning x 18–23) | north | 20,5 / 1,8 |
| Rail Cut (vest, y 6–9) | northwest | 1,8 / 7,5 |
| West Road (vest, y 12–15) | west | 1,8 / 13,5 |
| Platform Stairs (øst, y 5–8, rett opp på plattformen) | northeast | 37,8 / 6,5 |
| East Lane (øst, y 15–18, under plattformen) | east | 37,8 / 16,5 |
| Quay Ladders (klatrer opp fra vannet øst for innbuktningen) | south | 35 / 24,5 |
| Pier (klatrer opp på pirspissen) | pier | 16 / 28,6 |

Spiller: `entry` 8 / 21,5 (256 / 688 px), ENTRY-rektangel x 6, y 20,25, 4 × 2,5 ruter. Første dekning sandbag 7,18.25 (2 × 0,75), 2,9 ruter foran. Første ammokasse A1 13,5/21 = 5,5 ruter fra spawn, inntil L2 (13,22) og barrier 11.5,21. Øvrige: A2 midt (20,5/17,5), A3 på plattformen, A4 nord-midt.

## Revisjon 27.10 13:40 (Alexanders tilbakemelding)
- Klaringsregel (hard feil i selvsjekken): hver lav dekning ≥ 1,25 ruter fra vann, kaikant, ledge, vegg, bygg, container og kartkant (1 rute + 0,25 fordi tegnet kaikant/ledge-rim er tykkere enn dataene). Dybde min(w,h) ≥ 0,625.
- Gamle brudd: sandbag 15,26.5 (på piren), crates 22,24 (kaikant), barrier 33,20 og 29,19 (innbuktningen), sandbag 4,20 og barrier 5,15 (B2/container). Alle flyttet/erstattet.
- Retning: 19 vertikale (h > w) av 36 tupler (53 %), 7 L-former (to tupler som berører hverandre, ingen rotasjonsfelt).

| Inngang | Dekning som skjermer mot den |
|---|---|
| North Gate | L4 (8,11), barrier 15,9, crates 17,14, L6 (26,6/28,4.5), sandbag 12,5 |
| Rail Cut (NW) | barrier 6,7 (V), L4 (8,12 V), barrels 11,8 |
| West Road | barrier 5.25,17.25 (V, siktlinje), barrier 5.5,13.5 (V), barrier 13,15 (V), barrier 11,21 (V) |
| Platform Stairs (NE) | L5 (26,11 V + 27,13), L6, L7 på plattformen, barrier 34,6 |
| East Lane | barrier 21,12 (V), barrier 28.5,17.5 (V), barrier 35,16.5 (V), L3 |
| Quay Ladders (S) | L3 (33.5,18.5 + 33.5,19.25), sandbag 25,16, crates 22,22.5 |
| Pier | L2 (13,22 + 16,22), barrier 11.5,21 (V, h 3,75, siktlinje), barrier 20,21 (V) |

## Revisjon 27.10 13:55 (startplass)
- Spawn flyttet fra 5/23,5 (trangt, under B2-containeren) til 8/21,5 på åpen kai. ENTRY = rektangel 4 × 2,5 (arena/index.js bruker def.entry som rect).
- Harde sjekker: hele ENTRY i gangbart område; ≥ 1,25 ruter fra alle objekter (også dekning) og kartkant; ikke i skygge (fotavtrykk for container/bygg forlenget +0,76/+1,18 ruter mot sørøst + 0,15 margin, shared/light.js); fiendespawn ≥ 8 ruter (nærmest: West Road 10,1); lav dekning 1,5–3,5 ruter fra spawn (2,9); ammo1 5–6 ruter (5,5).
- L1 fjernet (sandsekken gjenbrukt som første dekning), barrier 11,21 → 11.5,21 (0,75 bred).

## Revisjon 27.10 14:05 (regresjoner fra Arena)
- Ledge 0,5 → 0,625 dyp: 31.375,4,0.625,5 · 31.375,12,0.625,3 · 32,14.375,7,0.625 (innerkant uendret).
- East Lane-barrier 35,16.5 (h 2) → 35,17.75, 0,75 × 1,5 (Arenas forslag); L3 vannrett del 33.5,18.5 kortet fra 2 til 1,25 (overlapp).
- Nye: barrier 5.25,17.25 (0,75 × 1,5) mot West Road; barrier 11.5,21 forlenget til h 3,75 mot Pier.
- entry dir 'N'.
- Nye harde sjekker: ledge-dybde ≥ 0,625; korridor fra hver fiendespawn til spiller med kropp r 1,5 mot høye ting/vann/ledge (≥ 3 ruter) og Kiln r 22 px + 0,1 mot alt; siktlinje fra hver fiendespawn til spawn må treffe dekning/høyt objekt. Gamle east-barrier gir feil (verifisert).
- Min. hopp mellom separate stykker er fortsatt 2,2 (crates 24,5 ↔ 26,6 i L6-området); ikke hevet til 3 for å unngå nye brudd.

## Revisjon 27.10 14:10 (søyleregel, 55°)
- Vertikal lav dekning maks 2 ruter (hard sjekk). Splittede stykker fra samme original ≥ 1 rute fra hverandre (hard sjekk). Ledger urørt.
- barrier 11.5,21 h 3,75 → splittet: 11.5,21,0.75,1.5 + 11.5,23.5,0.75,1.25 (gap 1; nedre del blokkerer fortsatt Pier-linjen).
- Kortet til h 2: barrier 20,21,1,3 → 20,21.5,1,2 · 28.5,17.5,1,3 → 28.5,18,1,2 · 5.5,13.5,1,2.5 → 5.5,14.25,1,2 (flyttet ned så Rail Cut-linjen fortsatt treffes) · 13,15,1,2.5 → 13,15.25,1,2 · 21,12,1,3 → 21,12.5,1,2 · L5 sandbag 26,11,1,3 → 26,12,1,2 · L6 barrier 28,4.5,1,2.5 → 28,4.5,1,2 (L-ene berører fortsatt).

## Revisjon 27.10 14:40 (stairGap)
- Sørkant-ledge 32,14.375,7 → 4,75 bred: trappeåpning x 36,75–38,75 (Arenas `stairGap`), restbiten øst for åpningen fjernet. Alle sjekker består.

## Hunker
Dekning ligger i et forskutt rutenett: nærmeste separate stykke 2,2–5,5 ruter (snitt 3,4), så Hunker kan hoppe cover→cover hele veien fra hver inngang. Grønn linje i skissen = typisk sløyfe. Plattformkanten er et godt «sitte»-punkt for Hunker/Spitter (overtak), rampen er struping.

## 5 bølger (forslag, innganger)
1. north (+ én fra northwest) – lær retning.
2. north + northeast (plattformen tas i bruk).
3. east + west – flanke, Lurcher. Hunker introduseres fra north.
4. northwest + west + pier – klype fra vest/sør, Hunker ×2.
5. Alle: north, northeast, east, south (quay), pier – topp, Kiln fra north.
Nivå 1 kan beholde dagens bølgedata (nøklene north/northwest/northeast/east/west finnes fortsatt); `south`/`pier` er nye og valgfrie.

## Ferdig data (lim inn, f.eks. `arena/yard-v2.js`)
```js
export const YARD_V2 = {
  id: 'yard', variant: 'v2', name: 'Kessa Yard', board: 'BOARD 01',
  cols: 40, rows: 30, seed: 0xB01A,
  entry: {'x': 6, 'y': 20.25, 'w': 4, 'h': 2.5}, // ingen exit/extraction
  playerSpawn: {'x': 8, 'y': 21.5},
  walkableSouth: 26, // kaikant (vann under); piren går til 29,5
  objects: [
    ['wall', 8, 0, 10, 1],
    ['wall', 23, 0, 8, 1],
    ['wall', 0, 5, 1, 1],
    ['wall', 0, 9, 1, 3],
    ['wall', 0, 15, 1, 11],
    ['wall', 39, 4, 1, 1],
    ['wall', 39, 8, 1, 7],
    ['wall', 39, 18, 1, 8],
    ['building', 0, 0, 8, 5, {'sign': 'B1'}],
    ['building', 31, 0, 9, 4, {'sign': 'B3'}],
    ['building', 0, 17, 4, 5, {'sign': 'B2'}],
    ['container', 9, 1, 6, 2, {'color': 1}],
    ['container', 24, 1, 6, 2, {'color': 0}],
    ['container', 37, 19, 2, 4, {'color': 2}],
    ['container', 1, 22, 3, 1.5, {'color': 4}],
    ['water', 0, 26, 14, 4],
    ['water', 18, 26, 8, 4],
    ['water', 26, 22, 6, 8],
    ['water', 32, 26, 8, 4],
    ['ledge', 31.375, 4, 0.625, 5],
    ['ledge', 31.375, 12, 0.625, 3],
    ['ledge', 32, 14.375, 4.75, 0.625],
    ['sandbag', 7, 18.25, 2, 0.75],
    ['barrier', 11.5, 21, 0.75, 1.5],
    ['barrier', 11.5, 23.5, 0.75, 1.25],
    ['barrier', 5.25, 17.25, 0.75, 1.5],
    ['crates', 9, 17, 2, 1],
    ['sandbag', 13, 22, 3, 1],
    ['barrier', 16, 22, 1, 2],
    ['barrier', 20, 21.5, 1, 2],
    ['crates', 22, 22.5, 2, 1],
    ['barrier', 33.5, 18.5, 1.25, 0.75],
    ['barrier', 33.5, 19.25, 0.75, 1.5],
    ['barrier', 28.5, 18, 1, 2],
    ['sandbag', 25, 16, 2, 1],
    ['barrier', 5.5, 14.25, 1, 2],
    ['sandbag', 8, 11, 3, 1],
    ['barrier', 8, 12, 1, 2],
    ['barrier', 13, 15.25, 1, 2],
    ['crates', 17, 14, 2, 1],
    ['barrier', 21, 12.5, 1, 2],
    ['sandbag', 26, 12, 1, 2],
    ['barrier', 27, 13, 2, 1],
    ['barrels', 11, 8, 1, 1],
    ['barrier', 15, 9, 3, 1],
    ['crates', 19, 7, 1, 2],
    ['sandbag', 24, 8, 2, 1],
    ['barrier', 6, 7, 1, 2],
    ['sandbag', 12, 5, 2, 1],
    ['barrier', 17, 4, 1, 2],
    ['crates', 24, 5, 2, 1],
    ['barrier', 28, 4.5, 1, 2],
    ['crates', 26, 6, 2, 1],
    ['barrier', 34, 6, 1, 2],
    ['sandbag', 35, 10, 2, 1],
    ['barrier', 33.5, 12, 1.75, 0.75],
    ['barrier', 33.5, 10.5, 0.75, 1.5],
    ['barrier', 35, 17.75, 0.75, 1.5],
  ],
  zones: {'platform': {'x': 32, 'y': 4, 'w': 7, 'h': 10.5, 'kind': 'raised', 'h_px': 24}, 'ramp': {'x': 30, 'y': 9, 'w': 2, 'h': 3, 'kind': 'ramp', 'dir': 'E'}},
  ammoCrates: [[13.5, 21], [20.5, 17.5], [34, 9], [16, 8.4]],
  spawnPoints: {
    entry: {'x': 8, 'y': 21.5, 'dir': 'N'},
    north: {'x': 20.5, 'y': 1.8, 'dir': 'N'},
    northwest: {'x': 1.8, 'y': 7.5, 'dir': 'NW'},
    west: {'x': 1.8, 'y': 13.5, 'dir': 'W'},
    northeast: {'x': 37.8, 'y': 6.5, 'dir': 'NE'},
    east: {'x': 37.8, 'y': 16.5, 'dir': 'E'},
    south: {'x': 35, 'y': 24.5, 'dir': 'S'},
    pier: {'x': 16, 'y': 28.6, 'dir': 'S'},
  },
};

// levels/data.js nivå 1
    spawnPoints: {
      entry: { x: 0.20, y: 0.72, dir: 'N' },
      north: { x: 0.51, y: 0.06, dir: 'N' },
      northwest: { x: 0.04, y: 0.25, dir: 'NW' },
      west: { x: 0.04, y: 0.45, dir: 'W' },
      northeast: { x: 0.94, y: 0.22, dir: 'NE' },
      east: { x: 0.94, y: 0.55, dir: 'E' },
      south: { x: 0.88, y: 0.82, dir: 'S' },
      pier: { x: 0.40, y: 0.95, dir: 'S' },
    },
```

## Arena må sjekke
- Nye kinds: `water` (blokkerer gange, ikke kuler/sikt; tegnes som vann) og `ledge` (lav dekning, blokkerer gange). Hvis det mangler: map midlertidig `water`→`wall` usynlig og `ledge`→`barrier`.
- `zones.platform` / `zones.ramp`: høydeforskjell er bare visuell + evt. sikt-bonus; trenger ingen fysikk nå. Si fra hvis kamera (75° ovenfra) skjuler noe bak B3 eller plattformen.
- `walkableSouth` gjelder ikke lenger rett linje – kaikanten styres av water-objektene (piren går til y 29,5).
- Kollisjon i åpningene (2,5–5 ruter brede) og at fiender ikke setter seg fast ved B2-nisjen og rampen.
- Lys/paint/props er ikke satt; gjenbruk stil fra yard.js. `routes`/`killZones` utgår.
