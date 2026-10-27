// Leser core-input og lager en «intensjon» per steg. Trykk (Space/E/Q/R/F) buffres i 150 ms (ANIMASJON §4.2).
import { TUNING as T } from './tuning.js';
import { PROJ } from '../shared/projection.js';

const BUF = ['space', 'e', 'q', 'r', 'f'];
export function createController() { return { buf: { space: 0, e: 0, q: 0, r: 0, f: 0 }, intent: null }; }

/** → { mx, my, ml, aimX, aimY, fire, aim, sprint, space, e, q, r, f, grenade } (space/e/q/r = bufret trykk tilgjengelig) */
export function readIntent(ctl, world, dt) {
  const inp = world.input, m = inp?.mouse || { worldX: 0, worldY: 0 };
  const k = (c) => !!inp?.down(c);
  // Sikte: i trekvart (view '34') tolkes musepunktet i brysthøyde → sikt mot bakkepunktet under (PROJ.aimGround, +20,25 worldY).
  // Ovenfra: musa direkte (uendret). Granatsikte i weapons leser fortsatt rå mus (bakken der musa peker).
  const ag = world.view === '34' ? PROJ.aimGround(m.worldX, m.worldY) : { x: m.worldX, y: m.worldY };
  let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  let my = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0);
  const l = Math.hypot(mx, my); if (l) { mx /= l; my /= l; }
  const pr = { space: inp?.pressed('Space'), e: inp?.pressed('KeyE'), q: inp?.pressed('KeyQ'), r: inp?.pressed('KeyR'), f: inp?.pressed('KeyF') };
  for (const b of BUF) { if (pr[b]) ctl.buf[b] = T.inputBuffer; else ctl.buf[b] = Math.max(0, ctl.buf[b] - dt); }
  ctl.intent = {
    mx, my, ml: l ? 1 : 0, aimX: ag.x, aimY: ag.y, mouseX: m.worldX, mouseY: m.worldY,
    fire: !!m.left, aim: !!m.right, sprint: k('ShiftLeft') || k('ShiftRight'),
    space: ctl.buf.space > 0, e: ctl.buf.e > 0, q: ctl.buf.q > 0, r: ctl.buf.r > 0, f: ctl.buf.f > 0,
    grenade: k('KeyG'),
  };
  return ctl.intent;
}
/** Marker et bufret trykk som brukt. */
export function consume(ctl, name) { ctl.buf[name] = 0; if (ctl.intent) ctl.intent[name] = false; }
