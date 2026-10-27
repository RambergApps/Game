// Testside (Breach Våpen, 2026-10-23): Warden med AR-9 / S-12 / M-4 (look/*.js) ved en container på Kessa Yard (trekvart).
// Kjør: cd game && python3 -m http.server → /src/weapons/look/test.html?zoom=2&mode=after|before
// mode=before: Warden-designs midlertidige rifle (v1) i hendene for alle tre (slik spillet så ut før look/*.js).
// Styres fra Playwright: window.LOOKTEST.scene({...}). window.BREACH = { world, camera, ... } for testriggen.
import { createWorld, createCamera } from '../../core/index.js';
import * as arena from '../../arena/index.js';
import { drawSorted } from '../../shared/depth.js';
import { faceted, muzzleOf } from '../../shared/rig/styles/faceted.js';
import { createRig, WARDEN } from '../../shared/rig/index.js';
import { clearAllCaches, cacheReport } from '../../shared/rig/faceted/bake.js';
import { registerWeaponLook, weaponLook, buildWeapon } from '../../shared/rig/faceted/weapons/index.js';
import { RIFLE_LOOK as TEMP_RIFLE } from '../../shared/rig/faceted/weapons/rifle.js';
import { LOOKS } from './index.js';
import { model, frame } from '../../shared/rig/faceted/mesh.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
canvas.width = innerWidth; canvas.height = innerHeight;
const world = createWorld(); const camera = createCamera(canvas);
world.camera = camera; world.arenaView = '34'; world.view = '34';
world.modules = { arena };
arena.init(world);
const errors = [];
addEventListener('error', (e) => errors.push(String(e.message)));

function setMode(mode) { registerWeaponLook(mode === 'before' ? TEMP_RIFLE : LOOKS.rifle); clearAllCaches(); }

function poseRig(x, y, a, aim = 1, t = 1.2) {
  const rig = createRig(WARDEN, { skin: 'warden', x, y, angle: a, style: faceted });
  const dt = 1 / 60;
  for (let i = 0; i <= Math.round(t / dt); i++) { rig.drive({ x, y, vx: 0, vy: 0, aimAngle: a, mode: 'idle', cover: null, aimBlend: aim, peek: 0, blind: 0, exposed: true }); rig.update(dt); }
  return rig;
}
function pickContainer() {
  const cov = arena.coverObjects(world).filter(o => o.type === 'high' && !o.ammo && o.w >= 120 && o.h >= 40 && o.h < o.w);
  const b = world.bounds || { w: 1600, h: 1000 }; const cx = (b.x || 0) + (b.w || 1600) / 2, cy = (b.y || 0) + (b.h || 1000) / 2;
  cov.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
  return cov[0];
}
/**
 * figs: [{ dx, dy (relativt til containerens sørvestre hjørne), a, weapon }]. Returnerer muzzle-mål per figur.
 */
function scene({ zoom = 2, mode = 'after', figs, cam = { dx: 0, dy: 0 } }) {
  setMode(mode);
  const c = pickContainer(); if (!c) throw new Error('no container');
  const ox = c.x, oy = c.y + c.h;
  camera.follow?.(null); camera.zoom = zoom; camera.x = ox + cam.dx; camera.y = oy + cam.dy; camera.shakeX = camera.shakeY = 0;
  const rigs = figs.map(f => ({ f, rig: poseRig(ox + f.dx, oy + f.dy, f.a) }));
  const actors = rigs.map(({ f, rig }) => { const F0 = rig.frame(); return { x: F0.x, y: F0.y, r: 12, team: 'player',
    drawActor: (cx) => { const F = rig.frame(); faceted.drawFigure(cx, rig, F, { weapon: mode === 'before' ? 'rifle' : f.weapon }); } }; });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0c0d0e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // to ganger: første runde baker (budsjett), andre tegner ferdige sprites
  for (let k = 0; k < 2; k++) {
    const keep = faceted.CFG.budgetMs; faceted.CFG.budgetMs = 1e9;
    ctx.save(); camera.apply(ctx);
    arena.draw(ctx, world, camera);
    drawSorted(ctx, world, camera, { cover: arena.coverObjects(world), drawCover: arena.drawCoverObject, actors: [], extra: actors });
    arena.drawTop?.(ctx, world, camera);
    ctx.restore(); faceted.CFG.budgetMs = keep;
  }
  return rigs.map(({ f, rig }) => {
    const F = rig.frame(), id = mode === 'before' ? 'rifle' : f.weapon, m = muzzleOf(rig, id), s = rig.socket('muzzle');
    const fwd = (p) => (p.x - F.x) * Math.cos(f.a) + (p.y - F.y) * Math.sin(f.a), side = (p) => -(p.x - F.x) * Math.sin(f.a) + (p.y - F.y) * Math.cos(f.a);
    const sc = camera.worldToScreen ? camera.worldToScreen(F.x, F.y) : null;
    return { weapon: f.weapon, id, look: weaponLook(id).name + ' v' + weaponLook(id).version, len: weaponLook(id).lengthPx ?? null,
      muzzle: { fwd: +fwd(m).toFixed(1), side: +side(m).toFixed(1), z: +m.z.toFixed(1) }, rigSocket: { fwd: +fwd(s).toFixed(1), side: +side(s).toFixed(1) }, screen: sc };
  });
}
window.BREACH = { world, camera, arena };
window.LOOKTEST = { scene, pickContainer, errors, cacheReport, LOOKS, weaponLook, registerWeaponLook, clearAllCaches };
window.LOOKTEST_READY = true;
if (!Q.get('manual')) scene({ zoom: +(Q.get('zoom') || 2), mode: Q.get('mode') || 'after',
  figs: [{ dx: 40, dy: 40, a: 0, weapon: 'rifle' }, { dx: 40, dy: 95, a: 0, weapon: 'shotgun' }, { dx: 40, dy: 150, a: 0, weapon: 'marksman' }] });
