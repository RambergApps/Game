#!/usr/bin/env node
// Breach testrigg – Playwright (playwright-core) + headless Chromium.
// Bruk: node tests/run.mjs [--root DIR] [--page REL] [--scenario FIL] [--out DIR] [--strict]
// Se tests/README.md.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanStatic, RUNTIME_HOOK, analyzeRuntime } from './lang.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const require = createRequire(path.join(REPO, 'package.json'));
const { chromium } = require('playwright-core');

// ---------- argumenter ----------
function parseArgs(argv) {
  const a = {
    root: path.join(REPO, 'game'),
    pages: [],
    scenario: path.join(HERE, 'scenarios', 'smoke.json'),
    out: path.join(REPO, 'shots', 'test'),
    results: path.join(HERE, 'results'),
    roles: ['player', 'arena', 'enemies', 'levels', 'story', 'audio'],
    strict: false, discover: true, stepTimeout: 30000, pageTimeout: 180000, autoStart: true, chrome: null, width: 1280, height: 720, quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--root') a.root = path.resolve(v());
    else if (k === '--page') { a.pages.push(v()); a.discover = false; }
    else if (k === '--scenario') a.scenario = path.resolve(v());
    else if (k === '--out') a.out = path.resolve(v());
    else if (k === '--results') a.results = path.resolve(v());
    else if (k === '--roles') a.roles = v().split(',').filter(Boolean);
    else if (k === '--no-discover') a.discover = false;
    else if (k === '--strict') a.strict = true;
    else if (k === '--chrome') a.chrome = v();
    else if (k === '--size') { const [w, h] = v().split('x').map(Number); a.width = w; a.height = h; }
    else if (k === '--quiet') a.quiet = true;
    else if (k === '--step-timeout') a.stepTimeout = Number(v());
    else if (k === '--page-timeout') a.pageTimeout = Number(v());
    else if (k === '--no-start') a.autoStart = false;
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(path.join(HERE, 'README.md'), 'utf8')); process.exit(0); }
    else { console.error('Ukjent argument: ' + k); process.exit(2); }
  }
  return a;
}
const args = parseArgs(process.argv);
const log = (...m) => { if (!args.quiet) console.log(...m); };

// ---------- Chromium ----------
function findChrome() {
  if (args.chrome) return args.chrome;
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  const cands = [];
  try {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      if (d.startsWith('chromium-')) cands.push(path.join(base, d, 'chrome-linux64', 'chrome'));
    }
  } catch {}
  cands.push('/usr/bin/google-chrome', '/usr/bin/chromium');
  return cands.find((p) => fs.existsSync(p)) || undefined; // undefined => playwright standard
}

// ---------- server ----------
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function ping(url) {
  return new Promise((res) => {
    const r = http.get(url, (resp) => { resp.resume(); res(true); });
    r.on('error', () => res(false)); r.setTimeout(500, () => { r.destroy(); res(false); });
  });
}
async function startServer(root) {
  const port = await freePort();
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; if (stderr.length > 20000) stderr = stderr.slice(-10000); });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    if (await ping(base)) return { proc, port, base, stop: () => { try { proc.kill('SIGTERM'); } catch {} } };
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill('SIGKILL');
  throw new Error('Klarte ikke å starte http.server: ' + stderr);
}

// ---------- mål ----------
function targets() {
  const list = [];
  const add = (name, rel, expected) => list.push({ name, rel, exists: fs.existsSync(path.join(args.root, rel)), expected });
  if (args.pages.length) { for (const p of args.pages) add(p.replace(/[\/\\]/g, '_').replace(/\.html$/, ''), p, true); return list; }
  add('index', 'index.html', true);
  if (args.discover) {
    const src = path.join(args.root, 'src');
    const found = new Set();
    try {
      for (const d of fs.readdirSync(src, { withFileTypes: true })) {
        if (d.isDirectory() && fs.existsSync(path.join(src, d.name, 'test.html'))) found.add(d.name);
      }
    } catch {}
    const all = [...new Set([...args.roles, ...[...found].sort()])];
    for (const r of all) add(`${r}-test`, `src/${r}/test.html`, args.roles.includes(r));
  }
  return list;
}

// ---------- side-skript ----------
const PERF_FN = async (ms) => {
  const d = []; let last = null; const t0 = performance.now();
  await new Promise((done) => {
    function f(t) { if (last !== null) d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else done(); }
    requestAnimationFrame(f);
  });
  const total = performance.now() - t0;
  return { deltas: d, totalMs: total };
};
const STATE_FN = () => {
  const B = window.BREACH || null;
  const w = (B && B.world) || window.world;
  if (!w || typeof w !== 'object') return null;
  const n = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : v === undefined ? null : v);
  const len = (v) => (Array.isArray(v) ? v.length : v && typeof v.size === 'number' ? v.size : null);
  const p = w.player || null;
  const cover = Array.isArray(w.cover) ? w.cover : [];
  const enemies = Array.isArray(w.enemies) ? w.enemies : [];
  const byType = {};
  for (const e of enemies) { const t = (e && (e.type || e.kind)) || '?'; byType[t] = (byType[t] || 0) + 1; }
  return {
    time: n(w.time),
    player: p ? { x: n(p.x), y: n(p.y), hp: n(p.hp ?? p.health), angle: n(p.angle ?? p.aim), state: p.state ?? null, inCover: p.inCover ?? p.cover ?? null } : null,
    enemies: len(w.enemies), enemiesAlive: enemies.filter((e) => e && !e.dead && (e.hp === undefined || e.hp > 0)).length, enemyTypes: byType,
    cover: len(w.cover), coverLow: cover.filter((c) => c && c.type === 'low').length, coverHigh: cover.filter((c) => c && c.type === 'high').length,
    projectiles: len(w.projectiles), effects: len(w.effects), level: (w.level && (w.level.id ?? w.level.n ?? w.level.name)) ?? null,
    hasEvents: !!(w.events && typeof w.events.emit === 'function' && typeof w.events.on === 'function'),
    paused: w.paused ?? null, debug: w.debug ?? null,
    playerExtra: p ? { r: n(p.r), maxHp: n(p.maxHp), aim: n(p.aim), dead: p.dead ?? null } : null,
    camera: B && B.camera ? { x: n(B.camera.x), y: n(B.camera.y), zoom: n(B.camera.zoom) } : null,
    loop: B && B.loop && B.loop.stats ? { fps: n(B.loop.stats.fps), steps: B.loop.stats.steps } : null,
    source: B ? 'BREACH' : 'world',
  };
};
const CANVAS_FN = () => {
  const cs = [...document.querySelectorAll('canvas')];
  return cs.map((c) => {
    const info = { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, blank: null, colors: null };
    try {
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx && c.width && c.height) {
        const set = new Set(); const step = Math.max(4, Math.floor(Math.min(c.width, c.height) / 40));
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
          const i = (y * c.width + x) * 4; set.add((img[i] << 16) | (img[i + 1] << 8) | img[i + 2] | (img[i + 3] === 0 ? 1 << 24 : 0));
        }
        info.colors = set.size; info.blank = set.size <= 1;
      }
    } catch (e) { info.error = String(e); }
    return info;
  });
};
// Lytter etter world.events-hendelser hvis mulig (patcher emit uten å endre oppførsel)
const EVENTS_HOOK = () => {
  window.__breachEvents = {};
  let tries = 0;
  const iv = setInterval(() => {
    const w = (window.BREACH && window.BREACH.world) || window.world;
    const ev = w && w.events;
    if (ev && typeof ev.emit === 'function' && !ev.__breachHooked) {
      const orig = ev.emit.bind(ev);
      ev.emit = function (name, ...rest) { window.__breachEvents[name] = (window.__breachEvents[name] || 0) + 1; return orig(name, ...rest); };
      ev.__breachHooked = true; clearInterval(iv);
    }
    if (++tries > 600) clearInterval(iv);
  }, 50);
};

function stats(deltas, totalMs) {
  if (!deltas.length) return { frames: 0 };
  const s = [...deltas].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const r = (v) => Math.round(v * 100) / 100;
  return {
    frames: deltas.length, durationMs: r(totalMs), fpsAvg: r((deltas.length / totalMs) * 1000), fpsFromAvgFrame: r(1000 / avg),
    frameMsAvg: r(avg), frameMsP50: r(q(0.5)), frameMsP95: r(q(0.95)), frameMsP99: r(q(0.99)), frameMsMax: r(s[s.length - 1]),
    over20ms: deltas.filter((d) => d > 20).length, over33ms: deltas.filter((d) => d > 33.4).length,
    fpsWorst1s: worstSecond(deltas),
  };
}
function worstSecond(d) {
  // laveste FPS i et glidende 1-sekunds vindu
  let best = Infinity, sum = 0, j = 0;
  for (let i = 0; i < d.length; i++) {
    sum += d[i];
    while (sum - d[j] >= 1000) { sum -= d[j]; j++; }
    if (sum >= 990) best = Math.min(best, (i - j + 1) / (sum / 1000));
  }
  return best === Infinity ? null : Math.round(best * 10) / 10;
}

// ---------- scenario ----------
function loadScenario(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  throw new Error('Scenario må være .json (eller bruk --scenario med .json)');
}
const BTN = { left: 'left', right: 'right', middle: 'middle', venstre: 'left', hoyre: 'right' };

class StepTimeout extends Error {}
function withTimeout(promise, ms, what) {
  let t; const to = new Promise((_, rej) => { t = setTimeout(() => rej(new StepTimeout(`Tidsavbrudd etter ${ms} ms: ${what}`)), ms); });
  return Promise.race([promise, to]).finally(() => clearTimeout(t));
}
function stepBudget(st) {
  // perf/wait/keys/aimCircle/mouseHold varer selv en stund – gi dem ms + margin
  const own = (st.ms ?? 0) + (Array.isArray(st.during) ? st.during.reduce((a, d) => a + (d.ms ?? 300), 0) : 0);
  return st.timeout ?? Math.max(args.stepTimeout, own + 15000);
}

async function runStep(page, st, ctx) {
  if (ctx.dead) throw new Error('Siden er ikke lenger tilgjengelig: ' + ctx.dead);
  const m = page.mouse, k = page.keyboard;
  const W = args.width, H = args.height;
  const px = (v, dim) => (typeof v === 'number' && v > 0 && v <= 1 && !Number.isInteger(v) ? v * dim : v); // brøk 0–1 eller piksler
  switch (st.do) {
    case 'wait': await page.waitForTimeout(st.ms ?? 1000); break;
    case 'shot': {
      const file = path.join(ctx.outDir, `${ctx.target}-${String(++ctx.shotN).padStart(2, '0')}-${st.name || 'shot'}.png`);
      const buf = await page.screenshot({ path: file, timeout: 15000 });
      ctx.shots.push({ name: st.name, file, sha1: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12) });
      break;
    }
    case 'keys': { // hold én eller flere taster i ms
      const keys = [].concat(st.keys || st.key);
      for (const key of keys) await k.down(key);
      await page.waitForTimeout(st.ms ?? 300);
      for (const key of keys.reverse()) await k.up(key);
      break;
    }
    case 'press': await k.press(st.key, { delay: st.hold ?? 60 }); break;
    case 'keyDown': await k.down(st.key); break;
    case 'keyUp': await k.up(st.key); break;
    case 'move': {
      const x = px(st.x, W), y = px(st.y, H); ctx.mouse = { x, y };
      await m.move(x, y, { steps: st.steps ?? 8 }); break;
    }
    case 'aimCircle': { // sikt rundt i en sirkel
      const cx = px(st.cx ?? 0.5, W), cy = px(st.cy ?? 0.5, H), r = st.r ?? 200, n = st.steps ?? 24, ms = st.ms ?? 1500;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2; ctx.mouse = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        await m.move(ctx.mouse.x, ctx.mouse.y); await page.waitForTimeout(ms / n);
      }
      break;
    }
    case 'click': {
      if (st.x !== undefined) { ctx.mouse = { x: px(st.x, W), y: px(st.y, H) }; await m.move(ctx.mouse.x, ctx.mouse.y); }
      const b = BTN[st.button || 'left'];
      for (let i = 0; i < (st.count ?? 1); i++) { await m.down({ button: b }); await page.waitForTimeout(st.hold ?? 50); await m.up({ button: b }); if (st.interval) await page.waitForTimeout(st.interval); }
      break;
    }
    case 'mouseHold': { const b = BTN[st.button || 'left']; await m.down({ button: b }); await page.waitForTimeout(st.ms ?? 500); await m.up({ button: b }); break; }
    case 'mouseDown': await m.down({ button: BTN[st.button || 'left'] }); break;
    case 'mouseUp': await m.up({ button: BTN[st.button || 'left'] }); break;
    case 'perf': {
      // valgfritt: kjør inndata-steg samtidig (måling under last), f.eks. bevegelse + skyting
      // CDP Performance-metrikker: hvor mye av tiden hovedtråden faktisk jobbet (skiller tungt spill fra travel maskin)
      let cdp = null, m0 = null;
      try { cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable'); m0 = await cdp.send('Performance.getMetrics'); } catch { cdp = null; }
      const pr = page.evaluate(PERF_FN, st.ms ?? 5000);
      pr.catch(() => {}); // aldri ubehandlet avvisning (det var dette som krasjet hele riggen)
      if (Array.isArray(st.during)) for (const sub of st.during) await runStep(page, sub, ctx);
      const r = await pr;
      let main = null;
      if (cdp && m0) {
        try {
          const m1 = await cdp.send('Performance.getMetrics');
          const g = (m, n) => (m.metrics.find((x) => x.name === n) || {}).value || 0;
          const dt = g(m1, 'Timestamp') - g(m0, 'Timestamp');
          const task = g(m1, 'TaskDuration') - g(m0, 'TaskDuration'), script = g(m1, 'ScriptDuration') - g(m0, 'ScriptDuration');
          const frames = r.deltas.length || 1;
          main = { busyPct: Math.round((task / dt) * 1000) / 10, scriptPct: Math.round((script / dt) * 1000) / 10, taskMsPerFrame: Math.round((task * 1000 / frames) * 100) / 100, scriptMsPerFrame: Math.round((script * 1000 / frames) * 100) / 100, jsHeapMB: Math.round(g(m1, 'JSHeapUsedSize') / 1048576 * 10) / 10 };
        } catch {}
        await cdp.detach().catch(() => {});
      }
      const s = { label: st.label || `perf-${ctx.perf.length + 1}`, ...stats(r.deltas, r.totalMs), mainThread: main };
      ctx.perf.push(s);
      log(`   ytelse ${s.label}: ${s.fpsAvg} FPS, snitt ${s.frameMsAvg} ms, p95 ${s.frameMsP95} ms, maks ${s.frameMsMax} ms, >20ms: ${s.over20ms}${main ? ` | hovedtråd opptatt ${main.busyPct} % (JS ${main.scriptMsPerFrame} ms/ramme, heap ${main.jsHeapMB} MB)` : ''}`);
      break;
    }
    case 'state': {
      const s = await page.evaluate(STATE_FN).catch((e) => ({ error: String(e) }));
      ctx.states.push({ label: st.label || `state-${ctx.states.length + 1}`, t: Date.now() - ctx.t0, state: s });
      if (s) log(`   tilstand ${st.label || ''}: ${JSON.stringify(s)}`);
      break;
    }
    case 'eval': { // fritt uttrykk (kan returnere Promise)
      const v = await page.evaluate(st.expr).catch((e) => ({ error: String(e) }));
      ctx.evals.push({ label: st.label ?? null, expr: st.expr, value: v });
      if (st.label) log(`   eval ${st.label}: ${JSON.stringify(v)}`);
      break;
    }
    case 'callCount': {
      // Teller kall til en funksjon i en modul via V8 presis dekning (CDP Profiler) – endrer ikke spillkoden.
      const r = await countCalls(page, ctx, st);
      ctx.callCounts.push(r);
      log(`   kall ${r.label}: ${JSON.stringify(r)}`);
      break;
    }
    case 'note': ctx.notes.push(st.text); break;
    default: throw new Error('Ukjent steg: ' + JSON.stringify(st));
  }
}

async function countCalls(page, ctx, st) {
  const label = st.label || `${st.url}:${st.fn}`;
  const out = { label, url: st.url, fn: st.fn, ms: st.ms ?? 2000, found: false };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
    const pick = (res) => {
      let n = null;
      for (const sc of res.result) {
        if (!sc.url.split('?')[0].endsWith(st.url)) continue;
        for (const f of sc.functions) if (f.functionName === st.fn) { n = (n ?? 0) + f.ranges[0].count; }
      }
      return n;
    };
    const loopSteps = () => page.evaluate(() => (window.BREACH && window.BREACH.loop && window.BREACH.loop.stats ? window.BREACH.loop.stats.steps : null)).catch(() => null);
    const a = pick(await cdp.send('Profiler.takePreciseCoverage')); const sa = await loopSteps(); const t0 = Date.now();
    await page.waitForTimeout(out.ms);
    const b = pick(await cdp.send('Profiler.takePreciseCoverage')); const sb = await loopSteps();
    await cdp.send('Profiler.stopPreciseCoverage').catch(() => {});
    out.found = b !== null; out.elapsedMs = Date.now() - t0;
    // takePreciseCoverage nullstiller tellerne → b er antall kall i vinduet
    out.calls = b; out.loopSteps = sa !== null && sb !== null ? sb - sa : null;
    out.callsPerSecond = b !== null ? Math.round((b / out.elapsedMs) * 10000) / 10 : null;
    out.ratioToLoopSteps = b !== null && out.loopSteps ? Math.round((b / out.loopSteps) * 100) / 100 : null;
  } finally { await cdp.detach().catch(() => {}); }
  return out;
}

async function autoStart(page, res, ctx) {
  // «Klikk for å starte»: skjermbilde av startskjermen, så BREACH.startGame() eller klikk på canvas, og krev world.paused === false.
  const info = await page.evaluate(() => {
    const w = (window.BREACH && window.BREACH.world) || window.world;
    return { hasWorld: !!w, paused: w ? w.paused ?? null : null, hasStartGame: !!(window.BREACH && typeof window.BREACH.startGame === 'function') };
  }).catch(() => null);
  if (!info || !info.hasWorld || info.paused !== true) { res.start = { needed: false, pausedAtLoad: info ? info.paused : null }; return; }
  await runStep(page, { do: 'shot', name: 'startskjerm' }, ctx);
  let method;
  if (info.hasStartGame) { method = 'BREACH.startGame()'; await page.evaluate(() => window.BREACH.startGame()); }
  else { method = 'klikk på canvas'; const c = await page.$('canvas'); const bb = c && (await c.boundingBox()); await page.mouse.click(bb ? bb.x + bb.width / 2 : args.width / 2, bb ? bb.y + bb.height / 2 : args.height / 2); }
  const isUnpaused = () => page.waitForFunction(() => { const w = (window.BREACH && window.BREACH.world) || window.world; return w && w.paused === false; }, null, { timeout: 1500 }).then(() => true).catch(() => false);
  // startLevel kan vise en mellomsekvens (.breach-cutscene) som pauser spillet igjen – ta bilde og hopp over med Escape (MELLOMROM/Esc = hopp over)
  let ok = false; const cutscenes = [];
  for (let i = 0; i < 6 && !ok; i++) {
    await page.waitForTimeout(400);
    ok = await isUnpaused();
    if (ok) break;
    const cs = await page.evaluate(() => !!document.querySelector('.breach-cutscene')).catch(() => false);
    if (cs) { if (!cutscenes.length) { await page.waitForTimeout(2500); /* la teksten skrives ut (språksjekk + bilde) */ await runStep(page, { do: 'shot', name: 'mellomsekvens' }, ctx); } cutscenes.push(i); await page.keyboard.press('Escape'); }
  }
  res.start = { needed: true, method, unpaused: ok, cutsceneSkipped: cutscenes.length > 0, overlayGone: await page.evaluate(() => !document.getElementById('start-screen')).catch(() => null) };
  log(`   start: ${method}${cutscenes.length ? ' + hoppet over mellomsekvens (Escape)' : ''} → world.paused=false: ${ok ? 'ja' : 'NEI'}`);
  if (!ok) throw new Error('Spillet startet ikke: world.paused ble ikke false etter ' + method);
}

async function runTarget(getBrowser, server, t, scenario, outDir) {
  const res = { name: t.name, page: t.rel, status: 'ok', errors: { console: [], pageErrors: [], requestFailed: [], http4xx5xx: [] }, warnings: [], shots: [], perf: [], states: [], evals: [], callCounts: [], notes: [], canvas: null, events: null, stepErrors: [], pageEvents: [] };
  if (!t.exists) { res.status = 'mangler'; return res; }
  const ctx = { target: t.name, outDir, shotN: 0, shots: res.shots, perf: res.perf, states: res.states, evals: res.evals, callCounts: res.callCounts, notes: res.notes, t0: Date.now(), mouse: null, dead: null };
  let context = null; const external = new Set();
  const work = async () => {
    const browser = await getBrowser(); ctx.browser = browser;
    context = await browser.newContext({ viewport: { width: args.width, height: args.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const ignored = (u) => /favicon\.ico$/.test(u || ''); // nettleseren spør alltid etter favicon – ikke et spillfunn
    page.on('console', (msg) => {
      const loc = msg.location(); const where = loc && loc.url ? `${loc.url.replace(server.base, '')}:${loc.lineNumber}` : '';
      if (ignored(loc && loc.url)) return;
      if (msg.type() === 'error') res.errors.console.push({ text: msg.text(), where });
      else if (msg.type() === 'warning') res.warnings.push({ text: msg.text(), where });
    });
    page.on('pageerror', (e) => res.errors.pageErrors.push({ message: e.message, stack: (e.stack || '').split('\n').slice(0, 4).join('\n') }));
    page.on('requestfailed', (r) => !ignored(r.url()) && res.errors.requestFailed.push({ url: r.url().replace(server.base, ''), error: r.failure()?.errorText }));
    page.on('response', (r) => { if (r.status() >= 400 && !ignored(r.url())) res.errors.http4xx5xx.push({ url: r.url().replace(server.base, ''), status: r.status() }); });
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(server.base) && !u.startsWith('data:') && !u.startsWith('blob:')) external.add(u); });
    // Hvem lukker siden? crash = renderer døde (minne/GPU), close = siden ble lukket (window.close() eller riggen), framenavigated = navigering bort
    page.on('crash', () => { ctx.dead = 'renderer krasjet (page crash)'; res.pageEvents.push({ t: Date.now() - ctx.t0, type: 'crash' }); });
    page.on('close', () => { if (ctx.rigClosing) { res.pageEvents.push({ t: Date.now() - ctx.t0, type: 'close (riggen, normal avslutning)' }); return; } if (!ctx.dead) ctx.dead = 'siden ble lukket (page close)'; res.pageEvents.push({ t: Date.now() - ctx.t0, type: 'close' }); });
    ctx.page = page;
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) res.pageEvents.push({ t: Date.now() - ctx.t0, type: 'navigated', url: f.url().replace(server.base, '') }); });
    context.on('close', () => { if (!ctx.dead) ctx.dead = 'browser context lukket'; });
    browser.on('disconnected', () => { if (!ctx.dead) ctx.dead = 'nettleseren ble koblet fra/lukket'; });
    await page.addInitScript(EVENTS_HOOK);
    await page.addInitScript(RUNTIME_HOOK);
    await page.addInitScript(() => { const c = window.close; window.close = function () { console.warn('[breach-testrigg] window.close() kalt'); try { window.__closeCalled = new Error().stack; } catch {} return c.call(window); }; });

    const resp = await page.goto(server.base + t.rel, { waitUntil: 'load', timeout: 20000 });
    res.httpStatus = resp ? resp.status() : null;
    res.globalReadyMs = await page.waitForFunction(() => window.BREACH || window.world, null, { timeout: 5000 }).then(() => Date.now() - ctx.t0).catch(() => null);
    await page.evaluate(() => window.focus());
    if (args.autoStart) await autoStart(page, res, ctx);
    for (const st of scenario.steps) {
      try { await withTimeout(runStep(page, st, ctx), stepBudget(st), `steg ${st.do}${st.label || st.name ? ' ' + (st.label || st.name) : ''}`); }
      catch (e) {
        res.stepErrors.push({ step: st, error: String(e.message || e) });
        if (ctx.dead) throw new Error(`Siden døde under steg «${st.do}${st.name ? ' ' + st.name : ''}${st.label ? ' ' + st.label : ''}»: ${ctx.dead}`);
      }
    }
    res.canvas = await page.evaluate(CANVAS_FN).catch((e) => ({ error: String(e) }));
    res.events = await page.evaluate(() => window.__breachEvents || null).catch(() => null);
    res.hasWorld = await page.evaluate(() => !!((window.BREACH && window.BREACH.world) || window.world)).catch(() => false);
    res.hasBREACH = await page.evaluate(() => !!window.BREACH).catch(() => false);
  };
  const collectText = async () => {
    if (!ctx.page) return;
    const entries = await withTimeout(ctx.page.evaluate(() => { try { window.__breachGrabDom && window.__breachGrabDom(); } catch {} return window.__breachText ? [...window.__breachText.entries()] : null; }), 5000, 'tekst').catch(() => null);
    if (!entries) return;
    const a = analyzeRuntime(entries);
    res.language = { uniqueTexts: a.uniqueTexts, norwegian: a.flagged, isGamePage: t.name === 'index' };
  };
  try {
    await withTimeout(work(), args.pageTimeout, `hele siden ${t.rel}`);
  } catch (e) {
    res.status = 'feil'; res.fatal = String(e.message || e);
    if (ctx.dead) res.cause = ctx.dead;
    if (ctx.browser && !ctx.browser.isConnected()) res.cause = 'hele Chromium-prosessen ble avsluttet (nettleseren koblet fra) – ikke siden selv; window.close() er blokkert i riggen, og ingen page-crash ble meldt';
    if (!ctx.dead && ctx.page && e instanceof StepTimeout) {
      const alive = await withTimeout(ctx.page.evaluate(() => 1), 3000, 'probe').then(() => true).catch(() => false);
      res.cause = alive ? 'siden svarer, men steg tok for lang tid' : 'siden henger – JS-tråden svarer ikke (f.eks. uendelig løkke eller tung synkron jobb)';
    }
    if (abortReason) res.cause = `riggen ble avbrutt utenfra (${abortReason}) – ikke en feil i siden`;
    log(`   FEIL: ${res.fatal}${res.cause ? ' | årsak: ' + res.cause : ''}`);
  }
  await collectText();
  res.externalRequests = [...external];
  // Inndata-effekt: endret spillerposisjon/sikte mellom første og andre tilstandsmåling, og skudd-hendelser
  const st = res.states.map((x) => x.state).filter((x) => x && x.player);
  if (st.length >= 2) {
    const a = st[0].player, b = st[1].player;
    res.inputEffect = { moved: Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0)) > 4, aimChanged: st.some((x) => x.playerExtra?.aim !== st[0].playerExtra?.aim || x.player.angle !== st[0].player.angle), shotEvents: res.events?.shot ?? null };
  } else res.inputEffect = null;
  const hashes = res.shots.map((s) => s.sha1);
  res.visualChange = hashes.length >= 2 ? new Set(hashes).size > 1 : null;
  const nErr = res.errors.console.length + res.errors.pageErrors.length + res.errors.requestFailed.length + res.errors.http4xx5xx.length;
  res.errorCount = nErr;
  if (res.status === 'ok' && (nErr || res.stepErrors.length)) res.status = 'feil';
  if (res.status === 'ok' && res.externalRequests.length) res.status = 'feil';
  if (res.status === 'ok' && res.start && res.start.needed && !res.start.unpaused) res.status = 'feil';
  // Språkregel: norsk spilltekst er advarsel; med --strict blir det feil for spillsiden (index). Testsider gir bare advarsel.
  if (res.language?.norwegian?.length) {
    res.warnings = (res.warnings || []).concat(res.language.norwegian.map((x) => `norsk tekst (${x.src}): «${x.text}» [${x.why}]`));
    if (args.strict && res.language.isGamePage && res.status === 'ok') { res.status = 'feil'; res.cause = 'norsk tekst i spillet (--strict)'; }
  }
  ctx.rigClosing = true;
  if (context) await withTimeout(context.close(), 10000, 'context.close').catch(() => {});
  return res;
}

function summaryLine(r) {
  if (r.status === 'mangler') return `${r.name}: MANGLER (${r.page})`;
  const p = r.perf[r.perf.length - 1];
  const perf = p && p.frames ? `${p.fpsAvg} FPS, snitt ${p.frameMsAvg} ms, p95 ${p.frameMsP95} ms, maks ${p.frameMsMax} ms, >20ms ${p.over20ms}/${p.frames}` : 'ingen ytelsesmåling';
  const e = r.errors;
  const audio = r.callCounts?.find((c) => /audio/.test(c.url || ''));
  return `${r.name}: ${r.status.toUpperCase()}${r.fatal ? ` (${r.cause || r.fatal})` : ''} | feil: konsoll ${e.console.length}, unntak ${e.pageErrors.length}, nett ${e.requestFailed.length + e.http4xx5xx.length}${r.externalRequests?.length ? `, eksterne ${r.externalRequests.length}` : ''} | ${perf} | bilder ${r.shots.length}${r.visualChange === false ? ' (INGEN visuell endring!)' : ''} | world: ${r.hasBREACH ? 'BREACH' : r.hasWorld ? 'ja' : 'nei'}${r.start?.needed ? ` | start: ${r.start.unpaused ? 'ok' : 'NEI'}` : ''}${r.inputEffect ? ` | inndata: flytt ${r.inputEffect.moved ? 'ja' : 'NEI'}, sikte ${r.inputEffect.aimChanged ? 'ja' : 'NEI'}, skudd ${r.inputEffect.shotEvents ?? '?'}` : ''}${audio ? ` | lyd-update: ${audio.found ? `${audio.calls} kall/${audio.loopSteps} steg` : 'ikke funnet'}` : ''}${r.language ? ` | norsk tekst: ${r.language.norwegian.length}/${r.language.uniqueTexts}` : ''}`;
}

// ---------- main ----------
let abortReason = null;
async function main() {
  if (!fs.existsSync(args.root)) { console.error('Rotmappe finnes ikke: ' + args.root); process.exit(2); }
  const scenario = loadScenario(args.scenario);
  // (a) Statisk språkskanning (én gang per kjøring)
  let languageScan = null;
  try {
    const sc = scanStatic(args.root);
    const game = sc.findings.filter((f) => !f.devOnly), dev = sc.findings.filter((f) => f.devOnly);
    languageScan = { rule: 'All spilltekst (UI, HUD, menyer, startskjerm, mellomsekvenser) skal være på engelsk', filesScanned: sc.filesScanned, gameFindings: game, devToolFindings: dev };
    log(`Språkskanning (statisk): ${sc.filesScanned} filer, ${game.length} mistenkte norske strenger i spillkode (+${dev.length} i test-/verktøyfiler)`);
    for (const f of game) log(`   ADVARSEL norsk? ${f.file}:${f.line}  «${f.text}»  [${f.why}]`);
  } catch (e) { languageScan = { error: String(e.message || e) }; log('Språkskanning feilet: ' + languageScan.error); }
  fs.mkdirSync(args.out, { recursive: true }); fs.mkdirSync(args.results, { recursive: true });
  const list = targets();
  const server = await startServer(args.root);
  const exe = findChrome();
  log(`Breach testrigg | rot: ${args.root} | server: ${server.base} | scenario: ${scenario.name || path.basename(args.scenario)} | chromium: ${exe || '(standard)'}`);
  const launch = () => chromium.launch({
    headless: true, executablePath: exe,
    // Riggen håndterer signaler selv (ellers lukker Playwright nettleseren midt i et steg ved SIGTERM/SIGHUP)
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  let browser = null;
  const getBrowser = async () => {
    if (!browser || !browser.isConnected()) { if (browser) log('   (starter ny nettleser – den forrige var lukket/krasjet)'); browser = await launch(); }
    return browser;
  };
  const started = new Date();
  const stamp = started.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(args.results, `resultat-${stamp}.json`);
  const results = [];
  const write = (final) => {
    const fails = results.filter((r) => r.status === 'feil');
    const missing = results.filter((r) => r.status === 'mangler' && list.find((t) => t.name === r.name)?.expected);
    const langFail = args.strict && languageScan?.gameFindings?.length > 0;
    const overall = abortReason ? `AVBRUTT (${abortReason})` : !final ? 'PÅGÅR' : fails.length || langFail ? 'FEIL' : missing.length ? 'OK (med manglende sider)' : 'OK';
    const out = {
      tool: 'breach-testrigg', version: 2, started: started.toISOString(), finishedMs: Date.now() - started.getTime(),
      root: args.root, scenario: { file: args.scenario, name: scenario.name }, viewport: `${args.width}x${args.height}`, chromium: exe || null,
      overall, summary: results.map(summaryLine), languageScan, targets: results,
    };
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    fs.writeFileSync(path.join(args.results, 'siste.json'), JSON.stringify(out, null, 2));
    return { overall, fails, missing, langFail };
  };
  const onSignal = (sig) => {
    if (abortReason) return; abortReason = sig;
    console.error(`\nRiggen fikk ${sig} – avbryter, lagrer delresultat og rydder opp.`);
    try { write(false); } catch {}
    Promise.resolve(browser && browser.close()).catch(() => {}).finally(() => { server.stop(); process.exit(sig === 'SIGINT' ? 130 : 143); });
    setTimeout(() => { server.stop(); process.exit(143); }, 5000).unref();
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => onSignal(sig));
  process.on('exit', () => server.stop());
  process.on('unhandledRejection', (e) => { console.error('Ubehandlet avvisning (fanget, riggen fortsetter):', String(e && e.message || e)); });
  try {
    for (const t of list) {
      if (abortReason) break;
      log(`-> ${t.name} (${t.rel})${t.exists ? '' : ' – mangler'}`);
      let r;
      try { r = await runTarget(getBrowser, server, t, scenario, args.out); }
      catch (e) { r = { name: t.name, page: t.rel, status: 'feil', fatal: 'Riggfeil: ' + String(e.message || e), errors: { console: [], pageErrors: [], requestFailed: [], http4xx5xx: [] }, perf: [], shots: [] }; }
      results.push(r); log('   ' + summaryLine(r));
      write(false);
    }
  } finally { if (browser) await browser.close().catch(() => {}); server.stop(); }
  const { overall, fails, langFail } = write(true);
  console.log(`SAMMENDRAG: ${overall} | sider ${results.filter((r) => r.status !== 'mangler').length} testet, ${fails.length} med feil, ${results.filter((r) => r.status === 'mangler').length} mangler | norsk tekst: statisk ${languageScan?.gameFindings?.length ?? '?'}, kjøretid ${results.reduce((n, r) => n + (r.language?.norwegian?.length || 0), 0)}${args.strict ? '' : ' (advarsler)'} | resultat: ${file}`);
  process.exitCode = fails.length || langFail || (args.strict && results.some((r) => r.status === 'mangler')) ? 1 : 0;
}
main().catch((e) => { console.error('Riggen krasjet:', e); process.exit(3); });
