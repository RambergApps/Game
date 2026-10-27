# Forslag til CORE-API.md: sikte i brysthøyde og munning med høyde (Breach Karakter, 2026-10-23)

## PROJ (shared/projection.js, innført)
- `PROJ.aimHeight = 27`: høyde z i verdens-px over bakken (samme enhet som `PROJ.heights`). Det er brysthøyden på en stående figur (actor 48).
- `PROJ.aimZ = 27`: alias. Kuler og tracere for siktede skudd kan tegnes via `PROJ.toScreen(x, y, aimZ)`.
- `PROJ.aimGround(wx, wy) → { x: wx, y: wy + aimHeight·zScale }`, dvs. **+20,25 worldY**. Tar musepunktets bakkekoordinat (`input.mouse.worldX/Y`) og gir bakkepunktet rett under det samme skjermpunktet når det tolkes i brysthøyde.
- Gjelder bare `world.view === '34'`. Ovenfra brukes musa direkte.

## Spiller (player/, innført)
- Siktevinkelen `P.aim` (riggens retning) = atan2(aimGround − fotpunkt).
- Skuddretningen som gis til `weapons.handleInput(... { aimAngle })` i 34 = atan2(aimGround − munning). Kulene konvergerer da mot punktet under trådkorset. Er siktepunktet nærmere enn munningsavstanden + 12 px, brukes `P.aim`.
- `player.muzzle = { x, y, z }`:
  - x/y er den logiske munningen (uendret, kulene starter her).
  - z er høyden til det tegnede løpet i verdens-px (≈ 33,8 stående, ≈ 23–25 huket).
- `player.muzzleZ = player.muzzle.z`.
- `player.muzzleDraw = { x, y, z }` er den nøyaktig tegnede løpstuppen i 34 (oblique), til glimt: `PROJ.toScreen(md.x, md.y, md.z)`. Ovenfra er den lik `muzzle`.
- `player.aimPoint = { x, y, z }`: bakkepunktet spilleren sikter mot, med z = aimHeight (34) eller 0 (top).
- `rig.socket(name) → { x, y, angle, z }` for muzzle, butt, head, handR, handL, throwHand, back og chest. Andre navn gir z 0.
- Granatsiktet bruker fortsatt rå mus (bakken der musa peker).

## Forslag til Våpen (ikke gjort, bare lest)
1. Bruk `e.muzzle.z` (eller `muzzleDraw`) når glimt, tracer og kuler tegnes: `PROJ.toScreen(x, y, z)`. Kulen kan gå lineært fra munnings-z mot `PROJ.aimZ` over de første ca. 60 px, eller holde munnings-z hele veien. Logikken (x/y, treffsjekk) er uendret.
2. `getMuzzle` kan beholdes. Valgfritt: send z videre i `weaponFire`/`shot`-hendelsene (`z: e.muzzle?.z ?? 0`).
3. Konvergens også ovenfra (valgfritt): beregn retningen fra munningen mot siktepunktet i stedet for fra fotpunktet. I dag går kulene parallelt med siktelinjen, ca. 6–10 px til siden.
4. Treffsjekken (sirkel r rundt fotpunktet) trenger ingen endring.

## Forslag til Fiende-AI
- Sikt på spillerens fotpunkt `(player.x, player.y)` i world. Det er treffsirkelen, og logikken er uendret.
- Visuelt: spillerens bryst er z = `PROJ.aimHeight` (27). Fiendekuler og tracere bør tegnes i z ≈ egen munningshøyde → 27.
- Gi fiendene en munnings-z, f.eks. 0,7 × egen aktørhøyde.

## Forslag til Core (camera.js, ikke rørt)
- Kamera-lead bruker `mouse.worldX/Y`. I 34 kan den bruke `PROJ.aimGround(...)` (forskjellen er ca. 20 px × lead, altså liten).
