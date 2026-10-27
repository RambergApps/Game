// BREACH – AR-9 Vanguard (`rifle`), faceted-utseende. Eies av Breach Våpen. 2026-10-23, v3 (runde 2: mørk brems med lys kant, tydeligere magasinhakk i 1×).
// Format: shared/rig/faceted/weapons/index.js (Warden-design). Mål i designarkets enheter (30 px), skaleres ×1,2 → 36 px.
// Lesbarhet i 1× (minScale ≤ 1): kolbe, låskasse, LYS håndvern, siktblokk, magasin som hakk under linja, kraftig munning.
// Fra 2×: skinne, ladehåndtak, teip, blå stripe, kornsikte, grep, LED. Fra 3×: munningsslisser og linse. v3: brems mørk m/ lys kant, magasin metalDark + lys bunnplate.
import { B, sidePlates, topPlate, frontPlate, defineLook } from './util.js';

export const RIFLE_LOOK = defineLook({
  id: 'rifle', name: 'AR-9 Vanguard', version: 3,
  palette: { metal: '#59626c', metalDark: '#3a4148', polymer: '#1f2327', wrap: '#5c5a48', wear: '#c3c9ce', led: '#39c6ff', accent: '#3c86c8' },
  skins: { desert: { polymer: '#6e6249', wrap: '#8a7a5c' }, blackout: { metal: '#3a3f45', polymer: '#16181b' } },
  wear: .5,
  points: {
    grip:   { x: 0, y: 0, z: 0 },              // høyre hånd (origo)
    fore:   { x: 11.3, y: -.5, z: 1.9 },       // venstre hånd under håndvernet
    stock:  { x: -9.6, y: 0, z: 3.3 },         // skulder
    muzzle: { x: 20.6, y: 0, z: 3.7 },         // løpsaksen ved bremsens front
    led:    { x: 6.6, y: 1.24, z: 4.7 },       // ammoindikator
  },
  parts: [
    // kolbe: kam + bakplate + skrå stag (skjelettkolbe, gir et tydelig hull mellom kam og stag)
    B('stockComb', -9.6, -2.7, 3.3, 5.0, 2.2, 'polymer', { c: .5, taper: [1, .85] }),
    B('buttPad', -9.6, -7.6, -1.1, 3.4, 2.4, 'polymer', { c: .45, topShift: .25 }),
    { id: 'stockStrut', beam: [{ x: -7.8, y: 0, z: .1 }, { x: -3.6, y: 0, z: 3.5 }], w: 1.8, h: 1.2, mat: 'polymer', c: .3 },
    B('buffer', -3.3, -.7, 3.3, 4.6, 1.5, 'metalDark', { c: .3 }),
    // låskasse (øvre/nedre) – nedre har skrå framkant ned mot magasinet
    B('upper', -1.0, 7.5, 3.3, 5.7, 2.4, 'metalDark', { c: .45 }),
    B('lower', -.8, 7.6, .7, 3.3, 2.2, 'metalDark', { c: .4, taper: [1, 1] }),
    B('grip', -2.4, .25, -3.2, .65, 2.0, 'polymer', { c: .35, topShift: 1.3, taper: [.8, 1], minScale: 1 }),
    // magasin: rett, litt framoverlent, med bunnplate → «hakket» under linja
    // v3: metalDark (ikke polymer, som forsvant mot asfalten), dypere og med LYS bunnplate fra 1× → hakket leses
    B('mag', 5.2, 8.3, -6.6, .8, 2.4, 'metalDark', { c: .35, topShift: -1.5, move: 'mag' }),
    B('magBase', 4.8, 8.7, -7.3, -6.5, 2.8, 'metal', { c: .2, topShift: -.25, move: 'mag', minScale: 1 }),
    // ladehåndtak (bolt) på høyre side
    B('bolt', .3, 2.2, 3.9, 4.8, .7, 'metal', { c: .15, move: 'bolt', minScale: 2 }, 1.45),
    // håndvern: LYSERE enn kroppen, så rifla får lys front / mørk bakdel
    B('guard', 7.3, 16.0, 1.9, 5.5, 2.6, 'metal', { c: .55 }),
    B('tape', 12.8, 14.8, 1.75, 5.65, 2.95, 'wrap', { c: .5, minScale: 2 }),
    B('rail', -1.8, 15.7, 5.5, 6.0, 1.4, 'metal', { c: .15, minScale: 2 }),
    // siktblokk (rødpunkt): høy, kantet kloss – bryter overkanten
    B('optic', 2.6, 7.2, 5.8, 8.3, 2.0, 'metalDark', { c: .45, taper: [.86, .85], topShift: .35 }),
    B('fsight', 15.9, 16.8, 5.0, 6.7, .8, 'metalDark', { c: .12, minScale: 2 }),
    // løp + munningsbrems: bremsen er tykkere enn løpet og lys stål på toppen → tydelig spiss
    { id: 'barrel', beam: [{ x: 15.8, y: 0, z: 3.65 }, { x: 17.4, y: 0, z: 3.65 }], w: 1.0, h: 1.0, mat: 'metalDark' },
    // v3: bremsen er MØRK med en lys frontkant (ikke en lys kloss i 1×)
    B('brake', 16.9, 20.1, 2.95, 4.45, 1.6, 'polymer', { c: .2, taper: [1, .3] }),   // smal topp: faceted lyser toppflater +40 % mot hvitt
    B('brakeLip', 20.1, 20.6, 2.8, 4.6, 1.8, 'metal', { c: .2, minScale: 1 }),
    // merker
    ...sidePlates('guard', 7.8, 15.4, 3.1, 3.6, 1.3, 'accent', { minScale: 2 }),          // blå stripe (AR-9-kjennetegn)
    ...sidePlates('upper', 1.0, 6.2, 4.1, 4.5, 1.2, 'metal', { minScale: 3 }),            // utkastport-kant
    ...sidePlates('upper', 5.9, 7.3, 4.3, 5.1, 1.2, 'led', { minScale: 1 }),             // LED ammoindikator, fremst på låskassa (side mot kamera)
    topPlate('optic', 3.6, 4.7, -.5, .5, 8.32, 'led', { minScale: 1 }),                  // LED på siktets topp – fra 1× (runde 2: synlig også når løpet peker mot kamera)
    ...sidePlates('brake', 17.5, 18.1, 3.2, 4.2, .8, 'polymer', { minScale: 3 }),        // brems-slisser
    ...sidePlates('brake', 18.7, 19.3, 3.2, 4.2, .8, 'polymer', { minScale: 3 }),
    frontPlate('optic', 7.2, -.6, .6, 6.4, 7.9, 'polymer', { minScale: 3 }),              // linse
    frontPlate('brakeLip', 20.62, -.35, .35, 3.35, 4.05, 'polymer', { minScale: 2 }),    // løpsåpning
  ],
  moving: {
    bolt: { axis: { x: -1, y: 0, z: 0 }, travel: 2.0 },
    mag:  { axis: { x: .25, y: 0, z: -1 }, travel: 6, fade: true },
  },
});
export default RIFLE_LOOK;
