// Pausemeny. Esc veksler world.paused. RESUME / SETTINGS / RESTART WAVE / QUIT TO MENU.
// createPauseMenu(world, { input, onRestartWave, onQuit, confirm, canOpen, pauseOnBlur }) → { open, close, toggle, isOpen, destroy }
import { openSettings } from './settingsScreen.js';
import { openControls } from './controlsScreen.js';   // CONTROLS (Arena 27.10)
import { injectStyle, pushKeys, el, uiSound, isUp, isDown, isOk, isBack, isLeft, isRight } from './style.js';

const ITEMS = [
  { id: 'resume', label: 'Resume' },
  { id: 'settings', label: 'Settings' },
  { id: 'controls', label: 'Controls' },
  { id: 'restart', label: 'Restart wave', confirm: { title: 'Restart wave?', text: 'Enemies and progress in this wave are reset. Upgrades are kept.', ok: 'Restart' } },
  { id: 'quit', label: 'Quit to menu', danger: true, confirm: { title: 'Quit to menu?', text: 'Progress in the current level will be lost.', ok: 'Quit' } },
];

/** Standard: åpner ikke over mellomsekvens, startskjerm, kort-valg eller annen pause som noen andre eier. */
function defaultCanOpen(world) {
  if (world.paused) return false;                                   // levels/story/main.js eier pausen nå
  if (document.querySelector('.breach-cutscene, #start-screen')) return false;
  if (world.player?.dead) return false;                             // dødsfasen styres av levels
  return true;
}

/** Linje under tittelen: «KESSA YARD · WAVE 2 OF 5 · FIRST CONTACT» når levels eksponerer _debug, ellers world.level. */
function contextLine(world) {
  try {
    const d = world.modules?.levels?._debug?.(world);
    const parts = [];
    if (d?.level?.name) parts.push(d.level.name);
    if (d?.wave && d.level?.waves) parts.push(`Wave ${d.wi + 1} of ${d.level.waves.length}`);
    else if (world.level?.wave) parts.push(`Wave ${world.level.wave}`);
    if (d?.wave?.name) parts.push(d.wave.name);
    return parts.join('  ·  ');
  } catch { return ''; }
}

export function createPauseMenu(world, opts = {}) {
  injectStyle();
  const input = opts.input ?? world.input ?? null;
  const canOpen = opts.canOpen ?? defaultCanOpen;
  let root = null, panel = null, toast = null, settings = null, modal = null, popKeys = null;
  let items = [], fi = 0, pausedByMe = false, toastT = 0;

  // Esc når menyen er lukket: lytter i capture-fasen, men slipper tasten videre hvis vi ikke åpner (mellomsekvens-skip osv.).
  const onGlobalKey = (e) => {
    if (root || e.code !== 'Escape' || e.repeat) return;
    if (!canOpen(world)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    open();
  };
  addEventListener('keydown', onGlobalKey, true);
  const onBlur = () => { if (opts.pauseOnBlur && !root && canOpen(world)) open(); };
  addEventListener('blur', onBlur);

  function releaseInput() {
    // Ingen knapp «henger» etter menyen: slipp musknapper og glem trykk som kom før pausen.
    input?.reset?.();   // holdte taster (W osv.) tømmes også, så spilleren ikke går videre etter menyen
    if (!input?.mouse) return;
    input.mouse.left = input.mouse.right = false; input.mouse.leftPressed = input.mouse.rightPressed = false; input.mouse.wheel = 0;
    input.endFrame?.();
  }

  function build() {
    root = el('div', 'bx-root bx-enter'); root.dataset.ui = 'pause';
    root.appendChild(el('div', 'bx-scrim'));
    panel = el('div', 'bx-panel');
    const ctx = contextLine(world);
    panel.innerHTML = `<div class="bx-hazard"></div><div class="bx-kicker">Operation suspended</div><h1 class="bx-title">Paused<b>//</b></h1>` +
      `<div class="bx-sub">${ctx ? `<i></i><span>${ctx}</span>` : '<i></i><span>Warden W-09 · Garrison 9</span>'}</div>`;
    const list = el('div', 'bx-list'); panel.appendChild(list);
    items = ITEMS.map((it, i) => {
      const b = el('button', `bx-item${it.danger ? ' bx-danger' : ''}`, `<span class="bx-num">0${i + 1}</span><span>${it.label}</span><span class="bx-chev"></span>`);
      b.type = 'button'; b.dataset.id = it.id;
      b.addEventListener('pointerenter', () => { if (!modal) setFocus(i); });
      b.addEventListener('click', (e) => { e.stopPropagation(); if (!modal) { setFocus(i, false); choose(it); } });
      list.appendChild(b); return { ...it, node: b };
    });
    toast = el('div', 'bx-toast'); panel.appendChild(toast);
    panel.appendChild(el('div', 'bx-hints', '<span><span class="bx-key">↑↓</span>Select</span><span><span class="bx-key">Enter</span>Confirm</span><span><span class="bx-key">Esc</span>Resume</span>'));
    root.appendChild(panel);
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click', 'wheel']) root.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
    root.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
    document.body.appendChild(root);
    setTimeout(() => root?.classList.remove('bx-enter'), 260);
  }

  function setFocus(i, sound = true) {
    if (!items[i]) return;
    if (i !== fi && sound) uiSound(world, 'uiHover');
    items[fi]?.node.classList.remove('bx-focus'); fi = i; items[fi].node.classList.add('bx-focus');
  }
  function say(msg) { if (!toast) return; toast.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => { if (toast) toast.textContent = ''; }, 2600); }

  function choose(it) {
    uiSound(world, 'uiClick');
    if (it.id === 'resume') return close();
    if (it.id === 'settings') return showSettings();
    if (it.id === 'controls') { panel.style.display = 'none'; settings = openControls(root, { world, kicker: 'Paused', onBack: () => { settings = null; if (panel) panel.style.display = ''; } }); return; }
    const needConfirm = opts.confirm !== false && it.confirm;
    if (needConfirm) return confirmBox(it.confirm, () => run(it.id));
    run(it.id);
  }

  /** Restart/quit: callback → modulfunksjon → hendelse. Hendelsen får { handled:false }; en lytter setter handled = true. */
  function run(id) {
    if (id === 'restart') {
      const lv = world.modules?.levels;
      let ok = false;
      if (typeof opts.onRestartWave === 'function') ok = opts.onRestartWave(world) !== false;   // false = ikke håndtert → neste ledd
      if (!ok && typeof lv?.restartWave === 'function') ok = lv.restartWave(world) !== false;
      if (!ok) { const p = { world, handled: false }; world.events.emit('ui:restartWave', p); ok = p.handled; }
      if (!ok) { say('Wave restart is not available yet'); return; }
      close();
    } else if (id === 'quit') {
      const ar = world.modules?.arena;
      let ok = false;
      teardown(); pausedByMe = false;                       // menyen lukkes, men pausen beholdes – hovedmenyen tar over
      if (typeof opts.onQuit === 'function') ok = opts.onQuit(world) !== false;
      if (!ok && typeof ar?.openMainMenu === 'function') ok = ar.openMainMenu(world) !== false;
      if (!ok) { const p = { world, handled: false }; world.events.emit('ui:quitToMenu', p); ok = p.handled; }
      if (!ok) location.reload();                           // reserve: tilbake til «Click to start»
    }
  }

  function confirmBox(c, onOk) {
    modal = el('div', 'bx-modal');
    const d = el('div', 'bx-dialog', `<h3>${c.title}</h3><p>${c.text}</p>`);
    const acts = el('div', 'bx-actions');
    const mk = (label, cls, fn) => { const b = el('button', `bx-item ${cls}`, `<span>${label}</span><span class="bx-chev"></span>`); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); acts.appendChild(b); return b; };
    let sel = 1;
    const btns = [mk(c.ok, 'bx-danger', () => yes()), mk('Cancel', '', () => no())];
    const show = () => btns.forEach((b, i) => b.classList.toggle('bx-focus', i === sel));
    btns.forEach((b, i) => b.addEventListener('pointerenter', () => { if (sel !== i) { sel = i; show(); uiSound(world, 'uiHover'); } }));
    d.appendChild(acts); modal.appendChild(d); root.appendChild(modal); show();
    const pop = pushKeys({ onKey(e) {
      if (isBack(e)) { if (!e.repeat) no(); }
      else if (isLeft(e) || isRight(e) || isUp(e) || isDown(e)) { sel = 1 - sel; show(); uiSound(world, 'uiHover'); }
      else if (isOk(e) && !e.repeat) (sel === 0 ? yes : no)();
    } });
    function done() { pop(); modal?.remove(); modal = null; }
    function yes() { uiSound(world, 'uiClick'); done(); onOk(); }
    function no() { uiSound(world, 'uiClick'); done(); }
  }

  function showSettings() {
    panel.style.display = 'none';
    settings = openSettings(root, { world, kicker: 'Paused', onBack: () => { settings = null; if (panel) panel.style.display = ''; } });
  }

  function open() {
    if (root) return;
    if (!world.paused) { world.paused = true; pausedByMe = true; }
    build(); setFocus(0, false);
    popKeys = pushKeys({ onKey(e) {
      if (isBack(e)) { if (!e.repeat) { uiSound(world, 'uiClick'); close(); } return; }
      if (isUp(e)) setFocus((fi - 1 + items.length) % items.length);
      else if (isDown(e)) setFocus((fi + 1) % items.length);
      else if (isOk(e) && !e.repeat) choose(items[fi]);
    } });
    releaseInput();
    world.events.emit('ui:pause', { world });
  }

  function teardown() {
    settings?.close(); settings = null;
    if (modal) { modal.remove(); modal = null; }
    popKeys?.(); popKeys = null;
    clearTimeout(toastT);
    root?.remove(); root = panel = toast = null;
    releaseInput();
  }

  function close() {
    if (!root) return;
    teardown();
    if (pausedByMe) { world.paused = false; pausedByMe = false; }
    world.events.emit('ui:resume', { world });
  }

  return {
    open, close,
    toggle() { root ? close() : canOpen(world) && open(); },
    isOpen: () => !!root,
    get settingsOpen() { return !!settings; },
    destroy() { teardown(); removeEventListener('keydown', onGlobalKey, true); removeEventListener('blur', onBlur); },
  };
}
