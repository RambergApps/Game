// Interaksjonstast ved utgangene på brett 2 (Warden-design 27.10). Bruker Storys grensesnitt i levels/brett2.js
// (exitInReach / tryUseExit / setAutoZone) – brett2.js redigeres ikke.
// Regel: E i en ulåst, ubrukt overgangssone (og Warden ikke død/opptatt) = start overgangen; E tas da IKKE til dekning.
// Ellers virker E som før (inn/ut av dekning). Klikk/tap på ledeteksten gjør det samme (touchpad).
// Kjører bare når brett2-tilstanden finnes (world._brett2), så brett 1 er upåvirket.
import * as B2 from '../levels/brett2.js';   // valgfrie funksjoner: brukes bare om de finnes

const VERB = { pry: 'Force door', ladder: 'Climb', crawl: 'Crawl', valve: 'Turn valve' };
let box = null;   // ledetekstens skjermrektangel fra forrige tegning (for klikk/tap)

export function initInteract() { box = null; }   // AUTO_ZONE=false er standard i brett2.js (Story, 23:25)
const T = 32;
function exitInReach(world) {
  const s = world._brett2, p = world.player; if (!s || !p || p.dead || s.busy) return null;
  if (B2.exitInReach) return B2.exitInReach(world);
  return B2.TRANSITIONS.find((t) => s.cleared.has(t.section) && !s.used.has(t.id) && Math.hypot(p.x - t.x * T, p.y - t.y * T) <= 1.2 * T) || null;
}
const tryUseExit = (world, id) => (typeof B2.tryUseExit === 'function' ? B2.tryUseExit(world, id) : false);

/** Kalles før stepState. true = overgang startet (E/klikk er brukt opp). */
export function updateInteract(world, P, I) {
  const t = world._brett2 ? exitInReach(world) : null;
  if (!t) { box = null; return false; }
  const m = world.input?.mouse;
  const click = !!(m?.leftPressed && box && m.x >= box.x && m.x <= box.x + box.w && m.y >= box.y && m.y <= box.y + box.h);
  if (!(I.e || click)) return false;
  if (!tryUseExit(world, t.id)) return false;
  P.ctl.buf.e = 0; I.e = false;
  if (click && m) { m.left = false; m.leftPressed = false; }   // klikket skal ikke også skyte
  return true;
}

/** Ledetekst over Warden (skjermkoordinater). */
export function drawInteract(ctx, world, camera) {
  const p = world.player, t = world._brett2 ? exitInReach(world) : null;
  if (!t || !p || p.dead || !camera?.worldToScreen) { box = null; return; }
  const c = camera.worldToScreen(p.x, p.y), z = camera.zoom || 1;
  const fs = Math.round(Math.max(14, 9 + z * 3)), txt = VERB[t.kind] || 'Use';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `bold ${fs}px sans-serif`; ctx.textBaseline = 'middle';
  const kw = ctx.measureText('E').width + fs * 0.8, tw = ctx.measureText(txt).width, pad = fs * 0.5;
  const w = kw + tw + pad * 3, h = fs * 1.8, x = Math.round(c.x - w / 2), y = Math.round(c.y - 46 * z - h - 8);
  const a = 0.85 + 0.15 * Math.sin((world.time || 0) * 5);
  ctx.fillStyle = 'rgba(10,14,18,0.82)'; ctx.strokeStyle = `rgba(57,198,255,${a})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 6) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#39c6ff'; ctx.fillRect(x + pad, y + h * 0.18, kw, h * 0.64);
  ctx.fillStyle = '#0a0e12'; ctx.textAlign = 'center'; ctx.fillText('E', x + pad + kw / 2, y + h / 2 + 1);
  ctx.fillStyle = '#e8eef2'; ctx.textAlign = 'left'; ctx.fillText(txt, x + pad * 2 + kw, y + h / 2 + 1);
  ctx.restore();
  box = { x, y, w, h };
}
