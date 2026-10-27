// Delt rigg – offentlig inngang. Se rig.js for API og utseende-kontrakten.
import { createRig as createRigBase } from './rig.js';
import { socketZ } from './styles/oblique.js';
/**
 * createRig med høyde på sockets: rig.socket(name) → { x, y, angle, z }. x/y/angle er uendret (bakoverkompatibelt);
 * z = høyde over bakken i verdens-px (samme enhet som PROJ.heights) slik figuren tegnes i trekvart (oblique).
 * Bruk: PROJ.toScreen(s.x, s.y, s.z). Ukjent socket → z 0. (rig.js er urørt; dette er en tynn innpakning.)
 */
export function createRig(def, opts) {
  const rig = createRigBase(def, opts); const base = rig.socket;
  rig.socket = (name) => { const o = base(name); o.z = socketZ(rig.frame(), name); return o; };
  return rig;
}
export { WARDEN, withDef } from './defs/warden.js';
export { SKINS, registerSkin, skinOf } from './skins.js';
export { painted, registerPaint } from './styles/painted.js';
export { CLIPS } from './clips.js';
export * as rigMath from './math.js';
