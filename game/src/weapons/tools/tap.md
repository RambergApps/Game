# Kort trykk (touchpad) – weaponFire per trykk, N=10 per celle

Årsak: weapons/index.js:527 (før) skjøt bare på mouse.left; core/input.js:15 setter left+leftPressed på mousedown, mouseup nullstiller left før neste steg, og leftPressed (nullstilles i endFrame, core/input.js:28) ble aldri lest. Fiks: held = left || leftPressed || (auto && tapHoldMs 80 ms). Toggle TUNING.input.tap.

cdp-0ms = mouse.down()+up() uten pause; sync = mousedown+mouseup i samme JS-task; cdp-8ms = 8 ms mellom; hold = 500 ms. Verdi = trykk med 0 skudd / snitt skudd (min–maks).

| pose | våpen | variant | FØR 0-skudd | FØR snitt (min–maks) | ETTER 0-skudd | ETTER snitt (min–maks) |
|---|---|---|---|---|---|---|
| åpent | rifle | cdp-0ms | 9/10 | 0.1 (0–1) | 0/10 | 1 (1–1) |
| åpent | rifle | sync-dispatch | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| åpent | rifle | cdp-8ms | 0/10 | 1 (1–1) | 0/10 | 1 (1–1) |
| åpent | rifle | hold-500ms | 0/10 | 5 (5–5) | 0/10 | 5 (5–5) |
| åpent | shotgun | cdp-0ms | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| åpent | shotgun | sync-dispatch | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| åpent | shotgun | cdp-8ms | 0/10 | 1 (1–1) | 0/10 | 1 (1–1) |
| åpent | marksman | cdp-0ms | 9/10 | 0.1 (0–1) | 0/10 | 1 (1–1) |
| åpent | marksman | sync-dispatch | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| åpent | marksman | cdp-8ms | 0/10 | 1 (1–1) | 0/10 | 1 (1–1) |
| cover (blind) | rifle | cdp-0ms | 9/10 | 0.1 (0–1) | 0/10 | 1 (1–1) |
| cover (blind) | rifle | sync-dispatch | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| cover (blind) | rifle | cdp-8ms | 0/10 | 1 (1–1) | 0/10 | 1 (1–1) |
| cover (blind) | rifle | hold-500ms | 0/10 | 5 (5–5) | 0/10 | 5 (5–5) |
| cover (blind) | shotgun | cdp-0ms | 5/10 | 0.5 (0–1) | 0/10 | 1 (1–1) |
| cover (blind) | shotgun | sync-dispatch | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| cover (blind) | shotgun | cdp-8ms | 0/10 | 1 (1–1) | 0/10 | 1 (1–1) |
| cover (blind) | marksman | cdp-0ms | 7/10 | 0.3 (0–1) | 0/10 | 1 (1–1) |
| cover (blind) | marksman | sync-dispatch | 10/10 | 0 (0–0) | 0/10 | 1 (1–1) |
| cover (blind) | marksman | cdp-8ms | 0/10 | 1 (1–1) | 0/10 | 1 (1–1) |
