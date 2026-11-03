// v1.12 Lagdelt tekno-musikk (v3) for brettene. Filer: game/assets/music/<spor>-int1/2/3.ogg (Opus mono, lages av
// /workspace/breach-lyd-forslag/src/techno-loop-v3.js). Samme grensesnitt som music.js/yard-music.js:
//   createTechnoMusic(ac, dest) → { start, stop, fadeOut, update, setIntensity, duck, intensity, output,
//                                   load(track) → Promise<bool>, ready(track), setTrack(track), note(type), voiceDuck(on), state() }
// Avspilling: tre AudioBufferSourceNode (loop=true) startes på samme ac-tid → sample-synkrone og sømløse.
// Intensitet: kamp-score → nivå 1/2/3 med hysterese og minste holdetid; gain-kryssfade starter på neste taktgrense.
// Minne: bare gjeldende spor er dekodet. Dekoding via OfflineAudioContext i lav rate (int1 22,05 kHz, int2/3 32 kHz, mono)
// → Yard ≈ 52 MB, Deepwell ≈ 55 MB i stedet for ≈ 173 MB (48 kHz stereo). Forrige spor slippes ved bytte.
export const TRACKS = {
  yard:     { bpm: 128, bars: 80, gainDb: 0, files: ['yard-int1.ogg', 'yard-int2.ogg', 'yard-int3.ogg'] },
  refinery: { bpm: 132, bars: 88, gainDb: 0, files: ['refinery-int1.ogg', 'refinery-int2.ogg', 'refinery-int3.ogg'] }  // v1.13: gainDb per spor (dB). Målt i spill: Deepwell v3 = Yard v3 (avviket var mot gammel music.js), derfor 0,
};
// Test: ?techgain=<dB> overstyrer refinery-løftet (for før/etter-måling).
if (typeof location !== 'undefined') { const m = /[?&]techgain=(-?[\d.]+)/.exec(location.search); if (m) TRACKS.refinery.gainDb = +m[1]; }
const RATES = [22050, 32000, 32000];
export const LOAD_TIMEOUT_S = 9; // v1.13: reserve-musikk først etter 9 s uten dekodet v3
const BASE = new URL('../../assets/music/', import.meta.url);
const LEVEL = 0.62;          // tilpasset så v3 ligger på omtrent samme nivå som yard-music.js i kamp (målt med _meter)
const UP = [0, 0.32, 0.62];  // score over UP[n] → minst nivå n+1
const DOWN = [0, 0.2, 0.45]; // under DOWN[n] → ned fra nivå n+1 (hysterese)
const HOLD_BARS = 4;         // minste tid på et nivå før det kan gå ned
const XFADE_BEATS = 2;

export function createTechnoMusic(ac, dest) {
  const out = ac.createGain(); out.gain.value = 0;
  const duckG = ac.createGain(), voiceG = ac.createGain(); out.connect(duckG); duckG.connect(voiceG); voiceG.connect(dest);
  const lanes = [0, 1, 2].map(() => { const g = ac.createGain(); g.gain.value = 0; g.connect(out); return g; });
  let track = null, bufs = null, loading = new Map(), cache = new Map(), srcs = [], t0 = 0, started = false, fadeTok = 0, want = null;
  let level = 1, lastChange = -1e9, score = 0, ext = 0, force = null, waveOn = false, warnT = 0, shots = [], booms = [], changes = 0, errors = 0;

  async function decode(file, rate) {
    const r = await fetch(new URL(file, BASE)); if (!r.ok) throw new Error(file + ' ' + r.status);
    const data = await r.arrayBuffer();
    const oc = new OfflineAudioContext(1, 1, rate);
    return await oc.decodeAudioData(data);
  }
  /** Laster og dekoder et spor (én gang). Forrige spor slippes fra cachen når et nytt er ferdig. */
  function load(name) {
    const T = TRACKS[name]; if (!T) return Promise.resolve(false);
    if (cache.has(name)) return Promise.resolve(true);
    if (loading.has(name)) return loading.get(name);
    const p = Promise.all(T.files.map((f, i) => decode(f, RATES[i]))).then((bs) => {
      const len = T.bars * 4 * 60 / T.bpm; // eksakt lengde (s): Opus-dekoding kan gi noen få ekstra samples
      const fixed = bs.map((b, i) => { const n = Math.round(len * b.sampleRate); if (b.length === n) return b;
        const nb = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: b.sampleRate }); nb.copyToChannel(b.getChannelData(0).subarray(0, n), 0); return nb; });
      for (const k of cache.keys()) if (k !== track && k !== name) cache.delete(k);
      cache.set(name, fixed); loading.delete(name); return true;
    }).catch((e) => { errors++; loading.delete(name); console.warn('[audio] musikk', name, e?.message ?? e); return false; });
    loading.set(name, p); return p;
  }
  const barDur = () => 4 * 60 / TRACKS[track].bpm;
  function stopSrcs(at = ac.currentTime) { srcs.forEach((s) => { try { s.stop(at); } catch (_) {} }); srcs = []; }
  function setTrack(name) {
    if (name === track) return true; if (!cache.has(name)) return false;
    const wasOn = started; if (wasOn) { stopSrcs(ac.currentTime + 0.05); started = false; }
    track = name; bufs = cache.get(name); for (const k of cache.keys()) if (k !== name) cache.delete(k); // frigi forrige
    if (wasOn) start(ac.currentTime + 0.06);
    return true;
  }
  const lvlFor = () => LEVEL * Math.pow(10, (TRACKS[track]?.gainDb || 0) / 20);
  function start(t = ac.currentTime, fade = 0.8) {
    fadeTok++;
    if (!bufs || (want && want !== track)) return; // v1.13: ikke spill forrige brett sitt spor mens nytt lastes
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t); out.gain.linearRampToValueAtTime(lvlFor(), t + fade);
    if (started) return;
    started = true; t0 = t;
    srcs = bufs.map((b, i) => { const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.connect(lanes[i]); s.start(t); return s; });
    lanes.forEach((g, i) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(i + 1 === level ? 1 : 0, t); });
  }
  /** v1.13: marker ønsket spor; start() er stille til det er satt med setTrack. */
  function expect(name) { want = name; }
  function stop() { stopSrcs(); started = false; }
  function fadeOut(dur = 2.5, t = ac.currentTime) {
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t); out.gain.linearRampToValueAtTime(0.0001, t + dur);
    const tok = ++fadeTok; setTimeout(() => { if (tok === fadeTok) stop(); }, dur * 1000 + 150);
  }
  /** Kryssfade til nivå n, med start på neste taktgrense. */
  function goLevel(n) {
    if (n === level) return; level = n; changes++; lastChange = ac.currentTime;
    if (!started) return;
    const bd = barDur(), now = ac.currentTime, k = Math.ceil((now + 0.02 - t0) / bd), at = t0 + k * bd, x = XFADE_BEATS * bd / 4;
    lanes.forEach((g, i) => { const v = i + 1 === n ? 1 : 0; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.setValueAtTime(g.gain.value, at); g.gain.linearRampToValueAtTime(v, at + x); });
  }
  /** Kamphendelser (fra index.js): shot, explosion, waveStart, waveEnd, spawnWarn. */
  function note(type) {
    const t = ac.currentTime;
    if (type === 'shot') shots.push(t); else if (type === 'explosion') booms.push(t);
    else if (type === 'waveStart') { waveOn = true; warnT = Math.max(warnT, 0.5); }
    else if (type === 'waveEnd') waveOn = false;
    else if (type === 'spawnWarn') warnT = 1;
  }
  function update(dt = 1 / 60, alive = 0) {
    const t = ac.currentTime; warnT = Math.max(0, warnT - dt / 10);
    while (shots.length && t - shots[0] > 8) shots.shift(); while (booms.length && t - booms[0] > 8) booms.shift();
    const own = (waveOn ? 0.3 : 0) + 0.45 * warnT + Math.min(0.35, shots.length * 0.012) + Math.min(0.3, booms.length * 0.12) + Math.min(0.25, alive * 0.05);
    score = Math.min(1, Math.max(own, ext * 0.6)); // ext = index.js' gamle intensitet (bølge/varme/fiender); alene gir den maks nivå 2
    let want = level;
    if (force !== null) want = force;
    else {
      const up = score > UP[2] ? 3 : score > UP[1] ? 2 : 1;
      if (up > level) want = up;
      else if (level > 1 && score < DOWN[level - 1] && t - lastChange > HOLD_BARS * (track ? barDur() : 2)) want = level - 1; // ett trinn om gangen
    }
    goLevel(want);
  }
  function setIntensity(v) { ext = Math.max(0, Math.min(1, +v || 0)); }
  /** Redusert sidechain (halv dybde av yard-music). */
  function duck(t = ac.currentTime, db = 4, ms = 220) {
    const g = duckG.gain, target = Math.pow(10, -db * 0.5 / 20);
    g.cancelScheduledValues(t); g.setValueAtTime(Math.min(g.value, 1), t); g.linearRampToValueAtTime(target, t + 0.02); g.setTargetAtTime(1, t + 0.04, ms / 3000);
  }
  function voiceDuck(on) { const g = voiceG.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(on ? 0.45 : 1, t, on ? 0.08 : 0.4); }
  function state() {
    return { track, level, score: +score.toFixed(3), started, ready: !!bufs, changes, errors, loaded: [...cache.keys()], loading: [...loading.keys()],
      lanes: lanes.map((g) => +g.gain.value.toFixed(3)), out: +out.gain.value.toFixed(3), voice: +voiceG.gain.value.toFixed(3),
      pos: started && track ? +(((ac.currentTime - t0) % (barDur() * TRACKS[track].bars)) / barDur()).toFixed(2) : null,
      mb: bufs ? +(bufs.reduce((a, b) => a + b.length * 4, 0) / 1e6).toFixed(1) : 0 };
  }
  return { start, stop, fadeOut, update, setIntensity, duck, voiceDuck, note, load, setTrack, expect, ready: (n) => cache.has(n), state,
    forceLevel(n) { force = n ? Math.max(1, Math.min(3, n)) : null; }, get intensity() { return score; }, output: out };
}
