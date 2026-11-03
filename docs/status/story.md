# Status – Story og brett (oppdatert 2026-10-28 13:36)
Eier: game/src/levels/ og game/src/story/. Historie: CINDER (låst). Spilltekst engelsk.
Brett 2 bygges KUN i kopien /workspace/breach-brett2. Sikkerhetskopi: /workspace/wt/bk-brett2-2026-10-28-muren/ (før porting: -pre-muren/).

**Brett 2 avsluttet etter Muren v2B per Alexander 13:24; restpunkter i reviews/brett2-restpunkter.md venter.**

## Ferdig (brett 2, i kopien)
- Layout 187×46 (refinery-v3.js), S1–S6 lukket, 0 lekkasjer, to S3→S4-utganger. Mål: reviews/brett2-maal.md.
- S5 «Muren v2B» erstatter Ringborgen (portet 13:25 fra mock-festning-v2b): mur øst–vest y 22–24, vestmur, port med stolper og overligger, tårn, sandsekker, tank, drepesone 10,2 ruter, sørlinje y 34,2, hakk ved S6-rattet. Markør: reviews/MUREN-GEO-KLAR.
- Tegning: arena/fort.js og effects/fort-cover.js, koblet i render.js, kinds.js, arena/index.js og cover.js.
- Fiende-AIs fiende-ai-defense-S5-muren.diff lagt inn (spawn b1–b3/brear + defense axis 'y'). Ringborgen-defense er borte.
- HUD S5: «Breach the Wall. Take the gate.»
- v10: objektene dybdesortert med Warden; overganger uendret.
- Tester 2026-10-28 13:36: reg-smoke + reg-smoke-brett2 OK, S5-røyktest OK (0 konsollfeil), fullkjøring S1→S6 (S3 nord) vunnet, hold 75 s, til brett 3.
- BUILD i kopien: 2026-10-28 13:36.

## Kjente avvik (godkjent i mocken, ikke rettet)
- Min-hopp 0,0: murstykker kant i kant, og ventil 132;33,65 overlapper sørlinja 133;34,2.
- Hakk-container 153,5;25 ligger 0,6 fra S6-rattet og 1,0 fra åpningen. Rattet nås nordfra.
- Fiende-AI: b1/b3 1,49 og ankre W/E 0,94 ruter fra portåpningen (bevisst).
- Kopiens yard-v2.js er eldre enn /workspace/breach (mangler Arenas G1/G12) – må ikke kopieres over.

## Neste
1. Restpunkter: reviews/brett2-restpunkter.md.
2. Breach laster opp (ikke Story og brett).
