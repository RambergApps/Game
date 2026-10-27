# Sjekkliste – spillfølelse (Breach Test)

Grunnlag: visjonen i `docs/PROSJEKT.md` («tyngde, dekning, disiplin», mørk industriell sci-fi, varme fiender mot kald spiller)
og konseptkunsten i `.../attachments/` (14 bilder, sett gjennom 2026-10-23: fiendeoversikt, Warden-ark, Board 01–03,
spillskjermbilder med HUD, tittel-/menyskjerm). Konseptkunsten er referanse, ikke fasit.
Hvert punkt vurderes **OK / Svak / Mangler** med skjermbilde som bevis (`shots/test/`).

## 1. Lesbarhet ovenfra
- [ ] Warden skilles fra fiender på et blikk: kald grå rustning + cyan visir/aksent (#39c6ff) mot røde/oransje/lilla fiender.
- [ ] Cyan markør/ring under spilleren (konseptet bruker en cyan ring) – synlig også i mørke områder.
- [ ] Hver fiendetype gjenkjennes på silhuett + farge: Grunt rød #c0392b, Flanker mørkerød hette #8e1e1e, Heavy oransje glød #ff7a1a (stor, skjold), Grenadier lilla #9b59ff.
- [ ] Fiender har små HP-striper og typeikon over hodet (som i konseptet) uten at det blir rotete.
- [ ] Karakterkropp ca. 28–32 px i diameter i spillskala; ikke for små i 1280x720 med valgt zoom.
- [ ] Siktretning tydelig (våpen/siktelinje/laser), uten at musepekeren forsvinner.

## 2. Dekning (kjernen i spillet)
- [ ] Low cover (kan skytes over, blokkerer ikke sikt) og high cover (blokkerer sikt og kuler) ser ulike ut uten debug.
- [ ] E inn i dekning: tydelig «snap» mot kanten, animasjon/lyd, `coverEnter`-hendelse; føles tungt og kontrollert, ikke klebrig.
- [ ] I dekning: Warden er synlig beskyttet (bøyd bak low, rygg mot high), kan kikke/blindskyte rundt hjørner ved high.
- [ ] Ut av dekning: E/bevegelse bort, `coverExit`, ingen fastlåsing.
- [ ] Kuler mot cover gir gnister/støv (konsept: oransje treff i kanten) – spilleren *ser* at dekningen virker.
- [ ] Fiender bruker også dekning og flankerer – trussel kommer fra sidene, ikke bare rett fram.

## 3. Bevegelse og rulling (tyngde)
- [ ] WASD: kort akselerasjon/retardasjon som gir vekt, men ingen «is».
- [ ] Space = rulling: rask, kort, med tydelig start/slutt, støvsky/strek (konseptets stiplede pil), kort sårbarhetsvindu/nedkjøling.
- [ ] Rulling fra dekning til dekning føles som Gears «roadie run/cover dash».
- [ ] Kollisjon mot cover og vegger er presis (ingen gjennomgang, ingen hekting på hjørner).

## 4. Skyting og treff
- [ ] Munningsflamme, sporlys (gule/oransje streker som i konseptet), lyd og liten kamerarist ved skudd.
- [ ] Treffbekreftelse: blink/sprut på fiende, skadetall eller hitmarker; døende fiende faller tydelig.
- [ ] Spilleren som tar skade: rødt blink, ristning, HP-stripe ned – aldri «hvorfor døde jeg».
- [ ] Granat (Grenadier): rød fareområde-sirkel med varselikon før eksplosjon (som i konseptet), tid til å reagere.
- [ ] Ammunisjon/omlading (R) synlig i HUD.

## 5. Stemning og miljø
- [ ] Mørk industri: betong #2b2e31, metall #3d4246, varselstriper #c9a227, varme lyspunkter #ffb347.
- [ ] Lys og skygge gir dybde (konseptet: lamper, glød fra ovner/flammer, våt asfalt) – ikke flat grå flate med rutenett.
- [ ] Arenaene matcher konseptbrettene: Container Yard, Refinery Crossroads, Underground Foundry – flere ruter (venstre/sentrum/høyre).
- [ ] Ingen «programmerer-grafikk» (rene sirkler/rektangler) i noe som skal leveres.

## 6. HUD og flyt
- [ ] HUD som i konseptet: bølge «WAVE x/y» + fiender igjen øverst til venstre, mål-liste, portrett + HP/rustning nede til venstre, våpen + ammo nede i midten, evner (Q/Space/G/R) med nedkjøling, minikart øverst til høyre.
- [ ] All tekst i spillet (UI, HUD, menyer, startskjerm, mellomsekvenser) er på **engelsk** (regel fra Breach 23.10.2026). Dokumentasjon og vurderinger er fortsatt på norsk. `tests/run.mjs` sjekker dette automatisk, statisk og under kjøring.
- [ ] Bølgestart varsles (`waveStart`), pause mellom bølger, tydelig seier/tap.
- [ ] Tittelskjerm «BREACH // Arena Protocol» med Spill/Innstillinger/Avslutt.

## 7. Teknisk følelse
- [ ] Stabil 60 FPS i riggen (p95 ≤ 17 ms, ingen rammer > 33 ms) også under kamp med mange kuler/effekter.
- [ ] Inndata reagerer samme ramme (ingen merkbar forsinkelse); pressed/released mistes ikke.
- [ ] Ingen konsollfeil/404 i noen side, ingen eksterne forespørsler.
