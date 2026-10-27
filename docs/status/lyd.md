# Status – Lyd og musikk (Breach Lyd)
Oppdatert: 2026-10-26 15:45 – STANDBY etter v1.6 (meldt til Breach)

## Ferdig
- Lydsystem i game/src/audio (index, engine, sfx, synth, mech, stingers, cinder, music, radio). Koblet i main.js via mods.audio. Vi rører ikke main.js.
- v1–v1.4: våpen, reload, granat, blokkert treff, nivålyder, CINDER-fiender, underjordisk taiko-musikk.
- v1.4.1–v1.5: CINDER-radio (announcer/command/warden), sekvensåpninger, upgradeOffer/upgrade, organiske skudd, Kiln Alpha, restart, midlertidig boss, rulletekst, demoflyt verifisert.
  - Volum-API (localStorage 'breach.audio.volumes'). src/audio/README.md med API og treff-/død-timing for Effekter.
- v1.6: menymusikk (stingers.js createMenuMusic) på menuOpen/Start/Close med fade; _meter() på klipperutgang (RMS/topp), played._total. Headless trenger ?menu=1.
- Verifisert: render uten klipping, lang 0/0 på audio-sidene, røyktest uten konsollfeil (intro-radio per speaker og Spitter-kast live).
- Review: reviews/lyd-2026-10-23.md (seksjon v1.6).

## Pågår
- Ingenting. Standby til Breach melder fra.

## Neste
- Spilt kamp-test av bulletImpact (demo.cjs dreper automatisk). Flere explosion-varianter når Våpen får nye kind.
- Dykk ved levelStart brett 2 (−66 dB ~0,3 s).
- Ashmaw-lyder mot docs/BOSS.md: bossPhase, weakPointHit, bossStagger og coverBreak. Plan står i review. Erstatter da de midlertidige bosslydene.
- grenadeBounce `surface` når Våpen sender det.

## Blokkert av
- Ashmaw/BOSS.md: kommer etter demoen, ikke start.
- Story og brett skal sende upgradeOffer fra offerUpgrade() (lytter finnes).
- Lyttetest tas av Test i full kjøring. Barb og «Signal lost.» beholdes til da.

## Siste skjermbilde
- reviews/lyd-2026-10-23/v16-meny.png (hovedmeny med menymusikk, v1.6)
