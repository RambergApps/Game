// v1.7 Stemmer i mellomsekvensene: forhåndsgenererte Opus-filer (Kokoro-82M, se tools/voice/README.md).
//   game/assets/voice/manifest.json + <scene>/<panel>-<linje>.ogg. Radiofilteret per speaker er bakt inn i filene.
//   createVoice(ac, dest, hooks) → { prepare(id), line(p), end(p), stopAll(fade), state() }
//   prepare: ved cutsceneStart – fetch + decodeAudioData for hele scenen (bare lokale, relative filer). Forrige scene slippes.
//   line: ved cutsceneLine – finner <panel>-<linje i panelet> og spiller den; forrige replikk tones ut (80 ms).
//   end: skip → rask uttoning; vanlig slutt → siste replikk får klinge ferdig.
//   Mangler manifest/fil, eller feiler dekodingen: ingen stemme, ingen feil (stille fallback).
const BASE = new URL('../../assets/voice/', import.meta.url);
const START_DELAY = 0.16; // etter radio-klikket (radioCommand/radioWarden/radioAnnouncer ≈ 120 ms), så de ikke kolliderer

export function createVoice(ac, dest, hooks = {}) {
  let manifest = null, manifestP = null;
  let sceneId = null, bufs = new Map(), pending = new Map(), delays = new Map();
  let panel = null, li = -1, cur = null, seq = 0, playedN = 0, missing = 0;

  function loadManifest() {
    if (manifestP) return manifestP;
    manifestP = fetch(new URL('manifest.json', BASE)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((m) => (manifest = m));
    return manifestP;
  }
  function prepare(id) {
    sceneId = id; panel = null; li = -1;
    bufs = new Map(); pending = new Map(); delays = new Map();
    const mine = id;
    return loadManifest().then((m) => {
      const sc = m?.scenes?.[id]; if (!sc || sceneId !== mine) return;
      for (const [key, e] of Object.entries(sc)) {
        delays.set(key, Math.min(1.5, +e.delay || 0)); // første linje i et panel: teksten kommer etter textDelay
        const p = fetch(new URL(e.file, BASE)).then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((ab) => (ab ? ac.decodeAudioData(ab) : null)).catch(() => null)
          .then((b) => { if (sceneId === mine && b) bufs.set(key, b); pending.delete(key); return b; });
        pending.set(key, p);
      }
    });
  }
  function fadeStop(v, fade) {
    if (!v) return;
    const t = ac.currentTime, g = v.g.gain;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); v.src.stop(t + fade + 0.02); } catch (_) {}
  }
  function start(buf, key, when) {
    fadeStop(cur, 0.08);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = 1;
    src.connect(g); g.connect(dest);
    const t = Math.max(ac.currentTime + 0.005, when);
    src.start(t);
    const v = { src, g, key, t, dur: buf.duration };
    src.onended = () => { if (cur === v) { cur = null; hooks.onSpeech?.(false); } };
    cur = v; playedN++;
    hooks.onSpeech?.(true, buf.duration, t);
  }
  function line(p, when = ac.currentTime) {
    if (p.id && p.id !== sceneId) prepare(p.id);
    if (p.panel !== undefined && p.panel !== panel) { panel = p.panel; li = 0; } else li++;
    const key = `${panel ?? 0}-${li}`;
    const my = ++seq;
    fadeStop(cur, 0.08); if (cur) { cur = null; hooks.onSpeech?.(false); }
    const at = when + Math.max(START_DELAY, delays.get(key) ?? 0);
    const b = bufs.get(key);
    if (b) { start(b, key, at); return key; }
    const pr = pending.get(key) || (manifestP && manifestP.then(() => pending.get(key)));
    // (er manifestet ikke lastet ennå, kjenner vi ikke delay: bruk START_DELAY)
    if (!pr) { missing++; return null; }
    Promise.resolve(pr).then((b2) => {
      // lasting tok tid: spill bare hvis det fortsatt er denne replikken (og ikke mer enn 1,5 s for sent)
      if (b2 && my === seq && sceneId && ac.currentTime - at < 1.5) start(b2, key, at);
      else if (!b2) missing++;
    });
    return key;
  }
  function end(p = {}) {
    seq++;
    if (p.skipped) { fadeStop(cur, 0.12); if (cur) { cur = null; hooks.onSpeech?.(false); } }
    sceneId = null; panel = null; li = -1; bufs = new Map(); pending = new Map(); // siste replikk (cur) klinger ferdig
  }
  function stopAll(fade = 0.1) { seq++; fadeStop(cur, fade); if (cur) { cur = null; hooks.onSpeech?.(false); } }
  function state() { return { scene: sceneId, loaded: bufs.size, pending: pending.size, speaking: cur?.key ?? null, played: playedN, missing, manifest: !!manifest }; }
  loadManifest();
  return { prepare, line, end, stopAll, state };
}
