// Spawnsjekk (Arena 27.10): ingen fiende-spawn (spawnPoints + enemySpawns) skal ligge inne i høy dekning pluss
// største fienderadius (18 px, Kiln/Lurcher). Avslutter med kode 1 ved brudd.  node src/arena/_tools/spawn-check.cjs [v2|v1|lavt]
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = { v2: ['yard-v2.js', 'YARD_V2'], v1: ['yard.js', 'YARD'], lavt: ['yard-lavt.js', 'YARD_LAVT'] };
function load(file, name) {
  let src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const imp = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([^']+)'/g)]; const ctx = { Math };
  for (const [, names, f] of imp) { const n = names.trim().split(/\s*,\s*/)[0]; ctx[n] = load(f, n); }
  src = src.replace(/^import .*$/mg, '').replace(/export const /g, 'var ').replace(/export function /g, 'function ');
  vm.createContext(ctx); vm.runInContext(src, ctx); return ctx[name];
}
const LOW = new Set(['barrier', 'sandbag', 'crates', 'barrels', 'water', 'ledge']);
const R = 18 / 32;   // tiles
const [file, name] = FILES[process.argv[2] || 'v2']; const def = load(file, name);
const pts = [...Object.entries(def.spawnPoints || {}).map(([k, p]) => ({ k, ...p })), ...(def.enemySpawns || []).map((p, i) => ({ k: 'enemySpawns[' + i + ']', ...p }))];
const highs = (def.objects || []).filter((o) => !LOW.has(o[0]));
const bad = [];
for (const p of pts) for (const o of highs) {
  const [t, x, y, w, h] = o; const dx = Math.max(x - p.x, 0, p.x - (x + w)), dy = Math.max(y - p.y, 0, p.y - (y + h));
  if (Math.hypot(dx, dy) < R) bad.push(`${p.k} (${p.x},${p.y}) i/inntil ${t} ${x},${y} ${w}×${h} (avstand ${Math.hypot(dx, dy).toFixed(2)} < ${R.toFixed(2)})`);
}
console.log(`[${process.argv[2] || 'v2'}] spawnpunkter ${pts.length}, høy dekning ${highs.length} | brudd ${bad.length}`); bad.forEach((b) => console.log('  ' + b));
process.exit(bad.length ? 1 : 0);
