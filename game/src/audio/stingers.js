// Breach – lyd: nivå-stingere (levelStart, upgradeOpen/upgrade, levelEnd, gameComplete, v1.4.1: restart, boss*, rulletekst). Ikke-romlige, går på ui-bussen
// (dukkes ikke av pause/mellomsekvens). Tonalitet som musikken: D frygisk. v1.4/CINDER: levelStart = krigstrommer +
// lavt horn (militært), gameComplete = tyngre og bittersøt (Dsus2-slutt, uløst melodi, glør som slukner).
import { rand, noiseLayer as N, toneLayer as T, metalLayer as M, clickLayer as C } from './synth.js';

const semi = (n) => Math.pow(2, n / 12);
const D2 = 73.42;

// «Messing»-akkord: detunede sagtenner gjennom lavpass som åpner seg, myk attack.
function pad(ac, out, send, t, freqs, { a = 0.25, hold = 0.4, d = 1.2, peak = 0.03, lp = 900, lp2 = 1800 } = {}) {
  freqs.forEach((f) => [-8, 0, 8].forEach((det) => {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + rand(-2, 2);
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.9;
    fl.frequency.setValueAtTime(lp, t); fl.frequency.linearRampToValueAtTime(lp2, t + a + hold * 0.5); fl.frequency.exponentialRampToValueAtTime(lp * 0.6, t + a + hold + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    o.connect(fl); fl.connect(g); g.connect(out); g.connect(send);
    o.start(t); o.stop(t + a + hold + d + 0.05);
  }));
}
function boom(ac, out, send, t, k = 1) {
  T(ac, out, t, { f: 62, f2: 28, drop: 0.5, d: 1.6, peak: 0.85 * k, drive: 2 });
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 700, f2: 100, d: 1.2, peak: 0.5 * k });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 1200, d: 1.0, peak: 0.6 * k });
}

// Horn-/cellolinje (gameComplete og rulletekst): sagtann gjennom lavpass som åpner og lukker seg, vibrato som kommer inn.
function horn(ac, out, send, tt, f, len, peak = 0.05) {
  const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
  const vib = ac.createOscillator(); vib.frequency.value = 4.8; const vg = ac.createGain(); vg.gain.setValueAtTime(0, tt); vg.gain.linearRampToValueAtTime(f * 0.006, tt + 0.8); vib.connect(vg); vg.connect(o1.frequency);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, tt); lp.frequency.linearRampToValueAtTime(1100, tt + 0.6); lp.frequency.linearRampToValueAtTime(600, tt + len);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(peak, tt + 0.35); g.gain.setValueAtTime(peak, tt + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
  o1.connect(lp); lp.connect(g); g.connect(out); g.connect(send);
  for (const x of [o1, vib]) { x.start(tt); x.stop(tt + len + 0.05); }
}

// Krigstromme (odaiko) – samme familie som kamplaget i music.js.
function warDrum(ac, out, send, t, k = 1) {
  T(ac, out, t, { f: 70, f2: 42, drop: 0.16, d: 0.9, peak: 0.6 * k, drive: 1.5 });
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 420, d: 0.2, peak: 0.5 * k });
  N(ac, out, t, { type: 'bandpass', f: 1000, q: 0.8, d: 0.03, peak: 0.14 * k });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 600, d: 0.6, peak: 0.4 * k });
}

function levelStart(ac, out, send, t, o = {}) {
  // CINDER: tung militær start – tre krigstrommer som strammer seg → lavt hornsignal (D–A, så frygisk E♭→D)
  // over jordrumling → stort slag + metallplate. Lengde ~4,6 s.
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 90, f2: 200, q: 1.3, a: 1.4, hold: 0.6, d: 1.6, peak: 0.25, sweep: 2 }); // bakken under
  [[0, 0.75], [0.5, 0.85], [0.82, 1]].forEach(([dt, k]) => warDrum(ac, out, send, t + dt, k));
  M(ac, out, t + 0.82, { f: rand(160, 190), ratios: [1, 2.32, 3.41, 4.86], d: 1.4, peak: 0.16, decayTilt: 0.78 });
  const h = t + 1.05;
  pad(ac, out, send, h, [D2, D2 * semi(7), D2 * 2], { a: 0.35, hold: 0.7, d: 0.8, peak: 0.04, lp: 400, lp2: 1300 });              // horn: D5
  pad(ac, out, send, h + 1.1, [D2 * 2 * semi(1)], { a: 0.12, hold: 0.25, d: 0.25, peak: 0.05, lp: 600, lp2: 1500 });           // E♭ …
  pad(ac, out, send, h + 1.55, [D2, D2 * semi(7), D2 * 2], { a: 0.1, hold: 0.6, d: 1.6, peak: 0.045, lp: 500, lp2: 1600 });     // … → D
  T(ac, out, h, { f: D2 / 2, a: 0.3, hold: 1.8, d: 1.6, peak: 0.2 });
  const e = h + 1.55;
  warDrum(ac, out, send, e, 1.1); boom(ac, out, send, e, 0.5);
  M(ac, out, e, { f: rand(130, 150), ratios: [1, 2.76, 5.4, 8.93], d: 2.2, peak: 0.2, decayTilt: 0.8 });
  return (e - t) + 2.0;
}

function upgradeOpen(ac, out, send, t, o = {}) {
  // v1.4.1: kortene åpnes – tung luke/kasselokk: lavt dunk → stål som skraper opp → lås som slår mot stopp,
  // under en varm, lav D-svulm (dukkes ikke: ui-bussen). Kort (~1,1 s), ingen arkade-pip.
  warDrum(ac, out, send, t, 0.55);
  N(ac, out, t + 0.04, { type: 'bandpass', f: 900, f2: 2600, q: 3.5, a: 0.06, hold: 0.18, d: 0.12, peak: 0.07, sweep: 0.3, drive: 2 }); // stål skraper
  M(ac, out, t + 0.05, { f: rand(420, 470), ratios: [1, 1.52, 2.61, 3.9], d: 0.35, peak: 0.05, decayTilt: 0.7 });
  const l = t + 0.36;
  C(ac, out, l, { f: 2100, peak: 0.26, body: 1.2 });
  T(ac, out, l, { f: 120, f2: 60, drop: 0.05, d: 0.16, peak: 0.42, drive: 1.8 });
  M(ac, out, l, { f: rand(1250, 1450), ratios: [1, 2.32, 3.41, 4.86], d: 0.3, peak: 0.07, decayTilt: 0.7 });
  [[D2, 0.12, 'sine'], [D2 * 2, 0.06, 'triangle']].forEach(([f, pk, wave]) => T(ac, out, t + 0.05, { wave, f, a: 0.25, hold: 0.2, d: 0.6, peak: pk }));
  return 1.2;
}

function upgrade(ac, out, send, t, o = {}) {
  // v1.4.1: kort valgt – tungt og militært: krigstromme + stålbolt som låses (to klikk og plateklang)
  // → lav kvint (D2/A2) med messing-pad som blir stående kort. ~1,6 s.
  warDrum(ac, out, send, t, 0.9);
  C(ac, out, t, { f: 2600, peak: 0.28, body: 1.0 });
  C(ac, out, t + 0.055, { f: 1900, peak: 0.34, body: 1.3 });
  T(ac, out, t + 0.055, { f: 150, f2: 70, drop: 0.05, d: 0.14, peak: 0.4, drive: 1.8 });
  M(ac, out, t + 0.055, { f: rand(165, 185), ratios: [1, 2.76, 5.4, 8.93], d: 1.1, peak: 0.13, decayTilt: 0.78 });
  M(ac, out, t + 0.055, { f: rand(1500, 1700), ratios: [1, 2.32, 3.41], d: 0.25, peak: 0.05, decayTilt: 0.6 });
  pad(ac, out, send, t + 0.08, [D2, D2 * semi(7), D2 * 2], { a: 0.12, hold: 0.3, d: 0.9, peak: 0.035, lp: 450, lp2: 1300 });
  T(ac, out, t + 0.06, { f: D2 / 2, a: 0.05, hold: 0.25, d: 0.9, peak: 0.16 });
  return 1.7;
}

function levelEnd(ac, out, send, t, o = {}) {
  // seier: dypt slag → frygisk kadens (B♭ → A) → åpen D-kvint som blir stående og dør ut
  boom(ac, out, send, t, 0.5);
  pad(ac, out, send, t + 0.05, [D2 * semi(8), D2 * semi(15), D2 * semi(20)], { a: 0.12, hold: 0.35, d: 0.4, peak: 0.042, lp: 900, lp2: 2000 });  // B♭
  pad(ac, out, send, t + 0.6, [D2 * semi(7), D2 * semi(14), D2 * semi(19)], { a: 0.1, hold: 0.35, d: 0.4, peak: 0.042, lp: 900, lp2: 2000 });   // A
  pad(ac, out, send, t + 1.15, [D2, D2 * semi(7), D2 * 2, D2 * 2 * semi(7)], { a: 0.15, hold: 0.8, d: 2.0, peak: 0.045, lp: 1000, lp2: 2600 }); // D5
  T(ac, out, t + 1.15, { f: D2, a: 0.1, hold: 0.6, d: 1.8, peak: 0.18 });
  M(ac, send, t + 1.15, { f: 220, ratios: [1, 2.76, 5.4, 8.93], d: 3.0, peak: 0.22, decayTilt: 0.85 });
  N(ac, out, t + 1.6, { type: 'highpass', f: 3000, f2: 6000, q: 0.7, a: 0.05, d: 1.2, peak: 0.05 });               // trykkluft
  return 4.4;
}

function gameComplete(ac, out, send, t, o = {}) {
  // CINDER: tyngre og bittersøt. To langsomme krigstrommer → lavt register, lange akkorder:
  // Dm(add9) – B♭maj7 – Gm(add9) – A7sus4 – Dsus2 (verken mol eller dur: seieren kostet).
  // Over det en enslig horn-/cellolinje som synker A–G–F–E og blir hengende på E (niende, uløst).
  // Under det: glør som sprakar og slukner, og vind som stilner. ~14 s.
  warDrum(ac, out, send, t, 0.8); warDrum(ac, out, send, t + 0.9, 0.65);
  boom(ac, out, send, t + 0.9, 0.45);
  const ch = [[0, 7, 14, 15], [-4, 3, 7, 12], [5, 12, 15, 19], [7, 12, 14, 17], [0, 7, 12, 14, 19]];
  const step = 2.0, t0 = t + 1.1;
  ch.forEach((c, i) => {
    const tt = t0 + i * step, last = i === ch.length - 1;
    pad(ac, out, send, tt, c.map((n) => D2 * semi(n)), { a: 0.6, hold: last ? 2.6 : 1.0, d: last ? 4.0 : 1.0, peak: 0.032, lp: 420, lp2: last ? 1300 : 1000 });
    T(ac, out, tt, { f: D2 / 2 * semi(c[0]), a: 0.3, hold: last ? 2.4 : 1.1, d: last ? 3.5 : 0.9, peak: 0.2 });
  });
  // melodilinje: A3 – G3 – F3 – E3 (hengende), myk trekant + sagtann gjennom lavpass, litt vibrato
  [[9 + 12, 0], [7 + 12, 1], [5 + 12, 2], [2 + 12, 3.1]].forEach(([n, i]) => {
    const len = i > 3 ? 4.5 : step * 0.95;
    horn(ac, out, send, t0 + 0.4 + i * step, D2 * 2 * semi(n - 12), len, 0.05);
  });
  M(ac, send, t0 + step * 4, { f: 110, ratios: [1, 2.76, 5.4], d: 4.0, peak: 0.12, decayTilt: 0.85 }); // én fjern metallklang
  // glør som slukner + vind som stilner
  for (let i = 0; i < 22; i++) { const tt = t + 6 + Math.pow(Math.random(), 1.6) * 7; C(ac, out, tt, { f: rand(2500, 5500), peak: 0.05 * (1 - (tt - t - 6) / 8), body: 0, d: 0.006 }); }
  N(ac, out, t + 0.5, { color: 'pink', type: 'bandpass', f: 420, f2: 200, q: 0.7, a: 3.0, hold: 3.0, d: 6.0, peak: 0.05, sweep: 12 });
  return 14.5;
}

function fallen(ac, out, send, t, o = {}) {
  // Warden faller (nøytral, tung – ingen kringkasting/«signal lost»): dypt slag → lav, mørk liten sekund (D–E♭)
  // som synker og dør ut i et mørkt sus. o.short = gjentatt død: slag + kort lav tone, ~1,3 s.
  boom(ac, out, send, t, o.short ? 0.55 : 0.75);
  T(ac, out, t, { f: 48, f2: 30, drop: 0.8, a: 0.01, d: o.short ? 0.8 : 1.6, peak: 0.5, drive: 1.4 });
  if (o.short) {
    T(ac, out, t + 0.05, { wave: 'triangle', f: D2, f2: D2 * semi(-1), drop: 1.0, a: 0.05, hold: 0.15, d: 0.9, peak: 0.12 });
    return 1.4;
  }
  pad(ac, out, send, t + 0.1, [D2, D2 * semi(1), D2 * 2], { a: 0.35, hold: 0.6, d: 2.0, peak: 0.04, lp: 500, lp2: 900 });
  T(ac, out, t + 0.1, { wave: 'triangle', f: D2, f2: D2 * semi(-2), drop: 2.5, a: 0.2, hold: 0.6, d: 2.0, peak: 0.16 });
  N(ac, out, t + 0.3, { color: 'brown', type: 'lowpass', f: 400, f2: 150, a: 0.6, hold: 0.5, d: 2.0, peak: 0.12, sweep: 3 });
  M(ac, send, t + 0.05, { f: 95, ratios: [1, 2.76, 5.4], d: 2.5, peak: 0.12, decayTilt: 0.85 });
  return 3.8;
}

// ---- v1.4.1: restart, boss (midlertidig), rulletekst ----
function restart(ac, out, send, t, o = {}) {
  // «Tilbake i kamp» etter død: kort sug inn (reversert sus) → ett tungt krigstrommeslag + stål som låses → lav D-quint
  // som står kort. ~1,6 s. Musikkintensiteten nullstilles i index.js.
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: 300, f2: 1400, q: 0.8, a: 0.32, d: 0.04, peak: 0.12, sweep: 0.34 });
  warDrum(ac, out, send, t + 0.34, 1);
  boom(ac, out, send, t + 0.34, 0.35);
  C(ac, out, t + 0.36, { f: 2600, peak: 0.22, body: 1.2 });
  M(ac, out, t + 0.36, { f: rand(2300, 2600), ratios: [1, 1.48, 1.93], d: 0.18, peak: 0.08, decayTilt: 0.7 });
  pad(ac, out, send, t + 0.38, [D2, D2 * semi(7)], { a: 0.05, hold: 0.3, d: 0.9, peak: 0.035, lp: 400, lp2: 800 });
  return 1.7;
}
function bossStart(ac, out, send, t, o = {}) {
  // MIDLERTIDIG (til docs/BOSS.md): Ashmaw er her. Jorden løfter seg (sub-svell) → tre store slag med metallplate →
  // dissonant lav messingklynge (D–E♭–A♭) som står og murrer. ~4,5 s.
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 70, f2: 240, q: 1.2, a: 0.9, hold: 0.2, d: 1.4, peak: 0.3, sweep: 1.2 });
  [[0.9, 0.9], [1.25, 0.9], [1.6, 1]].forEach(([dt, k]) => warDrum(ac, out, send, t + dt, k));
  boom(ac, out, send, t + 1.6, 0.8);
  M(ac, out, t + 1.6, { f: rand(150, 190), ratios: [1, 2.32, 3.41, 4.86, 6.3], d: 1.8, peak: 0.22, decayTilt: 0.8, spread: 0.02 });
  pad(ac, out, send, t + 1.62, [D2, D2 * semi(1), D2 * semi(6), D2 * 2], { a: 0.15, hold: 1.3, d: 1.6, peak: 0.04, lp: 380, lp2: 1100 });
  T(ac, out, t + 1.6, { f: D2 / 2, a: 0.05, hold: 1.2, d: 1.6, peak: 0.28, drive: 1.6 });
  return 4.6;
}
function bossPhase(ac, out, send, t, o = {}) {
  // MIDLERTIDIG: fasebytte – ett tungt slag + metall + kort stigende sus
  N(ac, out, t, { type: 'bandpass', f: 400, f2: 1600, q: 0.9, a: 0.25, d: 0.05, peak: 0.1, sweep: 0.3 });
  warDrum(ac, out, send, t + 0.28, 1); boom(ac, out, send, t + 0.28, 0.5);
  M(ac, out, t + 0.28, { f: rand(170, 230), ratios: [1, 2.32, 3.41, 4.86], d: 1.0, peak: 0.16, decayTilt: 0.78 });
  return 1.8;
}
function bossEnd(ac, out, send, t, o = {}) {
  // MIDLERTIDIG: lang utpust. Et siste dypt slag → sjakten «puster ut» (brun støy som synker og stilner) → lav D-akkord
  // (D–A–F) som løser seg til Dsus2 → glør som slukner. ~8 s.
  boom(ac, out, send, t, 0.7);
  N(ac, out, t + 0.2, { color: 'brown', type: 'lowpass', f: 600, f2: 90, a: 0.6, hold: 1.2, d: 4.5, peak: 0.28, sweep: 6 });
  N(ac, out, t + 0.4, { color: 'pink', type: 'bandpass', f: 900, f2: 250, q: 0.6, a: 1.0, hold: 0.8, d: 4.0, peak: 0.07, sweep: 5.5 });
  pad(ac, out, send, t + 1.2, [D2, D2 * semi(7), D2 * semi(15)], { a: 1.2, hold: 1.2, d: 2.0, peak: 0.03, lp: 380, lp2: 800 });
  pad(ac, out, send, t + 4.0, [D2, D2 * semi(7), D2 * semi(14)], { a: 0.9, hold: 1.0, d: 3.0, peak: 0.028, lp: 360, lp2: 700 });
  T(ac, out, t + 1.2, { wave: 'triangle', f: D2 / 2, a: 1.0, hold: 3.5, d: 3.0, peak: 0.18 });
  for (let i = 0; i < 18; i++) { const tt = t + 2.5 + Math.pow(Math.random(), 1.5) * 5; C(ac, out, tt, { f: rand(2500, 5500), peak: 0.045 * (1 - (tt - t - 2.5) / 6), body: 0, d: 0.006 }); }
  return 8.2;
}

/**
 * Rulletekst-musikk (creditsStart → creditsEnd): gameComplete-temaet i rolig, bittersøt løkke. Fraser på 15 s
 * (Dm(add9) – B♭maj7 – Gm(add9) – A7sus4 – Dsus2, 3 s per akkord) med vekslende horn-/cellolinje, vind og glør.
 * createCredits(ac, dest, send) → { start(t), update(), stop(fade) }. update() kalles fra lydens tick og legger
 * neste frase i kø ~2 s før den trengs. dest bør følge musikkvolumet (index.js).
 */
export function createCredits(ac, dest, revSend) {
  const out = ac.createGain(); out.gain.value = 0; out.connect(dest);
  const send = ac.createGain(); send.gain.value = 0; send.connect(revSend); // romsend tones sammen med out
  const G = [out, send];
  const CH = [[0, 7, 14, 15], [-4, 3, 7, 12], [5, 12, 15, 19], [7, 12, 14, 17], [0, 7, 12, 14, 19]];
  const LINES = [[[21, 0, 0.95], [19, 1, 0.95], [17, 2, 0.95], [14, 3.1, 1.5]],  // A – G – F – E (som gameComplete)
                 [[14, 0, 0.95], [16, 0.5, 0.45], [17, 1, 0.95], [21, 2, 0.95], [19, 3, 0.6], [16, 3.5, 1.3]]]; // stigende, faller tilbake til E
  const STEP = 3.0, LEN = CH.length * STEP;
  let next = 0, n = 0, on = false;
  function phrase(t0) {
    const line = LINES[n % LINES.length], soft = n === 0 ? 0.8 : 1; n++;
    CH.forEach((c, i) => {
      const tt = t0 + i * STEP, last = i === CH.length - 1;
      pad(ac, out, send, tt, c.map((x) => D2 * semi(x)), { a: 1.0, hold: last ? 1.6 : 1.4, d: last ? 2.6 : 1.4, peak: 0.026 * soft, lp: 380, lp2: 850 });
      T(ac, out, tt, { f: D2 / 2 * semi(c[0]), a: 0.6, hold: 1.6, d: 1.4, peak: 0.14 * soft });
    });
    line.forEach(([note, beat, len]) => horn(ac, out, send, t0 + 0.6 + beat * STEP, D2 * 2 * semi(note - 12), len * STEP, 0.04 * soft));
    if (n % 2 === 0) M(ac, send, t0 + STEP * 4, { f: 110, ratios: [1, 2.76, 5.4], d: 4.0, peak: 0.08, decayTilt: 0.85 }); // fjern klang
    N(ac, out, t0, { color: 'pink', type: 'bandpass', f: 380, f2: 240, q: 0.7, a: 4.0, hold: LEN - 8, d: 5.0, peak: 0.03, sweep: LEN }); // vind
    for (let i = 0; i < 10; i++) C(ac, out, t0 + Math.random() * LEN, { f: rand(2500, 5500), peak: 0.03, body: 0, d: 0.006 });
  }
  return {
    get active() { return on; },
    start(t = ac.currentTime + 0.05) {
      on = true; n = 0; next = t;
      for (const g of G) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 2.5); }
      this.update();
    },
    update() { if (on && ac.currentTime > next - 2) { phrase(next); next += LEN; } },
    scheduleUntil(tEnd) { while (on && next < tEnd) { phrase(next); next += LEN; } }, // offline-render
    stopAt(t, fade = 4) { on = false; for (const g of G) { g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); } }, // offline-render
    stop(fade = 4) {
      if (!on) return; on = false;
      const t = ac.currentTime;
      for (const g of G) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); }
      if (typeof OfflineAudioContext === 'undefined' || !(ac instanceof OfflineAudioContext)) setTimeout(() => { if (!on) { try { out.disconnect(); send.disconnect(); } catch (_) {} } }, fade * 1000 + 6000);
    },
    output: out,
  };
}

// ---------------- Hovedmeny (v1.4.1, demo av brett 1) ----------------
// createMenuMusic: mørk, rolig stemningsloop for hovedmenyen. Dyp D-drone (puster), vind over aske, sjeldne
// fjerne trommeslag «under bakken» (hjerteslag fra dypet), glør som knitrer, og hvert andre frase et lavt horn
// med motivet fra levelStart (D–A, frygisk E♭→D). Frase 16 s. Samme grensesnitt som createCredits.
export function createMenuMusic(ac, dest, revSend) {
  const out = ac.createGain(); out.gain.value = 0; out.connect(dest);
  const send = ac.createGain(); send.gain.value = 0; send.connect(revSend);
  const G = [out, send], LEN = 16;
  let next = 0, n = 0, on = false;
  function phrase(t0) {
    const soft = n === 0 ? 0.85 : 1; n++;
    // drone: D1 + A1 + D2 (sinus/trekant), lang inn-/utsving som overlapper neste frase
    for (const [f, p, w] of [[D2 / 2, 0.06, 'sine'], [D2, 0.06, 'triangle'], [D2 * 1.5, 0.03, 'triangle'], [D2 * 2, 0.02, 'triangle']])
      T(ac, out, t0, { wave: w, f, a: n === 1 ? 1.5 : 4.5, hold: LEN - 7, d: 6.5, peak: p * soft, lp: 700 }); // første frase: raskere inn
    pad(ac, out, send, t0 + 2, [D2 * semi(12), D2 * semi(19), D2 * semi(n % 2 ? 22 : 24)], { a: 3.5, hold: 4, d: 5, peak: 0.022 * soft, lp: 700, lp2: 1400 });
    N(ac, out, t0, { color: 'pink', type: 'bandpass', f: 300, f2: 520, q: 1.1, a: 5, hold: LEN - 9, d: 6, peak: 0.05, sweep: LEN }); // vind
    N(ac, out, t0, { color: 'brown', type: 'lowpass', f: 80, a: 4, hold: LEN - 8, d: 5, peak: 0.04 });                                      // jordrumling
    // fjerne slag under bakken: to og to (hjerteslag), dypt og dempet
    for (const b of [3.2, 3.75, 10.4, 10.95]) {
      T(ac, out, t0 + b, { f: 62, f2: 40, drop: 0.2, a: 0.01, d: 0.7, peak: (b % 1 > 0.5 ? 0.11 : 0.16) * soft });
      N(ac, send, t0 + b, { color: 'brown', type: 'lowpass', f: 300, d: 0.7, peak: 0.12 });
    }
    if (n % 2 === 0) { // lavt horn: D – A – E♭ – D
      [[0, 0, 2.2], [7, 2.4, 2.2], [1, 5, 1.6], [0, 6.8, 3.2]].forEach(([x, b, l]) => horn(ac, out, send, t0 + 4 + b, D2 * semi(x), l, 0.045));
    }
    for (let i = 0; i < 14; i++) C(ac, out, t0 + Math.random() * LEN, { f: rand(2500, 5500), peak: rand(0.02, 0.05), body: 0, d: 0.006 }); // glør
  }
  return {
    get active() { return on; },
    start(t = ac.currentTime + 0.05) {
      on = true; n = 0; next = t;
      for (const g of G) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.5); } // v1.6: fade inn ~1,5 s
      this.update();
    },
    update() { if (on && ac.currentTime > next - 3) { phrase(next); next += LEN; } },
    scheduleUntil(tEnd) { while (on && next < tEnd) { phrase(next); next += LEN; } },
    stopAt(t, fade = 1.5) { on = false; for (const g of G) { g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); } },
    stop(fade = 1.5) {
      if (!on) return; on = false;
      const t = ac.currentTime;
      for (const g of G) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); }
      if (typeof OfflineAudioContext === 'undefined' || !(ac instanceof OfflineAudioContext)) setTimeout(() => { if (!on) { try { out.disconnect(); send.disconnect(); } catch (_) {} } }, fade * 1000 + 20000);
    },
    output: out,
  };
}

function menuStart(ac, out, send, t, o = {}) {
  // PLAY trykket: tung metallisk lås (bolten slår i) → ett krigstrommeslag + sub-svell → lav plate som klinger ut.
  // ~1,3 s. Kringkastingen i intro venter til den har landet (index.js stingerUntil).
  C(ac, out, t, { f: 2600, peak: 0.5, body: 0.9, d: 0.02 });
  M(ac, out, t, { f: rand(900, 1000), ratios: [1, 2.32, 3.81, 5.1], d: 0.18, peak: 0.14, decayTilt: 0.6 });
  N(ac, out, t + 0.06, { type: 'bandpass', f: 1800, q: 1.5, d: 0.04, peak: 0.25 });                    // låsen går i inngrep
  warDrum(ac, out, send, t + 0.1, 0.85);
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 70, f2: 160, q: 1.2, a: 0.15, d: 0.9, peak: 0.25, sweep: 0.6 });
  M(ac, send, t + 0.1, { f: 98, ratios: [1, 2.76, 5.4], d: 1.6, peak: 0.12, decayTilt: 0.85 });
  return 1.3;
}

export const STINGER_SOUNDS = {
  menuStart:    { fn: menuStart,    gain: 0.75, max: 1, minGap: 1.0, send: 0.25, spatial: false, bus: 'ui' },
  restart:      { fn: restart,      gain: 0.75, max: 1, minGap: 0.8, send: 0.25, spatial: false, bus: 'ui' },
  bossStart:    { fn: bossStart,    gain: 0.8,  max: 1, minGap: 3.0, send: 0.35, spatial: false, bus: 'ui' },
  bossPhase:    { fn: bossPhase,    gain: 0.75, max: 1, minGap: 1.5, send: 0.3,  spatial: false, bus: 'ui' },
  bossEnd:      { fn: bossEnd,      gain: 0.75, max: 1, minGap: 3.0, send: 0.4,  spatial: false, bus: 'ui' },
  levelStart:   { fn: levelStart,   gain: 0.75, max: 1, minGap: 1.0, send: 0.3,  spatial: false, bus: 'ui' },
  upgradeOpen:  { fn: upgradeOpen,  gain: 0.7,  max: 1, minGap: 0.4, send: 0.15, spatial: false, bus: 'ui' },
  upgrade:      { fn: upgrade,      gain: 0.7,  max: 1, minGap: 0.3, send: 0.2,  spatial: false, bus: 'ui' },
  levelEnd:     { fn: levelEnd,     gain: 0.75, max: 1, minGap: 1.0, send: 0.35, spatial: false, bus: 'ui' },
  fallen:       { fn: fallen,       gain: 0.8,  max: 1, minGap: 0.8, send: 0.3,  spatial: false, bus: 'ui' },
  gameComplete: { fn: gameComplete, gain: 0.75, max: 1, minGap: 2.0, send: 0.4,  spatial: false, bus: 'ui' },
};
