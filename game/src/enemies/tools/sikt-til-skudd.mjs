// Headless-test (Test 26.10, A2): tid fra første frie sikt til første telegraf og første angrep, per type.
// Kjør fra /workspace/breach:  node game/src/enemies/tools/sikt-til-skudd.mjs   → exit 1 hvis noen > 4 s.
// Oppsett per type × scenario: «åpent» (ingen dekning, 230 px), «lag» (samme, pluss 3 Husker som konkurrerer om skyte-token),
// «dekning» (standardbanen i test.html). Spilleren er udødelig og står stille.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const LIMIT = 4;
const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, '../../..');
const PORT = 8000 + Math.floor(Math.random() * 900) + 50;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: gameDir, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  if (existsSync(base)) for (const d of readdirSync(base).sort().reverse()) {
    const c = path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell');
    if (existsSync(c)) return c;
  }
}
const browser = await chromium.launch({ headless: true, executablePath: findChrome() });
const errors = [], rows = [];
for (const type of ['grunt', 'flanker', 'heavy', 'grenadier']) for (const sc of ['åpent', 'lag', 'dekning']) for (const seed of [3, 7, 11]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/src/enemies/test.html?manual=1&seed=${seed}`);
  await page.waitForFunction(() => window.__bt);
  const r = await page.evaluate(({ type, sc }) => {
    const b = window.__bt, w = b.world, T = 32;
    b.setGod(true); b.player.hp = b.player.maxHp = 1e6;
    if (sc !== 'dekning') b.setCover([]);
    b.setPlayer(12 * T, 12 * T, 0);
    if (sc === 'lag') { b.spawn('grunt', 20 * T, 7 * T); b.spawn('grunt', 20 * T, 17 * T); b.spawn('grunt', 21 * T, 12 * T); b.step(3); }
    const e = b.spawn(type, 12 * T + 230, 12 * T + 40);
    const TEL = new Set(['telegraph', 'spinup', 'windup', 'throw', 'aimThrow', 'lunge', 'melee', 'peek']);
    let sight = null, tel = null, atk = null, t0 = w.time, maxState = {};
    const mark = (p) => { if ((p.owner === e || p.entity === e || p.source?.entity === e) && atk == null && sight != null) atk = w.time; };
    for (const ev of ['shot', 'grenade', 'throw', 'melee', 'lunge']) w.events.on(ev, mark);
    for (let i = 0; i < 60 * 12 && atk == null; i++) {
      b.step(1 / 60);
      if (sight == null && e.sees) sight = w.time;
      if (sight != null && tel == null && (TEL.has(e.state) && e.state !== 'peek' || e.state === (e.def.attackState || 'telegraph'))) tel = w.time;
      maxState[e.state] = (maxState[e.state] || 0) + 1 / 60;
    }
    const f = (x) => (x == null ? null : +(x - sight).toFixed(2));
    return { sight: sight == null ? null : +(sight - t0).toFixed(2), tel: f(tel), atk: f(atk), states: Object.fromEntries(Object.entries(maxState).map(([k, v]) => [k, +v.toFixed(1)])) };
  }, { type, sc });
  const fail = r.sight == null || r.atk == null || r.atk > LIMIT || (r.tel != null && r.tel > LIMIT);
  rows.push({ type, sc, seed, ...r, fail });
  console.log(`${fail ? 'FEIL' : 'OK  '} ${type.padEnd(9)} ${sc.padEnd(7)} seed ${String(seed).padStart(2)}  sikt ${r.sight}s  →telegraf ${r.tel}s  →angrep ${r.atk}s  ${JSON.stringify(r.states)}`);
  await page.close();
}
await browser.close(); server.kill();
const worst = {};
for (const r of rows) worst[r.type] = Math.max(worst[r.type] || 0, r.atk ?? 99);
const bad = rows.filter((r) => r.fail);
console.log(`SAMMENDRAG: ${bad.length ? 'FEIL' : 'OK'} | ${rows.length} kjøringer, ${bad.length} over ${LIMIT} s | verst sikt→angrep: ${JSON.stringify(worst)} | konsollfeil ${errors.length}`);
process.exit(bad.length || errors.length ? 1 : 0);
