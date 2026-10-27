// world.perf og ?perf=1-overlegget (eies av Arena, se docs/YTELSE.md).
// core/loop.js kaller world.perf?.mark(navn) RETT FØR hvert system. Tiden for et system er neste merke minus dette.
// 'update:end' og 'render:end' avslutter fasen. Update kan gå flere steg per bilde, så stegene summeres per bilde.
// Uten ?perf=1 settes world.perf ikke i det hele tatt: loopen koster da bare ett ?.-oppslag per merke.
// Med ?perf=1: ingen allokering per bilde (faste Float32Array-ringer; navn → indeks via Map satt opp én gang).
// Overlegget tegnes etter 'render:end' (utenfor målingen) på lerretet arena.drawTop sist så.
const N = 120;                  // ring per system (2 s ved 60 FPS), p95 regnes herfra
const EMA = 0.1;                // glidende snitt
const P95_EVERY = 15;           // p95 beregnes hvert 15. bilde (sortering av 120 tall), ellers gjenbrukes forrige
let on = null;
export function perfEnabled() {
  if (on !== null) return on;
  try { on = typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf') === '1'; } catch (e) { on = false; }
  return on;
}

const NAMES = ['update:level', 'update:player', 'update:enemies', 'update:arena', 'update:physics', 'update:weapons', 'update:projectiles', 'update:effects',
  'render:begin', 'render:arena', 'render:fxUnder', 'render:cover', 'render:sorted', 'render:enemies', 'render:player', 'render:weapons', 'render:projectiles',
  'render:fxOver', 'render:top', 'render:hud', 'render:levelHud', 'render:playerHud'];
const LABEL = { 'render:begin': 'render: clear+camera', 'render:sorted': 'render: depth sort', 'render:fxUnder': 'render: fx under', 'render:fxOver': 'render: fx over',
  'render:top': 'render: arena top', 'render:arena': 'render: arena floor', 'render:cover': 'render: arena cover' };
const K = NAMES.length, UPD = 0, REN = 1;   // samlerader: K = update total, K+1 = render total, K+2 = frame (rAF)
const ROWS = K + 3;

function createPerf() {
  const idx = new Map(NAMES.map((n, i) => [n, i]));
  const acc = new Float64Array(ROWS), ema = new Float64Array(ROWS), p95 = new Float64Array(ROWS);
  const ring = Array.from({ length: ROWS }, () => new Float32Array(N)), scratch = new Float32Array(N);
  let cur = -1, t0 = 0, phaseT0 = 0, i = 0, n = 0, frames = 0, lastRaf = 0, raf = 0, ctx = null;
  const now = () => performance.now();
  function commit(tEnd) {
    acc[K + 1] = tEnd - phaseT0;
    for (let r = 0; r < K + 2; r++) { const v = acc[r]; ring[r][i] = v; ema[r] = n ? ema[r] + (v - ema[r]) * EMA : v; acc[r] = 0; }
    i = (i + 1) % N; n = Math.min(N, n + 1); frames++;
    if (frames % P95_EVERY === 0) for (let r = 0; r < ROWS; r++) { scratch.set(ring[r]); if (n < N) scratch.fill(Infinity, n); scratch.sort(); p95[r] = scratch[Math.min(n - 1, Math.floor(n * 0.95))]; }
  }
  const tick = (ts) => {
    if (lastRaf) { const v = ts - lastRaf; ring[K + 2][i] = v; ema[K + 2] = ema[K + 2] ? ema[K + 2] + (v - ema[K + 2]) * EMA : v; }
    lastRaf = ts; raf = requestAnimationFrame(tick);
  };
  const perf = {
    enabled: true,
    /** Kalles av core/loop.js før hvert system. */
    mark(name) {
      const t = now();
      if (cur >= 0) acc[cur] += t - t0;
      if (name === 'update:end') { if (cur >= 0) acc[K] += t - phaseT0; cur = -1; return; }
      if (name === 'render:end') { cur = -1; commit(t); if (ctx) drawOverlay(ctx, perf.world); return; }
      const k = idx.get(name);
      if (k === undefined) { cur = -1; return; }            // ukjent merke: avslutt forrige, mål ikke
      if (cur < 0) phaseT0 = t;                              // første merke i fasen
      cur = k; t0 = t;
      if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick);
    },
    /** Lerretet overlegget tegnes på (settes av arena.drawTop). */
    setContext(c) { ctx = c; },
    /** Øyeblikksbilde: { name: { avg, p95 } } (ms per bilde). Allokerer – bare for verktøy/tester. */
    snapshot() {
      const o = {}; for (let r = 0; r < ROWS; r++) o[r < K ? NAMES[r] : ['update (total)', 'render (total)', 'frame (rAF)'][r - K]] = { avg: +ema[r].toFixed(3), p95: +p95[r].toFixed(3) };
      o.frames = frames; return o;
    },
    reset() { acc.fill(0); ema.fill(0); p95.fill(0); for (const r of ring) r.fill(0); i = n = frames = 0; },
    world: null, _ema: ema, _p95: p95,
  };
  return perf;
}

/** Kalles av arena (loadArena). Setter world.perf bare med ?perf=1; ellers ingenting. */
export function installPerf(world) {
  if (!perfEnabled() || world.perf?.enabled) return world.perf || null;
  world.perf = createPerf(); world.perf.world = world;
  return world.perf;
}

// ---------------------------------------------------------------- overlegg (engelsk tekst; testen flagger norsk)
const FONT = '600 11px ui-monospace, monospace', ROW_H = 13;
function drawOverlay(ctx, world) {
  const p = world?.perf; if (!p) return;
  const ema = p._ema, p95 = p._p95, fr = ema[K + 2] || 16.7;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const W = 262, H = 34 + (K + 3) * ROW_H + 14, x = ctx.canvas.width - W - 10, y = 70;
  ctx.fillStyle = 'rgba(8,10,12,0.8)'; ctx.fillRect(x, y, W, H);
  ctx.strokeStyle = 'rgba(57,198,255,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);
  ctx.font = FONT; ctx.textBaseline = 'top';
  let alive = 0; const es = world.enemies; if (es) for (let k = 0; k < es.length; k++) if (es[k] && !es[k].dead) alive++;
  ctx.fillStyle = '#39c6ff'; ctx.fillText(`PERF  view ${world.view || 'top'}  enemies ${alive}  fps ${(1000 / fr).toFixed(1)}`, x + 8, y + 6);
  ctx.fillStyle = '#6b747c'; ctx.fillText('system                  avg ms   p95', x + 8, y + 20);
  const row = (j, label, v, q, budget, strong) => {
    const yy = y + 34 + j * ROW_H;
    ctx.fillStyle = strong ? '#e8edf1' : '#9aa4ad'; ctx.fillText(label, x + 8, yy);
    ctx.fillStyle = v > budget ? '#ff7a1a' : '#e8edf1'; ctx.fillText(v.toFixed(2).padStart(6), x + 170, yy);
    ctx.fillStyle = q > budget ? '#ff7a1a' : '#6b747c'; ctx.fillText(q.toFixed(1).padStart(5), x + 220, yy);
  };
  row(0, 'frame (rAF)', fr, p95[K + 2], 17.5, true);
  row(1, 'update (total)', ema[K], p95[K], 4, true);
  row(2, 'render (total)', ema[K + 1], p95[K + 1], 8, true);
  for (let r = 0; r < K; r++) row(3 + r, LABEL[NAMES[r]] || NAMES[r].replace(':', ': '), ema[r], p95[r], 2, false);
  ctx.fillStyle = '#6b747c'; ctx.fillText('CPU ms/frame · orange = over budget', x + 8, y + H - 13);
  ctx.restore();
}
export const _names = NAMES;
