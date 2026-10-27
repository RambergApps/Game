// BREACH – mellomsekvensspiller. Fullskjerm-canvas over spillet, fade inn/ut, ett bilde per panel (tegneserierute),
// tekst skrives ut tegn for tegn. MELLOMROM/klikk/Enter: fullfør linje → neste linje/bilde. ESC: hopp over hele sekvensen.
// Valgfritt per panel (alt bakoverkompatibelt):
//   cam: { from: [zoom, fx, fy], to: [zoom, fx, fy], dur }  Ken Burns – zoom ≥ 1, (fx, fy) = fokuspunkt i bildet (0..1)
//   transition: 'fade' (standard) | 'cut' | 'swipe'  – overgangen INN til dette panelet
//   textDelay: sekunder bildet står alene før teksten starter (bilde før tekst)
import { CUTSCENES, SPEAKER_LABEL, PAINTED_PANELS } from './cutscenes.js';
import { renderScene, SCENES } from './scenes.js';
import { VW, VH } from './art.js';

const FONT = '"Barlow Condensed", "Bahnschrift SemiCondensed", "Arial Narrow", "Roboto Condensed", sans-serif';
const C = { text: '#d9d4c7', dim: 'rgba(217,212,199,0.38)', radio: '#ffb347', warden: '#39c6ff', ui: 'rgba(200,210,220,0.45)', bar: '#000' };
const DEF = { cps: 38, fadeIn: 0.7, fadeOut: 0.8, panelFade: 0.35, swipe: 0.45, autoAdvance: 0, parent: null, zIndex: 50 };
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Felles tasthint i alle sekvenser (mellomsekvenser, død, rulletekst). Space er rull i spillet. */
export const HINT = 'ENTER / CLICK  NEXT     ESC  SKIP';
/** Space er «neste» inne i en sekvens, men konsumeres alltid, og svelges ~300 ms etter at sekvensen er slutt
 *  slik at et Space-trykk aldri lekker ut som rull i spillet. */
export function swallowSpaceAfter(ms = 300) {
  const until = performance.now() + ms;
  const f = (e) => {
    if (performance.now() > until) { removeEventListener('keydown', f, true); removeEventListener('keyup', f, true); return; }
    if (e.code === 'Space' && e.type === 'keydown') { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  addEventListener('keydown', f, true); addEventListener('keyup', f, true);
  setTimeout(() => { removeEventListener('keydown', f, true); removeEventListener('keyup', f, true); }, ms + 50);
}

let fontReady = null;
export function loadFont() {
  if (fontReady) return fontReady;
  const base = new URL('./fonts/', import.meta.url);
  const faces = [['400', 'BarlowCondensed-Regular.ttf'], ['600', 'BarlowCondensed-SemiBold.ttf']]
    .map(([w, f]) => new FontFace('Barlow Condensed', `url(${new URL(f, base)})`, { weight: w }));
  fontReady = Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)).catch(() => null)));
  return fontReady;
}

function makeGrain(size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0); return c;
}

let queue = Promise.resolve();
/** Er en sekvens aktiv nå? (spillet kan pause løkka mens dette er true) */
export let active = false;

// ---- lydhendelser (avtalt med Lyd) ----
// cutsceneStart {id} → cutsceneLine {id, index, speaker, panel} per ny linje/nytt bilde → cutsceneEnd {id, skipped}
let boundWorld = null;
/** Lokal emitter for testsiden / når world mangler. `storyEvents.on(type, fn)` → avmeld-funksjon. */
export const storyEvents = (() => {
  const m = new Map();
  return {
    on(t, f) { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(f); return () => m.get(t).delete(f); },
    emit(t, d) { for (const f of m.get(t) || []) { try { f(d); } catch (err) { console.error(err); } } },
  };
})();
// Stemme-manifest (Lyd v1.7): brukes bare til å vente på at siste replikk er ferdig før autoEnd. Feiltolerant, lastes én gang.
const VOICE_START = 0.16, VOICE_TAIL = 0.1, VOICE_BREATH = 0.2, NO_VOICE_MIN = 3.3;   // v2 27.10 (Breach): hale 0,1 s, pust ~0,2 s ved talerbytte
let voiceManifest = null, voiceManifestP = null;
export function loadVoiceManifest() {
  if (!voiceManifestP) voiceManifestP = fetch(new URL('../../assets/voice/manifest.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : null)).catch(() => null).then((m) => (voiceManifest = m?.scenes || null));
  return voiceManifestP;
}
try { loadVoiceManifest(); } catch { /* ikke-nettleser */ }
export function bindWorld(world) { boundWorld = world || null; }
export function emit(o, type, data) {
  const w = o.world || boundWorld || (typeof window !== 'undefined' ? window.BREACH?.world : null);
  try { w?.events?.emit?.(type, data); } catch (err) { console.error(err); }
  storyEvents.emit(type, data);
}

/**
 * Vis en mellomsekvens. → Promise<{ id, skipped }>. Flere kall køes etter hverandre.
 * opts: { cps, fadeIn, fadeOut, autoAdvance (sekunder etter ferdig linje, 0 = vent på spiller),
 *         autoEndAfter (s uten inndata → sekvensen avsluttes; standard fra sekvensens eget felt), parent, onLine, world }
 */
export function showCutscene(id, opts = {}) {
  // Sekvensen kan ha egne tider (timing: { cps, fadeIn, fadeOut, autoAdvance }) – f.eks. den korte «fallen».
  const run = () => play(id, { ...DEF, ...(CUTSCENES[id]?.timing || {}), ...opts });
  const p = queue.then(run, run); queue = p.catch(() => {}); return p;
}

/**
 * Varm opp en sekvens (font, malte bilder og kodetegnede scener) så første visning starter uten hakk.
 * Kodemalingen tar ~0,5 s første gang; kall i en rolig stund (levels gjør det for «fallen» ved nivåstart).
 */
export function preloadCutscene(id, { paintedOnly = false } = {}) {
  const cs = CUTSCENES[id]; if (!cs) return Promise.resolve(false);
  // paintedOnly: bare hent/dekod malte bilder (billig) – ikke kodemal reservescener (~0,5 s hakk) midt i spillet.
  return loadFont().then(() => Promise.all(cs.panels.map(async (p) => (await panelImage(p)) || (paintedOnly ? null : renderScene(p.scene))))).then(() => true, () => false);
}

/** Malt panelbilde (img/story/<id>.webp) hvis panelet står i PAINTED_PANELS, ellers null → kodetegnet scene. */
const imgCache = new Map();
function panelImage(p) {
  if (!p.image || !PAINTED_PANELS.has(p.id)) return Promise.resolve(null);
  if (!imgCache.has(p.image)) imgCache.set(p.image, new Promise((res) => {
    const im = new Image(); const t = setTimeout(() => res(null), 4000);
    // dekod før bruk, så første drawImage i sekvensen ikke hakker
    im.onload = () => { clearTimeout(t); const ok = () => res(im.naturalWidth ? im : null); (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(ok); };
    im.onerror = () => { clearTimeout(t); console.info(`[story] malt bilde mangler: ${p.image} – bruker scenen`); res(null); };
    im.src = new URL('../../' + p.image, import.meta.url).href;
  }));
  return imgCache.get(p.image);
}

async function play(id, o) {
  const cs = CUTSCENES[id];
  if (!cs) { console.warn(`[story] ukjent mellomsekvens '${id}'`); return { id, skipped: true, missing: true }; }
  await loadFont();
  await Promise.race([loadVoiceManifest(), new Promise((r) => setTimeout(r, 1500))]); // stemme-tider leses ved kjøretid
  active = true;
  const parent = o.parent || document.body;
  const cv = document.createElement('canvas');
  cv.className = 'breach-cutscene';
  cv.setAttribute('role', 'dialog'); cv.setAttribute('aria-label', `Cutscene: ${cs.title}`); cv.tabIndex = -1;
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: String(o.zIndex), cursor: 'pointer', background: '#000', outline: 'none' });
  parent.appendChild(cv); cv.focus({ preventScroll: true });
  const ctx = cv.getContext('2d');
  const grain = makeGrain();
  let W = 0, H = 0, dpr = 1, scan = null;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const sc = document.createElement('canvas'); sc.width = 4; sc.height = 4; const sx = sc.getContext('2d');
    sx.fillStyle = 'rgba(0,0,0,0.22)'; sx.fillRect(0, 0, 4, 1); scan = ctx.createPattern(sc, 'repeat');
  };
  resize(); addEventListener('resize', resize);

  // tilstand
  const panels = await Promise.all(cs.panels.map(async (p) => ({ ...p, img: (await panelImage(p)) || renderScene(p.scene) })));
  let pi = 0, li = 0, chars = 0, lineDone = false, sinceDone = 0, panelT = 0;
  let phase = 'in', phaseT = 0, skipped = false, last = performance.now();
  // phase: 'in' (fade inn) → 'show' → 'out-panel' (fade til svart mellom paneler) → 'in' ... → 'out' (slutt)

  let resolveDone; const done = new Promise((r) => (resolveDone = r));
  const cur = () => panels[pi].lines[li];
  let lineIndex = -1;
  const delayOf = (p) => (li === 0 ? p.textDelay || 0 : 0);
  // stemmen spilles i sanntid, så vi måler i veggklokke (dt klemmes til 0,1 s og ville sakke ved lav FPS)
  const t0 = performance.now(); let sceneT = 0, voiceUntil = 0, lineVoiceEnd = 0;
  const lineShown = () => {
    lineIndex++;
    const L = cur(), lineId = `${pi}-${li}`;
    const ev = { id, index: lineIndex, speaker: L.speaker, panel: pi, line: li, lineId, text: L.text, who: L.who ?? null };
    emit(o, 'cutsceneLine', ev);   // Lyd (voice.js) lytter på denne
    emit(o, 'cutsceneText', ev);   // samme innhold, eget navn for logg/test
    const v = voiceManifest?.[id]?.[lineId];
    // samme regel som audio/voice.js: stemmen starter ved cutsceneLine + max(0,16, delay) – samtidig med typingen etter textDelay
    const start = sceneT + Math.max(VOICE_START, Math.min(1.5, +v?.delay || 0));
    const nx = panels[pi].lines[li + 1], who = (x) => x.who || x.speaker;
    const gap = nx && who(nx) !== who(L) ? Math.max(VOICE_TAIL, VOICE_BREATH - VOICE_START) : VOICE_TAIL;   // pust mellom ulike talere
    lineVoiceEnd = v ? start + v.dur + gap : 0;   // auto-videre kommer aldri før replikken er ferdig
    voiceUntil = Math.max(voiceUntil, v ? lineVoiceEnd : NO_VOICE_MIN);
  };
  emit(o, 'cutsceneStart', { id });
  lineShown();

  const transIn = (i) => panels[i]?.transition || 'fade';
  function advance() {
    if (phase !== 'show' && phase !== 'in') return;
    if (panelT < delayOf(panels[pi])) { panelT = delayOf(panels[pi]); return; }   // bilde før tekst: første trykk starter teksten
    if (!lineDone) { chars = cur().text.length; lineDone = true; sinceDone = 0; return; }
    if (li < panels[pi].lines.length - 1) { li++; chars = 0; lineDone = false; lineShown(); o.onLine?.(cur(), pi, li); return; }
    if (pi < panels.length - 1) { phase = 'out-panel'; phaseT = 0; return; }
    phase = 'out'; phaseT = 0;
  }
  function skip() { if (phase === 'out') return; skipped = true; phase = 'out'; phaseT = 0; }
  // går videre av seg selv etter autoEndAfter s uten inndata (f.eks. «fallen»: 3 s)
  const autoEnd = o.autoEndAfter ?? cs.autoEndAfter ?? 0;
  let idleT = 0, autoEnded = false;
  const maxDur = o.maxDuration ?? cs.maxDuration ?? 0;   // >0: sekvensen avsluttes senest her, også midt i en replikk (kun «fallen»)
  const onKey = (e) => {
    idleT = 0;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); }
    else e.stopImmediatePropagation(); // ikke lekk tastetrykk til spillet
  };
  const onKeyUp = () => {};   // keyup slippes gjennom til core/input.js (ellers henger taster etter sekvensen)
  const onPointer = (e) => { idleT = 0; e.preventDefault(); e.stopPropagation(); advance(); };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKeyUp, true);
  cv.addEventListener('pointerdown', onPointer);
  o.onLine?.(cur(), 0, 0);

  /** Tegn panelbildet med kamerabevegelse. Uten cam: den gamle langsomme innzoomen og driften. */
  function drawPanel(p, i, t, dx, bar, imgH) {
    const cover = Math.max(W / VW, imgH / VH);
    if (p.cam) {
      const c = p.cam, k = ease(t / (c.dur || 8)), f = c.from || [1, 0.5, 0.5], to = c.to || f;
      const z = f[0] + (to[0] - f[0]) * k, fx = f[1] + (to[1] - f[1]) * k, fy = f[2] + (to[2] - f[2]) * k;
      const iw = VW * cover * Math.max(1, z), ih = VH * cover * Math.max(1, z);
      let x = W / 2 - fx * iw, y = bar + imgH / 2 - fy * ih;
      x = Math.min(0, Math.max(W - iw, x)); y = Math.min(bar, Math.max(bar + imgH - ih, y));   // aldri svarte kanter
      ctx.drawImage(p.img, x + dx, y, iw, ih);
    } else {
      const zoom = 1.0 + Math.min(t, 14) * 0.0035, iw = VW * cover * zoom, ih = VH * cover * zoom;
      const drift = (t * 2.2) * (i % 2 ? -1 : 1);
      ctx.drawImage(p.img, (W - iw) / 2 + drift + dx, bar + (imgH - ih) / 2, iw, ih);
    }
  }

  function wrap(text, maxW) {
    const words = text.split(' '), out = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  }

  function frame(now) {
    // rAF-tid kan ligge før performance.now() ved start, så dt klemmes til ≥ 0
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; phaseT += dt; panelT += dt;
    // logikk
    if (phase === 'in' && phaseT >= o.fadeIn) { phase = 'show'; phaseT = 0; }
    idleT += dt;
    sceneT = (performance.now() - t0) / 1000;
    if (autoEnd > 0 && idleT >= autoEnd && sceneT >= voiceUntil && (o.autoAdvance <= 0 || (pi === panels.length - 1 && li === panels[pi].lines.length - 1)) && phase !== 'out') { autoEnded = true; phase = 'out'; phaseT = 0; }
    if (maxDur > 0 && sceneT >= maxDur && phase !== 'out') { autoEnded = true; phase = 'out'; phaseT = 0; }
    const waiting = panelT < delayOf(panels[pi]);
    if ((phase === 'show' || phase === 'in') && !lineDone && !waiting) {
      chars = Math.min(cur().text.length, chars + o.cps * dt);
      if (chars >= cur().text.length) { lineDone = true; sinceDone = 0; }
    } else if (lineDone) { sinceDone += dt; const last = pi === panels.length - 1 && li === panels[pi].lines.length - 1;
      // alle linjer: auto-videre venter på replikkens dur + hale (manifest); siste linje også på voiceUntil
      if (o.autoAdvance > 0 && phase === 'show' && sinceDone >= o.autoAdvance && sceneT >= lineVoiceEnd && (!last || sceneT >= voiceUntil)) advance(); }
    const outDur = transIn(pi + 1) === 'cut' ? 0 : transIn(pi + 1) === 'swipe' ? o.swipe : o.panelFade;
    if (phase === 'out-panel' && phaseT >= outDur) { pi++; li = 0; chars = 0; lineDone = false; panelT = 0; phase = 'in'; phaseT = 0; lineShown(); o.onLine?.(cur(), pi, 0); }
    if (phase === 'out' && phaseT >= o.fadeOut) { cleanup(); return; }

    // tegning (CSS-piksler)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const bar = Math.round(H * 0.085);
    const imgH = H - bar * 2;
    // bilde: «cover» innenfor bildefeltet + langsom innzoom (Ken Burns)
    const p = panels[pi];
    ctx.save(); ctx.beginPath(); ctx.rect(0, bar, W, imgH); ctx.clip();
    if (phase === 'out-panel' && transIn(pi + 1) === 'swipe' && panels[pi + 1]) {   // panelsveip: gammelt ut til venstre, nytt inn fra høyre
      const e = ease(phaseT / o.swipe), dx = -e * W;
      drawPanel(p, pi, panelT, dx, bar, imgH); drawPanel(panels[pi + 1], pi + 1, 0, dx + W, bar, imgH);
      ctx.fillStyle = '#000'; ctx.fillRect(dx + W - 6, bar, 12, imgH);                 // rutekant mellom bildene
    } else drawPanel(p, pi, panelT, 0, bar, imgH);
    // flimmer i lyset
    const fl = 0.035 * (Math.sin(now / 90) * 0.5 + Math.sin(now / 37) * 0.5);
    ctx.fillStyle = fl > 0 ? `rgba(255,190,120,${fl * 0.5})` : `rgba(0,0,0,${-fl})`; ctx.fillRect(0, bar, W, imgH);
    // tekstskygge nederst
    const tg = ctx.createLinearGradient(0, bar + imgH * 0.55, 0, bar + imgH);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = tg; ctx.fillRect(0, bar + imgH * 0.55, W, imgH * 0.45);
    // korn + skannlinjer
    ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
    const gx = Math.random() * 256, gy = Math.random() * 256;
    ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.translate(-gx, -gy); ctx.fillRect(gx, gy, W, H); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = scan; ctx.fillRect(0, bar, W, imgH);
    ctx.restore();

    // tekst
    const fs = Math.max(18, Math.min(40, H * 0.036));
    const x0 = Math.round(W * 0.075), maxW = Math.min(W * 0.62, fs * 30);
    ctx.textBaseline = 'alphabetic';
    let y = bar + imgH - fs * 1.1;
    const lines = (waiting || (phase === 'out-panel' && transIn(pi + 1) === 'swipe')) ? [] : p.lines;
    // bygg blokker for synlige linjer (tidligere linjer dempet), tegn nedenfra og opp
    const blocks = [];
    for (let i = 0; i <= Math.min(li, lines.length - 1); i++) {
      const L = lines[i], txt = i < li ? L.text : L.text.slice(0, Math.floor(chars));
      ctx.font = `400 ${fs}px ${FONT}`;
      blocks.push({ L, rows: wrap(txt, maxW), cur: i === li });
    }
    for (let b = blocks.length - 1; b >= 0; b--) {
      const { L, rows, cur: isCur } = blocks[b];
      ctx.font = `400 ${fs}px ${FONT}`;
      for (let r = rows.length - 1; r >= 0; r--) {
        ctx.fillStyle = isCur ? (SPEAKER_LABEL[L.speaker] ? '#f2d3a6' : L.speaker === 'caption' ? '#aeb4b8' : C.text) : C.dim;
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
        ctx.fillText(rows[r], x0, y);
        if (isCur && r === rows.length - 1 && !lineDone && Math.floor(now / 260) % 2 === 0) { // markør
          const w = ctx.measureText(rows[r]).width; ctx.fillStyle = SPEAKER_LABEL[L.speaker] ? C.radio : C.warden; ctx.fillRect(x0 + w + 4, y - fs * 0.72, fs * 0.42, fs * 0.78);
        }
        y -= fs * 1.22;
      }
      ctx.shadowBlur = 0;
      const label = SPEAKER_LABEL[L.speaker] ? (L.who || SPEAKER_LABEL[L.speaker]) : null;
      if (label) {
        ctx.font = `600 ${fs * 0.5}px ${FONT}`; ctx.letterSpacing = `${fs * 0.12}px`;
        ctx.fillStyle = isCur ? (L.speaker === 'command' ? '#e6c48f' : C.radio) : 'rgba(255,179,71,0.35)';
        ctx.fillText(`// ${label}`, x0 + 10, y + fs * 0.2);
        ctx.letterSpacing = '0px';
        y -= fs * 0.75;
      }
      y -= fs * 0.35;
    }

    // letterbox-felt: kapittel øverst, hint nederst
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    const sfs = Math.max(11, Math.min(16, H * 0.016));
    ctx.font = `600 ${sfs}px ${FONT}`; ctx.letterSpacing = `${sfs * 0.28}px`;
    ctx.fillStyle = 'rgba(57,198,255,0.75)'; ctx.fillText('BREACH', x0, bar * 0.62);
    const bw = ctx.measureText('BREACH').width;
    ctx.fillStyle = C.ui; ctx.fillText(`//  ${cs.chapter}  ${cs.title.toUpperCase()}`, x0 + bw + sfs, bar * 0.62);
    ctx.fillStyle = 'rgba(201,162,39,0.8)'; ctx.fillRect(x0, bar - 2, 36, 2);
    // panelindikator
    for (let i = 0; i < panels.length; i++) { ctx.fillStyle = i === pi ? 'rgba(217,212,199,0.8)' : 'rgba(217,212,199,0.2)'; ctx.fillRect(W - x0 - (panels.length - i) * 22, bar * 0.5, 16, 3); }
    ctx.textAlign = 'right'; ctx.fillStyle = C.ui; ctx.fillText(HINT, W - x0, H - bar * 0.42);
    ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
    if (lineDone && Math.floor(now / 500) % 2 === 0) { ctx.fillStyle = 'rgba(255,179,71,0.8)'; ctx.beginPath(); const ax = x0, ay = H - bar * 0.55; ctx.moveTo(ax, ay - 5); ctx.lineTo(ax + 8, ay); ctx.lineTo(ax, ay + 5); ctx.fill(); }

    // fade
    let k = 0;
    if (phase === 'in') k = pi === 0 ? 1 - phaseT / o.fadeIn : transIn(pi) === 'fade' ? 1 - phaseT / o.panelFade : 0;
    if (phase === 'out-panel') k = transIn(pi + 1) === 'fade' ? phaseT / o.panelFade : 0;
    if (phase === 'out') k = phaseT / o.fadeOut;
    if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, k))})`; ctx.fillRect(0, 0, W, H); }
    if (phase === 'in' && pi === 0) cv.style.opacity = String(Math.max(0, Math.min(1, phaseT / o.fadeIn * 1.5)));
    else if (phase !== 'out') cv.style.opacity = '1';
    if (phase === 'out') cv.style.opacity = String(Math.max(0, 1 - phaseT / o.fadeOut));
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

  function cleanup() {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKeyUp, true); removeEventListener('resize', resize);
    cv.remove(); active = false;
    swallowSpaceAfter(300);
    emit(o, 'cutsceneEnd', autoEnded ? { id, skipped, auto: true } : { id, skipped });
    resolveDone({ id, skipped });
  }
  return done;
}

export { CUTSCENES, SCENES };
