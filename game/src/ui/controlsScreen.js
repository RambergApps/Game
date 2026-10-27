// CONTROLS-skjermen (Breach Arena 27.10, godkjent av Breach som ny fil i ui/) – samme stil som settingsScreen.js.
// openControls(container?, { onBack, world, scrim, kicker }) → { el, close }. Bindinger lest fra core/input.js,
// player/controller.js, player/state.js (cover/roll/vault/dash) og weapons/index.js (våpenbytte, reload, melee, granat), Esc: ui/pauseMenu.js.
import { injectStyle, pushKeys, el, uiSound, isUp, isDown, isOk, isBack } from './style.js';

const K = (...k) => k.map((x) => `<span class="bx-key">${x}</span>`).join('');
// Cover først (Breach 16:26): hele Cover-seksjonen, inkl. Hold RMB og blindskudd, skal synes uten scrolling.
// col: 0 = venstre kolonne, 1 = høyre (to kolonner på brede skjermer; én kolonne i rekkefølgen under ellers).
export const CONTROLS_LAYOUT = [
  { section: 'Cover', col: 0, rows: [
    [K('E'), 'Take cover near you / leave cover'],
    [K('Hold RMB'), '<b>Pop up and aim.</b> Low cover: you stand up and can be hit. Cover edge or high cover: lean out'],
    [K('LMB'), '<b>Blind fire</b> (without RMB): you stay down – less accurate, but safer'],
    [K('Q'), 'Dash to the next cover in your direction'],
    [K('A', 'D'), 'Slide along the cover'],
    [K('Space'), 'Vault over low cover'],
  ] },
  { section: 'Movement', col: 1, rows: [
    [K('W', 'A', 'S', 'D'), 'Move (arrow keys also work)'],
    [K('Shift'), 'Sprint (hold while moving)'],
    [K('Space'), 'Combat roll – dodges hits'],
  ] },
  { section: 'Combat', col: 1, rows: [
    [K('LMB'), 'Fire'],
    [K('RMB'), 'Aim (tighter spread)'],
    [K('R'), 'Reload'],
    [K('1', '2', '3') + K('Wheel'), 'Switch weapon'],
    [K('Hold G'), 'Aim grenade – release to throw'],
    [K('F'), 'Melee strike'],
  ] },
  { section: 'Game', col: 0, rows: [
    [K('Esc'), 'Pause menu / back'],
  ] },
];

const CSS = `.bx-panel.bx-ctrlp{width:min(1140px,calc(100vw - 120px));max-width:none}
.bx-ctrlw{position:relative}
.bx-ctrl{overflow-y:auto;scrollbar-width:none;scroll-snap-type:y proximity}.bx-ctrl::-webkit-scrollbar{display:none}
.bx-cgrid{display:grid;grid-template-columns:1fr;gap:0 22px}
@media (min-width:900px){.bx-cgrid{grid-template-columns:1fr 1fr}}
.bx-ccol .bx-sec{margin-top:6px}
.bx-crow{display:grid;grid-template-columns:minmax(150px,max-content) 1fr;align-items:center;gap:12px;min-height:30px;padding:3px 12px;background:rgba(43,46,49,.55);margin-bottom:2px;border-left:3px solid transparent;scroll-snap-align:start}
.bx-crow .bx-keys{white-space:nowrap}.bx-crow .bx-key{margin:1px 3px 1px 0;font-size:10.5px;padding:2px 6px}
.bx-crow .bx-desc{font-size:13.5px;line-height:1.25;letter-spacing:.4px;color:#bfc7cd}.bx-crow .bx-desc b{color:#e8edf1}
.bx-cmore{position:absolute;left:0;right:0;bottom:0;height:34px;display:none;align-items:flex-end;justify-content:center;padding-bottom:2px;pointer-events:none;
 background:linear-gradient(rgba(14,16,18,0),rgba(14,16,18,.92));font-size:11px;letter-spacing:3px;color:#39c6ff;font-weight:700}
.bx-ctrlw.bx-hasmore .bx-cmore{display:flex}
@media (max-height:680px){.bx-crow{min-height:27px;padding:2px 10px}.bx-crow .bx-desc{font-size:12.5px}}`;

export function openControls(container, opts = {}) {
  const { onBack = null, world = null } = opts;
  injectStyle();
  if (!document.getElementById('bx-ctrl-css')) { const s = document.createElement('style'); s.id = 'bx-ctrl-css'; s.textContent = CSS; document.head.appendChild(s); }
  const host = container || document.body;
  const root = el('div', `bx-root bx-enter${host === document.body ? '' : ' bx-inline'}`);
  root.dataset.ui = 'controls';
  if ((host === document.body || opts.scrim === true) && opts.scrim !== false) root.appendChild(el('div', 'bx-scrim'));
  const panel = el('div', 'bx-panel bx-wide bx-ctrlp');
  panel.innerHTML = `<div class="bx-hazard"></div><div class="bx-kicker">${opts.kicker ?? 'Help'}</div><h1 class="bx-title">Controls<b>//</b></h1>`;
  const wrap = el('div', 'bx-ctrlw'); const body = el('div', 'bx-ctrl'); const grid = el('div', 'bx-cgrid');
  const cols = [el('div', 'bx-ccol'), el('div', 'bx-ccol')];
  const wide = () => innerWidth >= 900;
  function layout() {   // brede skjermer: to kolonner; smale: én kolonne med Cover først
    cols.forEach((c) => { c.textContent = ''; }); grid.textContent = '';
    for (const g of CONTROLS_LAYOUT) {
      const c = wide() ? cols[g.col] : cols[0];
      c.appendChild(el('div', 'bx-sec', g.section));
      for (const row of g.rows) { const r = el('div', 'bx-crow'); r.append(el('div', 'bx-keys', row[0]), el('div', 'bx-desc', row[1])); c.appendChild(r); }
    }
    grid.append(cols[0]); if (wide()) grid.append(cols[1]);
  }
  layout(); body.appendChild(grid); wrap.append(body, el('div', 'bx-cmore', '▼ more')); panel.appendChild(wrap);
  const actions = el('div', 'bx-actions');
  const backBtn = el('button', 'bx-item bx-focus', '<span>Back</span><span class="bx-chev"></span>'); backBtn.type = 'button';
  backBtn.addEventListener('click', (e) => { e.stopPropagation(); uiSound(world, 'uiClick'); back(); });
  actions.appendChild(backBtn); panel.appendChild(actions);
  panel.appendChild(el('div', 'bx-hints', '<span class="bx-cscroll"><span class="bx-key">↑↓</span>Scroll</span><span><span class="bx-key">Enter</span><span class="bx-key">Esc</span>Back</span>'));
  root.appendChild(panel);

  // Høyden låses til hele rader (ingen rad kuttes); «▼ more» + fade når noe ligger under.
  function rowsOf() { return [...body.querySelectorAll('.bx-crow, .bx-sec')]; }
  function fit() {
    body.style.maxHeight = 'none'; if (!root.isConnected) return;
    const top = body.getBoundingClientRect().top, below = actions.getBoundingClientRect().height + panel.querySelector('.bx-hints').getBoundingClientRect().height + 64;
    const avail = Math.max(120, innerHeight - top - below);
    if (body.scrollHeight <= avail) { upd(); return; }
    let h = 0; for (const n of rowsOf()) { const b = n.offsetTop + n.offsetHeight; if (b <= avail - 30 && b > h) h = b; }
    body.style.maxHeight = h + 'px'; upd();
  }
  function upd() { wrap.classList.toggle('bx-hasmore', body.scrollTop + body.clientHeight < body.scrollHeight - 2); const sc = panel.querySelector('.bx-cscroll'); if (sc) sc.style.display = body.scrollHeight > body.clientHeight + 2 ? '' : 'none'; }
  function step(d) { const ts = [...new Set(rowsOf().map((n) => n.offsetTop))].sort((a, b) => a - b); const cur = body.scrollTop;
    const t = d > 0 ? ts.find((y) => y > cur + 1) : [...ts].reverse().find((y) => y < cur - 1); if (t != null) body.scrollTo({ top: t }); }
  body.addEventListener('scroll', upd);
  const onResize = () => { layout(); fit(); }; addEventListener('resize', onResize);
  function back() { close(); onBack?.(); }
  const popKeys = pushKeys({ onKey(e) {
    if (isBack(e) || (isOk(e) && !e.repeat)) { if (!e.repeat) { uiSound(world, 'uiClick'); back(); } return; }
    if (isUp(e)) step(-1); else if (isDown(e)) step(1);
  } });
  for (const t of ['pointerdown', 'mousedown', 'click', 'contextmenu']) root.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'contextmenu') e.preventDefault(); });
  let closed = false;
  function close() { if (closed) return; closed = true; popKeys(); removeEventListener('resize', onResize); root.remove(); }
  host.appendChild(root); fit(); requestAnimationFrame(fit);
  setTimeout(() => { root.classList.remove('bx-enter'); fit(); }, 260);
  return { el: root, close, get closed() { return closed; } };
}
