# Warden – status (Breach Warden-design og animasjon) – 27.10 15:58

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

## 17:20 Dukk raskere ved slipp av sikte
- Årsak til 1.8/6.25 s: logikken dukket allerede på ~0.10 s; bot-en i spill-brett1 holder høyre mus mens den har mål (setMouse), så Test målte siktetid. Lean teller 0.6 kun mens sub==='lean' (slutter straks ved slipp).
- tuning: popDownTime 0.12→0.07, duckHidePeek 0.3→0.5. coverHitChance/popUpTime/blindfire urørt.
- Før: exposed=false 0.100 s, coverDuck 0.083, visuelt nede 0.133. Etter: 0.050 / 0.033 / 0.083 (alle tre scenarioer, sandbag+barrier, maks=snitt).
- shots/warden-C-dukk-raskt.png/.mp4. Backup: /workspace/wt/bk-dukk-1650/
