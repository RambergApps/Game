// BREACH – S-12 Breaker (`shotgun`), faceted-utseende. Eies av Breach Våpen. 2026-10-23, v2.
// Designarkets enheter (25 px) ×1,2 → ~32 px. Runde 2 (Breach 23.10): v1 leste som «lys kloss». Nå hagleform i 1×:
// kolbe → låskasse (synlig foran hånda) → kort pumpe (fortsatt lysest/bredest, men dempet) → LØP + RØRMAGASIN som to
// parallelle streker med tydelig luft mellom → mørk, firkantet munning med lys kant. Ingen optikk.
import { B, sidePlates, topPlate, frontPlate, defineLook } from './util.js';

export const SHOTGUN_LOOK = defineLook({
  id: 'shotgun', name: 'S-12 Breaker', version: 3,
  // wrap = pumpa: mørk oliven (#565240) – lysere enn resten av våpenet, men ikke lenger en lyskilde
  palette: { metal: '#5f6872', metalDark: '#353b42', polymer: '#1f2327', wrap: '#6c6650', wear: '#c3c9ce', led: '#39c6ff', accent: '#a8823e' },
  skins: { desert: { polymer: '#6e6249', wrap: '#94886a' }, blackout: { metal: '#3a3f45', polymer: '#16181b', wrap: '#5e5a48' } },
  wear: .3,   // v2: lavere – slitasjeflekkene gjorde den mørke munningen lys i 1×
  points: {
    grip:   { x: 0, y: 0, z: 0 },
    fore:   { x: 10.6, y: 0, z: .1, on: 'pump' },   // venstre hånd på pumpa (on er reservert i formatet)
    stock:  { x: -5.6, y: 0, z: 1.8 },
    muzzle: { x: 21.0, y: 0, z: 3.6 },             // løpsaksen ved munningsklossens front
    led:    { x: 5.5, y: 1.75, z: 2.9 },            // kammerindikator foran hånda, på begge sider
  },
  parts: [
    // kort, kraftig kolbe med rekylpute
    B('stockComb', -5.6, -1.4, 1.2, 2.85, 2.8, 'polymer', { c: .55, taper: [1, .9] }),
    B('buttPad', -5.7, -4.0, -1.5, 2.8, 3.0, 'polymer', { c: .5 }),
    { id: 'stockStrut', beam: [{ x: -4.4, y: 0, z: -.5 }, { x: -2.0, y: 0, z: 1.3 }], w: 2.4, h: 1.2, mat: 'polymer', c: .3 },
    // låskasse i METAL (ikke mørk): den lange flaten mellom hendene som sier «hagle», stikker 6 enheter foran grepet
    B('recv', -1.6, 7.0, .4, 3.8, 3.2, 'metalDark', { c: .55, taper: [.97, .9] }),
    B('recvTop', -1.4, 6.8, 3.8, 4.1, 2.2, 'polymer', { c: .15, minScale: 1 }),          // mørk ryggkant → låskassa får kontur
    B('carrier', 1.0, 4.4, 1.0, 3.2, 3.8, 'metalDark', { c: .35, minScale: 2 }),
    B('grip', -1.85, .1, -3.2, .6, 2.2, 'polymer', { c: .4, topShift: 1.25, taper: [.85, 1], minScale: 1 }),
    B('trigger', .4, 2.6, -.9, .45, 1.6, 'metalDark', { c: .2, minScale: 2 }),
    // LØP (øverst, lyst metal) og RØRMAGASIN (under, mørkt) – to streker med luft imellom foran pumpa
    // z-luft 2,1 enheter (≈ 2 px i 1×) – minus toppflatens høyde i 37° gir ~1 px mørk strek mellom løp og rør
    { id: 'barrel', beam: [{ x: 6.8, y: 0, z: 3.6 }, { x: 18.6, y: 0, z: 3.6 }], w: 1.1, h: 1.1, mat: 'metal', c: .15 },
    { id: 'tube', beam: [{ x: 6.8, y: 0, z: -.5 }, { x: 17.2, y: 0, z: -.5 }], w: 1.0, h: 1.0, mat: 'polymer', c: .15 },   // v3: lavere og mørkere → tydelig luft til løpet
    B('clamp', 15.9, 16.8, -.2, 4.0, 1.5, 'metalDark', { c: .15, minScale: 2 }),             // klemme løp/rør (fra 2×)
    B('tubeCap', 16.9, 17.5, -1.1, .1, 1.3, 'metal', { c: .15, minScale: 1 }),             // lys rørende → enden av nedre strek
    // PUMPE: kortere (5,2 mot 6,8), lavere og dempet, men fortsatt bredest (3,9 mot låskassas 3,2) – riller fra 2×
    B('pump', 8.4, 12.8, -.8, 1.7, 3.9, 'wrap', { c: .5, bevel: .3, taper: [1, .7], move: 'pump' }),
    // MØRK, firkantet munning med lys frontkant
    B('breach', 18.4, 20.55, 2.55, 4.65, 2.5, 'polymer', { c: .3, taper: [1, .3] }),   // polymer = mørkest (toppflaten lyses opp)
    B('breachLip', 20.55, 21.0, 2.4, 4.8, 2.7, 'metal', { c: .2, minScale: 1 }),
    B('rsight', 1.5, 2.6, 4.1, 4.8, 1.2, 'metalDark', { c: .2, minScale: 2 }),
    B('fsight', 17.4, 18.1, 4.1, 4.8, .8, 'metal', { c: .15, minScale: 2 }),
    // merker
    ...sidePlates('carrier', 1.3, 4.1, 2.2, 2.95, 1.9, 'accent', { minScale: 2 }),       // fire messingpatroner (samlet)
    ...sidePlates('carrier', 1.3, 4.1, 1.25, 2.05, 1.9, 'polymer', { minScale: 2 }),     // hylsene (mørke)
    ...sidePlates('pump', 9.3, 9.7, -.4, 1.7, 1.97, 'metalDark', { minScale: 2 }),       // riller i pumpa
    ...sidePlates('pump', 10.5, 10.9, -.4, 1.7, 1.97, 'metalDark', { minScale: 2 }),
    ...sidePlates('pump', 11.9, 12.3, -.4, 1.7, 1.97, 'metalDark', { minScale: 3 }),
    ...sidePlates('breach', 18.9, 19.3, 3.0, 4.2, 1.25, 'metalDark', { minScale: 2 }),      // slisser i munningen
    ...sidePlates('breach', 19.7, 20.1, 3.0, 4.2, 1.25, 'metalDark', { minScale: 3 }),
    ...sidePlates('recv', 5.2, 6.0, 2.6, 3.2, 1.6, 'led', { minScale: 1 }),               // LED kammerindikator (side mot kamera)
    topPlate('recvTop', 5.0, 6.2, -.5, .5, 4.12, 'led', { minScale: 1 }),                // samme LED ovenfra – fra 1× (runde 2: synlig også mot kamera)
    frontPlate('breachLip', 21.02, -.8, .8, 2.9, 4.3, 'polymer', { minScale: 1 }),        // stor, mørk munningsåpning
  ],
  moving: {
    pump: { axis: { x: -1, y: 0, z: 0 }, travel: 2.6 },
  },
});
export default SHOTGUN_LOOK;
