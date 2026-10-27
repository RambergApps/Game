// Hastefiks 27.10 (QA vinkel 55): fiender telegraferer/skyter/kaster KUN når de er innenfor kamerabildet.
// Bruker kameraets faktiske transform (world.camera.worldToScreen, inkl. følg, lead, zoom, g og rist) –
// ingen fast avstand. Sjekker fotpunkt og munning/hode (z via PROJ.zScale). Margin innover: 28 skjerm-px.
// Uten kamera (headless-rigg/test.html) → true (midlertidig fallback, oppførsel som før).
import { PROJ } from '../shared/projection.js';
export const ONSCREEN_MARGIN = 28;
export function onScreen(world, e, margin = ONSCREEN_MARGIN) {
  const cam = world.camera;
  if (!cam || typeof cam.worldToScreen !== 'function' || !(cam.width > 0)) return true;
  const W = cam.width, H = cam.height, zs = world.view === '34' ? (PROJ.zScale || 0) * (cam.zoom || 1) : 0;
  const inside = (x, y, z) => { const s = cam.worldToScreen(x, y); const sy = s.y - z * zs; return s.x >= margin && s.x <= W - margin && sy >= margin && sy <= H - margin; };
  if (!inside(e.x, e.y, 0)) return false;
  const m = e.muzzle, z = (m && Number.isFinite(m.z)) ? m.z : (e.muzzleZ || 26);
  return inside(m && Number.isFinite(m.x) ? m.x : e.x, m && Number.isFinite(m.y) ? m.y : e.y, z);
}
// Tilstander der en fiende varsler eller angriper på avstand. Går den ut av bildet her → avbryt (ny vurdering).
export const ATTACK_STATES = new Set(['telegraph', 'fire', 'spinup', 'sustain', 'throw', 'meleeCharge']);
