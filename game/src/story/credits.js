// BREACH – rulletekst (eies av Breach Nivåer og story). Spilles etter sluttsekvensen «ending».
// showCredits(opts) → Promise<{ skipped }>. Teksten ruller langsomt over mørk bakgrunn med svake glør.
// Esc hopper over · hold Enter/museknapp (eller Space, som konsumeres) = raskere rulling.
// Hendelser (for Lyd, samme kanal som mellomsekvensene): creditsStart {} → creditsEnd { skipped }.
// Effekter utover enkel glød/aske hører til Breach Effekter.
import { loadFont, emit, swallowSpaceAfter } from './player.js';

const FONT = '"Barlow Condensed", "Bahnschrift SemiCondensed", "Arial Narrow", sans-serif';
const AI = (role) => `Breach ${role} (Grok Bot)`;

/** Innhold (spilltekst på engelsk). kind: title | sub | role | name | gap | small | end */
export const CREDITS = [
  { kind: 'title', text: 'BREACH' },
  { kind: 'sub', text: 'CINDER  //  THE DEEPWELL' },
  { kind: 'gap', h: 120 },
  { kind: 'role', text: 'Direction' }, { kind: 'name', text: 'Alexander Nielsen' },
  { kind: 'role', text: 'Project lead' }, { kind: 'name', text: AI('Project Lead') },
  { kind: 'role', text: 'Character' }, { kind: 'name', text: AI('Character') },
  { kind: 'role', text: 'Arena' }, { kind: 'name', text: AI('Arena') },
  { kind: 'role', text: 'Enemy AI' }, { kind: 'name', text: AI('Enemy AI') },
  { kind: 'role', text: 'Enemy design' }, { kind: 'name', text: AI('Enemy Design') },
  { kind: 'role', text: 'Weapons' }, { kind: 'name', text: AI('Weapons') },
  { kind: 'role', text: 'Audio' }, { kind: 'name', text: AI('Audio') },
  { kind: 'role', text: 'Effects' }, { kind: 'name', text: AI('Effects') },
  { kind: 'role', text: 'Cutscene art' }, { kind: 'name', text: AI('Cutscene Art') },
  { kind: 'role', text: 'Levels & story' }, { kind: 'name', text: AI('Levels & Story') },
  { kind: 'role', text: 'Test' }, { kind: 'name', text: AI('Test') },
  { kind: 'gap', h: 90 },
  { kind: 'role', text: 'Garrison Nine' }, { kind: 'name', text: 'The Warden  ·  Hale  ·  Okafor  ·  Brandt' },
  { kind: 'gap', h: 90 },
  { kind: 'role', text: 'Typeface' }, { kind: 'name', text: 'Barlow Condensed' },
  { kind: 'small', text: '© 2017 The Barlow Project Authors  ·  SIL Open Font License 1.1' },
  { kind: 'gap', h: 50 },
  { kind: 'small', text: 'Built with plain JavaScript and Canvas 2D. No engine.' },
  { kind: 'gap', h: 260 },
  { kind: 'end', text: 'Garrison Nine. Stand down.' },
];

// layout i referansehøyde 1080 (skaleres med u = H / 1080)
const STYLE = {
  title: { size: 120, weight: 600, track: 28, col: '#e8e2d4', h: 150 },
  sub: { size: 26, weight: 600, track: 9, col: '#ffb347', h: 60 },
  role: { size: 20, weight: 600, track: 6, col: 'rgba(255,179,71,0.85)', h: 34, upper: true },
  name: { size: 34, weight: 400, track: 1.5, col: '#d9d4c7', h: 78 },
  small: { size: 20, weight: 400, track: 1, col: 'rgba(217,212,199,0.5)', h: 36 },
  end: { size: 40, weight: 600, track: 4, col: '#e8e2d4', h: 60 },
};
const DEF = { speed: 55, fast: 5, hold: 3.2, fadeIn: 1.2, fadeOut: 1.4, zIndex: 50, parent: null, world: null, items: CREDITS };

let running = null;

/** Vis rulleteksten. → Promise<{ skipped }>. Kalles den mens en allerede går, returneres samme løfte. */
export function showCredits(opts = {}) {
  if (running) return running;
  running = play({ ...DEF, ...opts }).finally(() => { running = null; });
  return running;
}
export const creditsActive = () => !!running;

async function play(o) {
  await loadFont();
  const parent = o.parent || document.body;
  const cv = document.createElement('canvas');
  cv.className = 'breach-credits'; cv.setAttribute('role', 'dialog'); cv.setAttribute('aria-label', 'Credits'); cv.tabIndex = -1;
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: String(o.zIndex), background: '#050506', outline: 'none', cursor: 'default' });
  parent.appendChild(cv); cv.focus({ preventScroll: true });
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
  resize(); addEventListener('resize', resize);

  // layout (referanse-px); endItem stopper i midten
  const items = o.items.map((it) => ({ ...it, st: STYLE[it.kind] }));
  let y = 0; for (const it of items) { it.y = y; y += it.kind === 'gap' ? it.h : it.st.h; }
  const endY = items.find((i) => i.kind === 'end')?.y ?? y;

  // glør: svake, langsomme, oransje prikker som stiger
  const rnd = Math.random;
  const embers = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), r: 0.6 + rnd() * 1.8, v: 0.012 + rnd() * 0.03, s: rnd() * 6.28, a: 0.15 + rnd() * 0.45 }));

  let scroll = 0, t = 0, holdT = 0, out = 0, skipped = false, fast = false, phase = 'roll', last = performance.now();
  let resolveDone; const done = new Promise((r) => (resolveDone = r));
  const onKey = (e) => {
    if (e.type === 'keydown') e.stopImmediatePropagation();   // keyup slippes gjennom til core/input.js
    if (e.code === 'Escape') { e.preventDefault(); if (phase !== 'out') { skipped = true; phase = 'out'; } }
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); fast = e.type === 'keydown'; }
  };
  const onDown = (e) => { e.preventDefault(); fast = true; };
  const onUp = () => { fast = false; };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  cv.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp);
  emit(o, 'creditsStart', {});

  const text = (it, cx, cy, u) => {
    const st = it.st; ctx.font = `${st.weight} ${st.size * u}px ${FONT}`; ctx.fillStyle = st.col;
    const s = st.upper ? it.text.toUpperCase() : it.text;
    if ('letterSpacing' in ctx) { ctx.letterSpacing = `${st.track * u}px`; ctx.fillText(s, cx + (st.track * u) / 2, cy); ctx.letterSpacing = '0px'; }
    else ctx.fillText(s, cx, cy);
  };

  function frame(nowMs) {
    const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
    const u = H / 1080;
    if (phase === 'roll') {
      scroll += o.speed * (fast ? o.fast : 1) * dt;
      // sluttlinjen når midten av skjermen: stopp og hold
      if (H - scroll * u + (endY + STYLE.end.size) * u <= H / 2) phase = 'hold';
    } else if (phase === 'hold') { holdT += dt * (fast ? 3 : 1); if (holdT >= o.hold) phase = 'out'; }
    else out += dt;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H);
    // svak glød nedenfra (varmen som dør)
    const gl = ctx.createRadialGradient(W / 2, H * 1.15, 0, W / 2, H * 1.15, H * 0.9);
    gl.addColorStop(0, `rgba(255,110,30,${0.16 + 0.03 * Math.sin(t * 0.7)})`); gl.addColorStop(1, 'rgba(255,110,30,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    // glør
    for (const e of embers) {
      e.y -= e.v * dt; e.s += dt * 0.6;
      if (e.y < -0.02) { e.y = 1.02; e.x = rnd(); }
      const fade = Math.min(1, e.y * 1.6) * e.a * (0.6 + 0.4 * Math.sin(t * 2 + e.s * 3));
      ctx.fillStyle = `rgba(255,${130 + (e.r * 30) | 0},60,${fade.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(e.x * W + Math.sin(e.s) * 14 * u, e.y * H, e.r * u, 0, 6.283); ctx.fill();
    }
    // tekst
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const base = H - scroll * u; // første linje starter rett under skjermkanten
    for (const it of items) {
      if (it.kind === 'gap') continue;
      const cy = (it.kind === 'end' && phase !== 'roll') ? H / 2 : base + it.y * u + it.st.size * u;
      if (cy < -200 * u || cy > H + 200 * u) continue;
      // myk inn-/uttoning i kantene
      const edge = Math.min(1, Math.max(0, Math.min(cy / (H * 0.18), (H - cy) / (H * 0.18))));
      ctx.globalAlpha = edge;
      if (it.kind === 'title') { ctx.save(); ctx.shadowColor = 'rgba(255,122,26,0.35)'; ctx.shadowBlur = 30 * u; text(it, W / 2, cy, u); ctx.restore(); }
      else text(it, W / 2, cy, u);
    }
    ctx.globalAlpha = 1;
    // inn-/uttoning
    const a = phase === 'out' ? Math.min(1, out / o.fadeOut) : Math.max(0, 1 - t / o.fadeIn);
    if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
    if (t < 6 && phase === 'roll') { ctx.font = `400 ${13 * u}px ${FONT}`; ctx.fillStyle = `rgba(200,210,220,${0.4 * Math.min(1, t / 1.5) * Math.min(1, (6 - t) / 1.5)})`; ctx.textAlign = 'right'; ctx.fillText('HOLD ENTER / CLICK  FASTER     ESC  SKIP', W - 24 * u, H - 22 * u); }
    if (phase === 'out' && out >= o.fadeOut) return finish();
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);
  function finish() {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true);
    removeEventListener('pointerup', onUp); removeEventListener('resize', resize);
    cv.remove(); swallowSpaceAfter(300);
    emit(o, 'creditsEnd', { skipped });
    resolveDone({ skipped });
  }
  return done;
}
