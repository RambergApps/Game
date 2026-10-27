// Varsel for fiender utenfor skjermen (Våpen/UI, 27.10): liten trekant ved skjermkanten i fiendens typefarge
// (enemies/stats.js ENEMY_TYPES[type].color), som peker mot fienden. Fade etter avstand (nær = sterk, langt = svak).
// Tegnes fra ui/index.js sin hud.draw (loopens mods.hud), dvs. før level/player-HUD – panelene ligger alltid oppå.
// Bunnkanten klemmes over HUD-panelene: våpenpanelet (weapons/hud.js: midtstilt 360 px, reload-bar 396 px, topp H−139) og helsepanelet (levels/hud.js: 0..320u, topp H−74u, u = clamp(min(W/1600,H/900), .62, 1.5)).
// Ingen ctx.filter/shadowBlur, ingen Math.random, ingen allokering per fiende utover camera.worldToScreen-resultatet.
import { getSettings } from './settings.js';
import { PROJ } from '../shared/projection.js';
import { ENEMY_TYPES } from '../enemies/stats.js';

export const OFFSCREEN_UI = { margin: 22, pad: 10, near: 260, far: 1500, alphaMin: 0.38, size: 13, sizeFar: 9, z: 24 };
const rgbCache = {};
function rgbOf(type) {
  let c = rgbCache[type]; if (c) return c;
  const hex = (ENEMY_TYPES[type]?.color || '#c0392b').replace('#', '');
  c = rgbCache[type] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  return c;
}
/** HUD-panelenes rektangler nederst (skjerm-px). Gjenbrukt objekt. */
const _rects = { wx0: 0, wx1: 0, wTop: 0, hx1: 0, hTop: 0 };
export function hudRects(W, H, world) {
  const u = Math.min(1.5, Math.max(0.62, Math.min(W / 1600, H / 900)));
  // alltid reload-størrelsen (bredere 396 px reload-bar, topp H−139), så pilene ikke hopper når man lader om
  _rects.wx0 = W / 2 - 198 - 6; _rects.wx1 = W / 2 + 198 + 6; _rects.wTop = H - 18 - 74 - 30 - 17;
  _rects.hx1 = 320 * u; _rects.hTop = H - 74 * u;
  return _rects;
}

export function createOffscreenIndicator(world) {
  function draw(ctx, w, camera) {
    const list = world.enemies; if (!list || !list.length || !camera?.worldToScreen) return;
    if (getSettings().offscreenEnemies === false) return;
    const p = world.player; if (!p) return;
    const W = ctx.canvas.width, H = ctx.canvas.height, O = OFFSCREEN_UI, m = O.margin;
    const lifted = world.view === '34';
    const R = hudRects(W, H, world);
    const pz = lifted ? PROJ.toScreen(p.x, p.y, O.z) : p;
    const ps = camera.worldToScreen(pz.x, pz.y);
    const cx = Math.min(W - m, Math.max(m, ps.x)), cy = Math.min(R.wTop - O.pad, Math.max(m, ps.y));
    ctx.save(); ctx.lineJoin = 'round';
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (!e || e.dead || !Number.isFinite(e.x)) continue;
      const ez = lifted ? PROJ.toScreen(e.x, e.y, O.z) : e;
      const s = camera.worldToScreen(ez.x, ez.y), rr = (e.r || 16) * (camera.zoom || 1);
      if (s.x > -rr && s.x < W + rr && s.y > -rr && s.y < H + rr * 0.5) continue;   // synlig (eller nesten)
      const dx = s.x - cx, dy = s.y - cy, len = Math.hypot(dx, dy) || 1, kx = dx / len, ky = dy / len;
      // indre ramme: bunnen avhenger av hvilket panel strålen treffer
      const t = (bottom) => Math.min(kx > 0 ? (W - m - cx) / kx : kx < 0 ? (m - cx) / kx : 1e9, ky > 0 ? (bottom - cy) / ky : ky < 0 ? (m - cy) / ky : 1e9);
      let k = t(H - m), x = cx + kx * k, y = cy + ky * k;
      if (y > R.wTop - O.pad && x > R.wx0 && x < R.wx1) { k = t(R.wTop - O.pad); x = cx + kx * k; y = cy + ky * k; }
      if (y > R.hTop - O.pad && x < R.hx1) { k = t(R.hTop - O.pad); x = cx + kx * k; y = cy + ky * k; }
      const d = Math.hypot(e.x - p.x, e.y - p.y), f = Math.min(1, Math.max(0, (d - O.near) / (O.far - O.near)));
      const a = 1 - (1 - O.alphaMin) * f, sz = O.size + (O.sizeFar - O.size) * f;
      ctx.setTransform(1, 0, 0, 1, x, y); ctx.rotate(Math.atan2(ky, kx));
      ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.75, -sz * 0.8); ctx.lineTo(-sz * 0.35, 0); ctx.lineTo(-sz * 0.75, sz * 0.8); ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(10,8,8,${0.75 * a})`; ctx.stroke();
      ctx.fillStyle = `rgba(${rgbOf(e.type)},${a})`; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,225,200,${0.45 * a})`; ctx.stroke();
    }
    ctx.restore();
  }
  return { draw };
}
