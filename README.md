# Breach

Breach is a top-down (55° oblique) cover shooter written in vanilla JavaScript (ES modules) with Canvas 2D. No build step and no framework.

## Run locally

ES modules need an HTTP server (opening `index.html` via `file://` will not work):

```sh
cd game
python3 -m http.server 8080
# open http://localhost:8080/
```

Any static server works (e.g. `npx serve game`). Useful URL parameters: `?zoom=2.25`, `?view=34`, `?hunkerVar=A`.

## Tests

Headless tests use Playwright (`npm install`, then `node tests/run.mjs` with the game served locally). See `tests/README.md`.

## Layout

- `game/` – the game (index.html, src/, assets/, img/)
- `docs/` – design docs and plans
- `tests/` – automated play and regression tests
