# Warden – status (Breach Warden-design og animasjon) – 27.10 23:33

**Nå: LEDIG.** Siste: E/klikk-interaksjon ved utganger brett 2 levert (player/interact.js i breach-brett2; Story eier AUTO_ZONE=false og skjuler DOOR-markør). Skjermbilde breach-brett2/shots/warden-interakt-ledetekst.png, run.mjs OK. Overgangsanimasjoner stoppet; ammo-diff droppet.

## Ferdig
- Dødsanim v1 (8 retninger, 1,1 s, holdt til respawn) + v2 sluttpose: beina samlet,
  parallelle, knær trukket opp (ikke rag doll). shots/warden-C-dod-v2.mp4 / -v2-for-etter.png
- Del 2 – reis over lav dekning (Warden C):
  - Dukket: overkroppen bøyd ned/fram (mur/barrier kryper 1,45× dypere), rifla nede.
  - popUp: står helt opp, hele figuren flyttes 4,5 px mot kanten (henger sammen, ingen brudd).
  - Rask overgang på rå peek (0,14 s opp / 0,12 s ned). Blindfire: dukket, bare rifla opp.
  - Brudd-feilen (kropp/bein kuttet) var vår egen: overkroppen ble løftet/forskjøvet uten
    beina. Fikset i paintedC, ingen endring/diff i depth.js nødvendig.
  - Hendelser coverRise {entity,x,y,type,nx,ny,cover} ved peek ≥0,6 og coverDuck {…} ved
    peek ≤0,3; p.exposed true mellom dem. False ved coverExit, rull, død (coverDuck sendes).
  - Treffsjanse følger exposed: popUp 0,6 kun når exposed, ellers 0,1 (core/combat.js urørt).
- Treff (300 fiendekuler gjennom core per positur): sandsekk dukket 28 / oppe 174 / blind 98;
  mur dukket 36 / oppe 191 / blind 87.
- Hode over kanten bak dekning (skjerm-px, zoom 2,25): sekk/kasse 27→71, mur 15→71.
- Filer: player/state.js, player/tuning.js, shared/rig/rig.js (peekRaw/blindRaw),
  rig/styles/paintedC.js, rig/paintedC/paintedC.js, rig/clips.js. Kopier: /workspace/wt/bk-*.
- tests/run.mjs: OK (10 sider, 0 feil).

## Pågår / neste
- Ingenting. Venter på Breach.

## Svakheter
- Dukket = sammenpresset malt overkropp, ikke ommalt huk. Ingen armer separat.
- Ekte grunt-AI skjøt nesten ikke i klippet; treffall er målt med kuler via core.

## Siste skjermbilder
- shots/warden-C-cover-hel.png, warden-C-cover-for-etter.png, warden-C-cover-reis.mp4
