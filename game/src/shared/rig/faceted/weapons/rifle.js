// MIDLERTIDIG AR-9-utseende (Breach Warden-design, 2026-10-23). Breach Våpen erstatter denne med
// game/src/weapons/look/rifle.js (samme format, registerWeaponLook). Langt og rett (≈ 36 px), bryter omrisset.
// Palett fra WARDEN-DESIGN §3 (gunmetal #2b3036 / #59626c). Origo = grepet (høyre hånd).
import { registerWeaponLook } from './index.js';

export const RIFLE_LOOK = registerWeaponLook({
  id: 'rifle', name: 'AR-9', version: 1.5,   // 1.5: tykkere (≥ 3 skjerm-px i 1×), synlig magasin og sikte
  palette: { metal: '#59626c', metalDark: '#2b3036', polymer: '#23272b', wrap: '#5c5a48', wear: '#c3c9ce', led: '#39c6ff' },
  skins: { desert: { polymer: '#6e6249', wrap: '#8a7a5c' }, blackout: { metal: '#3a3f45', polymer: '#16181b' } },
  wear: .5,
  points: {
    grip:   { x: 0, y: 0, z: 0 },
    fore:   { x: 11.9, y: -1.3, z: .2 },
    stock:  { x: -11.5, y: 0, z: .6 },
    muzzle: { x: 24.5, y: 0, z: 1.4 },
  },
  parts: [
    { id: 'stock',    box: [-11.5, -5.0, -1.5, 1.5, -1.0, 2.6], mat: 'polymer', c: .5, taper: [1, .9] },
    { id: 'receiver', box: [-5.0, 4.3, -1.7, 1.7, -0.5, 3.3], mat: 'metal', c: .45 },
    { plate: [{ x: -1.4, y: 1.72, z: 1.3 }, { x: 2.9, y: 1.72, z: 1.3 }, { x: 2.9, y: 1.72, z: 2.0 }, { x: -1.4, y: 1.72, z: 2.0 }], on: 'receiver', mat: 'led', n: { x: 0, y: 1, z: 0 }, minScale: 2 },
    { plate: [{ x: -1.4, y: -1.72, z: 1.3 }, { x: 2.9, y: -1.72, z: 1.3 }, { x: 2.9, y: -1.72, z: 2.0 }, { x: -1.4, y: -1.72, z: 2.0 }], on: 'receiver', mat: 'led', n: { x: 0, y: -1, z: 0 }, minScale: 2 },
    { id: 'bolt',     box: [-3.6, -0.6, .9, 1.7, 1.0, 2.4], mat: 'metalDark', c: .2, move: 'bolt', minScale: 2 },
    { id: 'guard',    box: [4.3, 15.1, -1.6, 1.6, -0.2, 2.8], mat: 'metalDark', c: .4 },
    { id: 'wrap',     box: [6.5, 11.0, -1.7, 1.7, -0.3, 2.9], mat: 'wrap', c: .4, minScale: 2 },
    { id: 'barrel',   beam: [{ x: 15.1, y: 0, z: 1.4 }, { x: 24.5, y: 0, z: 1.4 }], w: 1.4, h: 1.4, mat: 'metalDark' },
    { id: 'brake',    box: [22.4, 24.5, -1.0, 1.0, .4, 2.4], mat: 'metal', c: .2 },
    { id: 'mag',      box: [0.2, 3.8, -1.1, 1.1, -5.2, -0.4], mat: 'metalDark', c: .3, topShift: .8, move: 'mag' },
    { id: 'grip',     box: [-1.0, 0.6, -.7, .7, -2.3, 0.0], mat: 'polymer', c: .2, minScale: 2 },
    { id: 'sight',    box: [-2.2, 2.8, -1.0, 1.0, 3.3, 5.4], mat: 'metalDark', c: .2 },
  ],
  moving: {
    bolt: { axis: { x: -1, y: 0, z: 0 }, travel: 2.4 },
    mag:  { axis: { x: .25, y: 0, z: -1 }, travel: 7, fade: true },
  },
});
export default RIFLE_LOOK;
