// Stemning under mellomsekvenser (v1.4.1, demo av brett 1). Diegetisk bakgrunn UTENFOR radiobåndet:
// havn, vind, sirene, skipshorn, rumling under asfalten, fjern brann. Alt går gjennom én egen gain,
// så stop() (cutsceneEnd / skip) fjerner ALT – ingen lyd blir hengende igjen etter sekvensen.
// Styres per bilde (panel-indeks fra cutsceneLine). Lagnivåene er lave: radioen/replikkene ligger oppå.
import { rand, noiseLayer as N, toneLayer as T, noiseBuffer, filter } from './synth.js';

// id → panel-indeks → { lag: nivå 0..1, ev: engangshendelser }. Lag: sea, wind, siren, rumble, fire, glow.
export const SCENE_MOODS = {
  intro: {
    0: { sea: 0.7, wind: 0.6, siren: 0.6 },                          // Kessa Port, evakueringen
    1: { sea: 0.8, wind: 0.5, siren: 0.8, ev: ['shipHorn'] },        // kaiene: sirene + skipet som laster
    2: { sea: 0.35, wind: 0.3, siren: 0.3 },                         // hjelmvisiret: verden dempes
    3: { wind: 0.4, rumble: 0.9, glow: 0.8, ev: ['groundThump'] },   // asfalten gløder nedenfra
  },
  'yard-clear': {
    0: { sea: 0.9, wind: 0.6, ev: ['shipHorn', 'shipHornFar'] },     // siste skip forbi moloen – to lange støt
    1: { sea: 0.35, wind: 0.3, rumble: 0.3 },                        // hjelmvisiret
    2: { wind: 0.5, fire: 0.9, rumble: 0.5, ev: ['farBoom'] },       // Deepwell brenner i det fjerne
  },
};
export const hasMood = (id) => !!SCENE_MOODS[id];

const PEAK = { sea: 0.11, wind: 0.05, siren: 0.022, rumble: 0.16, fire: 0.07, glow: 0.05 };

/** createScene(ac, dest, revSend) → { start(id, t), panel(i, t), stop(t, fade), active, id } */
export function createScene(ac, dest, revSend) {
  let S = null;
  const isOffline = () => typeof OfflineAudioContext !== 'undefined' && ac instanceof OfflineAudioContext;
  function build(t) {
    const out = ac.createGain(); out.gain.value = 0; out.connect(dest);
    const send = ac.createGain(); send.gain.value = 0.6; out.connect(send); send.connect(revSend);
    const srcs = [], G = {};
    const loop = (color, rate = 1) => { const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac, color); s.loop = true; s.playbackRate.value = rate; srcs.push(s); return s; };
    const lfo = (f, amt, param) => { const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain(); g.gain.value = amt; o.connect(g); g.connect(param); srcs.push(o); };
    const layer = (name) => { const g = ac.createGain(); g.gain.value = 0; g.connect(out); G[name] = g; return g; };
    // hav: rosa støy, lavpass som puster (dønninger ~7 s)
    { const s = loop('pink'), f = filter(ac, 'lowpass', 520, 0.6), sw = ac.createGain(); sw.gain.value = 0.7;
      lfo(0.14, 0.3, sw.gain); lfo(0.14, 220, f.frequency); s.connect(f); f.connect(sw); sw.connect(layer('sea')); }
    // vind: båndpass som vandrer
    { const s = loop('pink', 0.8), f = filter(ac, 'bandpass', 420, 1.4); lfo(0.07, 180, f.frequency); s.connect(f); f.connect(layer('wind')); }
    // fjern sirene: to sagtenner som stiger/synker sakte, langt unna (lavpass + mye rom)
    { const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = 520; o2.frequency.value = 523; lfo(0.09, 150, o1.frequency); lfo(0.09, 150, o2.frequency);
      const f = filter(ac, 'lowpass', 1100, 0.7), h = filter(ac, 'highpass', 300, 0.7); o1.connect(f); o2.connect(f); f.connect(h); h.connect(layer('siren')); srcs.push(o1, o2); }
    // rumling under bakken (brun, sub) med langsom svevning
    { const s = loop('brown'), f = filter(ac, 'lowpass', 95, 1.1), am = ac.createGain(); am.gain.value = 0.75; lfo(0.23, 0.25, am.gain); s.connect(f); f.connect(am); am.connect(layer('rumble')); }
    // fjern brann: brun/rosa båndpass + flakking
    { const s = loop('brown', 1.3), f = filter(ac, 'bandpass', 380, 0.6), am = ac.createGain(); am.gain.value = 0.8; lfo(1.7, 0.2, am.gain); lfo(0.31, 0.15, am.gain); s.connect(f); f.connect(am); am.connect(layer('fire')); }
    // gløden i sprekkene: høyt, svakt sprak (hvit støy, smal topp) med raske utfall
    { const s = loop('white', 0.6), f = filter(ac, 'bandpass', 3800, 3), am = ac.createGain(); am.gain.value = 0.5; lfo(9.3, 0.5, am.gain); lfo(5.1, 0.3, am.gain); s.connect(f); f.connect(am); am.connect(layer('glow')); }
    for (const s of srcs) s.start(t);
    return { out, send, srcs, G, id: null, panel: null };
  }
  const EV = {
    shipHorn(o, t) { horn(o, t + 0.8, 1, 2.6); },
    shipHornFar(o, t) { horn(o, t + 4.6, 0.55, 3.2); },
    groundThump(o, t) { for (const d of [0.4, 2.2]) { T(ac, o, t + d, { f: 46, f2: 30, drop: 0.4, a: 0.02, d: 0.9, peak: 0.22 }); N(ac, o, t + d, { color: 'brown', type: 'lowpass', f: 200, a: 0.02, d: 0.6, peak: 0.12 }); } },
    farBoom(o, t) { const d = rand(1.2, 2); T(ac, o, t + d, { f: 55, f2: 32, drop: 0.6, a: 0.03, d: 1.6, peak: 0.16 }); N(ac, o, t + d, { color: 'brown', type: 'lowpass', f: 260, a: 0.05, d: 1.8, peak: 0.12 }); },
  };
  function horn(o, t, k, len) { // skipshorn (tyfon): to dype, svakt skjeve sagtenner, langt unna
    for (const [f, p] of [[73.4, 1], [110, 0.5], [146.8, 0.25]]) {
      const x = ac.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f * rand(0.997, 1.003);
      const lp = filter(ac, 'lowpass', 420, 0.8), g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * k * p, t + 0.25); g.gain.setValueAtTime(0.05 * k * p, t + len - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      x.connect(lp); lp.connect(g); g.connect(o); x.start(t); x.stop(t + len + 0.05);
    }
  }
  const api = {
    get active() { return !!S; }, get id() { return S?.id ?? null; },
    start(id, t = ac.currentTime) {
      if (!SCENE_MOODS[id]) return false;
      if (S) api.stop(t, 0.1);
      S = build(t); S.id = id;
      S.out.gain.setValueAtTime(0, t); S.out.gain.linearRampToValueAtTime(1, t + 1.2);
      api.panel(0, t);
      return true;
    },
    panel(i, t = ac.currentTime) {
      if (!S || i === S.panel) return; S.panel = i;
      const m = SCENE_MOODS[S.id]?.[i]; if (!m) return;
      for (const k of Object.keys(PEAK)) S.G[k].gain.setTargetAtTime((m[k] ?? 0) * PEAK[k], t, i === 0 ? 0.3 : 0.6);
      for (const e of m.ev || []) EV[e]?.(S.out, t);
    },
    stop(t = ac.currentTime, fade = 0.6) {
      if (!S) return; const s = S; S = null;
      s.out.gain.cancelScheduledValues(t); s.out.gain.setValueAtTime(Math.max(0, s.out.gain.value), t); s.out.gain.linearRampToValueAtTime(0, t + fade);
      for (const x of s.srcs) try { x.stop(t + fade + 0.05); } catch (_) {}
      if (!isOffline()) setTimeout(() => { try { s.out.disconnect(); s.send.disconnect(); } catch (_) {} }, (fade + 0.4) * 1000);
    },
  };
  return api;
}
