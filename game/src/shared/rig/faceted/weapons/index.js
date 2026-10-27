// Våpen-utseende for stilen «faceted». Grensesnittet eies av Breach Warden-design; våpen-defene eies av Breach Våpen
// (game/src/weapons/look/<id>.js: rifle, shotgun, marksman → registerWeaponLook(def)). Format og eksempel: ../README.md «Våpen».
//
// VÅPEN-DEF (ren data; byggeklossene er de samme som figurdelene i mesh.js)
// {
//   id: 'rifle', name: 'AR-9', version: 1,         // id = våpen-id i weapons/data.js; version inngår i cache-nøkkelen
//   palette: { metal, metalDark, polymer, wrap, wear, led },   // farger (hex). wear = farge på avskallede kanter, led = cyan plate
//   skins?: { navn: { ...delvis palett } },          // skin byttes uten å endre geometrien
//   wear?: 0..1,                                     // standard slitasjegrad (kan overstyres per aktør)
//   // Våpenrom (tegnede verdens-px): x langs løpet (fram), y mot høyre, z opp.
//   points: { grip:{x,y,z} (handR), fore?:{x,y,z,on?:'pump'} (handL), stock:{x,y,z} (skulder), muzzle:{x,y,z} },
//   parts: [
//     { id, box: [x0,x1,y0,y1,z0,z1], mat, c?, taper?:[sx,sy], bevel?, topShift?, minScale?, move? },
//     { id, beam: [{x,y,z},{x,y,z}], w, h, mat, c?, taper?, minScale?, move? },
//     { plate: [{x,y,z}, …], on: 'partId', mat, n?: {x,y,z}, minScale? },          // flat plate/merke på en del
//   ],
//   moving?: { pump?: { axis:{x,y,z}, travel }, bolt?: {…}, mag?: { axis, travel, fade? } },
// }
// mat ∈ palettnøklene (metal | metalDark | polymer | wrap | accent | led; accent = kald blå hvis paletten mangler den); minScale = laveste skjermskala (px per verdens-px) der delen
// tegnes (1× skal bare vise silhuetten: lengde, magasin, kikkert, pumpe). move = navnet på en bevegelig del.
import { box, beam, decal, frame } from '../mesh.js';

const LOOKS = new Map();
export function registerWeaponLook(def) { if (!def || !def.id) throw new Error('weapon look needs id'); LOOKS.set(def.id, def); return def; }
export function weaponLook(id) { return LOOKS.get(id) || LOOKS.get('rifle'); }
export function weaponLooks() { return [...LOOKS.keys()]; }
export const MOVING = ['pump', 'bolt', 'mag'];
/** Nøkkel for geometri + skin + slitasje (aldri animasjonsfase). */
export const lookKey = (def, skin = 'default', wear) => `${def.id}.${def.version || 1}.${skin}.${Math.round((wear ?? def.wear ?? .5) * 4)}`;
const P3 = (p) => Array.isArray(p) ? p : [p.x || 0, p.y || 0, p.z || 0];

// ---------------------------------------------------------------- palett → materialer
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (v) => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const shadeC = (c, k) => toHex(hex(c).map(v => k < 0 ? v * (1 + k) : v + (255 - v) * k));
const KIND = { metal: { stroke: .5, wear: 1, edge: .7, spec: .5, contrast: 1.2 }, metalDark: { stroke: .5, wear: .7, edge: .7, spec: .35, contrast: 1.2 }, polymer: { stroke: .7, wear: .35, edge: .6 }, wrap: { stroke: 1, wear: .1, edge: .5, jit: .14 },
  accent: { stroke: .3, wear: .25, edge: .4 } };
const MCACHE = new Map();
/** Materialtabell for et våpen (prefiks `${id}:`), ut fra palett + skin + slitasje. */
export function weaponMats(def, skin = 'default', wear) {
  const key = lookKey(def, skin, wear); let m = MCACHE.get(key); if (m) return m;
  const pal = { ...def.palette, ...(def.skins?.[skin] || {}) }, w = wear ?? def.wear ?? .5;
  m = {};
  if (!pal.accent) pal.accent = '#3c86c8';   // 'accent': kald blå som standard (AR-9-stripe); def/skin overstyrer (f.eks. messing på S-12)
  for (const k of ['metal', 'metalDark', 'polymer', 'wrap', 'accent']) { const c = pal[k]; if (!c) continue; const K = KIND[k];
    m[`${def.id}:${k}`] = { ramp: [shadeC(c, -.5), c, shadeC(c, .28)], top: shadeC(c, .4), stroke: K.stroke, wear: K.wear * w * 1.6, edge: K.edge, jit: K.jit, spec: K.spec, contrast: K.contrast }; }
  const led = hex(pal.led || '#39c6ff').join(',');
  m[`${def.id}:led`] = { glow: led, glowBody: hex(shadeC(pal.led || '#39c6ff', .35)).join(',') };
  m.__wearCol = pal.wear || '#c3c9ce';
  MCACHE.set(key, m); return m;
}

/**
 * Bygg våpenet inn i modell M i ramme WT (våpenrommet; WT(grip) = høyre hånd).
 * o: { D (skjermskala ved baking → minScale), only: undefined = alle faste deler | 'pump'|'bolt'|'mag' = bare den bevegelige delen }
 * → { parts, hands:{R,L}, stock, muzzle } (verdenspunkt i modellrommet)
 */
export function buildWeapon(M, WT, def, o = {}) {
  const mat = (m) => `${def.id}:${m}`, ids = new Map(), parts = [], D = o.D ?? 4;
  for (const [i, p] of (def.parts || []).entries()) {
    if ((p.minScale || 0) > D + 1e-6) continue;
    const host = p.plate ? (ids.get(p.on) || null) : null;
    const grp = p.plate ? (host?.move || null) : (p.move || null);
    if (!o.all && (o.only || null) !== grp) continue;
    const id = `${def.id}.${p.id || i}`;
    let P = null;
    if (p.box) { const [x0, x1, y0, y1, z0, z1] = p.box; P = box(M, WT, x0, x1, y0, y1, z0, z1, mat(p.mat), { id, c: p.c ?? .4, taper: p.taper, bevel: p.bevel, topShift: p.topShift, bias: o.bias ?? .5 }); }
    else if (p.beam) { const [a, b] = p.beam; P = beam(M, WT(...P3(a)), WT(...P3(b)), p.w, p.h, WT.dir(0, 0, 1), mat(p.mat), { id, c: p.c ?? .2, taper: p.taper, bias: o.bias ?? .5 }); }
    else if (p.plate) { if (host) decal(host, p.plate.map(q => WT(...P3(q))), mat(p.mat), p.n ? WT.dir(...P3(p.n)) : null); continue; }
    if (P) { P.own = 1; P.gun = 1; P.move = grp; parts.push(P); if (p.id) ids.set(p.id, P); }
  }
  const pt = def.points;
  return { parts, hands: { R: WT(...P3(pt.grip || { x: 0, y: 0, z: 0 })), L: pt.fore ? WT(...P3(pt.fore)) : null }, stock: pt.stock ? WT(...P3(pt.stock)) : null, muzzle: WT(...P3(pt.muzzle)) };
}

// ---------------------------------------------------------------- animasjon av bevegelige deler (pumpe, bolt, magasin)
// Riggen får en liten tilstand rig.__wpn = { look, chamberT, reload:{phase,t} }. Tid = riggens egen klokke (rig.S.t), så
// hitstop/pause følger riggen. Forskyvningen er 0..1 × moving[navn].travel langs aksen; sprites bakes ALDRI per fase.
const CHAMBER = .34;           // s: pumpe/bolt tilbake og fram
/** Koble en rigg til våpenhendelsene. Returnerer avmeldingsfunksjon. entity = aktøren som eier riggen. */
export function attachWeaponEvents(world, rig, entity) {
  const st = rig.__wpn || (rig.__wpn = { look: null, chamberT: -9, reload: null });
  const now = () => rig.S?.t ?? performance.now() / 1000;
  const off1 = world.events.on('chamber', (e) => { if (e.entity !== entity) return; st.look = e.weapon || st.look; st.chamberT = now(); });
  const off2 = world.events.on('reload', (e) => { if (e.entity !== entity) return; st.look = e.weapon || st.look;
    st.reload = e.phase === 'end' ? { phase: 'end', t: now() } : { phase: e.phase, t: now(), dur: e.time || 1.4 }; });
  return () => { typeof off1 === 'function' && off1(); typeof off2 === 'function' && off2(); };
}
/** Forskyvning (0..1) og alfa per bevegelig del akkurat nå. */
export function weaponAnim(rig, def) {
  const st = rig.__wpn, out = { pump: 0, bolt: 0, mag: 0, magA: 1 }; if (!st) return out;
  const t = rig.S?.t ?? performance.now() / 1000;
  const c = (t - st.chamberT) / CHAMBER; if (c >= 0 && c < 1) { const k = Math.sin(c * Math.PI); out.pump = k; out.bolt = k; }
  const r = st.reload;
  if (r) { const u = t - r.t;
    if (r.phase === 'start') { const k = Math.min(1, u / .22); out.mag = k; out.magA = def?.moving?.mag?.fade === false ? 1 : 1 - k; }
    else if (r.phase === 'active') { const k = Math.max(0, 1 - u / .2); out.mag = k; out.magA = 1 - k * .6; }
    else if (r.phase === 'end') { const k = Math.min(1, u / .18); out.bolt = Math.max(out.bolt, Math.sin(k * Math.PI)); if (k >= 1) st.reload = null; } }
  return out;
}
export { frame };
