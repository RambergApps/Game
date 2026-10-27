// Hovedmeny (eies av Arena) – overlegg inne i index.html, ingen sidelasting.
// API:
//   attach(BREACH)            kalles én gang fra main.js; åpner menyen ved oppstart (unntak: ?skipmenu=1, og automatiserte
//                             nettlesere (navigator.webdriver) uten ?menu=1 – så tests/run.mjs og smoke går uendret).
//   openMainMenu(world?)      vis menyen (pausemenyens QUIT kaller den via arena.openMainMenu). Pauser spillet og stopper loopen.
//   closeMainMenu(reason?)    skjul uten å starte noe. Sender world.events: menuOpen {boot}, menuStart {level} (PLAY), menuClose {reason}.  isMainMenuOpen()
// PLAY = brett 1 (som «Click to start»). SETTINGS = Våpens ui/settingsScreen.openSettings. LEVEL SELECT er låst (ingen lagring ennå).
import { pushKeys, uiSound, isUp, isDown, isOk, isBack } from '../ui/style.js';
import { loadFonts } from './fonts.js';
import { renderLogo } from './logo.js';
import { createBackground } from './bg.js';
import { CSS } from './style.js';

const VERSION = 'v0.9 · CINDER';
const ITEMS = [
  { id: 'play', label: 'Play' },
  { id: 'levels', label: 'Level select', disabled: true, lock: 'LOCKED' },
  { id: 'settings', label: 'Settings' },
  { id: 'controls', label: 'Controls' },
  { id: 'credits', label: 'Credits' },
];
const CREDITS = [['Arena', 'Kessa Yard, Deepwell'], ['Character', 'The Warden'], ['Enemy AI', 'The Cinderborn'], ['Weapons & UI', 'Arsenal, settings'],
  ['VFX', 'Fire, ash, impacts'], ['Audio', 'Score and sound'], ['Levels & Story', 'Operation Cinder']];

let B = null, root = null, bg = null, popKeys = null, sel = 0, btns = [], sub = null, busy = false, logoState = null, logoRaf = 0, toastT = 0;
import { showLoading } from './loading.js';
const q = () => new URLSearchParams(location.search);

/** Kobles på fra main.js etter at window.BREACH er satt. */
export function attach(breach) {
  B = breach || window.BREACH || null;
  if (!B) return;
  if (B.startGame && !B.startGame._menu) {                 // BREACH.startGame() (tester) lukker menyen først
    const orig = B.startGame;
    B.startGame = Object.assign((...a) => { if (root) closeMainMenu(); B.loop?.start?.(); return orig(...a); }, { _menu: true, orig });
  }
  B.menu = { open: openMainMenu, close: closeMainMenu, isOpen: isMainMenuOpen };
  const p = q();
  const boot = () => document.getElementById('boot-black')?.remove();   // svart fra første bilde (index.html) til menyen dekker
  // Hakk 27.10: lasteskjerm (src/menu/loading.js) til arenabakingen er ferdig, så menyen; svart hele veien
  const go = () => { if (p.get('skipmenu') === '1' || (navigator.webdriver && p.get('menu') !== '1')) return boot(); openMainMenu(B.world, { boot: true }); boot(); };
  showLoading(B.world).then(go);
}

export function isMainMenuOpen() { return !!root; }

export function openMainMenu(world, opts = {}) {
  B = B || window.BREACH || null;
  const w = world || B?.world;
  if (root) return true;
  if (w) w.paused = true;
  const ss = document.getElementById('start-screen'); if (ss) ss.style.display = 'none';
  B?.loop?.stop?.();
  injectCss();
  root = document.createElement('div'); root.className = 'bm-root'; root.dataset.ui = 'main-menu';
  root.innerHTML = `<canvas class="bm-bg"></canvas><div class="bm-read"></div><div class="bm-strip"></div>
    <div class="bm-col"><div class="bm-logo"><canvas></canvas><canvas></canvas><canvas></canvas></div><div class="bm-sub">OPERATION CINDER</div><div class="bm-list"></div></div>
    <div class="bm-ver">${VERSION}</div><div class="bm-hint"><i></i><b>ENTER</b>&nbsp;SELECT&nbsp;&nbsp;·&nbsp;&nbsp;<b>ESC</b>&nbsp;BACK</div><div class="bm-toast"></div><div class="bm-black"></div>`;
  document.body.appendChild(root);
  const list = root.querySelector('.bm-list');
  btns = ITEMS.map((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bm-btn' + (it.disabled ? ' bm-off' : ''); b.dataset.id = it.id;
    b.innerHTML = `<span class="bm-face"></span><span class="bm-bar"></span><span class="bm-txt">${it.label}</span>${it.lock ? `<span class="bm-lock">${it.lock}</span>` : '<span class="bm-chev">›</span>'}`;
    b.style.transitionDelay = `${1.35 + i * 0.06}s`;
    b.setAttribute('aria-disabled', it.disabled ? 'true' : 'false'); b.tabIndex = -1;
    b.addEventListener('pointerenter', () => { if (!it.disabled) setSel(i, true); });   // deaktivert: ingen hover (MENY-STIL)
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!it.disabled) b.classList.add('bm-down'); });
    b.addEventListener('pointerleave', () => b.classList.remove('bm-down'));
    b.addEventListener('click', (e) => { e.preventDefault(); activate(i); });
    list.appendChild(b); return b;
  });
  sel = 0; setSel(0, false); busy = false;
  bg = createBackground(root.querySelector('.bm-bg'));
  popKeys = pushKeys({ onKey });
  bg.ready.then(() => { if (!root) return; bg.start(); requestAnimationFrame(() => requestAnimationFrame(() => root?.classList.add('bm-in'))); });
  loadFonts().then(() => { if (root) buildLogo(); });
  addEventListener('resize', onResize);
  // sikkerhetsnett: vis menyen selv om bilder/fonter henger
  setTimeout(() => root?.classList.add('bm-in'), 2500);
  menuEmit(w, 'menuOpen', { boot: !!opts.boot });
  return true;
}

export function closeMainMenu(reason = 'close') {
  if (!root) return;
  menuEmit(B?.world, 'menuClose', { reason });
  removeEventListener('resize', onResize); popKeys?.(); popKeys = null; bg?.stop(); bg = null; cancelAnimationFrame(logoRaf);
  root.remove(); root = null; btns = []; busy = false;
  for (const s of activeSubs) s.close?.(); activeSubs.length = 0;
}

// ---------------------------------------------------------------- intern
// Hendelser for Lyd m.fl.: 'menuOpen' {boot}, 'menuStart' {level} (PLAY trykket, ~720 ms før lukking), 'menuClose' {reason:'play'|'close'}
function menuEmit(w, name, data) { try { w?.events?.emit?.(name, data); } catch (e) { console.warn('[menu]', name, e); } }
let logoScale = 0, resizeT = 0;
function onResize() {   // logoen tegnes på nytt når skalaen endres mye (ellers blir den uskarp ved forstørring)
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); if (root && logoScale && Math.abs(s / logoScale - 1) > 0.2) { cancelAnimationFrame(logoRaf); buildLogo(); } }, 200);
}
function injectCss() {
  if (document.getElementById('bm-style')) return;
  const s = document.createElement('style'); s.id = 'bm-style'; s.textContent = CSS; document.head.appendChild(s);
}
function setSel(i, sound) {
  if (i === sel && btns[i]?.classList.contains('bm-sel')) return;
  sel = i; btns.forEach((b, k) => b.classList.toggle('bm-sel', k === i));
  if (sound) uiSound(B?.world, 'uiHover');
}
function move(d) { let i = sel; for (let k = 0; k < btns.length; k++) { i = (i + d + btns.length) % btns.length; if (!ITEMS[i].disabled) break; } setSel(i, true); }   // hopper over låste
function onKey(e) {
  if (busy) return;
  if (isUp(e)) move(-1);
  else if (isDown(e)) move(1);
  else if (isOk(e)) { const b = btns[sel]; if (!ITEMS[sel].disabled) { b.classList.add('bm-down'); setTimeout(() => b.classList.remove('bm-down'), 80); } activate(sel); }
  else if (isBack(e)) { /* toppnivå: ingenting å gå tilbake til */ }
}
function toast(msg) {
  const t = root?.querySelector('.bm-toast'); if (!t) return;
  t.textContent = msg; t.classList.add('bm-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('bm-on'), 1600);
}
function activate(i) {
  const it = ITEMS[i]; if (!it || busy) return;
  if (it.disabled) { toast('COMPLETE CHAPTER 01 TO UNLOCK'); return; }
  uiSound(B?.world, 'uiClick');
  if (it.id === 'play') return play();
  if (it.id === 'settings') return openSettingsScreen();
  if (it.id === 'controls') return openControlsScreen();
  if (it.id === 'credits') return openCredits();
}

// Svart dekke under menyen (z 39) fra PLAY til intro-cutscenen er helt inntonet (z 50, opacity 1) –
// ingen arena-frame mellom meny og første mellomsekvens. Fjernes også hvis ingen cutscene kommer (maks 8 s).
function blackUntilCutscene() {
  const c = document.createElement('div'); c.id = 'bm-black';
  Object.assign(c.style, { position: 'fixed', inset: '0', background: '#000', zIndex: '39', pointerEvents: 'none' });
  document.body.appendChild(c);
  const t0 = performance.now(); let seen = false;
  const tick = () => {
    const cv = document.querySelector('canvas.breach-cutscene'), dt = performance.now() - t0;
    if (cv) seen = true;
    if ((cv && cv.style.opacity === '1') || (seen && !cv) || dt > 8000 || (dt > 1500 && !cv && B?.world && !B.world.paused)) return c.remove();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function play() {
  blackUntilCutscene();
  busy = true; menuEmit(B?.world, 'menuStart', { level: 1 }); bg?.flare(0.7); if (logoState) logoState.flareT = performance.now();
  setTimeout(() => btns[sel]?.classList.remove('bm-down'), 80);
  setTimeout(() => root?.classList.add('bm-out'), 260);
  setTimeout(() => { startLevelOne(); }, 720);
}
function startLevelOne() {
  const w = B?.world;
  closeMainMenu('play');
  B?.loop?.start?.();
  const ss = document.getElementById('start-screen');
  if (ss && B?.startGame) { const f = B.startGame.orig || B.startGame; ss.style.display = ''; f(); return; }   // første gang: main.js sin start
  const L = w?.modules?.levels;
  if (w && L?.startLevel) { w.paused = false; L.startLevel(w, 1); }
}

// Undersider (settings/credits) – menyen ligger under, egen tastehandler øverst på stabelen.
const activeSubs = [];
async function openSettingsScreen() {
  busy = true;
  let api = null;
  try { api = await import('../ui/settingsScreen.js'); } catch (e) { api = null; }
  busy = false;
  if (!root) return;
  if (!api?.openSettings) { toast('SETTINGS NOT AVAILABLE YET'); return; }
  const s = api.openSettings(document.body, { world: B?.world, kicker: 'Main menu', scrim: true, onBack: () => { const k = activeSubs.indexOf(s); if (k >= 0) activeSubs.splice(k, 1); } });
  if (s?.el) s.el.style.zIndex = '60';
  activeSubs.push(s);
}
async function openControlsScreen() {
  busy = true;
  let api = null;
  try { api = await import('../ui/controlsScreen.js'); } catch (e) { api = null; }
  busy = false;
  if (!root) return;
  if (!api?.openControls) { toast('CONTROLS NOT AVAILABLE YET'); return; }
  const s = api.openControls(document.body, { world: B?.world, kicker: 'Main menu', scrim: true, onBack: () => { const k = activeSubs.indexOf(s); if (k >= 0) activeSubs.splice(k, 1); } });
  if (s?.el) s.el.style.zIndex = '60';
  activeSubs.push(s);
}
function openCredits() {
  const c = document.createElement('div'); c.className = 'bm-credits';
  c.innerHTML = `<div class="bm-panel"><h2>CREDITS</h2>${CREDITS.map(([a, b]) => `<p><b>${a.toUpperCase()}</b>${b}</p>`).join('')}
    <p style="margin-top:calc(var(--s)*18)">Barlow Condensed © The Barlow Project Authors, SIL OFL 1.1</p><div class="bm-back">ESC BACK</div></div>`;
  root.appendChild(c);
  const close = () => { pop(); c.remove(); const k = activeSubs.indexOf(sub); if (k >= 0) activeSubs.splice(k, 1); uiSound(B?.world, 'uiClick'); };
  const pop = pushKeys({ onKey: (e) => { if (isBack(e) || isOk(e)) close(); } });
  c.addEventListener('click', close);
  const sub = { close: () => { pop(); c.remove(); } }; activeSubs.push(sub);
}

// Logo: tre lerreter (glød bak, stål, sprekkeglød) i høy oppløsning; glødkanten pulserer i takt med glo-laget (0,4–0,6).
function buildLogo() {
  const box = root.querySelector('.bm-logo'), [cg, cs, cc] = box.querySelectorAll('canvas');
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080); logoScale = scale; const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(250 * scale * dpr);
  const L = renderLogo(Math.max(60, px));
  for (const [c, src] of [[cg, L.glow], [cs, L.steel], [cc, L.crack]]) { c.width = L.w; c.height = L.h; c.getContext('2d').drawImage(src, 0, 0); }
  const k = 250 / px; // css-px i 1920-skala per lerretspiksel
  box.style.width = `calc(var(--s) * ${(L.w * k).toFixed(1)})`; box.style.height = `calc(var(--s) * ${(L.h * k).toFixed(1)})`;
  box.style.marginLeft = `calc(var(--s) * ${(-L.pad * k).toFixed(1)})`; box.style.marginTop = `calc(var(--s) * ${(-L.pad * k).toFixed(1)})`;
  logoState = { flareT: -1e9 };
  const tick = () => {
    if (!root) return;
    const p = bg ? bg.pulse() : 0.5, fl = Math.max(0, 1 - (performance.now() - logoState.flareT) / 600);
    cg.style.opacity = String(0.4 + 0.2 * p + fl * 0.4);
    cc.style.opacity = String(0.35 + 0.25 * p + fl * 0.65);
    logoRaf = requestAnimationFrame(tick);
  };
  tick();
}
