// Breach – lyd: radio for mellomsekvenser (CINDER, v1.4.1). Krig mot en inntrenger fra under bakken.
// Alle Protocol-elementer (jingler, «on air»-pip, «signal lost»-bærebølge) er fjernet.
//   announcer = BROADCAST: nasjonal nødkringkasting – alvorlig, knitrete AM (smalt bånd, brum, fading, plystring)
//   command   = RADIO: militær feltradio – tastklikk, squelch-rykk inn og squelch-hale ut
//   warden    = hjelmradio – korte, tørre klikk
//   caption   = stum tekst – bare et dempet gulv
// Lydene går på egen radio-buss i motoren (dukkes IKKE); musikk og effekter dukkes under.
//
// Hendelser: cutsceneStart {id} · cutsceneLine {id, index, speaker, panel} · cutsceneEnd {id, skipped}
// Vanlig pause (world.paused uten cutscene-hendelser) får ALDRI radiostøy.
import { rand, chance, noiseBuffer, filter, chain, noiseLayer as N, toneLayer as T, clickLayer as C } from './synth.js';

export const CUTSCENE_EVENTS = { start: 'cutsceneStart', line: 'cutsceneLine', end: 'cutsceneEnd' };

/** speaker → { click: lyd ved ny replikk (null = ingen), bed: sus, crackle: knitring, am: AM-brum/fading/plystring (0..1) }. */
export const SPEAKER_SOUND = {
  announcer: { click: 'radioAnnouncer', bed: 0.050, crackle: 0.9,  am: 1.0 }, // BROADCAST: AM-nødsending
  command:   { click: 'radioCommand',   bed: 0.055, crackle: 0.8,  am: 0.0 }, // RADIO: feltradio
  warden:    { click: 'radioWarden',    bed: 0.034, crackle: 0.35, am: 0.0 }, // hjelmradio
  caption:   { click: null,             bed: 0.018, crackle: 0.18, am: 0.0 }, // dempet
};
export const IDLE_BED = { bed: 0.026, crackle: 0.3, am: 0.0 };

/**
 * Åpning per sekvens-id (src/story/cutscenes.js: intro, yard-clear, refinery-clear, foundry-core, ashmaw-rise, ending, fallen).
 * style: emergency = AM-nødsending med dyster varseltone (ingen jingel) · field = feltradio åpner (squelch)
 *        deep = feltradio dypt under bakken (tung forstyrrelse, rumling i signalet) · dawn = stille, rent signal
 *        quake = som deep, men sjakten skjelver: to dype støt, signalutfall og overstyrt sprak (ashmaw-rise)
 *        helmet = hjelmradio-rykk (Warden faller; ingen «signal lost»)
 */
export const OPENINGS = {
  intro:            { style: 'emergency' }, // evakueringen: nødkringkasting til sivile
  'yard-clear':     { style: 'field' },
  'refinery-clear': { style: 'field' },
  'foundry-core':   { style: 'deep' },
  'ashmaw-rise':    { style: 'quake' }, // v1.4.1: Ashmaw bryter opp – feltradio i et skjelvende sjakt, signalet faller ut
  ending:           { style: 'dawn' },  // v1.4.1 ny «Cold Dawn»: stille, rent signal (samme stil, ny tekst)
  fallen:           { style: 'helmet' },
  default:          { style: 'field' },
};
export const openingFor = (id) => OPENINGS[id] || OPENINGS.default;

// Radiobånd: 2× høypass + 2× lavpass (+ metning). AM: smalere og mørkere (250–2600 Hz), feltradio: 300–3000 Hz.
function band(ac, out, { lo = 300, hi = 3000, drive = 0 } = {}) {
  const a = filter(ac, 'highpass', lo, 0.7), b = filter(ac, 'highpass', lo, 0.7);
  const c = filter(ac, 'lowpass', hi, 0.7), d = filter(ac, 'lowpass', hi, 0.7);
  if (drive > 0) {
    const sh = ac.createWaveShaper(); const n = 1024, cu = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cu[i] = Math.tanh(x * drive) / Math.tanh(drive); }
    sh.curve = cu; chain(a, b, sh, c, d, out);
  } else chain(a, b, c, d, out);
  return a;
}
const amBand = (ac, out, drive = 1.8) => band(ac, out, { lo: 250, hi: 2600, drive });
function keyClick(ac, out, t, peak = 0.25) { C(ac, out, t, { f: 2400, peak, body: 0.6, d: 0.012 }); }
function crackles(ac, out, t, n, span, peak) {
  for (let i = 0; i < n; i++) N(ac, out, t + rand(0, span), { type: 'bandpass', f: rand(900, 2600), q: 1.5, d: rand(0.003, 0.012), peak: peak * rand(0.4, 1) });
}
// squelch: kort, hard støyflate når bæreren åpner/lukker
function squelch(ac, out, t, peak = 0.3, d = 0.11) { N(ac, out, t, { type: 'bandpass', f: rand(1800, 2400), q: 0.45, d, hold: 0.03, peak, drive: 3 }); }

// Dyster varseltone (nødkringkasting, i stedet for jingel): lav, uren dyade (E♭4 + A4, tritonus) i tre lange støt,
// gjennom AM-båndet med lett vibrato og ujevn styrke – som et sivilforsvarssignal på en dårlig sender.
function warningTone(ac, out, t, { n = 3, len = 0.62, gap = 0.22, peak = 0.07 } = {}) {
  for (let i = 0; i < n; i++) {
    const tt = t + i * (len + gap), pk = peak * (i === n - 1 ? 1.1 : 1) * rand(0.85, 1);
    for (const f of [311.13, 440 * 0.997]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const v = ac.createOscillator(); v.frequency.value = rand(4.5, 5.5); const vg = ac.createGain(); vg.gain.value = f * 0.004; v.connect(vg); vg.connect(o.frequency);
      const lp = filter(ac, 'lowpass', 1400, 0.7), g = ac.createGain(); const P = g.gain;
      P.setValueAtTime(0.0001, tt); P.exponentialRampToValueAtTime(pk, tt + 0.05); P.setValueAtTime(pk, tt + len - 0.08); P.exponentialRampToValueAtTime(0.0001, tt + len);
      o.connect(lp); lp.connect(g); g.connect(out);
      for (const x of [o, v]) { x.start(tt); x.stop(tt + len + 0.05); }
    }
  }
  return n * (len + gap);
}

// ---------- Engangslyder (registreres i SOUNDS, bus: 'radio') ----------

function bcastStart(ac, out, send, t, o = {}) {
  const st = openingFor(o.id).style;
  if (st === 'emergency') {
    // AM-nødsending: mottaker stilles inn (plystring som glir inn på frekvensen) → bærer → varseltone ×3
    const B = amBand(ac, out, 2);
    N(ac, B, t, { type: 'bandpass', f: 500, f2: 2200, q: 1.1, a: 0.1, d: 0.35, peak: 0.24, sweep: 0.45 });
    T(ac, B, t + 0.02, { f: 2400, f2: 900, drop: 0.4, a: 0.03, d: 0.45, peak: 0.035 });                     // heterodyn-plyst
    crackles(ac, B, t + 0.05, 10, 0.5, 0.3);
    T(ac, B, t + 0.35, { wave: 'sawtooth', f: 100, a: 0.08, hold: 2.4, d: 0.4, peak: 0.02 });             // nettbrum
    const w = warningTone(ac, B, t + 0.5);
    crackles(ac, B, t + 0.5, 12, w, 0.25);
    return 0.5 + w + 0.4;
  }
  if (st === 'helmet') {
    // Warden faller: hjelmradioen rykker – kort overstyrt støy og klikk (ingen bærebølge som dør)
    const B = band(ac, out, { lo: 400, hi: 2800, drive: 2.5 });
    keyClick(ac, B, t, 0.28);
    N(ac, B, t + 0.01, { type: 'bandpass', f: 1600, q: 0.6, d: o.short ? 0.12 : 0.28, hold: o.short ? 0 : 0.08, peak: 0.3, drive: 2.5 });
    crackles(ac, B, t + 0.02, o.short ? 3 : 7, o.short ? 0.14 : 0.4, 0.3);
    if (!o.short) keyClick(ac, B, t + rand(0.42, 0.5), 0.2);
    return o.short ? 0.3 : 0.7;
  }
  if (st === 'quake') {
    // Ashmaw: tastklikk → squelch → signalet kveles av to dype støt fra under gulvet (sub + grus i mikrofonen),
    // korte utfall (båndet kuttes) og overstyrt sprak. Ingen tone, ingen jingel.
    const B = band(ac, out, { drive: 3.5 });
    keyClick(ac, B, t, 0.3);
    squelch(ac, B, t + 0.01, 0.34, 0.12);
    crackles(ac, B, t + 0.04, 16, 1.1, 0.4);
    for (const [dt, k] of [[0.25, 1], [0.95, 0.8]]) {
      T(ac, out, t + dt, { f: 42, f2: 26, drop: 0.5, a: 0.01, d: 0.9, peak: 0.34 * k, drive: 1.6 });
      N(ac, out, t + dt, { color: 'brown', type: 'lowpass', f: 220, a: 0.01, hold: 0.15, d: 0.7, peak: 0.24 * k });
      N(ac, B, t + dt + 0.01, { type: 'bandpass', f: 900, q: 0.7, d: 0.12, peak: 0.28 * k, drive: 3 });          // mikrofonen overstyres
      N(ac, B, t + dt + 0.18, { type: 'bandpass', f: 2000, f2: 700, q: 0.9, a: 0.05, d: 0.35, peak: 0.1, sweep: 0.4 }); // signalet glir ut
    }
    N(ac, out, t + 0.2, { color: 'brown', type: 'lowpass', f: 120, a: 0.4, hold: 0.6, d: 1.0, peak: 0.1 });      // sjakten rumler videre
    return 2.0;
  }
  // field / deep / dawn: feltradio åpner
  const deep = st === 'deep', dawn = st === 'dawn';
  const B = band(ac, out, { drive: deep ? 3 : dawn ? 1 : 2.5 });
  keyClick(ac, B, t, dawn ? 0.18 : 0.3);
  squelch(ac, B, t + 0.01, dawn ? 0.14 : 0.32, dawn ? 0.08 : 0.12);
  crackles(ac, B, t + 0.04, dawn ? 2 : deep ? 12 : 6, deep ? 0.7 : 0.3, deep ? 0.36 : 0.28);
  if (deep) { // dypt nede: signalet sliter – fading-sveip og jordrumling som lekker inn i mikrofonen
    N(ac, B, t + 0.15, { type: 'bandpass', f: 1800, f2: 600, q: 0.9, a: 0.1, d: 0.6, peak: 0.16, sweep: 0.7 });
    N(ac, out, t + 0.1, { color: 'brown', type: 'lowpass', f: 140, a: 0.2, hold: 0.3, d: 0.8, peak: 0.12 });
    return 1.3;
  }
  return dawn ? 0.5 : 0.7;
}

function bcastEnd(ac, out, send, t, o = {}) {
  const st = openingFor(o.id).style;
  const B = st === 'emergency' ? amBand(ac, out) : band(ac, out, { drive: 1.6 });
  if (o.short) { keyClick(ac, B, t, 0.22); return 0.15; }                                  // kort fallen: bare tast av
  if (o.skipped) {                                                                          // hoppet over: brått kutt
    keyClick(ac, B, t, 0.32);
    N(ac, B, t + 0.004, { type: 'bandpass', f: 1600, q: 0.7, d: 0.08, peak: 0.25 });
    return 0.25;
  }
  if (st === 'emergency') { // AM: bæreren glir bort i sus (ingen tone)
    N(ac, B, t, { type: 'bandpass', f: 1400, f2: 500, q: 0.8, a: 0.03, d: 0.5, peak: 0.16, sweep: 0.5 });
    crackles(ac, B, t, 4, 0.3, 0.2);
    return 0.6;
  }
  squelch(ac, B, t, st === 'dawn' ? 0.1 : 0.24, 0.09);                                      // squelch-hale
  keyClick(ac, B, t + 0.12, 0.22);
  return 0.35;
}

function radioAnnouncer(ac, out, send, t, o = {}) {
  // BROADCAST: ny melding i nødsendingen – bæreren fader inn med et lite plyst og et knitrerykk (ingen pip)
  const B = amBand(ac, out, 2);
  N(ac, B, t, { type: 'bandpass', f: 900, f2: 1600, q: 1, a: 0.04, d: 0.2, peak: 0.14, sweep: 0.2 });
  T(ac, B, t + 0.01, { f: rand(1500, 2100), f2: rand(1100, 1400), drop: 0.2, a: 0.02, d: 0.22, peak: 0.02 });
  crackles(ac, B, t, 5, 0.25, 0.3);
  return 0.35;
}

function radioCommand(ac, out, send, t, o = {}) {
  // RADIO: militær feltradio – tastklikk og kraftig squelch-rykk, knitring
  const B = band(ac, out, { drive: 3 });
  keyClick(ac, B, t, 0.3);
  squelch(ac, B, t + 0.008, 0.3);
  crackles(ac, B, t + 0.02, 5, 0.22, 0.32);
  return 0.4;
}

function radioWarden(ac, out, send, t, o = {}) {
  // hjelmradio: to tette klikk og et lite pust av støy
  const B = band(ac, out, { lo: 400, hi: 2800, drive: 1.5 });
  keyClick(ac, B, t, 0.2);
  keyClick(ac, B, t + rand(0.03, 0.045), 0.12);
  N(ac, B, t + 0.01, { type: 'bandpass', f: 1500, q: 0.8, d: 0.06, peak: 0.1 });
  return 0.2;
}

function radioPanel(ac, out, send, t, o = {}) {
  // nytt bilde: myk støysveip (mottakeren driver litt) – ingen klikk
  const B = band(ac, out);
  N(ac, B, t, { type: 'bandpass', f: 2600, f2: 700, q: 0.9, a: 0.06, d: 0.25, peak: 0.14, sweep: 0.3 });
  return 0.4;
}

export const RADIO_SOUNDS = {
  bcastStart:     { fn: bcastStart,     gain: 0.7,  max: 1, minGap: 0.3,  send: 0.03, spatial: false, bus: 'radio' },
  bcastEnd:       { fn: bcastEnd,       gain: 0.7,  max: 1, minGap: 0.3,  send: 0.03, spatial: false, bus: 'radio' },
  radioAnnouncer: { fn: radioAnnouncer, gain: 0.6,  max: 2, minGap: 0.08, send: 0.03, spatial: false, bus: 'radio' },
  radioCommand:   { fn: radioCommand,   gain: 0.6,  max: 2, minGap: 0.08, send: 0.02, spatial: false, bus: 'radio' },
  radioWarden:    { fn: radioWarden,    gain: 0.6,  max: 2, minGap: 0.06, send: 0.02, spatial: false, bus: 'radio' },
  radioPanel:     { fn: radioPanel,     gain: 0.6,  max: 2, minGap: 0.1,  send: 0.02, spatial: false, bus: 'radio' },
};

// ---------- Støygulv (kontinuerlig mens en mellomsekvens pågår) ----------

let crackleBuf = null;
function crackleBuffer(ac) {
  if (crackleBuf && crackleBuf.sampleRate === ac.sampleRate) return crackleBuf;
  const sr = ac.sampleRate, len = sr * 4, b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
  const n = 70; // ~17 knepp/s
  for (let k = 0; k < n; k++) {
    const p = (Math.random() * (len - 600)) | 0, a = Math.random() ** 2 * (Math.random() < 0.5 ? -1 : 1), dl = 20 + ((Math.random() * 200) | 0);
    for (let i = 0; i < dl; i++) d[p + i] += a * Math.exp(-i / (dl * 0.3)) * (Math.random() * 2 - 1);
  }
  return (crackleBuf = b);
}

/** createBed(ac, dest) → { start(t?), setMode({bed, crackle}, t?), stop(t?), active } */
export function createBed(ac, dest) {
  let nodes = null;
  const bed = {
    active: false,
    start(t = ac.currentTime) {
      if (nodes) return;
      const out = ac.createGain(); out.gain.value = 0; out.connect(dest);
      const hiss = ac.createBufferSource(); hiss.buffer = noiseBuffer(ac, 'white'); hiss.loop = true;
      const hissG = ac.createGain(); hissG.gain.value = IDLE_BED.bed;
      hiss.connect(band(ac, hissG)); hissG.connect(out);
      const cr = ac.createBufferSource(); cr.buffer = crackleBuffer(ac); cr.loop = true; cr.playbackRate.value = rand(0.9, 1.1);
      const crG = ac.createGain(); crG.gain.value = IDLE_BED.crackle * 0.5;
      cr.connect(band(ac, crG, { drive: 1.5 })); crG.connect(out);
      // sakte svevning i nivået (bærebølgen «puster»)
      const lfo = ac.createOscillator(); lfo.frequency.value = rand(0.17, 0.3);
      const lfoG = ac.createGain(); lfoG.gain.value = 0.18; lfo.connect(lfoG); lfoG.connect(out.gain);
      // AM-lag (kun BROADCAST): 100 Hz nettbrum + svak heterodyn-plystring som vandrer + dyp fading
      const amG = ac.createGain(); amG.gain.value = 0; const amFade = ac.createGain(); amFade.gain.value = 0.65; amG.connect(amFade); amFade.connect(out);
      const amIn = amBand(ac, amG, 1.5);
      const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100; const humG = ac.createGain(); humG.gain.value = 0.014; hum.connect(humG); humG.connect(amIn);
      const wh = ac.createOscillator(); wh.frequency.value = rand(1700, 2100); const whG = ac.createGain(); whG.gain.value = 0.004; wh.connect(whG); whG.connect(amIn);
      const wd = ac.createOscillator(); wd.frequency.value = 0.07; const wdG = ac.createGain(); wdG.gain.value = 120; wd.connect(wdG); wdG.connect(wh.frequency);
      const amHiss = ac.createBufferSource(); amHiss.buffer = noiseBuffer(ac, 'pink'); amHiss.loop = true; const ahG = ac.createGain(); ahG.gain.value = 0.05; amHiss.connect(ahG); ahG.connect(amIn);
      const fad = ac.createOscillator(); fad.frequency.value = rand(0.11, 0.19); const fadG = ac.createGain(); fadG.gain.value = 0.35; fad.connect(fadG); fadG.connect(amFade.gain); // fading 0,3–1,0 (etter nivået → stille når am = 0)
      hiss.start(t, Math.random() * 2); cr.start(t, Math.random() * 3); lfo.start(t);
      for (const x of [hum, wh, wd, fad]) x.start(t); amHiss.start(t, Math.random() * 2);
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 0.35);
      nodes = { out, hiss, cr, lfo, hissG, crG, amG, am: [hum, wh, wd, fad, amHiss] }; bed.active = true;
    },
    setMode(m = IDLE_BED, t = ac.currentTime) {
      if (!nodes) return;
      nodes.hissG.gain.setTargetAtTime(m.bed, t, 0.12);
      nodes.crG.gain.setTargetAtTime(m.crackle * 0.5, t, 0.12);
      nodes.amG.gain.setTargetAtTime(m.am ?? 0, t, 0.15);
    },
    stop(t = ac.currentTime, fade = 0.35) {
      if (!nodes) return; const n = nodes; nodes = null; bed.active = false;
      n.out.gain.cancelScheduledValues(t); n.out.gain.setValueAtTime(n.out.gain.value, t); n.out.gain.linearRampToValueAtTime(0, t + fade);
      for (const s of [n.hiss, n.cr, n.lfo, ...n.am]) try { s.stop(t + fade + 0.05); } catch (_) {}
      if (typeof setTimeout !== 'undefined' && !(ac instanceof (globalThis.OfflineAudioContext || function () {}))) setTimeout(() => { try { n.out.disconnect(); } catch (_) {} }, (fade + 0.3) * 1000);
    },
  };
  return bed;
}
