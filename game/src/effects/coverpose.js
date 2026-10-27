// BREACH – Effekter: Warden over dekning. Adapter mellom kilden (hendelser eller positur) og effektene coverRise / exposedHit (index.js).
// Kontrakt (Warden-design 27.10, sendt fra player/state.js): coverRise {entity,x,y,type,nx,ny,cover} når hodet passerer kanten,
// coverDuck {entity,x,y,type,nx,ny} når han er nede igjen, p.exposed === true mellom dem (blindfire teller ikke).
// Reserve til hendelsene finnes: stigende/fallende kant på p.posture === 'popUp' (og 'lean'), sjekket én gang per update-steg.
// Bytt kilde: SOURCE.mode = 'auto' (hendelser hvis de kommer, ellers positur) | 'events' | 'posture'.
import { spawn } from './index.js';
import { PROJ } from '../shared/projection.js';

export const SOURCE = { mode: 'auto' };
const UP = (p) => p.posture === 'popUp' || p.posture === 'lean';
/** Er figuren eksponert nå? Kontraktflagget først, ellers positur. */
export function isExposed(p) { if (!p) return false; if (typeof p.exposed === 'boolean') return p.exposed; return !!p.inCover && UP(p); }

function edgePoint(p, cover, nx, ny) {
  // Nærmeste punkt på dekningsrektangelet (robust uansett fortegn på normalen); ellers x + n·r.
  if (cover && Number.isFinite(cover.x) && Number.isFinite(cover.w)) {
    const x = Math.max(cover.x, Math.min(p.x, cover.x + cover.w)), y = Math.max(cover.y, Math.min(p.y, cover.y + cover.h));
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d > 0.5) return { x, y, nx: dx / d, ny: dy / d };
  }
  return { x: p.x + (nx || 0) * (p.r || 12), y: p.y + (ny || 0) * (p.r || 12), nx: nx || 0, ny: ny || -1 };
}
function coverZ(cover, type) {
  if (cover && Number.isFinite(cover.height)) return cover.height;
  if (cover && Number.isFinite(cover.elev)) return cover.elev / PROJ.zScale;
  return type === 'high' ? (PROJ.heights?.high ?? 48) : (PROJ.heights?.low ?? 24);
}
const S_last = { e: null };
// Støvtak: maks ~40 levende reisestøv-partikler totalt, nedskalering når flere reiser seg innen 0,3 s, 0,5 s nedkjøling per dekning.
export const DUST = { floor: 0.13, max: 40, full: 30, life: 0.6, window: 0.3, cooldown: 0.5 };
const B = { log: [], cool: new Map(), last: { n: 0, scale: 1, live: 0 } };
function budget(world, cover, e) {
  const now = world.time || 0, key = cover?.id ?? `${Math.round(e.x / 16)},${Math.round(e.y / 16)}`;
  if (now - (B.cool.get(key) ?? -9) < DUST.cooldown) return 0;
  let live = 0, recent = 0; for (let i = B.log.length - 1; i >= 0; i--) { const q = B.log[i], age = now - q.t; if (age > DUST.life || age < 0) { B.log.splice(i, 1); continue; } live += q.n; if (age <= DUST.window) recent++; }
  let k = recent ? 1 / (recent + 1) : 1; k = Math.max(DUST.floor, Math.min(k, Math.max(0, DUST.max - live) / DUST.full));   // gulv: hver reising får alltid kantlist + ~4 korn
  B.cool.set(key, now); if (B.cool.size > 64) B.cool.delete(B.cool.keys().next().value);
  B.log.push({ t: now, n: Math.round(DUST.full * k) }); B.last = { n: B.log.length, scale: k, live: live + Math.round(DUST.full * k) }; return k;
}
export function dustStats() { return B.last; }
export function riseSpawns() { return S_last.n || 0; }
function rise(world, p, cover, type, nx, ny) {
  if (type === 'high') return;   // høy dekning: lener ut på siden, ingen toppkant
  const e = edgePoint(p, cover, nx, ny), k = budget(world, cover, e); if (!k) return;
  S_last.e = e;
  S_last.n = (S_last.n || 0) + 1; spawn(world, 'coverRise', { scale: k, x: e.x, y: e.y, z: coverZ(cover, type), nx: e.nx, ny: e.ny, tx: -e.ny, ty: e.nx, material: cover?.material, depth: cover ? (Math.abs(e.nx) > Math.abs(e.ny) ? cover.w : cover.h) : 12 });
}

/** Kobles fra bind.js. Returnerer liste med off-funksjoner. */
export function bindCoverPose(world, st, on) {
  const S = { cueT: 0, e: null, cover: null, type: 'low', nx: 0, ny: 0, up: false, sawEv: false, n: 0 };
  st.pose = S;
  on('coverEnter', (q) => { if (q?.entity !== world.player) return; S.cover = q.cover || null; S.type = q.type || 'low'; S.nx = q.nx; S.ny = q.ny; });
  on('coverExit', (q) => { if (q?.entity && q.entity !== world.player) return; S.cover = null; S.up = false; });
  on('coverRise', (q) => { if (!q || SOURCE.mode === 'posture') return; S.sawEv = true; const p = q.entity || world.player; if (!p) return; S.n++;
    rise(world, { x: q.x ?? p.x, y: q.y ?? p.y, r: p.r }, q.cover || S.cover, q.type || S.type, q.nx, q.ny); });
  on('coverDuck', () => { if (SOURCE.mode !== 'posture') S.sawEv = true; });
  on('hit', (h) => {
    const t = h?.target; if (!t || t !== world.player || h.blocked || !(h.amount > 0) || !isExposed(t)) return;
    const s = h.source || {}, pr = s.projectile, sx = s.x ?? pr?.ox, sy = s.y ?? pr?.oy;
    const a = pr ? pr.angle : Number.isFinite(sx) ? Math.atan2(t.y - sy, t.x - sx) : -Math.PI / 2, rr = (t.r || 12) * 0.6;
    spawn(world, 'exposedHit', { x: t.x - Math.cos(a) * rr, y: t.y - Math.sin(a) * rr, z: 34, angle: a, power: Math.min(1.4, 0.7 + (h.amount || 8) / 20) });
  });
  // Reserve: kant på positur (bare når ingen kontrakthendelser er sett, eller mode = 'posture')
  st.tickPose = () => {
    const p = world.player; if (!p || p.dead) { S.up = false; return; }
    if (SOURCE.mode === 'events' || (SOURCE.mode === 'auto' && (S.sawEv || typeof p.exposed === 'boolean'))) { S.up = false; return; }   // 27.10: state.js setter p.exposed → kilden sender hendelser, reserven tier fra første bilde (ellers dobbel første reising)
    const up = !!p.inCover && UP(p);
    if (up && !S.up) { S.n++; rise(world, p, S.cover, S.type, S.nx, S.ny); }
    S.up = up;
  };
  // vedvarende markør mens eksponert (kontraktflagget eller reserven), ~7 Hz
  st.tickCue = (dt) => {
    const p = world.player; if (!p || p.dead || !isExposed(p) || S.type === 'high') { S.cueT = 0; return; }
    S.cueT -= dt; if (S.cueT > 0) return; S.cueT = 0.14; const e = S_last.e;
    spawn(world, 'exposedCue', { x: p.x, y: p.y, nx: e?.nx ?? 0, ny: e?.ny ?? -1 });
  };
}
