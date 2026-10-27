// Breach – lyd: grunnleggende synteseklosser (fungerer både i AudioContext og OfflineAudioContext).
// Ingen avhengigheter. Alle funksjoner tar (ac, out, t, opts) og kobler noder til `out`.

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const caches = new WeakMap();
function cache(ac) {
  let c = caches.get(ac);
  if (!c) { c = { noise: {}, curves: {} }; caches.set(ac, c); }
  return c;
}

/** Støybuffer (mono, 3 s) – 'white' | 'pink' | 'brown'. Caches per kontekst. */
export function noiseBuffer(ac, color = 'white') {
  const c = cache(ac);
  if (c.noise[color]) return c.noise[color];
  const sr = ac.sampleRate, len = Math.floor(sr * 3);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    let v;
    if (color === 'brown') { last = (last + 0.02 * w) / 1.02; v = last; }
    else if (color === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    } else v = w;
    d[i] = v; const a = Math.abs(v); if (a > peak) peak = a;
  }
  const norm = 0.95 / (peak || 1);
  for (let i = 0; i < len; i++) d[i] *= norm;
  c.noise[color] = buf;
  return buf;
}

/** Myk metning (tanh), caches per drive-verdi. */
export function shaper(ac, drive = 2) {
  const c = cache(ac); const key = drive.toFixed(2);
  let curve = c.curves[key];
  if (!curve) {
    const n = 2048; curve = new Float32Array(n);
    const k = Math.tanh(drive);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * drive) / k; }
    c.curves[key] = curve;
  }
  const ws = ac.createWaveShaper(); ws.curve = curve; ws.oversample = '2x';
  return ws;
}

export function filter(ac, type, freq, Q = 0.707) {
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q; return f;
}

export function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

/** Amplitude-envelope: rask attack, eksponentiell decay til -80 dB over `d` sekunder. */
export function env(ac, t, { a = 0.002, peak = 1, hold = 0, d = 0.2 } = {}) {
  const g = ac.createGain(); const p = g.gain;
  p.setValueAtTime(0.0001, t);
  if (a <= 0.0005) p.setValueAtTime(peak, t); else p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  if (hold > 0) p.setValueAtTime(peak, t + a + hold);
  p.exponentialRampToValueAtTime(0.0001 * Math.max(peak, 0.01), t + a + hold + d);
  p.setValueAtTime(0, t + a + hold + d + 0.001);
  return g;
}

/** Filtrert støy-lag. f2 = sluttfrekvens for filtersveip. */
export function noiseLayer(ac, out, t, o = {}) {
  const { color = 'white', type = 'bandpass', f = 1000, f2 = null, q = 0.8, a = 0.001, hold = 0,
    d = 0.1, peak = 0.5, rate = 1, sweep = null, drive = 0 } = o;
  const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac, color); src.loop = true;
  src.playbackRate.value = rate;
  const fl = filter(ac, type, f, q);
  if (f2) {
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + (sweep ?? (a + hold + d)));
  }
  const g = env(ac, t, { a, hold, d, peak });
  if (drive > 0) chain(src, fl, shaper(ac, drive), g, out); else chain(src, fl, g, out);
  src.start(t, Math.random() * 2.5); src.stop(t + a + hold + d + 0.05);
  return g;
}

/** Tonalt kropps-lag med pitch-drop. */
export function toneLayer(ac, out, t, o = {}) {
  const { wave = 'sine', f = 120, f2 = null, drop = 0.08, a = 0.001, hold = 0, d = 0.2,
    peak = 0.6, drive = 0, lp = 0, detune = 0 } = o;
  const osc = ac.createOscillator(); osc.type = wave; osc.detune.value = detune;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(5, f2), t + drop);
  const g = env(ac, t, { a, hold, d, peak });
  const nodes = [osc];
  if (lp) nodes.push(filter(ac, 'lowpass', lp, 0.7));
  if (drive > 0) nodes.push(shaper(ac, drive));
  nodes.push(g, out); chain(...nodes);
  osc.start(t); osc.stop(t + a + hold + d + 0.05);
  return g;
}

/** Metallisk klang (modal: inharmoniske sinus-partialer, høyere partialer dør raskere). */
export function metalLayer(ac, out, t, o = {}) {
  const { f = 800, ratios = [1, 2.76, 5.4, 8.93], d = 0.4, peak = 0.2, spread = 0.03, decayTilt = 0.6 } = o;
  const bus = ac.createGain(); bus.gain.value = peak / Math.sqrt(ratios.length); bus.connect(out);
  ratios.forEach((r, i) => {
    const fr = f * r * (1 + rand(-spread, spread));
    if (fr > ac.sampleRate * 0.45) return;
    const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = fr;
    const dd = d * Math.pow(decayTilt, i) * rand(0.8, 1.2);
    const g = env(ac, t, { a: 0.0005, peak: rand(0.5, 1) / (1 + i * 0.35), d: dd });
    chain(osc, g, bus); osc.start(t); osc.stop(t + dd + 0.05);
  });
  // eksitasjon: kort støyimpuls gjennom båndpass
  noiseLayer(ac, bus, t, { type: 'bandpass', f: Math.min(f * 3, 9000), q: 1.2, d: 0.012, peak: 0.9 });
  return bus;
}

/** Kort mekanisk klikk (høypasset støy + kort resonans). */
export function clickLayer(ac, out, t, o = {}) {
  const { f = 3500, peak = 0.3, d = 0.018, body = 0.5 } = o;
  noiseLayer(ac, out, t, { type: 'highpass', f: f * 0.7, q: 0.7, d: d * 0.5, peak });
  noiseLayer(ac, out, t, { type: 'bandpass', f, q: 6, d, peak: peak * 0.9 });
  if (body > 0) toneLayer(ac, out, t, { wave: 'triangle', f: f * 0.32 * rand(0.9, 1.1), f2: f * 0.22, drop: d, d: d * 1.4, peak: peak * body });
}

/** Generert impulsrespons: betong/industrihall (stereo, tidlige refleksjoner, mørkere hale over tid). */
export function makeImpulse(ac, { dur = 2.6, rt60 = 2.2, predelay = 0.014, bright = 7000, dark = 1100 } = {}) {
  const sr = ac.sampleRate, len = Math.floor(sr * dur);
  const buf = ac.createBuffer(2, len, sr);
  const decay = 6.91 / rt60; // -60 dB ved rt60
  const pre = Math.floor(predelay * sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const fc = dark + (bright - dark) * Math.exp(-t * 2.2);
      const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
      y += a * ((Math.random() * 2 - 1) - y);
      // ujevn tetthet tidlig (diffus oppbygging)
      const build = Math.min(1, t / 0.035);
      d[i] = y * Math.exp(-t * decay) * build;
    }
    // tidlige refleksjoner (harde betongflater)
    const refl = [0.009, 0.017, 0.023, 0.031, 0.044, 0.058, 0.071];
    refl.forEach((r, k) => {
      const idx = pre + Math.floor((r + (ch ? 0.0021 * (k % 3) : 0.0013 * (k % 2))) * sr);
      if (idx < len) d[idx] += (ch ? -1 : 1) * (k % 2 ? -1 : 1) * 0.55 * Math.exp(-k * 0.35);
    });
    // svak metallisk flutter-kam (parallelle vegger)
    const comb = Math.floor(0.0113 * sr), combEnd = Math.min(len, Math.floor(0.35 * sr));
    for (let i = comb; i < combEnd; i++) d[i] += d[i - comb] * 0.07 * (1 - i / combEnd);
    // normaliser energi
    let e = 0; for (let i = 0; i < len; i++) e += d[i] * d[i];
    const n = 1.6 / Math.sqrt(e || 1);
    for (let i = 0; i < len; i++) d[i] *= n;
  }
  return buf;
}

/** Myk sikkerhetsbegrenser: lineær opp til `knee`, deretter myk overgang mot `ceil` (< 0 dBFS). */
export function safetyClipper(ac, knee = 0.7, ceil = 0.966) {
  const n = 4096, curve = new Float32Array(n), r = ceil - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 4 - 2, a = Math.abs(x);
    const y = a <= knee ? a : knee + r * Math.tanh((a - knee) / r);
    curve[i] = Math.sign(x) * y;
  }
  const ws = ac.createWaveShaper(); ws.curve = curve; ws.oversample = '4x';
  // WaveShaper-kurven dekker [-1,1] av inngangen; skaler ned/opp rundt den så ±2 dekkes
  const pre = ac.createGain(); pre.gain.value = 0.5; const post = ac.createGain(); post.gain.value = 1;
  // kurven er laget for x i [-2,2] → inngang skaleres 0.5 inn i [-1,1]
  pre.connect(ws); ws.connect(post);
  return { input: pre, output: post };
}
