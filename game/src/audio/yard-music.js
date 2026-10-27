// v1.7 (koblet inn for brett 1, arenaLoaded id 'yard'): bakgrunnsmusikk for Kessa Yard (brett 1). Samme grensesnitt som music.js:
//   createYardMusic(ac, dest, revSend) → { start, stop, fadeOut, update, scheduleUntil, setIntensity, duck, intensity, output }
// Mørk og drivende, 100 BPM, D frygisk. Lag: sub-drone + mørk pad (alltid), «hjerteslag»-odaiko (rolig),
// maskinpuls i lave mellomtoner + bass-ostinato på 16-deler + mellomtromme + flere odaiko (kamp), dempet metallslag.
// Frekvensplan: alt musikalsk innhold < ~900 Hz; 1–4 kHz kuttes aktivt (peaking −10 dB @ 2,2 kHz + lavpass 5 kHz med
// skrå hylle) så skudd, varsler og radio eier det området. Ducking: duck(t, dB, ms) fra 'shot'/'explosion'/'waveStart'.
import { rand, pick, chance, clamp, noiseBuffer, noiseLayer as N, toneLayer as T, metalLayer as M, filter } from './synth.js';

const LEVEL = 0.25; // ≈ −12 dB: musikken ligg 10–14 dB under SFX i kamp
const BPM = 100, STEP = 60 / BPM / 4, ROOT = 36.71; // D1
const SCALE = [0, 1, 3, 5, 7, 8, 10];
const semi = (n) => Math.pow(2, n / 12);
const ODA_CALM = [1,0,0,0, 0,0,0,0, 0,0,0.55,0, 0,0,0,0];           // hjerteslag: «dunk … du-dunk»
const ODA = [[1,0,0,0, 0,0,1,0, 0,0,0.7,0, 1,0,0,0], [1,0,0,0.5, 0,0,0,0, 1,0,0.6,0, 0,0,1,0], [1,0,0,0, 1,0,0,0.5, 0,0,1,0, 0,0.6,0,0]];
const MID = [[0,0,1,0, 0,1,0,0.5, 0,0,1,0, 0,1,0,0], [0,0.5,0,1, 0,0,1,0, 0,0.5,0,1, 0,0,1,0.6]];
const BASS = [[0,0,0,0, 0,0,1,0, 0,0,0,0, 3,0,1,0], [0,0,0,0, 0,0,-2,0, 0,0,0,0, 1,0,0,-2], [0,0,0,0, 5,0,3,0, 0,0,1,0, 0,0,-2,0]];
const FILL = [0,0,0,0, 0,0,0,0, 0.6,0,0.7,0.5, 0.8,0.7,0.9,1];

export function createYardMusic(ac, dest, revSend) {
  const out = ac.createGain(); out.gain.value = 0;
  // utgangs-EQ: hold unna skudd/varsler
  const notch = ac.createBiquadFilter(); notch.type = 'peaking'; notch.frequency.value = 2200; notch.Q.value = 0.6; notch.gain.value = -10;
  const lp = filter(ac, 'lowpass', 5000, 0.5);
  const duckG = ac.createGain(); duckG.gain.value = 1;
  out.connect(notch); notch.connect(lp); lp.connect(duckG); duckG.connect(dest);
  const wet = ac.createGain(); wet.gain.value = 0.5; if (revSend) wet.connect(revSend);
  const bed = ac.createGain(); bed.gain.value = 1; bed.connect(out);
  const calm = ac.createGain(); calm.gain.value = 1; calm.connect(out);
  const combat = ac.createGain(); combat.gain.value = 0; combat.connect(out); combat.connect(wet);
  const sustained = [];
  let started = false, intensity = 0, nextStep = 0, step = 0, bar = 0, oda = ODA[0], mid = MID[0], bass = BASS[0], padLP = null;

  function lfo(f, depth, param) { const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); sustained.push(o); }

  function start(t = ac.currentTime) {
    if (started) return; started = true;
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(LEVEL, t + 2);
    // sub-drone D1/D2 + mørk pad (D, Eb, A) gjennom lavpass som åpner med intensiteten
    padLP = filter(ac, 'lowpass', 260, 1.4);
    const pg = ac.createGain(); pg.gain.value = 0.11; padLP.connect(pg); pg.connect(bed); pg.connect(wet);
    [[ROOT, 'sine', 0, 0.9], [ROOT * 2, 'sawtooth', -7, 0.35], [ROOT * 2, 'sawtooth', 7, 0.35], [ROOT * 3, 'triangle', 0, 0.25],
     [ROOT * 4 * semi(1), 'sawtooth', 4, 0.1], [ROOT * 4 * semi(7), 'sawtooth', -4, 0.12]].forEach(([f, w, d, g]) => {
      const o = ac.createOscillator(); o.type = w; o.frequency.value = f; o.detune.value = d; const gg = ac.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(padLP); o.start(t); sustained.push(o); });
    lfo(0.05, 60, padLP.frequency); lfo(0.083, 0.025, pg.gain);
    // industriell luft: brun støy rundt 90 Hz (verkshall) – ingen sus i 1–4 kHz
    const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac, 'brown'); s.loop = true; s.start(t); sustained.push(s);
    const bp = filter(ac, 'bandpass', 90, 1.5); const ng = ac.createGain(); ng.gain.value = 0.22; s.connect(bp); bp.connect(ng); ng.connect(bed); lfo(0.031, 25, bp.frequency);
    nextStep = t + 0.05;
  }
  function stop() { sustained.forEach((n) => { try { n.stop(); } catch (_) {} }); sustained.length = 0; started = false; }
  function fadeOut(dur = 2.5, t = ac.currentTime) { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t); out.gain.linearRampToValueAtTime(0.0001, t + dur); }
  function setIntensity(v, t = ac.currentTime, smooth = 1.5) {
    intensity = clamp(v, 0, 1);
    combat.gain.setTargetAtTime(0.45 * Math.pow(intensity, 0.9), t, smooth);
    calm.gain.setTargetAtTime(1 - 0.6 * intensity, t, smooth);
    bed.gain.setTargetAtTime(1 - 0.25 * intensity, t, smooth);
    if (padLP) padLP.frequency.setTargetAtTime(260 + 380 * intensity, t, smooth * 2);
  }
  /** Sidechain: dukk musikken `db` dB med rask attack (15 ms) og slipp over `ms`. Kalles fra 'shot' (−4 dB), explosion (−8), waveStart-signal (−6). */
  function duck(t = ac.currentTime, db = 4, ms = 220) {
    const g = duckG.gain, target = Math.pow(10, -db / 20);
    g.cancelScheduledValues(t); g.setValueAtTime(Math.min(g.value, 1), t); g.linearRampToValueAtTime(target, t + 0.015); g.setTargetAtTime(1, t + 0.03, ms / 3000);
  }

  // ---- instrumenter (alle lavpasset) ----
  function odaiko(t, v, to = combat) {
    T(ac, to, t, { f: 82, f2: 41, drop: 0.12, d: 0.75, peak: 0.55 * v, lp: 260, drive: 1.4 });
    N(ac, to, t, { color: 'brown', type: 'lowpass', f: 320, d: 0.35, peak: 0.45 * v });
    N(ac, to, t, { type: 'bandpass', f: 600, q: 1.2, d: 0.03, peak: 0.12 * v }); // skinnanslag, under 1 kHz
  }
  function midDrum(t, v) {
    T(ac, combat, t, { f: 150, f2: 105, drop: 0.05, d: 0.22, peak: 0.28 * v, lp: 600 });
    N(ac, combat, t, { color: 'pink', type: 'bandpass', f: rand(380, 480), q: 1.4, d: 0.08, peak: 0.22 * v });
  }
  function machine(t, v) { // maskinpuls (presse/stempel), lav og tørr
    N(ac, combat, t, { color: 'pink', type: 'bandpass', f: 700, q: 3, d: 0.045, peak: 0.07 * v, drive: 1.5 });
    T(ac, combat, t, { wave: 'square', f: 55, d: 0.05, peak: 0.05 * v, lp: 300 });
  }
  function metal(t, v) { // dempet ambolt, kun lave partialer
    M(ac, combat, t, { f: rand(110, 140), ratios: [1, 2.32, 3.41, 4.86], d: 1.1, peak: 0.16 * v, decayTilt: 0.6 });
    T(ac, combat, t, { f: 120, f2: 70, drop: 0.05, d: 0.2, peak: 0.25 * v });
  }
  function bassNote(t, deg, len, v) {
    const oct = Math.floor(deg / 7), idx = ((deg % 7) + 7) % 7, f = ROOT * 2 * semi(SCALE[idx] + 12 * oct);
    const l = filter(ac, 'lowpass', 140 + 360 * intensity, 3); const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15 * v, t + 0.01); g.gain.setTargetAtTime(0.0001, t + len * 0.5, len * 0.25);
    l.connect(g); g.connect(combat);
    for (const [w, d] of [['sawtooth', 0], ['sawtooth', 9]]) { const o = ac.createOscillator(); o.type = w; o.frequency.value = f; o.detune.value = d; o.connect(l); o.start(t); o.stop(t + len + 0.3); }
  }

  function scheduleStep(t, s) {
    const i = s % 16, I = intensity;
    if (ODA_CALM[i]) odaiko(t, ODA_CALM[i] * 0.55, calm);           // rolig puls hele tida (dempes i kamp)
    if (I > 0.08) {
      const fill = bar % 8 === 7 && I > 0.6;
      if (oda[i] && !(fill && i >= 8)) odaiko(t, oda[i] * (0.6 + 0.4 * I));
      if (fill && FILL[i]) midDrum(t, FILL[i]);
      else if (I > 0.3 && mid[i]) midDrum(t, mid[i] * (0.5 + 0.5 * I));
      if (I > 0.45) machine(t, (i % 4 === 0 ? 1 : 0.55) * I);       // 16-dels drivet
      if (I > 0.6 && (i === 4 || i === 12) && !fill) metal(t, 0.8 * I);
      if (I > 0.2) bassNote(t, bass[i] ?? 0, STEP * 0.9, (i % 4 === 0 ? 1 : 0.6) * (0.5 + 0.5 * I));
    }
  }
  function scheduleUntil(tEnd) {
    if (!started) return;
    while (nextStep < tEnd) {
      if (step % 16 === 0) { bar++; if (bar % 2 === 0) { oda = chance(0.6) ? oda : pick(ODA); mid = pick(MID); } if (bar % 4 === 0) bass = pick(BASS); }
      scheduleStep(nextStep, step); step++; nextStep += STEP;
    }
  }
  return { start, stop, fadeOut, update() { if (started) scheduleUntil(ac.currentTime + 0.3); }, scheduleUntil, setIntensity, duck, get intensity() { return intensity; }, output: out };
}
