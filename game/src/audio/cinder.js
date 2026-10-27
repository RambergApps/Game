// Breach – lyd: CINDER (låst 23.10). Cinderborn = varmeetende kitinskapninger fra under bakken.
// Mål: organisk og tungt, ikke synth-pip. Byggesteinene er derfor generert STØY med struktur, ikke rene toner:
//   - crackle(): glør/sprak – glisne impulser med potens-fordelt styrke (få store smell, mange små), i en buffer
//   - clicks(): kitin – korte, dempede resonanser (2–6 kHz, 1–4 ms) i klynger eller med fast takt (stridulasjon)
//   - growl(): strupe – sagtann med jitter + amplitude-«fry» gjennom tre formantfiltre, pluss pust
// Alle oppskrifter: (ac, out, send, t, o) → varighet. o.type = intern fiendetype (grunt/flanker/heavy/grenadier).
import { rand, pick, chance, clamp, noiseLayer as N, toneLayer as T, metalLayer as M, filter, shaper } from './synth.js';

// ---------------------------------------------------------------- byggesteiner
const SIZE = { grunt: 1, flanker: 0.75, heavy: 1.45, grenadier: 0.9, kilnAlpha: 1.7 };
const VOICE = { grunt: 72, flanker: 112, heavy: 46, grenadier: 88, kilnAlpha: 40 }; // grunntone strupe (Hz)
const sz = (o) => SIZE[o?.type] ?? 1;
const isAlpha = (o) => o?.type === 'kilnAlpha' || o?.variant === 'alpha';
// Kiln Alpha (v1.4.1): ekstra sub og lengre, mørk hale – brukes i spawnRise, hitChitin, cinderDeath
function alphaSub(ac, out, send, t, { f = 34, d = 1.4, peak = 0.4, tail = 1.6 } = {}) {
  T(ac, out, t, { f: f * 1.4, f2: f * 0.7, drop: d * 0.6, a: 0.01, d, peak, drive: 1.6 });
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 160, f2: 60, a: 0.02, d: tail, peak: peak * 0.7, sweep: tail });
  N(ac, send, t + 0.05, { color: 'brown', type: 'lowpass', f: 300, d: tail, peak: peak * 0.5 });
}

function buf(ac, dur, fill) {
  const sr = ac.sampleRate, n = Math.max(1, Math.ceil(dur * sr));
  const b = ac.createBuffer(1, n, sr); fill(b.getChannelData(0), sr, n); return b;
}
export function playBuf(ac, out, t, b, { rate = 1, peak = 0.5, type = null, f = 2000, q = 0.7, type2 = null, f2 = 0, q2 = 0.7 } = {}) {
  const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = peak;
  let node = s;
  if (type) { const fl = filter(ac, type, f, q); node.connect(fl); node = fl; }
  if (type2) { const fl = filter(ac, type2, f2, q2); node.connect(fl); node = fl; }
  node.connect(g); g.connect(out); s.start(t); s.stop(t + b.duration / rate + 0.02);
  return g;
}
// Glør: rate(u) = impulser/s ved relativ tid u∈[0,1]. Potensfordelt amplitude gir «ekte» bål-sprak.
export function crackleBuf(ac, dur, rate, { len = [0.0004, 0.0025], bright = 0.6 } = {}) {
  return buf(ac, dur, (d, sr, n) => {
    let ti = 0;
    while (ti < dur) {
      const r = Math.max(0.5, rate(ti / dur)); ti += -Math.log(1 - Math.random()) / r; if (ti >= dur) break;
      const i0 = (ti * sr) | 0, L = (rand(len[0], len[1]) * sr) | 0, A = Math.pow(Math.random(), 3.2) * 0.95 + 0.03;
      let lp = 0;
      for (let k = 0; k < L && i0 + k < n; k++) { const w = Math.random() * 2 - 1; lp += (w - lp) * bright; d[i0 + k] += lp * A * Math.exp(-5 * k / L); }
    }
  });
}
// Kitin: dempede resonanser. times = liste av starttider (s); f = [lo, hi] Hz; dec = [lo, hi] s.
export function clickBuf(ac, dur, times, { f = [2400, 5200], dec = [0.0012, 0.004], amp = [0.4, 1] } = {}) {
  return buf(ac, dur, (d, sr, n) => {
    for (const t0 of times) {
      const i0 = (t0 * sr) | 0, fr = rand(f[0], f[1]), de = rand(dec[0], dec[1]), A = rand(amp[0], amp[1]);
      const L = Math.min(n - i0, (de * 6 * sr) | 0), w = 2 * Math.PI * fr / sr, ph = Math.random() * 6.28;
      for (let k = 0; k < L; k++) d[i0 + k] += A * Math.sin(w * k + ph) * Math.exp(-k / (de * sr)) + (k < 12 ? A * 0.5 * (Math.random() * 2 - 1) : 0);
    }
  });
}
export const cluster = (n, span, t0 = 0) => Array.from({ length: n }, () => t0 + Math.random() * span).sort((a, b) => a - b);
// stridulasjon: klikk med (nesten) fast takt hz over dur, litt jitter
const strid = (dur, hz, jit = 0.25) => { const a = []; for (let t = 0; t < dur; t += (1 / hz) * (1 + rand(-jit, jit))) a.push(t); return a; };

// v1.4.1: knurr – maks 2 samtidig (per AudioContext) og mer variasjon: tilfeldig «vokal» (formantsett), bøy,
// fry og jitter, og av og til et brudd (to støt i stedet for ett). Over grensen spilles bare pusten (svakere).
const GROWL_MAX = 2, growlEnds = new WeakMap();
const VOWELS = [null, [[260, 6, 1], [620, 7, 0.6], [1250, 8, 0.3]], [[340, 5, 1], [900, 6, 0.65], [1700, 7, 0.3]], [[230, 7, 1], [520, 8, 0.7], [1100, 9, 0.35]], [[400, 4, 1], [1050, 5, 0.6], [1900, 6, 0.3]]];
export function growlVoices(ac, t) { return (growlEnds.get(ac) || []).filter((e) => e > t).length; }
function growl(ac, out, t, o = {}) {
  const ends = (growlEnds.get(ac) || []).filter((e) => e > t); growlEnds.set(ac, ends);
  const dur0 = o.dur ?? 0.5;
  if (ends.length >= GROWL_MAX) { // stemmegrense: bare et svakt pust, så massedød ikke blir et vokodet kor
    N(ac, out, t, { color: 'pink', type: 'bandpass', f: rand(700, 1300), q: 0.9, a: 0.05, d: dur0 * 0.6, peak: (o.peak ?? 0.2) * 0.25 });
    return;
  }
  ends.push(t + dur0 + 0.05);
  const v = o.formants ? null : pick(VOWELS);
  const oo = { ...o, formants: o.formants ?? v ?? undefined, f0: (o.f0 ?? 70) * rand(0.88, 1.12), bend: (o.bend ?? 0.75) * rand(0.9, 1.1), fry: (o.fry ?? 30) * rand(0.75, 1.3), dur: dur0 * rand(0.85, 1.2) };
  if (dur0 > 0.35 && chance(0.3)) { // brudd: to støt
    const d1 = oo.dur * rand(0.35, 0.5);
    growlOne(ac, out, t, { ...oo, dur: d1 });
    growlOne(ac, out, t + d1 + rand(0.04, 0.1), { ...oo, dur: oo.dur - d1, f0: oo.f0 * rand(0.85, 1.05), peak: (oo.peak ?? 0.2) * 0.8 });
  } else growlOne(ac, out, t, oo);
}
function growlOne(ac, out, t, { f0 = 70, dur = 0.5, peak = 0.2, fry = 30, bend = 0.75, formants = [[300, 5, 1], [750, 6, 0.7], [1500, 7, 0.35]], breath = 0.35, a = 0.04, drive = 1.6 } = {}) {
  const o = ac.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * bend, t + dur);
  const j = ac.createOscillator(); j.frequency.value = rand(3, 11); const jg = ac.createGain(); jg.gain.value = f0 * rand(0.04, 0.12); j.connect(jg); jg.connect(o.frequency);
  const am = ac.createGain(); am.gain.value = 0.5;
  const fl = ac.createOscillator(); fl.type = 'triangle'; fl.frequency.setValueAtTime(fry, t); fl.frequency.linearRampToValueAtTime(fry * rand(0.6, 0.9), t + dur);
  const fg = ac.createGain(); fg.gain.value = 0.48; fl.connect(fg); fg.connect(am.gain);
  const env = ac.createGain(); const p = env.gain;
  p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a); p.setTargetAtTime(peak * 0.6, t + a, dur * 0.4); p.exponentialRampToValueAtTime(0.0001, t + dur);
  const sh = shaper(ac, drive); o.connect(am);
  for (const [ff, q, g] of formants) { const bp = filter(ac, 'bandpass', ff * rand(0.92, 1.08), q); const gg = ac.createGain(); gg.gain.value = g; am.connect(bp); bp.connect(gg); gg.connect(sh); }
  sh.connect(env); env.connect(out);
  for (const x of [o, j, fl]) { x.start(t); x.stop(t + dur + 0.05); }
  if (breath > 0) N(ac, out, t, { color: 'pink', type: 'bandpass', f: formants[1][0] * 1.4, q: 0.9, a: a * 1.5, hold: dur * 0.3, d: dur * 0.6, peak: peak * breath });
}
const voiceOf = (o) => (VOICE[o?.type] ?? 72) * rand(0.92, 1.08);

// ---------------------------------------------------------------- spawn
function spawnWarn(ac, out, send, t, o = {}) {
  // dyp rumling som bygger seg opp over hele varselstiden (o.warn s) og topper i det de bryter opp
  const k = sz(o), dur = clamp(o.warn ?? 0.9, 0.3, 2.0);
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 70, f2: 220, q: 1.4, a: dur, hold: 0.02, d: 0.35, peak: 0.6 * k, sweep: dur });
  T(ac, out, t, { f: 28 / Math.sqrt(k), f2: 44 / Math.sqrt(k), drop: dur, a: dur * 0.9, hold: 0.05, d: 0.3, peak: 0.22 * Math.min(k, 1.2), drive: 1.8 });
  N(ac, out, t, { color: 'brown', type: 'bandpass', f: 45, f2: 75, q: 3, a: dur * 0.9, hold: 0.05, d: 0.3, peak: 0.5 * k, sweep: dur }); // ru, ikke ren sinus
  // grus og stein som gnis (tettere og lysere mot slutten)
  playBuf(ac, out, t, crackleBuf(ac, dur + 0.15, (u) => 8 + 140 * u * u, { len: [0.002, 0.008], bright: 0.25 }), { peak: 0.55 * k, type: 'bandpass', f: 520, q: 0.9, type2: 'lowpass', f2: 1400 });
  N(ac, send, t + dur * 0.5, { color: 'brown', type: 'lowpass', f: 300, a: dur * 0.5, d: 0.5, peak: 0.25 * k });
  return dur + 0.45;
}
function spawnRise(ac, out, send, t, o = {}) {
  // betong/jord brytes: smell + dunk → stein og grus faller → jorddryss; skapningen klikker og pruster
  const k = sz(o);
  N(ac, out, t, { type: 'lowpass', f: 2600, q: 0.8, d: 0.07, peak: 0.6 * k, drive: 3 });
  N(ac, out, t, { type: 'bandpass', f: 1100, q: 1.1, d: 0.12, peak: 0.35 * k, drive: 2 });
  T(ac, out, t, { f: 95 / Math.sqrt(k), f2: 38, drop: 0.18, d: 0.32, peak: 0.75 * Math.min(k, 1.2), drive: 2.2 });
  // steinfall: dempede «klonk» i lavt mellomtoneområde, avtagende tetthet
  const rocks = []; for (let i = 0; i < 22 * k; i++) rocks.push(0.03 + Math.pow(Math.random(), 1.8) * 0.85);
  playBuf(ac, out, t, clickBuf(ac, 1.0, rocks.sort(), { f: [280, 1400], dec: [0.006, 0.02], amp: [0.15, 0.7] }), { peak: 0.38 * k, type: 'lowpass', f: 2600 });
  N(ac, out, t + 0.04, { color: 'pink', type: 'bandpass', f: 1300, f2: 450, q: 0.7, a: 0.02, d: 0.75, peak: 0.16 * k }); // jorddryss
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 600, d: 0.9, peak: 0.4 * k });
  playBuf(ac, out, t + 0.12, clickBuf(ac, 0.35, cluster(o.type === 'flanker' ? 9 : 6, 0.3)), { peak: 0.3, type: 'highpass', f: 1500 });
  growl(ac, out, t + 0.16, { f0: voiceOf(o), dur: 0.4 * Math.sqrt(k), peak: 0.13 * Math.min(k, 1.3), bend: 0.85, breath: 0.5 });
  if (isAlpha(o)) { alphaSub(ac, out, send, t, { f: 30, d: 1.2, peak: 0.42, tail: 2.0 }); return 2.3; }
  return 1.25;
}

// ---------------------------------------------------------------- bevegelse og angrep
function chitinStep(ac, out, send, t, o = {}) {
  const ty = o.type;
  if (ty === 'flanker') { // lav, rask firbeint: lett trippende kitin
    playBuf(ac, out, t, clickBuf(ac, 0.14, cluster(pick([3, 4, 5]), 0.11), { f: [2800, 5600], dec: [0.0008, 0.0022] }), { peak: 0.32, type: 'highpass', f: 1800 });
    N(ac, out, t, { type: 'bandpass', f: 900, q: 1, d: 0.03, peak: 0.05 });
    return 0.18;
  }
  if (ty === 'heavy' || ty === 'kilnAlpha') { // massiv: tungt dunk + plater som gnisser
    const al = ty === 'kilnAlpha';
    T(ac, out, t, { f: al ? 46 : 58, f2: al ? 27 : 34, drop: 0.12, d: al ? 0.32 : 0.2, peak: 0.6, drive: 2 });
    N(ac, out, t, { type: 'lowpass', f: 600, d: 0.08, peak: 0.25 });
    N(ac, out, t + 0.02, { type: 'bandpass', f: rand(700, 1000), q: 3.5, a: 0.01, d: 0.1, peak: 0.07 });
    playBuf(ac, out, t + 0.03, clickBuf(ac, 0.12, cluster(2, 0.08), { f: [1400, 2600], dec: [0.002, 0.005] }), { peak: 0.25 });
    return 0.3;
  }
  if (ty === 'grenadier') { // oppblåst: bløtt, våt kontakt + et par klikk
    N(ac, out, t, { type: 'bandpass', f: 650, f2: 320, q: 2.2, d: 0.07, peak: 0.12 });
    T(ac, out, t, { f: 110, f2: 70, drop: 0.05, d: 0.06, peak: 0.18 });
    playBuf(ac, out, t + 0.01, clickBuf(ac, 0.1, cluster(2, 0.07)), { peak: 0.22, type: 'highpass', f: 1500 });
    return 0.15;
  }
  // Husk (tobent, tung rygghump): dumpt dunk + 2–3 kitinklikk
  T(ac, out, t, { f: 82, f2: 50, drop: 0.06, d: 0.08, peak: 0.32, drive: 1.5 });
  N(ac, out, t, { type: 'lowpass', f: 900, d: 0.04, peak: 0.12 });
  playBuf(ac, out, t + 0.012, clickBuf(ac, 0.12, cluster(pick([2, 3]), 0.08)), { peak: 0.28, type: 'highpass', f: 1600 });
  return 0.16;
}
function chitinRattle(ac, out, send, t, o = {}) {
  // stridulasjon før angrep (telegraph): kitin som gnis i fast takt, sveller opp og slipper; pust under
  const fl = o.type === 'flanker', dur = clamp((o.duration ?? 0.5) * 0.7, 0.22, 0.55);
  const b = clickBuf(ac, dur + 0.02, strid(dur, fl ? 62 : 38), { f: fl ? [3200, 5600] : [2200, 4200], dec: [0.0012, 0.003] });
  const g = playBuf(ac, out, t, b, { peak: 0.0001, type: 'highpass', f: 1400 });
  g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0.42, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: fl ? 2600 : 1700, q: 1.2, a: dur * 0.6, d: dur * 0.4, peak: 0.05 });
  return dur + 0.1;
}
function lurcherCharge(ac, out, send, t, o = {}) {
  // Lurcher stormer inn (meleeCharge): hvesing + rask kitinrasling + kort strupe som stiger
  const dur = clamp(o.duration ?? 0.3, 0.2, 0.6);
  N(ac, out, t, { color: 'white', type: 'highpass', f: 2800, f2: 4500, q: 0.8, a: dur * 0.7, d: 0.12, peak: 0.16 });
  playBuf(ac, out, t, clickBuf(ac, dur + 0.05, strid(dur, 75, 0.35), { f: [3000, 6000] }), { peak: 0.28, type: 'highpass', f: 2000 });
  growl(ac, out, t + dur * 0.3, { f0: 105, dur: dur * 0.9, peak: 0.12, bend: 1.35, fry: 40, breath: 0.8 });
  return dur + 0.2;
}
function kilnSpinup(ac, out, send, t, o = {}) {
  // Kiln: ovnen i brystet blusser opp før sprayen (spinup) – brus som stiger, kjernen dunker, glør tetner
  const dur = clamp(o.duration ?? 0.8, 0.3, 2), al = isAlpha(o) ? 0.72 : 1;
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: 180 * al, f2: 900 * al, q: 0.9, a: dur * 0.9, hold: 0.05, d: 0.3, peak: 0.32, sweep: dur });
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 160, a: dur * 0.8, d: 0.35, peak: 0.35 });
  for (let i = 0, n = Math.max(2, Math.round(dur / 0.22)); i < n; i++) T(ac, out, t + i * dur / n, { f: 50, f2: 38, drop: 0.1, d: 0.16, peak: 0.18 + 0.25 * i / n, drive: 1.6 });
  playBuf(ac, out, t, crackleBuf(ac, dur + 0.2, (u) => 20 + 260 * u), { peak: 0.35, type: 'highpass', f: 1600 });
  return dur + 0.4;
}
function kilnSpindown(ac, out, send, t) {
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: 700, f2: 160, q: 0.9, d: 0.6, peak: 0.16 });
  N(ac, out, t + 0.05, { color: 'white', type: 'highpass', f: 3500, d: 0.4, peak: 0.04 }); // damp/varme slipper
  return 0.7;
}

// ---------------------------------------------------------------- treff, død, brennende lag
function hitChitin(ac, out, send, t, o = {}) {
  // skallet sprekker (skarpe brudd) + dumpt kjøtt + gnistregn av glør + kort fres
  const k = sz(o);
  playBuf(ac, out, t, clickBuf(ac, 0.06, cluster(pick([2, 3, 4]), 0.03), { f: [1600, 3600], dec: [0.001, 0.0035], amp: [0.6, 1] }), { peak: 0.55 });
  N(ac, out, t, { type: 'bandpass', f: rand(1800, 2800), q: 1.4, d: 0.03, peak: 0.35, drive: 2 });
  T(ac, out, t, { f: 150 / Math.sqrt(k), f2: 70, drop: 0.04, d: 0.06, peak: 0.32 });
  if (o.type === 'heavy' || o.type === 'kilnAlpha') M(ac, out, t, { f: rand(240, 320) / (isAlpha(o) ? 1.35 : 1), ratios: [1, 2.3, 3.6], d: isAlpha(o) ? 0.2 : 0.09, peak: 0.12 }); // plateryggen
  if (isAlpha(o)) T(ac, out, t, { f: 70, f2: 40, drop: 0.08, d: 0.22, peak: 0.28, drive: 1.5 }); // Alpha: mer sub
  playBuf(ac, out, t + 0.01, crackleBuf(ac, 0.22, (u) => 320 * (1 - u) + 10), { peak: 0.4, type: 'highpass', f: 2200 });
  N(ac, out, t + 0.01, { color: 'white', type: 'highpass', f: 4200, a: 0.01, d: 0.22, peak: 0.05 });
  return 0.35;
}
function cinderDeath(ac, out, send, t, o = {}) {
  // kitin knases og faller sammen → siste rallende utpust → glørne sprakar og slukner, varmen siver ut
  const k = sz(o), big = o.type === 'heavy' || o.type === 'kilnAlpha';
  playBuf(ac, out, t, clickBuf(ac, 0.4, cluster(Math.round(16 * k), 0.28), { f: [900, 3800], dec: [0.0015, 0.006], amp: [0.25, 1] }), { peak: 0.5 * Math.min(k, 1.2) });
  N(ac, out, t, { type: 'bandpass', f: 1400, q: 0.8, d: 0.18, peak: 0.3 * k, drive: 2.2 });
  T(ac, out, t + 0.12, { f: 75 / Math.sqrt(k), f2: 32, drop: 0.35, d: 0.45, peak: 0.55 * Math.min(k, 1.3), drive: 2 }); // kroppen treffer bakken
  N(ac, out, t + 0.12, { color: 'brown', type: 'lowpass', f: 500, d: 0.35, peak: 0.35 * k });
  growl(ac, out, t + 0.05, { f0: voiceOf(o) * 0.9, dur: 0.55 + 0.35 * k, peak: 0.12, bend: 0.55, fry: 24, breath: 0.7, a: 0.02 });
  const ed = isAlpha(o) ? 3.6 : big ? 2.6 : 1.8;
  if (isAlpha(o)) alphaSub(ac, out, send, t + 0.1, { f: 28, d: 1.8, peak: 0.45, tail: 2.6 });
  playBuf(ac, out, t + 0.1, crackleBuf(ac, ed, (u) => 260 * Math.pow(1 - u, 2.2) + 3), { peak: 0.42, type: 'highpass', f: 1800 });
  N(ac, out, t + 0.1, { color: 'pink', type: 'highpass', f: 3000, f2: 1800, a: 0.05, d: ed * 0.8, peak: 0.07 });
  N(ac, send, t + 0.1, { color: 'brown', type: 'lowpass', f: 400, d: 0.8, peak: 0.25 * k });
  if (big) { // kjernen ventilerer: dypt sukk av varme + dunk
    N(ac, out, t + 0.2, { color: 'pink', type: 'bandpass', f: 500, f2: 120, q: 0.8, a: 0.08, d: 1.4, peak: 0.3 });
    T(ac, out, t + 0.25, { f: 48, f2: 26, drop: 0.6, d: 0.9, peak: 0.45, drive: 1.8 });
  }
  return ed + 0.3;
}
function emberIdle(ac, out, send, t, o = {}) {
  // svakt brennende lag rundt en levende Cinderborn (planlegges glisent fra index.js tick)
  const d = rand(0.35, 0.7), big = o.type === 'heavy' || o.type === 'kilnAlpha';
  playBuf(ac, out, t, crackleBuf(ac, d, () => (big ? 40 : 22)), { peak: big ? 0.38 : 0.3, type: 'highpass', f: 1500, rate: rand(0.85, 1.15) });
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: big ? 900 : 2400, q: 0.7, a: d * 0.4, d: d * 0.6, peak: big ? 0.05 : 0.025 });
  return d + 0.05;
}

// ---------------------------------------------------------------- Spitter
function spitWindup(ac, out, send, t, o = {}) {
  // posen fylles: boblende gurgling som tetner + lav strupe
  const dur = clamp(o.duration ?? 0.75, 0.3, 1.2);
  for (let i = 0, n = 7; i < n; i++) { const tt = t + dur * Math.pow(i / n, 0.7); const f = rand(220, 520); T(ac, out, tt, { f, f2: f * 1.6, drop: 0.03, a: 0.003, d: 0.04, peak: 0.14 }); N(ac, out, tt, { type: 'bandpass', f: f * 2, q: 4, d: 0.03, peak: 0.06 }); }
  N(ac, out, t, { color: 'brown', type: 'bandpass', f: 320, f2: 780, q: 2.5, a: dur * 0.8, d: 0.12, peak: 0.12, sweep: dur });
  growl(ac, out, t + dur * 0.2, { f0: 84, dur: dur * 0.8, peak: 0.12, bend: 1.1, fry: 22, breath: 0.5, formants: [[260, 6, 1], [620, 7, 0.6], [1300, 8, 0.25]] });
  return dur + 0.15;
}
function spitPlop(ac, out, send, t) {
  // posen skytes ut: våt «plopp» (lukket munn som åpner seg) + slim + kort luft
  T(ac, out, t, { f: 150, f2: 520, drop: 0.035, a: 0.002, d: 0.05, peak: 0.45 });
  T(ac, out, t + 0.035, { f: 480, f2: 160, drop: 0.06, d: 0.07, peak: 0.22 });
  N(ac, out, t, { type: 'bandpass', f: 700, f2: 1500, q: 3, d: 0.07, peak: 0.25 });
  N(ac, out, t + 0.02, { color: 'pink', type: 'lowpass', f: 1200, d: 0.15, peak: 0.08 });
  return 0.25;
}
function sacSplat(ac, out, send, t, o = {}) {
  // posen treffer bakken: vått klask + bobler, så etsende fres til den sprekker (o.fuse)
  const fuse = clamp(o.fuse ?? 1.0, 0.3, 2);
  N(ac, out, t, { type: 'lowpass', f: 1600, q: 0.8, d: 0.08, peak: 0.45, drive: 2 });
  T(ac, out, t, { f: 120, f2: 60, drop: 0.06, d: 0.07, peak: 0.3 });
  for (let i = 0; i < 6; i++) { const tt = t + 0.05 + Math.random() * 0.35, f = rand(300, 800); T(ac, out, tt, { f, f2: f * 1.5, drop: 0.02, d: 0.025, peak: 0.05 }); }
  N(ac, out, t + 0.03, { color: 'white', type: 'highpass', f: 3500, a: 0.08, hold: fuse * 0.6, d: fuse * 0.4, peak: 0.07 });
  playBuf(ac, out, t + 0.03, crackleBuf(ac, fuse, (u) => 90 + 60 * u, { len: [0.0002, 0.0008], bright: 0.9 }), { peak: 0.2, type: 'highpass', f: 4000 });
  return fuse + 0.1;
}
function sacBounce(ac, out, send, t) {
  N(ac, out, t, { type: 'bandpass', f: 800, q: 1.4, d: 0.05, peak: 0.25 }); T(ac, out, t, { f: 140, f2: 80, drop: 0.04, d: 0.05, peak: 0.2 });
  return 0.1;
}
function acidBurst(ac, out, send, t) {
  // posen sprekker: vått smell + dunk, dråpesprut, kraftig etsende fres som dør ut
  N(ac, out, t, { type: 'lowpass', f: 2200, q: 0.7, d: 0.2, peak: 0.8, drive: 2.5 });
  T(ac, out, t, { f: 85, f2: 34, drop: 0.25, d: 0.4, peak: 0.75, drive: 2 });
  N(ac, out, t, { type: 'bandpass', f: 500, f2: 1600, q: 2, d: 0.12, peak: 0.35 });
  const drops = []; for (let i = 0; i < 26; i++) drops.push(0.05 + Math.pow(Math.random(), 1.5) * 0.7);
  playBuf(ac, out, t, clickBuf(ac, 0.9, drops.sort(), { f: [500, 1800], dec: [0.003, 0.01], amp: [0.1, 0.6] }), { peak: 0.35, type: 'lowpass', f: 3000 });
  N(ac, out, t + 0.04, { color: 'white', type: 'highpass', f: 2600, a: 0.03, hold: 0.35, d: 1.3, peak: 0.2 });
  playBuf(ac, out, t + 0.05, crackleBuf(ac, 1.4, (u) => 400 * Math.pow(1 - u, 1.5) + 20, { len: [0.0002, 0.001], bright: 0.9 }), { peak: 0.35, type: 'highpass', f: 3500 });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 900, d: 0.8, peak: 0.45 });
  return 1.8;
}

// ---------------------------------------------------------------- organiske fiendeskudd (v1.4.1)
// shot.weapon 'spine' (Husk), 'slag' (Kiln), 'acid' (Spitter → spitPlop). Matches eksakt i index.js.
function spineShot(ac, out, send, t, o = {}) {
  // benpigg: skarpt, tørt kitinsmell (ryggplatene slår sammen) + kort dunk i kroppen + pipende pigg som suser bort.
  // Pipet er smal båndpass-STØY (luft rundt en pigg), ikke en ren tone; tonehøyde og fall varierer per skudd.
  playBuf(ac, out, t, clickBuf(ac, 0.05, cluster(pick([2, 3]), 0.018), { f: [2200, 4800], dec: [0.0008, 0.0025], amp: [0.7, 1] }), { peak: 0.7 });
  N(ac, out, t, { type: 'bandpass', f: rand(2600, 3400), q: 1.6, d: 0.025, peak: 0.45, drive: 2.5 });
  N(ac, out, t, { type: 'highpass', f: 5000, d: 0.012, peak: 0.25 });
  T(ac, out, t, { f: rand(130, 160), f2: 70, drop: 0.035, d: 0.06, peak: 0.3, drive: 1.4 });
  // v1.4.1 'barb' (Lurcher, SMG-takt): samme oppskrift, men mindre pigg – høyere og kortere sus (se o.barb nedenfor)
  const w = rand(3600, 4600) * (o.barb ? 1.2 : 1), wd = rand(0.14, 0.24) * (o.barb ? 0.55 : 1);
  N(ac, out, t + 0.012, { type: 'bandpass', f: w, f2: w * rand(0.5, 0.62), q: rand(14, 22), a: 0.006, d: wd, peak: 0.55, sweep: wd });
  N(ac, out, t + 0.012, { color: 'pink', type: 'bandpass', f: w * 0.5, q: 3, a: 0.004, d: wd * 0.6, peak: 0.08 });
  return 0.32;
}
function slagSpray(ac, out, send, t, o = {}) {
  // Kiln-smeltesprut (automatisk takt): tungt «chug» fra halsen + gurglende magma (bobler med variert tonehøyde)
  // + fresende hvesing + gnistsprut. Hvert skudd trekkes på nytt (tonehøyde, antall bobler, lengde) så salven
  // ikke blir en maskingevær-loop. Voice-limit og minGap i CINDER_SOUNDS. Alpha: lavere og tyngre.
  const al = isAlpha(o) ? 0.75 : 1, k = rand(0.85, 1.15);
  T(ac, out, t, { f: 78 * al * k, f2: 40 * al, drop: 0.07, d: 0.13, peak: 0.42, drive: 2.2 });
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 520 * al, d: 0.09, peak: 0.42 * k });
  N(ac, out, t, { type: 'bandpass', f: rand(600, 900) * al, q: 1.6, d: 0.05, peak: 0.22, drive: 2 }); // våt utblåsning
  for (let i = 0, n = pick([2, 3, 3, 4]); i < n; i++) { // gurgle
    const tt = t + 0.01 + Math.random() * 0.12, f = rand(140, 380) * al;
    T(ac, out, tt, { f, f2: f * rand(1.4, 2.0), drop: rand(0.015, 0.03), a: 0.002, d: rand(0.03, 0.05), peak: rand(0.07, 0.14) });
  }
  N(ac, out, t + 0.02, { color: 'white', type: 'highpass', f: rand(3200, 4200), a: 0.012, d: rand(0.16, 0.28), peak: 0.09 }); // hvesing
  playBuf(ac, out, t + 0.01, crackleBuf(ac, 0.22, (u) => 220 * (1 - u) + 20), { peak: 0.26, type: 'highpass', f: 2000, rate: rand(0.85, 1.2) });
  return 0.34;
}

export const CINDER_SOUNDS = {
  spineShot:     { fn: spineShot,     gain: 0.6,  max: 4, minGap: 0.04, send: 0.08 },
  slagSpray:     { fn: slagSpray,     gain: 0.62, max: 3, minGap: 0.05, send: 0.1 },
  spawnWarn:     { fn: spawnWarn,     gain: 0.7, max: 3, minGap: 0,    send: 0.25 },
  spawnRise:     { fn: spawnRise,     gain: 0.7,  max: 3, minGap: 0,    send: 0.25 },
  chitinStep:    { fn: chitinStep,    gain: 0.5,  max: 4, minGap: 0.06, send: 0.05 },
  chitinRattle:  { fn: chitinRattle,  gain: 0.6,  max: 2, minGap: 0.2,  send: 0.1 },
  lurcherCharge: { fn: lurcherCharge, gain: 0.8,  max: 2, minGap: 0.2,  send: 0.1 },
  kilnSpinup:    { fn: kilnSpinup,    gain: 0.8,  max: 2, minGap: 0.3,  send: 0.15 },
  kilnSpindown:  { fn: kilnSpindown,  gain: 0.6,  max: 2, minGap: 0.3,  send: 0.15 },
  hitChitin:     { fn: hitChitin,     gain: 0.52, max: 4, minGap: 0.03, send: 0.08 },
  cinderDeath:   { fn: cinderDeath,   gain: 0.66, max: 4, minGap: 0.04, send: 0.2 },
  emberIdle:     { fn: emberIdle,     gain: 0.4,  max: 3, minGap: 0.05, send: 0.05 },
  spitWindup:    { fn: spitWindup,    gain: 0.7,  max: 2, minGap: 0.3,  send: 0.1 },
  spitPlop:      { fn: spitPlop,      gain: 0.75, max: 3, minGap: 0.08, send: 0.1 },
  sacSplat:      { fn: sacSplat,      gain: 0.7,  max: 3, minGap: 0.08, send: 0.1 },
  sacBounce:     { fn: sacBounce,     gain: 0.5,  max: 3, minGap: 0.05, send: 0.05 },
  acidBurst:     { fn: acidBurst,     gain: 0.85, max: 3, minGap: 0.05, send: 0.3 },
};
