// SETTINGS-skjermen – frittstående og gjenbrukbar (pausemeny + Arenas hovedmeny).
// openSettings(container?, { onBack, world, scrim }) → { el, close, refresh, focus(i) }
import { getSettings, setSetting, resetSettings, onSettingsChange, SCHEMA, DEFAULTS } from './settings.js';
import { injectStyle, pushKeys, el, uiSound, isUp, isDown, isLeft, isRight, isOk, isBack } from './style.js';

const pct = (v) => `${Math.round(v * 100)}%`;
/** Radoppsett. fmt = visning av verdien; off = vis dempet når verdien er 0. */
export const SETTINGS_LAYOUT = [
  { section: 'Audio' },
  { key: 'master', label: 'Master volume', fmt: pct, off: true },
  { key: 'music', label: 'Music', fmt: pct, off: true },
  { key: 'sfx', label: 'Sound effects', fmt: pct, off: true },
  { key: 'voice', label: 'Voice', fmt: pct, off: true },
  { section: 'Controls' },
  { key: 'mouseSensitivity', label: 'Mouse sensitivity', fmt: (v) => `×${v.toFixed(2)}` },
  { key: 'aimAssist', label: 'Aim assist', fmt: (v) => (v <= 0 ? 'OFF' : pct(v)), off: true },
  { section: 'Display' },
  { key: 'screenShake', label: 'Screen shake', fmt: (v) => (v <= 0 ? 'OFF' : pct(v)), off: true },
  { key: 'showFps', label: 'Show FPS' },
  { key: 'damageIndicator', label: 'Damage direction' },
  { key: 'offscreenEnemies', label: 'Off-screen enemies' },
];

export function openSettings(container, opts = {}) {
  const { onBack = null, world = null } = opts;
  injectStyle();
  const host = container || document.body;
  const standalone = host === document.body || opts.scrim === true;
  const root = el('div', `bx-root bx-enter${host === document.body ? '' : ' bx-inline'}`);
  root.dataset.ui = 'settings';
  if (standalone && opts.scrim !== false) root.appendChild(el('div', 'bx-scrim'));
  const panel = el('div', 'bx-panel bx-wide');
  panel.innerHTML = `<div class="bx-hazard"></div><div class="bx-kicker">${opts.kicker ?? 'System'}</div><h1 class="bx-title">Settings<b>//</b></h1>`;
  const body = el('div'); panel.appendChild(body);
  root.appendChild(panel);

  const focusables = [];   // { node, kind:'range'|'bool'|'action', key?, act? }
  const views = {};        // key → oppdateringsfunksjon
  let fi = 0;

  for (const row of SETTINGS_LAYOUT) {
    if (row.section) { body.appendChild(el('div', 'bx-sec', row.section)); continue; }
    const s = SCHEMA[row.key];
    const r = el('div', 'bx-row'); r.dataset.key = row.key;
    r.appendChild(el('div', 'bx-lab', row.label));
    const ctl = el('div', 'bx-ctl'); r.appendChild(ctl);
    const f = { node: r, kind: s.type, key: row.key };
    if (s.type === 'range') {
      const track = el('div', 'bx-track'), fill = el('div', 'bx-fill'), knob = el('div', 'bx-knob'), val = el('div', 'bx-val');
      track.append(el('div', 'bx-ticks'), fill, knob); ctl.append(track, val);
      views[row.key] = (v) => {
        const t = (v - s.min) / (s.max - s.min);
        fill.style.width = `${t * 100}%`; knob.style.left = `${t * 100}%`;
        val.textContent = row.fmt(v); val.classList.toggle('bx-off', !!row.off && v <= 0);
      };
      const fromX = (cx) => { const b = track.getBoundingClientRect(); const t = Math.min(1, Math.max(0, (cx - b.left) / b.width)); return s.min + Math.round((t * (s.max - s.min)) / s.step) * s.step; };
      track.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); track.setPointerCapture?.(e.pointerId);
        setFocus(focusables.indexOf(f), false);
        setSetting(row.key, fromX(e.clientX));
        const move = (m) => setSetting(row.key, fromX(m.clientX));
        const up = () => { track.removeEventListener('pointermove', move); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); uiSound(world, 'uiClick'); };
        track.addEventListener('pointermove', move); track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
      });
    } else {
      const seg = el('div', 'bx-seg'), off = el('span', '', 'OFF'), on = el('span', '', 'ON');
      seg.append(off, on); ctl.appendChild(seg);
      views[row.key] = (v) => { on.classList.toggle('bx-on', !!v); off.classList.toggle('bx-on', !v); };
      off.addEventListener('click', (e) => { e.stopPropagation(); setFocus(focusables.indexOf(f), false); if (getSettings()[row.key]) { setSetting(row.key, false); uiSound(world, 'uiClick'); } });
      on.addEventListener('click', (e) => { e.stopPropagation(); setFocus(focusables.indexOf(f), false); if (!getSettings()[row.key]) { setSetting(row.key, true); uiSound(world, 'uiClick'); } });
      r.addEventListener('click', () => activate(f));
    }
    r.addEventListener('pointerenter', () => setFocus(focusables.indexOf(f)));
    focusables.push(f); body.appendChild(r);
    if (row.key === 'mouseSensitivity' && opts.sensitivityNote) body.appendChild(el('div', 'bx-note', opts.sensitivityNote));
  }

  const actions = el('div', 'bx-actions');
  const mkAction = (label, act, danger) => {
    const b = el('button', `bx-item${danger ? ' bx-danger' : ''}`, `<span>${label}</span><span class="bx-chev"></span>`); b.type = 'button';
    const f = { node: b, kind: 'action', act };
    b.addEventListener('pointerenter', () => setFocus(focusables.indexOf(f)));
    b.addEventListener('click', (e) => { e.stopPropagation(); setFocus(focusables.indexOf(f), false); activate(f); });
    focusables.push(f); actions.appendChild(b); return f;
  };
  mkAction('Reset defaults', 'reset', true);
  mkAction('Back', 'back');
  panel.appendChild(actions);
  panel.appendChild(el('div', 'bx-hints', '<span><span class="bx-key">↑↓</span>Select</span><span><span class="bx-key">←→</span>Adjust</span><span><span class="bx-key">Enter</span>Toggle</span><span><span class="bx-key">Esc</span>Back</span>'));

  function refresh() { const s = getSettings(); for (const k in views) views[k](s[k]); }
  function setFocus(i, sound = true) {
    if (i < 0 || i >= focusables.length) return;
    if (i !== fi && sound) uiSound(world, 'uiHover');
    focusables[fi]?.node.classList.remove('bx-focus'); fi = i; focusables[fi].node.classList.add('bx-focus');
  }
  function adjust(f, dir) {
    if (f.kind === 'range') { const s = SCHEMA[f.key]; const v = getSettings()[f.key]; const nv = Math.round((v + dir * s.step) / s.step) * s.step; if (setSetting(f.key, nv) !== v) uiSound(world, 'uiHover'); }
    else if (f.kind === 'bool') { const v = getSettings()[f.key]; if (v !== dir > 0) { setSetting(f.key, dir > 0); uiSound(world, 'uiClick'); } }
    else if (f.kind === 'action') { const j = fi + dir; if (focusables[j]?.kind === 'action') setFocus(j); }
  }
  function activate(f) {
    if (f.kind === 'bool') { setSetting(f.key, !getSettings()[f.key]); uiSound(world, 'uiClick'); }
    else if (f.kind === 'action') { uiSound(world, 'uiClick'); if (f.act === 'reset') resetSettings(); else back(); }
  }
  function back() { close(); onBack?.(); }

  const offChange = onSettingsChange(refresh);
  const popKeys = pushKeys({
    onKey(e) {
      if (isBack(e)) { if (!e.repeat) { uiSound(world, 'uiClick'); back(); } return; }
      if (isUp(e)) setFocus((fi - 1 + focusables.length) % focusables.length);
      else if (isDown(e)) setFocus((fi + 1) % focusables.length);
      else if (isLeft(e)) adjust(focusables[fi], -1);
      else if (isRight(e)) adjust(focusables[fi], +1);
      else if (isOk(e) && !e.repeat) activate(focusables[fi]);
    },
  });
  // Ingen musehendelser lekker ut av menyen (spillets canvas får dem uansett ikke, men vi stopper bobling for sikkerhets skyld).
  for (const t of ['pointerdown', 'mousedown', 'click', 'wheel', 'contextmenu']) root.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'contextmenu') e.preventDefault(); }, { passive: t !== 'contextmenu' && t !== 'wheel' ? true : false });

  let closed = false;
  function close() { if (closed) return; closed = true; popKeys(); offChange(); root.remove(); }
  host.appendChild(root);
  refresh(); setFocus(0, false);
  setTimeout(() => root.classList.remove('bx-enter'), 260);
  return { el: root, close, refresh, focus: (i) => setFocus(i, false), get closed() { return closed; }, defaults: DEFAULTS };
}
