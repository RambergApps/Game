// BREACH – M-4 Sentinel (`marksman`), faceted-utseende. Eies av Breach Våpen. 2026-10-23, v1.
// Designarkets enheter (42 px) ×1,19 → 50 px. Kjennetegn i 1×: klart lengst, stor kikkert på toppen, tynt løp med
// tykk demper ytterst, tommelhullskjefte. LED på kikkerttårnet (cyan).
import { B, sidePlates, topPlate, frontPlate, defineLook } from './util.js';

export const MARKSMAN_LOOK = defineLook({
  id: 'marksman', name: 'M-4 Sentinel', version: 1,
  palette: { metal: '#59626c', metalDark: '#3a4148', polymer: '#1f2327', wrap: '#5c5a48', wear: '#c3c9ce', led: '#39c6ff' },
  skins: { desert: { polymer: '#6e6249', wrap: '#8a7a5c' }, blackout: { metal: '#3a3f45', polymer: '#16181b' } },
  wear: .45,
  points: {
    grip:   { x: 0, y: 0, z: 0 },
    fore:   { x: 12.7, y: -.3, z: 1.3 },
    stock:  { x: -10.3, y: 0, z: 1.4 },
    muzzle: { x: 31.9, y: 0, z: 3.36 },
    led:    { x: 5.85, y: 1.3, z: 5.1 },
  },
  parts: [
    // kolbe: bakplate + kinnstøtte (oliven) + tommelhullskjefte
    B('butt', -10.3, -7.5, -2.1, 2.8, 2.4, 'polymer', { c: .5, topShift: .2 }),
    B('stockTop', -7.7, .5, 1.0, 2.6, 2.0, 'polymer', { c: .45, taper: [1, .9] }),
    B('cheek', -7.7, -2.9, 2.5, 3.3, 2.6, 'wrap', { c: .45, minScale: 1 }),
    { id: 'stockLow', beam: [{ x: -7.6, y: 0, z: -.9 }, { x: -3.4, y: 0, z: .2 }], w: 1.8, h: 1.2, mat: 'polymer', c: .3 },
    B('grip', -3.1, -1.0, -1.25, 1.1, 1.9, 'polymer', { c: .35, topShift: .7, taper: [.8, 1] }),
    // låskasse + forskjefte i ett (langt, slankt)
    B('recv', .7, 18.2, 1.3, 3.6, 2.0, 'metalDark', { c: .4 }),
    B('mag', 3.8, 7.0, -1.3, 1.4, 1.6, 'polymer', { c: .3, move: 'mag' }),
    // bolt med kule på høyre side (lys stål)
    B('bolt', 1.4, 2.8, 1.6, 3.2, 1.0, 'metal', { c: .2, move: 'bolt', minScale: 2 }, 1.5),
    B('knob', 1.6, 2.6, .95, 1.9, 1.2, 'metal', { c: .3, move: 'bolt', minScale: 1 }, 2.4),
    // løp + demper (tykkere ytterst → tydelig munning)
    { id: 'barrel', beam: [{ x: 18.1, y: 0, z: 3.36 }, { x: 26.1, y: 0, z: 3.36 }], w: 1.0, h: .9, mat: 'metal' },
    B('supp', 25.9, 31.9, 2.7, 4.05, 1.7, 'metalDark', { c: .4 }),
    B('suppCap', 31.0, 31.9, 2.75, 4.0, 1.75, 'metal', { c: .3, minScale: 1 }),
    // kikkert: stor og høy – M-4s viktigste kjennetegn ovenfra
    B('rings', 7.0, 12.7, 3.55, 4.75, 1.4, 'metalDark', { c: .25, minScale: 2 }),
    B('rbell', -.7, 1.6, 4.1, 6.2, 2.2, 'metalDark', { c: .5 }),
    B('tubeS', 1.4, 9.4, 4.55, 5.75, 1.5, 'metalDark', { c: .35 }),
    B('turret', 4.9, 6.8, 4.3, 6.9, 2.6, 'metal', { c: .4, minScale: 1 }),
    B('fbell', 9.2, 12.6, 4.05, 6.25, 2.4, 'metalDark', { c: .55 }),
    B('bipod', 14.8, 22.3, -.1, 1.3, 1.3, 'metalDark', { c: .25, minScale: 2 }),
    // merker
    frontPlate('fbell', 12.62, -.85, .85, 4.45, 5.85, 'polymer', { minScale: 2 }),       // objektivlinse
    ...sidePlates('turret', 5.55, 6.15, 4.95, 5.45, 1.3, 'led', { minScale: 1 }),         // LED på tårnet (side mot kamera)
    topPlate('turret', 5.3, 6.4, -.7, .7, 6.92, 'led', { minScale: 1 }),                  // samme LED oppå tårnet (synlig ovenfra)
    ...sidePlates('supp', 27.0, 30.6, 3.2, 3.55, .85, 'metal', { minScale: 3 }),          // demperribber (lys)
    frontPlate('supp', 31.92, -.35, .35, 3.0, 3.7, 'polymer', { minScale: 2 }),
  ],
  moving: {
    bolt: { axis: { x: -1, y: 0, z: 0 }, travel: 2.6 },
    mag:  { axis: { x: 0, y: 0, z: -1 }, travel: 4, fade: true },
  },
});
export default MARKSMAN_LOOK;
