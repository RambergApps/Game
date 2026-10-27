// Dekningssjekk (Arena 27.10): lav dekning skal ligge ≥ 1 rute fra vann/kaikant, vegg, bygg og container, og aldri overlappe
// ammokasser. Rapporterer andel liggende (w > h). Avslutter med kode 1 ved brudd.  node src/arena/_tools/cover-check.cjs [v2|v1|lavt]
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = { v2: ['yard-v2.js', 'YARD_V2'], v1: ['yard.js', 'YARD'], lavt: ['yard-lavt.js', 'YARD_LAVT'] };
function load(file, name) {
  let src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const imp = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([^']+)'/g)]; const ctx = { Math };
  for (const [, names, f] of imp) { const base = load(f, names.trim().split(/\s*,\s*/)[0]); ctx[names.trim().split(/\s*,\s*/)[0]] = base; }
  src = src.replace(/^import .*$/mg, '').replace(/export const /g, 'var ').replace(/export function /g, 'function ');
  vm.createContext(ctx); vm.runInContext(src, ctx); return ctx[name];
}
const LOW = new Set(['barrier', 'sandbag', 'crates', 'barrels']), SOLID = new Set(['water', 'wall', 'building', 'container', 'stack', 'cratestack', 'tank', 'unit']);
const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));   // < 0 = overlapp
// Startsted (27.10): nøyaktig ett ENTRY, sentrert på spawnen; ENTRY/spawn overlapper ingenting, ≥ 1 rute til container og
// dekning, og ingen containerskygge over start. Skygge: shadowOffset(h) fra shared/light.js – for container/høy dekning (h 64)
// ca. +0,76 rute x, +1,18 rute y, pluss 4 px blur. Skyggeflaten = omsluttende boks for objektet og det forskjøvne objektet.
const SH = { x: 0.76, y: 1.18, blur: 4 / 32 }, SHADOW_KINDS = new Set(['container', 'stack', 'cratestack', 'building', 'tank', 'unit']);
function startCheck(def, objs) {
  const e = [], sp = def.playerSpawn;
  const entries = [def.entry, ...Object.values(def.zones || {}).filter((z) => z.kind === 'entry')].filter(Boolean);
  if (entries.length !== 1) e.push(`START: ${entries.length} ENTRY-soner (skal være 1)`);
  if (!sp) return [...e, 'START: mangler playerSpawn'];
  // samme utledning som arena/index.js entryOf(): sentrert på spawnen
  const w = def.entry?.w || 5, h = def.entry?.h || 2.5, en = { x: sp.x - w / 2, y: sp.y - h / 2, w, h };
  const se = def.spawnPoints?.entry; if (se && Math.hypot(se.x - sp.x, se.y - sp.y) > 0.25) e.push(`START: spawnPoints.entry (${se.x},${se.y}) ligger ikke ved playerSpawn (${sp.x},${sp.y})`);
  const pt = { x: sp.x - 0.45, y: sp.y - 0.45, w: 0.9, h: 0.9 }; // Warden ~r 14 px
  for (const o of objs) {
    const need = o.kind === 'water' ? 0 : 1, g = gap(en, o);
    if (g < need - 1e-6) e.push(`START: ENTRY (${en.x},${en.y},${w}×${h}) ${g < 0 ? 'OVERLAPPER' : 'for nær (' + g.toFixed(2) + ' rute)'} ${o.kind}#${o.i} (${o.x},${o.y},${o.w}×${o.h})`);
    if (gap(pt, o) < 0) e.push(`START: spawnen overlapper ${o.kind}#${o.i}`);
    if (SHADOW_KINDS.has(o.kind)) {
      const b = SH.blur, s = { x: o.x - b, y: o.y - b, w: o.w + SH.x + 2 * b, h: o.h + SH.y + 2 * b };
      if (gap(en, s) < 0) e.push(`START: skyggen fra ${o.kind}#${o.i} (${o.x},${o.y}) dekker ENTRY`);
    }
  }
  if (en.x < 0 || en.y < 0 || en.x + w > def.cols || en.y + h > (def.walkableSouth || def.rows)) e.push('START: ENTRY utenfor gangbart kart');
  for (const [ax, ay] of def.ammoCrates || []) if (gap(en, { x: ax - 0.4, y: ay - 0.3, w: 0.8, h: 0.6 }) < 0) e.push(`START: ENTRY overlapper ammokasse (${ax},${ay})`);
  return e;
}
let fail = 0;
for (const v of process.argv.slice(2).length ? process.argv.slice(2) : ['v2', 'v1']) {
  const [f, n] = FILES[v]; const def = load(f, n); const objs = def.objects.map(([kind, x, y, w, h], i) => ({ i, kind, x, y, w, h }));
  const low = objs.filter((o) => LOW.has(o.kind)), solid = objs.filter((o) => SOLID.has(o.kind)), errs = [];
  for (const c of low) {
    for (const s of solid) { const g = gap(c, s); if (g < 1 - 1e-6) errs.push(`${c.kind}#${c.i} (${c.x},${c.y},${c.w}×${c.h}) ${g < 0 ? 'OVERLAPPER' : 'for nær (' + g.toFixed(2) + ' rute)'} ${s.kind}#${s.i} (${s.x},${s.y},${s.w}×${s.h})`); }
    for (const [ax, ay] of def.ammoCrates || []) if (gap(c, { x: ax - 0.4, y: ay - 0.3, w: 0.8, h: 0.6 }) < 0) errs.push(`${c.kind}#${c.i} overlapper ammokasse (${ax},${ay})`);
  }
  if (v === 'v2') errs.push(...startCheck(def, objs));
  const hz = low.filter((o) => o.w > o.h).length, vt = low.filter((o) => o.h > o.w).length;
  console.log(`[${v}] lav dekning ${low.length}: liggende ${hz} (${Math.round(100 * hz / low.length)} %), stående ${vt}, kvadratisk ${low.length - hz - vt} | brudd ${errs.length}`);
  for (const e of errs) console.log('   ' + e);
  if (errs.length) fail = 1;
}
process.exit(fail);
