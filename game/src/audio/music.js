// Breach – lyd: prosedyrisk musikk/stemning. CINDER (v1.4): under bakken, varmt og truende.
// Ambient: varm, lav drone (D) som «puster», jordrumling, steingnag, fjerne dype dunk nedenfra, svak glørknitring,
//          sjeldne fjerne kitinsvermer og (sjelden) metallklang fra basen. Ingen fabrikkpuls lenger.
// Kamp (setIntensity 0..1): taiko-aktige lave trommer (odaiko + mellomtromme + stramme kanter), metallslag på
//          bakslag, mørk bass-ostinato i D frygisk, spenningsflate øverst.
// Variasjon: mønstre trekkes tilfeldig per takt, fills, sannsynlighetsstyrte slag, langsomme LFO-er med ulike perioder.
import { rand, pick, chance, clamp, noiseBuffer, noiseLayer as N, toneLayer as T, metalLayer as M, filter } from './synth.js';
import { crackleBuf, clickBuf, playBuf, cluster } from './cinder.js';

const BPM = 88;
const STEP = 60 / BPM / 4; // 16-deler
const ROOT = 36.71; // D1
const SCALE = [0, 1, 3, 5, 7, 8, 10]; // frygisk
const semi = (n) => Math.pow(2, n / 12);

// 16-trinns mønstre (1 = slag, 0.5 = svakt slag). Taiko-tenkning: få, tunge odaiko-slag; mellomtromma bærer drivet.
const ODAIKO = [
  [1,0,0,0, 0,0,0,0, 1,0,0,0.6, 0,0,0,0],
  [1,0,0,0, 0,0,0.6,0, 0,0,1,0, 0,0,0,0],
  [1,0,0,0.5, 0,0,0,0, 1,0,0,0, 0,0,0.6,0],
  [1,0,0,0, 0,0,0,0, 0,0,1,0, 1,0,0,0],
];
const MID = [
  [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,0.6,1,0],
  [0,0,0.6,0, 1,0,0,1, 0,0,0.6,0, 1,0,0,0],
  [0,1,0,0.6, 0,0,1,0, 0,1,0,0.6, 0,0,1,0],
];
const METAL = [
  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
  [0,0,0,0, 1,0,0,0, 0,0,0,0, 0.7,0,1,0],
  [0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
];
const FILL = [1,0,0.5,0, 0.6,0,0.6,0.5, 0.7,0.5,0.8,0.6, 0.9,0.8,1,1]; // mellomtromme-crescendo
const BASS = [
  [0,null,0,0, 1,null,0,null],
  [0,0,null,0, 3,null,1,null],
  [0,null,0,1, 0,null,-2,null],
  [0,0,0,null, 5,null,3,1],
];

export function createMusic(ac, dest, revSend) {
  const out = ac.createGain(); out.gain.value = 1; out.connect(dest);
  const ambient = ac.createGain(); ambient.gain.value = 0.7; ambient.connect(out);
  const combat = ac.createGain(); combat.gain.value = 0; combat.connect(out);
  const tension = ac.createGain(); tension.gain.value = 0; tension.connect(out);
  const wet = ac.createGain(); wet.gain.value = 1; if (revSend) wet.connect(revSend);
  const cWet = ac.createGain(); cWet.gain.value = 0; cWet.connect(wet); // kamp-romsend følger kampnivået

  let fadeTok = 0;
  let intensity = 0, started = false, nextStep = 0, step = 0, bar = 0;
  let oda = ODAIKO[0], mid = MID[0], metal = METAL[0], bass = BASS[0];
  let nextClang = 0, nextVent = 0, nextThud = 0, nextGroan = 0, nextSwarm = 0, nextEmber = 0;
  const sustained = [];
  let tensionLP = null;

  function lfo(freq, depth, param, type = 'sine') {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); sustained.push(o);
  }
  function loopNoise(color) {
    const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac, color); s.loop = true; s.start(0, Math.random() * 2); sustained.push(s); return s;
  }
  function panned(gain, p = rand(-0.9, 0.9), toWet = true) {
    const g = ac.createGain(); g.gain.value = gain;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (pan.pan) pan.pan.value = p;
    g.connect(pan); pan.connect(ambient); if (toWet) pan.connect(wet); return g;
  }

  function start(t = ac.currentTime) {
    if (started) { // v1.4.1: start() midt i en fadeOut → avbryt stoppen og løft nivået igjen (ellers ble musikken borte)
      fadeTok++;
      for (const g of [out, wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.linearRampToValueAtTime(1, t + 1.5); }
      return;
    }
    started = true; fadeTok++;
    for (const g of [out, wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 1.5); }
    // --- varm drone: myke bølgeformer (trekant/sinus) + én dempet sagtann for kropp; «puster» med langsomt filter/volum ---
    const lp = filter(ac, 'lowpass', 210, 1.2);
    const dg = ac.createGain(); dg.gain.value = 0.15;
    [[ROOT, 'sine', 0, 0.6], [ROOT * 2, 'triangle', -5, 0.45], [ROOT * 2, 'triangle', 6, 0.45], [ROOT * 3, 'sine', 3, 0.18], [ROOT * 2, 'sawtooth', 0, 0.12], [ROOT * 2 * semi(1), 'sine', 0, 0.05]]
      .forEach(([f, w, det, gv]) => {
        const o = ac.createOscillator(); o.type = w; o.frequency.value = f; o.detune.value = det;
        const g = ac.createGain(); g.gain.value = gv; o.connect(g); g.connect(lp); o.start(t); sustained.push(o);
      });
    lp.connect(dg); dg.connect(ambient); dg.connect(wet);
    lfo(0.029, 70, lp.frequency); lfo(0.011, 30, lp.frequency, 'triangle'); lfo(0.067, 0.05, dg.gain); // pust
    // --- jordrumling: resonant brun støy dypt nede, langsomme bølger ---
    const rb = filter(ac, 'bandpass', 62, 2.2); const rg = ac.createGain(); rg.gain.value = 0.28;
    loopNoise('brown').connect(rb); rb.connect(rg); rg.connect(ambient);
    lfo(0.041, 18, rb.frequency); lfo(0.019, 0.12, rg.gain);
    // --- varmeflimmer: svak, lav mellomtone-sus som vandrer (ikke luftanlegg – varm luft fra sprekker) ---
    const hb = filter(ac, 'bandpass', 520, 2.5); const hg = ac.createGain(); hg.gain.value = 0.03;
    const hp = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
    loopNoise('pink').connect(hb); hb.connect(hg); hg.connect(hp); hp.connect(ambient); hp.connect(wet);
    lfo(0.017, 220, hb.frequency); lfo(0.0061, 120, hb.frequency, 'triangle');
    if (hp.pan) lfo(0.025, 0.6, hp.pan);
    lfo(0.037, 0.018, hg.gain);
    // --- spenningsflate (kamp): mørk klynge, lavpasset ---
    tensionLP = filter(ac, 'lowpass', 360, 1.2);
    [[ROOT * 4, -9], [ROOT * 4, 9], [ROOT * 4 * semi(1), 0], [ROOT * 4 * semi(7), 5], [ROOT * 8 * semi(3), -6]].forEach(([f, det]) => {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const g = ac.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(tensionLP); o.start(t); sustained.push(o);
    });
    tensionLP.connect(tension); tension.connect(wet);
    lfo(0.09, 100, tensionLP.frequency);
    nextStep = t + 0.1; nextClang = t + rand(12, 25); nextVent = t + rand(4, 9); nextThud = t + rand(2, 5);
    nextGroan = t + rand(5, 10); nextSwarm = t + rand(10, 20); nextEmber = t + rand(1, 3);
  }

  /** Kontrollert avslutning: myk nedtoning, deretter stopp. Neste start() løfter nivået igjen. */
  function fadeOut(dur = 2.5, t = ac.currentTime) {
    if (!started) return;
    for (const g of [out, wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    const tok = ++fadeTok;
    if (typeof OfflineAudioContext === 'undefined' || !(ac instanceof OfflineAudioContext)) setTimeout(() => { if (tok === fadeTok) stop(); }, dur * 1000 + 100);
  }
  function stop() { sustained.forEach((n) => { try { n.stop(); } catch (_) {} }); sustained.length = 0; started = false; }

  function setIntensity(v, smooth = 1.2) {
    intensity = clamp(v, 0, 1);
    const t = ac.currentTime;
    combat.gain.setTargetAtTime(Math.pow(intensity, 0.8) * 0.7, t, smooth);
    cWet.gain.setTargetAtTime(Math.pow(intensity, 0.8) * 0.7, t, smooth);
    tension.gain.setTargetAtTime(intensity > 0.45 ? Math.pow((intensity - 0.45) / 0.55, 2) * 0.045 : 0, t, smooth * 1.5);
    ambient.gain.setTargetAtTime(0.7 - intensity * 0.3, t, smooth);
  }

  // ---- ambient-hendelser ----
  function thud(t) { // noe stort beveger seg dypt under: ett eller to dype, dempede dunk (som et fjernt hjerte)
    const g = panned(rand(0.5, 0.9), rand(-0.6, 0.6));
    const n = chance(0.4) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const tt = t + i * rand(0.38, 0.5), k = i ? 0.7 : 1;
      T(ac, g, tt, { f: 48, f2: 30, drop: 0.25, a: 0.02, d: 0.9, peak: 0.28 * k, lp: 140, drive: 1.3 });
      N(ac, g, tt, { color: 'brown', type: 'lowpass', f: 180, a: 0.02, d: 0.6, peak: 0.2 * k });
    }
    if (chance(0.5)) playBuf(ac, g, t + 0.15, crackleBuf(ac, 1.2, (u) => 25 * (1 - u) + 2, { len: [0.003, 0.01], bright: 0.2 }), { peak: 0.25, type: 'lowpass', f: 800 }); // grus drysser
  }
  function groan(t) { // stein/jord som gnager: resonant sveip i brun støy, lett forvrengt
    const g = panned(1);
    const d = rand(1.8, 3.2);
    N(ac, g, t, { color: 'brown', type: 'bandpass', f: rand(55, 80), f2: rand(110, 170), q: 7, a: d * 0.5, hold: 0.2, d: d * 0.5, peak: 0.35, drive: 2, sweep: d });
    N(ac, g, t + d * 0.3, { color: 'pink', type: 'bandpass', f: rand(250, 400), q: 4, a: d * 0.3, d: d * 0.4, peak: 0.04 });
  }
  function swarm(t) { // fjern kitinsverm i veggene: klikkesky, sterkt dempet og mest romklang
    const d = rand(1.5, 3), pan = rand(-1, 1);
    const g = ac.createGain(); g.gain.value = 1;
    const p = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (p.pan) p.pan.value = pan;
    g.connect(p); p.connect(wet); const dry = ac.createGain(); dry.gain.value = 0.35; p.connect(dry); dry.connect(ambient);
    const b = clickBuf(ac, d, cluster(Math.round(d * 70), d), { f: [1800, 3600], dec: [0.001, 0.003], amp: [0.1, 0.6] });
    const v = playBuf(ac, g, t, b, { peak: 0.0001, type: 'lowpass', f: 2400 });
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.06, t + d * 0.5); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  }
  function ember(t) { // svak glørknitring fra sprekkene
    const g = panned(1, rand(-0.8, 0.8), false);
    playBuf(ac, g, t, crackleBuf(ac, rand(1, 2.5), () => rand(6, 14)), { peak: 0.06, type: 'bandpass', f: 2800, q: 0.6 });
  }
  function vent(t) { // varm damp/gass siver fra en sprekk
    const g = panned(1);
    N(ac, g, t, { color: 'pink', type: 'bandpass', f: rand(700, 1300), f2: rand(400, 700), q: 1.2, a: 0.4, hold: rand(0.5, 1.5), d: 1.2, peak: 0.03 });
  }
  function clang(t) { // sjelden: basen ovenfor – fjern metallklang, dempet
    const f = rand(70, 180);
    const g = panned(rand(0.15, 0.3));
    const lp = filter(ac, 'lowpass', rand(900, 1800), 0.7); lp.connect(g);
    M(ac, lp, t, { f, ratios: pick([[1, 2.76, 5.4, 8.93], [1, 1.59, 2.14, 2.65, 3.91]]), d: rand(2, 4), peak: 0.5, decayTilt: 0.82, spread: 0.01 });
  }

  // ---- kamp: taiko + metall ----
  function odaiko(t, v) { // stor, lav tromme: dyp tonehøyde-fall, hudens dunk, kroppsresonans, litt rom
    T(ac, combat, t, { f: 68, f2: 43, drop: 0.14, d: 0.75, peak: 0.55 * v, drive: 1.4 });
    N(ac, combat, t, { color: 'brown', type: 'lowpass', f: 380, d: 0.16, peak: 0.45 * v });
    N(ac, combat, t, { type: 'bandpass', f: 1100, q: 0.8, d: 0.025, peak: 0.2 * v }); // køllen
    N(ac, combat, t, { type: 'bandpass', f: rand(2800, 3600), q: 1.2, d: 0.014, peak: 0.32 * v, drive: 1.5 }); // v1.4.1: attack – kølle mot skinn
    N(ac, combat, t, { color: 'pink', type: 'bandpass', f: 115, q: 3, d: 0.45, peak: 0.3 * v });
    N(ac, cWet, t, { color: 'brown', type: 'lowpass', f: 500, d: 0.4, peak: 0.35 * v });
  }
  function midDrum(t, v) { // nagado/okedo-aktig: strammere, kortere
    const f = rand(118, 128);
    T(ac, combat, t, { f, f2: f * 0.72, drop: 0.06, d: 0.24, peak: 0.32 * v, drive: 1.3 });
    N(ac, combat, t, { type: 'bandpass', f: 320, q: 1.4, d: 0.09, peak: 0.25 * v });
    N(ac, combat, t, { type: 'bandpass', f: 1600, q: 1, d: 0.018, peak: 0.1 * v });
    N(ac, combat, t, { type: 'bandpass', f: rand(3000, 4000), q: 1.4, d: 0.011, peak: 0.22 * v }); // attack
    N(ac, cWet, t, { type: 'bandpass', f: 300, q: 1, d: 0.15, peak: 0.12 * v });
  }
  function rim(t, v) { // stramt kantslag (shime) – erstatter hi-hat
    N(ac, combat, t, { type: 'bandpass', f: rand(2800, 3400), q: 2.2, d: 0.03, peak: 0.16 * v });
    T(ac, combat, t, { f: 400, f2: 330, drop: 0.02, d: 0.04, peak: 0.05 * v });
  }
  function metalHit(t, v) { // amboss/plate på bakslag: inharmonisk klang + tungt slag
    M(ac, combat, t, { f: rand(170, 230), ratios: [1, 2.32, 3.41, 4.86, 6.3], d: 0.9, peak: 0.2 * v, decayTilt: 0.75, spread: 0.02 });
    N(ac, combat, t, { type: 'bandpass', f: 1300, q: 0.9, d: 0.06, peak: 0.25 * v, drive: 2 });
    T(ac, combat, t, { f: 150, f2: 90, drop: 0.04, d: 0.12, peak: 0.25 * v });
    M(ac, combat, t, { f: rand(1300, 1600), ratios: [1, 1.48, 2.21, 2.9], d: 0.35, peak: 0.09 * v, decayTilt: 0.7 }); // platekanten
    M(ac, combat, t, { f: rand(2600, 3100), ratios: [1, 1.34, 1.79], d: 0.26, peak: 0.12 * v, decayTilt: 0.7 }); // v1.4.1: ambolt-«tink»
    N(ac, combat, t, { type: 'highpass', f: 3500, d: 0.018, peak: 0.2 * v }); // anslag
    M(ac, cWet, t, { f: rand(170, 230), ratios: [1, 2.32, 3.41], d: 1.2, peak: 0.12 * v });
  }
  function kane(t, v) { // v1.4.1: atarigane (liten messinggong i taiko-ensemble) – metall og drive på åttedeler
    M(ac, combat, t, { f: rand(1850, 2050), ratios: [1, 1.52, 2.41, 3.3], d: 0.14, peak: 0.12 * v, decayTilt: 0.6, spread: 0.01 });
    N(ac, combat, t, { type: 'bandpass', f: 4200, q: 2, d: 0.012, peak: 0.09 * v });
  }
  function dBass(t, deg, len) { // mørk og varm: trekant + sub, lavpass som åpner litt med intensiteten
    const oct = Math.floor(deg / 7), idx = ((deg % 7) + 7) % 7;
    const f = ROOT * 2 * semi(SCALE[idx] + 12 * oct);
    const lp = filter(ac, 'lowpass', 110, 2.5);
    lp.frequency.setValueAtTime(130 + 500 * intensity, t);
    lp.frequency.exponentialRampToValueAtTime(100, t + len * 0.9);
    const g = ac.createGain(); g.connect(combat);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.17, t + 0.012);
    g.gain.setTargetAtTime(0.0001, t + len * 0.6, len * 0.2);
    lp.connect(g);
    [['sawtooth', 0, 0.5], ['triangle', 7, 1]].forEach(([w, det, gv]) => { const o = ac.createOscillator(); o.type = w; o.frequency.value = f; o.detune.value = det; const og = ac.createGain(); og.gain.value = gv; o.connect(og); og.connect(lp); o.start(t); o.stop(t + len + 0.2); });
    const sub = ac.createOscillator(); sub.frequency.value = f / 2; const sg = ac.createGain(); sg.gain.value = 0.55; sub.connect(sg); sg.connect(g); sub.start(t); sub.stop(t + len + 0.2);
  }

  function scheduleStep(t, s) {
    // ambient
    if (t >= nextThud) { thud(t); nextThud = t + rand(4, 10); }
    if (t >= nextGroan) { groan(t); nextGroan = t + rand(9, 18); }
    if (t >= nextSwarm) { swarm(t); nextSwarm = t + rand(14, 30); }
    if (t >= nextEmber) { ember(t); nextEmber = t + rand(3, 7); }
    if (t >= nextVent) { vent(t); nextVent = t + rand(8, 16); }
    if (t >= nextClang) { clang(t); nextClang = t + rand(18, 40); }
    // kamp
    if (intensity > 0.04) {
      const i = s % 16; const fill = bar % 4 === 3 && i >= 8 && intensity > 0.55;
      if (oda[i] && !(fill && i > 8)) odaiko(t, oda[i] * (0.75 + 0.25 * intensity));
      if (intensity > 0.2) { const m = fill ? FILL[i] : mid[i]; if (m) midDrum(t, m * (0.6 + 0.4 * intensity)); }
      if (intensity > 0.35 && metal[i] && !fill) metalHit(t, metal[i] * (0.7 + 0.3 * intensity));
      if (fill && i === 15) metalHit(t + STEP * 0.5, 0.8);
      if (intensity > 0.65 && (i % 2 === 0 || chance(0.25 * intensity))) rim(t, i % 4 === 2 ? 1 : 0.5);
      if (intensity > 0.5 && i % 2 === 1 && !fill) kane(t, (i % 4 === 3 ? 1 : 0.6) * (0.5 + 0.5 * intensity));
      if (i % 2 === 0) {
        const deg = bass[i / 2];
        if (deg !== null && !(intensity < 0.2 && i / 2 % 2 === 1)) dBass(t, deg, STEP * 2);
      }
    }
  }

  /** Planlegg hendelser fram til tEnd (lookahead-scheduler). */
  function scheduleUntil(tEnd) {
    if (!started) return;
    while (nextStep < tEnd) {
      if (step % 16 === 0) {
        bar++;
        oda = chance(0.7) ? oda : pick(ODAIKO);
        mid = chance(0.6) ? mid : pick(MID);
        metal = chance(0.7) ? metal : pick(METAL);
        if (bar % 2 === 1) bass = pick(BASS);
      }
      scheduleStep(nextStep, step);
      step++; nextStep += STEP;
    }
  }

  function update(dt) { if (started) scheduleUntil(ac.currentTime + 0.3); }

  return { start, stop, fadeOut, update, scheduleUntil, setIntensity, get intensity() { return intensity; }, output: out };
}
