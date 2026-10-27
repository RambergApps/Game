// Breach – lyd: våpenmekanikk (lading, aktiv lading, tomt klikk, våpenbytte, granatsprett).
// Tunge, mekaniske lag. o.weapon = 'rifle' | 'shotgun' | 'marksman' (låste id-er) gir variant per våpen.
// Tider hentet fra src/weapons/data.js: equipTime rifle 0,35 / shotgun 0,4 / marksman 0,5 s.
import { rand, chance, noiseLayer as N, toneLayer as T, metalLayer as M, clickLayer as C } from './synth.js';
import { playBuf, crackleBuf, clickBuf, cluster } from './cinder.js';

/** Våpenprofil: p = tonehøyde-faktor for mekanikk, mass = tyngde (kropp), equip = s til låst etter bytte. */
export const WEAPON_PROFILE = {
  rifle:    { p: 1.0,  mass: 1.0,  equip: 0.35 },
  shotgun:  { p: 0.82, mass: 1.25, equip: 0.4 },
  marksman: { p: 1.12, mass: 0.95, equip: 0.5 },
  minigun:  { p: 0.7,  mass: 1.5,  equip: 0.6 }, // Kiln (fiende) – rev. 4: magasin 60, reloadTime 3,0 s
};
const prof = (o) => WEAPON_PROFILE[o?.weapon] || WEAPON_PROFILE.rifle;

// Tungt magasin/lås som smeller på plass.
function seat(ac, out, t, w, k = 1) {
  C(ac, out, t, { f: 2500 * w.p, peak: 0.3 * k, body: 1.1 });
  T(ac, out, t, { f: 170 * w.p, f2: 80 * w.p, drop: 0.03, d: 0.09, peak: 0.42 * k * w.mass, drive: 1.6 });
  M(ac, out, t, { f: rand(720, 860) * w.p, ratios: [1, 2.4, 3.9], d: 0.12, peak: 0.08 * k });
}

// ---- lading ----
function reloadStart(ac, out, send, t, o = {}) {
  if (o.weapon === 'minigun') return minigunStart(ac, out, send, t, o);
  // magasin ut: utløser-klikk → magasinet glir ut → (gevær/presisjon) treffer bakken
  const w = prof(o);
  C(ac, out, t, { f: 3600 * w.p, peak: 0.2, body: 0.6 });
  N(ac, out, t + 0.04, { type: 'bandpass', f: 1300 * w.p, f2: 850 * w.p, q: 1.5, a: 0.015, d: 0.12, peak: 0.17 });
  if (o.weapon === 'shotgun') {
    // hagle: åpner lasteluke + hylser som rasler i hånda
    T(ac, out, t + 0.1, { f: 150, f2: 90, drop: 0.03, d: 0.07, peak: 0.25, drive: 1.3 });
    for (let i = 0; i < 3; i++) M(ac, out, t + 0.22 + i * rand(0.05, 0.08), { f: rand(1600, 2100), ratios: [1, 2.1, 3.3], d: 0.06, peak: 0.04 });
    return 0.6;
  }
  const g = t + rand(0.32, 0.4); // tomt magasin i betonggulvet
  T(ac, out, g, { f: 120, f2: 70, drop: 0.04, d: 0.08, peak: 0.22 });
  M(ac, out, g, { f: rand(500, 650), ratios: [1, 2.3, 3.6], d: 0.1, peak: 0.06 });
  return 0.7;
}

function reloadDone(ac, out, send, t, o = {}) {
  if (o.weapon === 'minigun') return minigunEnd(ac, out, send, t, o);
  // magasin inn + ladegrep (per våpen)
  const w = prof(o);
  N(ac, out, t, { type: 'bandpass', f: 1100 * w.p, f2: 1600 * w.p, q: 1.5, a: 0.03, d: 0.05, peak: 0.13 });
  seat(ac, out, t + 0.05, w);
  const b = t + 0.05 + rand(0.2, 0.26);
  if (o.weapon === 'shotgun') { // pumpe fram
    N(ac, out, b - 0.03, { type: 'bandpass', f: 1000, f2: 1600, q: 1.6, a: 0.02, d: 0.06, peak: 0.13 });
    C(ac, out, b + 0.1, { f: 2200, peak: 0.24, body: 1 }); T(ac, out, b + 0.1, { f: 150, f2: 80, drop: 0.03, d: 0.08, peak: 0.32, drive: 1.5 });
    return 0.65;
  }
  if (o.weapon === 'marksman') { // kort bolt
    C(ac, out, b, { f: 3200, peak: 0.16, body: 0.5 });
    C(ac, out, b + 0.16, { f: 2300, peak: 0.24, body: 1 }); T(ac, out, b + 0.16, { f: 170, f2: 90, drop: 0.03, d: 0.08, peak: 0.28, drive: 1.5 });
    return 0.65;
  }
  C(ac, out, b, { f: 4200, peak: 0.18, body: 0.4 });                                   // ladehåndtak bak
  C(ac, out, b + 0.09, { f: 3000, peak: 0.28, body: 0.9 });                            // … smeller fram
  M(ac, out, b + 0.09, { f: rand(1000, 1200), ratios: [1, 2.7, 4.4], d: 0.12, peak: 0.07 });
  return 0.6;
}

// ---- tung lading: minigun (Kiln). Fiendelyd → alt går gjennom et lavpass («fjernere») og får mer romklang. ----
// v1.4.1: lavpasset flyttet 2,6 → 5,5 kHz (avstand bæres nå av romsending + lavere nivå) så 2–5 kHz-metallet slipper gjennom
function far(ac, out, send, f = 5500) {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.6; lp.connect(out);
  const s = ac.createGain(); s.gain.value = 0.35; lp.connect(s); s.connect(send);
  return lp;
}
function minigunStart(ac, out, send, t) {
  // beltekassen løsnes: tung lås slås opp → beltet rasler ut av mateluka → kassa slippes i bakken
  const o = far(ac, out, send);
  C(ac, o, t, { f: 1900, peak: 0.3, body: 1.2 });
  T(ac, o, t, { f: 120, f2: 65, drop: 0.04, d: 0.12, peak: 0.42, drive: 1.6 });
  M(ac, o, t + 0.005, { f: rand(380, 440), ratios: [1, 2.3, 3.7], d: 0.25, peak: 0.08 });
  M(ac, o, t + 0.004, { f: rand(2300, 2600), ratios: [1, 1.48, 1.93], d: 0.14, peak: 0.13, decayTilt: 0.7 }); // låsen: stål 2–5 kHz
  for (let i = 0; i < 9; i++) M(ac, o, t + 0.12 + i * rand(0.028, 0.04), { f: rand(2200, 3200), ratios: [1, 1.6, 2.3], d: 0.06, peak: 0.09 * (1 - i / 12) }); // beltelenker (lysere)
  N(ac, o, t + 0.12, { type: 'bandpass', f: 1500, f2: 900, q: 1.3, a: 0.02, d: 0.3, peak: 0.09 });
  const g = t + rand(0.62, 0.7); // full kasse i betongen
  T(ac, o, g, { f: 85, f2: 45, drop: 0.06, d: 0.2, peak: 0.5, drive: 1.8 });
  N(ac, o, g, { type: 'lowpass', f: 700, d: 0.12, peak: 0.3 });
  M(ac, o, g + 0.003, { f: rand(260, 320), ratios: [1, 2.1, 3.4], d: 0.3, peak: 0.09 });
  M(ac, o, g + 0.004, { f: rand(1900, 2300), ratios: [1, 1.7, 2.45], d: 0.18, peak: 0.06, decayTilt: 0.65 }); // kassehjørnet ringer
  return 1.1;
}
function minigunEnd(ac, out, send, t) {
  // ny kasse inn (tungt smell) → belte mates (raske klikk) → løpene spinner kort opp og ned
  const o = far(ac, out, send);
  N(ac, o, t, { type: 'bandpass', f: 800, f2: 1300, q: 1.2, a: 0.05, d: 0.06, peak: 0.1 });
  const s = t + 0.1;
  T(ac, o, s, { f: 95, f2: 42, drop: 0.05, d: 0.22, peak: 0.55, drive: 2 });
  C(ac, o, s, { f: 1700, peak: 0.3, body: 1.3 });
  M(ac, o, s + 0.003, { f: rand(300, 360), ratios: [1, 2.4, 3.9], d: 0.35, peak: 0.1 });
  M(ac, o, s + 0.004, { f: rand(2400, 2800), ratios: [1, 1.52, 1.87], d: 0.22, peak: 0.13, decayTilt: 0.7 }); // stål mot stål
  for (let i = 0; i < 6; i++) { C(ac, o, s + 0.18 + i * 0.045, { f: rand(2800, 3600), peak: 0.13, body: 0.6, d: 0.012 }); M(ac, o, s + 0.18 + i * 0.045, { f: rand(3200, 4400), ratios: [1, 1.5], d: 0.04, peak: 0.06 }); }
  C(ac, o, s + 0.48, { f: 2400, peak: 0.24, body: 1.2 }); // dekselet lukkes
  M(ac, o, s + 0.482, { f: rand(2100, 2500), ratios: [1, 1.63, 2.2], d: 0.16, peak: 0.07, decayTilt: 0.7 });
  // løpsspinn: motor + luftvirvel, ca. 0,8 s
  const w = s + 0.6, osc = ac.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(40, w); osc.frequency.exponentialRampToValueAtTime(190, w + 0.35); osc.frequency.exponentialRampToValueAtTime(55, w + 0.85);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, w); g.gain.exponentialRampToValueAtTime(0.09, w + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, w + 0.9);
  osc.connect(lp); lp.connect(g); g.connect(o); osc.start(w); osc.stop(w + 0.95);
  N(ac, o, w, { type: 'bandpass', f: 600, f2: 2200, q: 2, a: 0.3, d: 0.5, peak: 0.08, sweep: 0.35 });
  N(ac, o, w + 0.1, { type: 'bandpass', f: 2600, f2: 4200, q: 6, a: 0.22, d: 0.45, peak: 0.06, sweep: 0.3 }); // lagre/løp som synger
  return 1.6;
}

// ---- aktiv lading (phase:'active'). Magasin inn + ladegrep kommer fra phase:'end' rett etter – ikke her. ----
function activePerfect(ac, out, send, t, o = {}) {
  if (o.weapon === 'minigun') out = far(ac, out, send);
  // Gears-stil: tilfredsstillende metallisk CLACK + kort, lys bekreftelsestone
  const w = prof(o);
  N(ac, out, t, { type: 'highpass', f: 2500, q: 0.7, d: 0.02, peak: 0.45 });
  C(ac, out, t, { f: 2800 * w.p, peak: 0.36, body: 1.2 });
  T(ac, out, t, { f: 110 * w.p, f2: 55, drop: 0.06, d: 0.18, peak: 0.45 * w.mass, drive: 2 });
  M(ac, out, t + 0.002, { f: rand(1250, 1350) * w.p, ratios: [1, 2.32, 3.81, 5.1], d: 0.35, peak: 0.14, decayTilt: 0.7 }); // klar metallring
  // bekreftelse: to rene toner (kvint), lyse, korte – ikke arkade-pip: myk attack, glir ut
  const b = t + 0.05;
  [[1760, 0.09], [2637, 0.06]].forEach(([f, pk]) => { T(ac, out, b, { f, d: 0.28, peak: pk, a: 0.004 }); T(ac, send, b, { f, d: 0.35, peak: pk * 0.6, a: 0.004 }); });
  T(ac, out, b + 0.07, { f: 3520, d: 0.18, peak: 0.03, a: 0.004 });
  return 0.6;
}

function activeGood(ac, out, send, t, o = {}) {
  if (o.weapon === 'minigun') out = far(ac, out, send);
  // ren klikk + set
  const w = prof(o);
  C(ac, out, t, { f: 3400 * w.p, peak: 0.28, body: 0.7, d: 0.014 });
  T(ac, out, t, { f: 210 * w.p, f2: 120, drop: 0.02, d: 0.05, peak: 0.2 });
  return 0.25;
}

function activeFail(ac, out, send, t, o = {}) {
  if (o.weapon === 'minigun') out = far(ac, out, send);
  // jam: skurrende metall mot metall (ru AM-støy + lav sagtann) og en dump, død klakk
  const w = prof(o);
  const am = ac.createGain(); am.gain.value = 0.5; am.connect(out);
  const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rand(28, 38);
  const lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain); lfo.start(t); lfo.stop(t + 0.45);
  N(ac, am, t, { type: 'bandpass', f: 1400 * w.p, f2: 700, q: 2.2, a: 0.02, hold: 0.12, d: 0.2, peak: 0.42, drive: 3 });
  T(ac, am, t, { wave: 'sawtooth', f: 95 * w.p, f2: 70 * w.p, drop: 0.3, a: 0.02, hold: 0.1, d: 0.2, peak: 0.16, lp: 900, drive: 2 });
  // dump klakk: lavpasset, uten ring
  const k = t + 0.34;
  N(ac, out, k, { type: 'lowpass', f: 900, q: 0.7, d: 0.05, peak: 0.35 });
  T(ac, out, k, { f: 130 * w.p, f2: 70, drop: 0.04, d: 0.1, peak: 0.45 * w.mass, drive: 1.3 });
  return 0.6;
}

// ---- tomt klikk ----
function dryFire(ac, out, send, t, o = {}) {
  const w = prof(o);
  C(ac, out, t, { f: 2100 * w.p, peak: 0.24, body: 0.9, d: 0.016 });               // avtrekker/hane faller på tomt
  T(ac, out, t, { f: 260 * w.p, f2: 160, drop: 0.02, d: 0.04, peak: 0.12 });
  if (o.weapon === 'shotgun') C(ac, out, t + 0.035, { f: 1700, peak: 0.12, body: 0.6 }); // hane + sperre
  return 0.2;
}

// ---- våpenbytte ----
function weaponSwitch(ac, out, send, t, o = {}) {
  // rustning knirker/rasler → våpenet slenges rundt → låses i hendene ved equipTime
  const w = prof(o), lock = t + (o.equip ?? w.equip);
  for (let i = 0; i < 4; i++) N(ac, out, t + i * rand(0.03, 0.06), { color: 'pink', type: 'bandpass', f: rand(700, 1600), q: 1.4, a: 0.01, d: rand(0.04, 0.08), peak: rand(0.08, 0.14) });
  M(ac, out, t + 0.02, { f: rand(380, 460), ratios: [1, 2.1, 3.4], d: 0.12, peak: 0.05 });     // rustningsplate
  N(ac, out, t + 0.06, { type: 'bandpass', f: 450, f2: 1500, q: 1.1, a: 0.08, d: 0.14, peak: 0.16, sweep: 0.2 }); // sving
  T(ac, out, lock - 0.03, { f: 90, f2: 55, drop: 0.04, d: 0.12, peak: 0.25 * w.mass });                // tyngde i hendene
  C(ac, out, lock, { f: 2600 * w.p, peak: 0.26, body: 1 });                                            // lås
  M(ac, out, lock, { f: rand(800, 950) * w.p, ratios: [1, 2.5, 4.1], d: 0.1, peak: 0.06 });
  if (o.weapon === 'shotgun') C(ac, out, lock + 0.07, { f: 2000, peak: 0.14, body: 0.8 });
  if (o.weapon === 'marksman') M(ac, out, lock + 0.05, { f: rand(2600, 3000), ratios: [1, 2.3], d: 0.06, peak: 0.03 }); // reim-spenne
  return (lock - t) + 0.3;
}

// ---- granat ----
function grenadeBounce(ac, out, send, t, o = {}) {
  // tungt metall mot underlaget; o.surface 'metal' | 'concrete', o.k = styrke 0..1 (fra fart)
  const k = Math.max(0.3, Math.min(1, o.k ?? 0.7)), metal = o.surface === 'metal';
  T(ac, out, t, { f: rand(150, 180), f2: 80, drop: 0.03, d: 0.07, peak: 0.35 * k });
  N(ac, out, t, { type: metal ? 'bandpass' : 'lowpass', f: metal ? 3000 : 1800, q: 0.8, d: 0.03, peak: 0.3 * k });
  M(ac, out, t, { f: rand(1050, 1350), ratios: [1, 2.32, 3.81, 5.1], d: metal ? 0.3 : 0.14, peak: (metal ? 0.18 : 0.1) * k });
  if (metal) M(ac, out, t, { f: rand(420, 520), ratios: [1, 2.76, 5.4], d: 0.35, peak: 0.08 * k, decayTilt: 0.75 }); // plate synger
  else N(ac, out, t + 0.003, { color: 'brown', type: 'bandpass', f: 600, q: 1, d: 0.05, peak: 0.12 * k });    // grus
  return metal ? 0.45 : 0.25;
}


// ---- ammokasse ----
function refill(ac, out, send, t, o = {}) {
  // kort, tungt påfyll: lokk/lås slår opp → magasiner raskes ut av kassa → magasin klakker i vesten → lås
  N(ac, out, t, { type: 'lowpass', f: 1600, q: 0.7, d: 0.05, peak: 0.3 });
  T(ac, out, t, { f: 130, f2: 70, drop: 0.04, d: 0.12, peak: 0.45, drive: 1.6 });                    // kasselokk
  M(ac, out, t, { f: rand(330, 400), ratios: [1, 2.76, 5.4], d: 0.25, peak: 0.07 });
  for (let i = 0; i < 3; i++) {                                                                      // magasiner mot hverandre
    const tt = t + 0.1 + i * rand(0.06, 0.09);
    C(ac, out, tt, { f: rand(2200, 3000), peak: 0.16, body: 0.8 });
    M(ac, out, tt, { f: rand(1300, 1700), ratios: [1, 2.3, 3.7], d: 0.07, peak: 0.05 });
  }
  N(ac, out, t + 0.12, { type: 'bandpass', f: 900, q: 1.2, a: 0.03, d: 0.15, peak: 0.1 });            // stoff/vest
  const l = t + 0.4;
  C(ac, out, l, { f: 2400, peak: 0.28, body: 1.1 });                                                 // metallklakk
  T(ac, out, l, { f: 160, f2: 80, drop: 0.03, d: 0.09, peak: 0.38, drive: 1.5 });
  M(ac, out, l, { f: rand(850, 950), ratios: [1, 2.5, 4.1], d: 0.12, peak: 0.07 });
  return 0.7;
}
function crateReady(ac, out, send, t, o = {}) {
  // diskret «klar»-pip: to myke sinustoner (kvart opp), lavt nivå, litt romklang
  [[1318.5, 0], [1760, 0.09]].forEach(([f, dt]) => {
    T(ac, out, t + dt, { f, a: 0.006, d: 0.16, peak: 0.08 });
    T(ac, send, t + dt, { f, a: 0.006, d: 0.25, peak: 0.05 });
  });
  N(ac, out, t, { type: 'bandpass', f: 3000, q: 3, d: 0.06, peak: 0.02 });                            // svakt elektrisk «tikk»
  return 0.45;
}

// ---- nærkamp (kolbeslag) ----
function meleeStart(ac, out, send, t, o = {}) {
  // tungt sving: lav luftstrøm som feier opp + rustningsrasling
  N(ac, out, t + 0.03, { type: 'bandpass', f: 300, f2: 1300, q: 1.2, a: 0.08, d: 0.12, peak: 0.32, sweep: 0.17 });
  N(ac, out, t + 0.05, { color: 'pink', type: 'lowpass', f: 500, q: 0.7, a: 0.06, d: 0.12, peak: 0.22 });
  for (let i = 0; i < 3; i++) N(ac, out, t + i * rand(0.025, 0.05), { color: 'pink', type: 'bandpass', f: rand(900, 1800), q: 1.5, a: 0.008, d: rand(0.04, 0.07), peak: rand(0.07, 0.12) });
  M(ac, out, t + 0.01, { f: rand(360, 440), ratios: [1, 2.1, 3.4], d: 0.1, peak: 0.05 });
  return 0.35;
}
function meleeHit(ac, out, send, t, o = {}) {
  // Nærkamptreff. v1.4.1 (Effekter): anslaget ligger på t (ingen forsinkede lag før 10 ms) – index.js spiller med
  // immediate, så lyden starter ~6–8 ms etter hendelsen (kompressorens forsinkelse). Tekstur etter o.surface:
  // 'chitin' (standard, Cinderborn) · 'metal' · 'concrete'/'stone' · 'flesh'/'body'. o.killed: skallsprekk + glørhale ~0,7 s.
  const sf = o.surface || 'chitin';
  C(ac, out, t, { f: sf === 'metal' ? 3400 : sf === 'flesh' || sf === 'body' ? 1800 : 2800, peak: 0.45, body: 0.9, d: 0.012 }); // anslag: bredbåndet klikk nøyaktig på t
  // v1.5 heldWeapon: kolben avgjør dunket – hagle = tung trekolbe (lavere, lengre), presisjonsrifle = lang stålkolbe
  // (lysere, litt klang), angrepsgevær/ukjent = polymerkolbe (standard).
  const H = /shot/.test(o.held || '') ? { f: 100, f2: 38, d: 0.26, pk: 0.95 } : /marks/.test(o.held || '') ? { f: 135, f2: 52, d: 0.18, pk: 0.8, ring: true } : { f: 120, f2: 45, d: 0.2, pk: 0.85 };
  T(ac, out, t, { f: H.f, f2: H.f2, drop: 0.08, d: H.d, peak: H.pk, drive: 2.5 });                       // dunk
  if (H.ring) M(ac, out, t, { f: rand(820, 900), ratios: [1, 2.7, 4.4], d: 0.14, peak: 0.05 });
  N(ac, out, t, { type: 'lowpass', f: 2200, q: 0.8, a: 0.001, d: 0.06, peak: 0.55, drive: 3 });
  const g = ac.createGain(); g.gain.value = 0.5; g.connect(out);                                       // knas: AM-kornet støy
  const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rand(55, 75);
  const lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + 0.15);
  N(ac, g, t + 0.003, { type: 'bandpass', f: 1600, q: 1.2, d: 0.09, peak: 0.45, drive: 2 });
  if (sf === 'metal') {
    M(ac, out, t, { f: rand(520, 640), ratios: [1, 2.32, 3.81, 5.1], d: 0.35, peak: 0.2, decayTilt: 0.6 }); // rustningsplate som synger
    C(ac, out, t, { f: rand(2600, 3200), peak: 0.3, body: 0.8 });
  } else if (sf === 'concrete' || sf === 'stone') {
    playBuf(ac, out, t, crackleBuf(ac, 0.3, (u) => 260 * (1 - u) + 20, { len: [0.0006, 0.003], bright: 0.35 }), { peak: 0.35, type: 'bandpass', f: 1800, q: 0.6 }); // grus
  } else if (sf === 'flesh' || sf === 'body') {
    N(ac, out, t, { color: 'pink', type: 'lowpass', f: 700, a: 0.001, d: 0.09, peak: 0.4 });
  } else {
    // kitin: tørre skallklikk (2–3 innen 15 ms) + kort hult skall-«tokk» + splint-rasling som legger seg ~0,4 s
    playBuf(ac, out, t, clickBuf(ac, 0.04, [0, ...cluster(pick2(), 0.015, 0.002)], { f: [2200, 4600], dec: [0.0008, 0.003], amp: [0.6, 1] }), { peak: 0.55 });
    N(ac, out, t, { type: 'bandpass', f: rand(780, 950), q: 4, a: 0.001, d: 0.05, peak: 0.3 });               // hult skall
    playBuf(ac, out, t + 0.004, crackleBuf(ac, 0.13, (u) => 520 * (1 - u) + 60, { len: [0.0004, 0.002], bright: 0.7 }), { peak: 0.24, type: 'highpass', f: 1500 }); // splinter (tett, topp 20–90 ms)
    playBuf(ac, out, t + 0.1, crackleBuf(ac, 0.32, (u) => 70 * (1 - u) + 4, { len: [0.0004, 0.0018], bright: 0.7 }), { peak: 0.1, type: 'highpass', f: 2000 });       // støv/rasling ut mot 0,4 s
    M(ac, out, t, { f: rand(380, 460), ratios: [1, 2.3, 3.9], d: 0.12, peak: 0.06, decayTilt: 0.5 });
  }
  if (o.killed) {
    // drap: skallet sprekker (skarp, bred knekk + lav knas), så glør som sprakar og hveser ut over ~0,7 s
    N(ac, out, t, { type: 'bandpass', f: rand(2400, 3200), q: 1.2, a: 0.0005, d: 0.035, peak: 0.6, drive: 3 });
    playBuf(ac, out, t + 0.002, clickBuf(ac, 0.12, cluster(6, 0.09), { f: [1400, 3800], dec: [0.002, 0.006], amp: [0.5, 1] }), { peak: 0.5 });
    T(ac, out, t + 0.006, { f: 85, f2: 38, drop: 0.12, d: 0.3, peak: 0.45, drive: 2 });
    playBuf(ac, out, t + 0.03, crackleBuf(ac, 0.75, (u) => 90 * Math.pow(1 - u, 1.4) + 4, { len: [0.0005, 0.003], bright: 0.55 }), { peak: 0.3, type: 'bandpass', f: 3200, q: 0.5 }); // glør
    N(ac, out, t + 0.02, { color: 'pink', type: 'highpass', f: 2600, a: 0.04, hold: 0.15, d: 0.55, peak: 0.07 });                     // hvesing
    N(ac, send, t + 0.01, { color: 'brown', type: 'lowpass', f: 500, d: 0.6, peak: 0.25 });
  }
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 900, d: 0.2, peak: 0.25 });
  return o.killed ? 0.85 : sf === 'chitin' ? 0.5 : 0.45;
}
const pick2 = () => (Math.random() < 0.5 ? 1 : 2);
function meleeMiss(ac, out, send, t, o = {}) {
  // bom: lett sus som går ut i lufta
  N(ac, out, t, { type: 'bandpass', f: 1400, f2: 600, q: 1.4, a: 0.01, d: 0.14, peak: 0.16, sweep: 0.15 });
  return 0.25;
}
function meleeEnd(ac, out, send, t, o = {}) {
  // bare svak rasling når våpenet går tilbake
  for (let i = 0; i < 2; i++) N(ac, out, t + i * rand(0.04, 0.07), { color: 'pink', type: 'bandpass', f: rand(1000, 1700), q: 1.5, a: 0.01, d: 0.05, peak: 0.05 });
  return 0.2;
}

// ---- lading avbrutt (reload end result 'cancel') ----
function reloadCancel(ac, out, send, t, o = {}) {
  // magasinet slenges halvveis tilbake: kort glid → halvt, dødt anslag (ingen lås) → løse deler rasler
  const w = prof(o);
  N(ac, out, t, { type: 'bandpass', f: 2200 * w.p, f2: 1100 * w.p, q: 1.2, a: 0.008, d: 0.07, peak: 0.45 });
  T(ac, out, t + 0.055, { f: 230 * w.p, f2: 120, drop: 0.03, d: 0.06, peak: 0.42 * w.mass, drive: 1.6, lp: 2400 });
  N(ac, out, t + 0.055, { type: 'bandpass', f: 1800, q: 0.9, d: 0.035, peak: 0.5 });
  let tt = t + 0.085;
  for (let i = 0; i < 4; i++) {
    tt += rand(0.022, 0.042);
    C(ac, out, tt, { f: rand(2600, 3800), peak: 0.35 * (1 - i * 0.2), body: 0.5 });
    M(ac, out, tt, { f: rand(1700, 2400), ratios: [1, 2.2, 3.5], d: 0.05, peak: 0.12 * (1 - i * 0.2) });
  }
  return 0.35;
}

// ---- treff blokkert av usårbarhet (core: hit {amount:0, blocked:true}, f.eks. under rulling) ----
function bulletGraze(ac, out, send, t, o = {}) {
  // kula streifer/suser forbi: kort, lyst sus som faller i tonehøyde, av og til et tynt rikosjett-pling
  const f = rand(3000, 4200);
  N(ac, out, t, { type: 'bandpass', f, f2: f * 0.35, q: 2.2, a: 0.018, hold: 0.01, d: 0.1, peak: 0.32 });
  N(ac, out, t + 0.004, { color: 'white', type: 'highpass', f: 5000, q: 0.7, a: 0.004, d: 0.035, peak: 0.08 });
  if (chance(0.45)) {
    const p = rand(2400, 3400);
    T(ac, out, t + 0.02, { wave: 'sine', f: p, f2: p * 0.55, a: 0.003, d: rand(0.14, 0.2), peak: 0.07 });
    M(ac, out, t + 0.02, { f: p * 0.8, ratios: [1, 2.76], d: 0.06, peak: 0.03 });
  }
  return 0.3;
}

// ---- granat: windup (sikringssplint + grep) ----
function grenadePin(ac, out, send, t, o = {}) {
  // ringen dras: kort metallskrap → splinten slipper med et lyst pling → fjærklikk når grepet strammes
  N(ac, out, t, { type: 'bandpass', f: 3400, f2: 2600, q: 3, a: 0.006, d: 0.05, peak: 0.16 });
  M(ac, out, t + 0.045, { f: rand(3000, 3500), ratios: [1, 2.31, 3.9], d: 0.11, peak: 0.07 });
  C(ac, out, t + 0.045, { f: 5200, peak: 0.12, body: 0.2 });
  const k = t + rand(0.1, 0.13);
  C(ac, out, k, { f: 3000, peak: 0.22, body: 0.6 });
  T(ac, out, k, { wave: 'triangle', f: 1900, f2: 1500, d: 0.035, peak: 0.05 });
  return 0.25;
}

export const MECH_SOUNDS = {
  reloadStart:   { fn: reloadStart,   gain: 0.7,  max: 2, minGap: 0.2,  send: 0.08 },
  reloadDone:    { fn: reloadDone,    gain: 0.75, max: 2, minGap: 0.2,  send: 0.08 },
  activePerfect: { fn: activePerfect, gain: 0.8,  max: 1, minGap: 0.2,  send: 0.12 },
  activeGood:    { fn: activeGood,    gain: 0.75, max: 1, minGap: 0.2,  send: 0.08 },
  activeFail:    { fn: activeFail,    gain: 0.75, max: 1, minGap: 0.2,  send: 0.08 },
  dryFire:       { fn: dryFire,       gain: 0.6,  max: 2, minGap: 0.08, send: 0.05 },
  weaponSwitch:  { fn: weaponSwitch,  gain: 0.7,  max: 1, minGap: 0.12, send: 0.06 },
  grenadeBounce: { fn: grenadeBounce, gain: 0.45, max: 2, minGap: 0.08, send: 0.12 },
  grenadePin:    { fn: grenadePin,    gain: 0.45, max: 2, minGap: 0.1,  send: 0.04 },
  bulletGraze:   { fn: bulletGraze,   gain: 0.35, max: 2, minGap: 0.07, send: 0.04 },
  reloadCancel:  { fn: reloadCancel,  gain: 0.7,  max: 2, minGap: 0.2,  send: 0.05 },
  refill:        { fn: refill,        gain: 0.75, max: 1, minGap: 0.3,  send: 0.08 },
  crateReady:    { fn: crateReady,    gain: 1.0,  max: 2, minGap: 0.2,  send: 0.2 },
  meleeStart:    { fn: meleeStart,    gain: 0.75, max: 2, minGap: 0.15, send: 0.06 },
  meleeHit:      { fn: meleeHit,      gain: 0.8,  max: 2, minGap: 0.1,  send: 0.12 },
  meleeMiss:     { fn: meleeMiss,     gain: 0.6,  max: 2, minGap: 0.1,  send: 0.06 },
  meleeEnd:      { fn: meleeEnd,      gain: 0.5,  max: 1, minGap: 0.2,  send: 0.0 },
};
