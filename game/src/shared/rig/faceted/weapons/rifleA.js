// VARIANT A av AR-9 (id 'rifleA'): samme lengde (≈ 36 px) men reell bredde i 1× (≥ 3 px), tydelig magasin og
// kikkert som alltid tegnes (minScale 0). Bare for stilen facetedA; Våpens rifle.js erstatter begge senere.
import { registerWeaponLook } from './index.js';

export const RIFLE_A_LOOK = registerWeaponLook({
  id: 'rifleA', name: 'AR-9 (A)', version: 1,
  palette: { metal: '#5d6873', metalDark: '#22272d', polymer: '#1a1e23', wrap: '#3c4652', wear: '#d4dbe2', led: '#39c6ff' },
  skins: { blackout: { metal: '#3a3f45', polymer: '#16181b' } },
  wear: .35,
  points: {
    grip:   { x: 0, y: 0, z: 0 },
    fore:   { x: 11.6, y: -1.8, z: .4 },
    stock:  { x: -11.5, y: 0, z: .8 },
    muzzle: { x: 24.5, y: 0, z: 1.6 },
  },
  parts: [
    { id: 'stock',    box: [-11.5, -4.6, -1.5, 1.5, -1.2, 2.6], mat: 'polymer', c: .8, taper: [1, .85], bevel: .5 },
    { id: 'receiver', box: [-5.0, 4.6, -1.8, 1.8, -0.4, 3.2], mat: 'metal', c: .7, bevel: .5 },
    { plate: [{ x: -1.4, y: 1.82, z: 1.4 }, { x: 3.1, y: 1.82, z: 1.4 }, { x: 3.1, y: 1.82, z: 2.2 }, { x: -1.4, y: 1.82, z: 2.2 }], on: 'receiver', mat: 'led', n: { x: 0, y: 1, z: 0 }, minScale: 1.7 },
    { plate: [{ x: -1.4, y: -1.82, z: 1.4 }, { x: 3.1, y: -1.82, z: 1.4 }, { x: 3.1, y: -1.82, z: 2.2 }, { x: -1.4, y: -1.82, z: 2.2 }], on: 'receiver', mat: 'led', n: { x: 0, y: -1, z: 0 }, minScale: 1.7 },
    { id: 'bolt',     box: [-3.6, -0.6, 1.0, 1.95, 1.0, 2.6], mat: 'metalDark', c: .2, move: 'bolt', minScale: 2 },
    { id: 'guard',    box: [4.6, 16.0, -1.55, 1.55, -0.1, 2.9], mat: 'metalDark', c: .6, taper: [1, .92] },
    { id: 'wrap',     box: [6.8, 11.2, -1.65, 1.65, -0.2, 3.0], mat: 'wrap', c: .6, minScale: 1.7 },
    { id: 'barrel',   beam: [{ x: 16.0, y: 0, z: 1.6 }, { x: 24.5, y: 0, z: 1.6 }], w: 1.4, h: 1.4, mat: 'metalDark' },
    { id: 'brake',    box: [22.4, 24.5, -1.0, 1.0, .6, 2.6], mat: 'metal', c: .3 },
    { id: 'mag',      box: [0.2, 4.0, -1.1, 1.1, -5.2, -0.3], mat: 'metalDark', c: .4, topShift: 1.2, move: 'mag' },
    { id: 'grip',     box: [-1.2, 0.6, -.9, .9, -2.6, 0.0], mat: 'polymer', c: .3, minScale: 1.7 },
    { id: 'scope',    box: [-2.8, 3.6, -1.15, 1.15, 3.2, 5.4], mat: 'metal', c: .5, bevel: .4 },
    { id: 'scopeLens',box: [3.6, 4.1, -.8, .8, 3.6, 5.0], mat: 'led', c: .2, minScale: 1.7 },
  ],
  moving: {
    bolt: { axis: { x: -1, y: 0, z: 0 }, travel: 2.4 },
    mag:  { axis: { x: .25, y: 0, z: -1 }, travel: 7, fade: true },
  },
});
export default RIFLE_A_LOOK;
