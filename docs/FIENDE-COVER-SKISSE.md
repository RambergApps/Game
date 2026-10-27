# Hunker – dekningsfiende (bygget 27.10, behaviors/hunker.js)
Type `'hunker'`, farge #e0c234, r 18, HUNKER_SCALE 1,2. Topp ≈ 39 stående / ≈ 18,6 dukket (low = 24). Ved tilt 55 er dukket Hunker skjult bak lavt cover bare når den står maks 18–20 px bak bakkanten, så cover-spot legges ≤ 18 px bak kanten. Krumbøyd menneskeudyr med beinplater på ryggen og slaggerifle (se shots/fiende-cover/a-hunker.jpg).

## Adferd
1. **toCover**: går til nærmeste lave cover med skuddvinkel mot spilleren, ikke lenger unna enn i dag (bestSpot med `lowOnly`, isWalkable på stedet).
2. **duck** (1,2–2,0 s, tilfeldig): `cover = 1`. Ryggskjoldet gir **skade × 0,5** når treffet kommer innenfor ±60° av coverets normal (forfra over muren). Fra siden/bak tar den full skade. Treff på skjoldet gir `hitAt` + `shieldHit: true`.
3. **peek → fire**: ber om fire-token. Får den det, går `peek` 0 → 1 over ≥ 0,45 s (telegrafen, med lyd). Deretter `anim fire` og en salve på 3 skudd, munning fra `HUNKER_MUZZLE` (importeres fra look/hunker.js, nå {fwd: 23, z: 27}, ikke hardkodet), og så ned igjen. Uten token blir den i duck og prøver på nytt etter 0,6 s.
4. **shift** (coverbytte): når den er flankert (spilleren ser forbi normalen, vinkelen er over 70°), etter 2–3 popups eller etter maks 4 s nedholdt. Bytter til nabocover 96–192 px unna, aldri tilbake til ett av de to siste stedene. `anim walk`, `cover 0,4–0,6`.
5. **Fremdrift**: uten sikt i over 3 s tar den et shift mot spilleren (samme hunt-regler som Husk). Softlock-vakten (8 s) gjelder uendret.

## Rettferdighet og squad
- Telegraf ≥ 0,4 s alltid, og bare innenfor kamerabildet (onscreen.js, margin 28 px), som for alle typer. attackPhase starter først når peek = 1.
- Teller som skytter i kvoten (maks 2 samtidig), ingen heavy-prioritet. Maks 1 Hunker i peek om gangen.
- shift teller som framrykk (`sq.advancer`, én om gangen). Hunker brukes som `squadFront`, så flankere går rundt den.
- Flanking belønnes, for skjoldet virker bare fra fronten.

## poseOf (avtalt med Monsterdesign)
| Tilstand | anim | cover | peek | attackPhase | facing / coverFacing | Ekstra |
|---|---|---|---|---|---|---|
| idle/hold | idle | 0 | 0 | – | facing | |
| toCover | walk | 0–0,2 | 0 | – | bevegelse | |
| duck | cover | 1 | 0 | – | coverFacing (rad) = coverets normal | skjold aktivt |
| peek (telegraf) | cover | 1 → 0,3 | 0 → 1 (≥ 0,4 s) | – | coverFacing → mot spiller | |
| fire | fire (alias attack) | 0,3 | 1 | 0–1 (munningsblink) | mot spiller | muzzle z ≈ 27 |
| shift | walk (cover ≥ 0,3 = krøket sprint) | 0,4–0,6 | 0 | – | bevegelse | |
| hit | hit | uendret | uendret | – | uendret | `hitAt`, `shieldHit` |
| death | die | → 0 | 0 | – | siste | |
facing er fallback når coverFacing mangler.

## Fra Arena (justert 27.10 – bygget uten å vente)
- Kantnormal regnes selv fra cover-rektangelet (cover.js-spot nx/ny); fronten = −normal mot Warden.
- Gåbarhet: world.arena.isWalkable via walk.js, ellers egen reserve. Lave cover fra Effekters cover.js (low=24).
- Kessa Yard (yard-v2) bruker samme vei; ingen Yard-koordinater i enemies.
