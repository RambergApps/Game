// Felles stil (CSS injiseres én gang) og tastaturstabel for UI-skjermer. DOM-overlegg valgt for gjenbruk i hovedmenyen.
export const PALETTE = { concrete: '#2b2e31', metal: '#3d4246', accent: '#39c6ff', hazard: '#c9a227', light: '#ffb347', text: '#e6ebef', dim: '#8d979f', bg: '#0c0d0e', danger: '#e5533d' };

const CSS = `
.bx-root{position:fixed;inset:0;z-index:50;display:flex;align-items:stretch;font-family:"Bahnschrift","DIN Alternate","Roboto Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif;
  color:${PALETTE.text};user-select:none;-webkit-user-select:none;cursor:default;-webkit-font-smoothing:antialiased}
.bx-root.bx-inline{position:absolute}
.bx-scrim{position:absolute;inset:0;background:
  radial-gradient(120% 90% at 70% 50%,rgba(8,10,12,.35) 0%,rgba(6,7,9,.86) 70%),
  linear-gradient(90deg,rgba(6,7,9,.94) 0%,rgba(6,7,9,.78) 38%,rgba(6,7,9,.30) 100%);
  backdrop-filter:blur(3px) saturate(.7);-webkit-backdrop-filter:blur(3px) saturate(.7)}
.bx-scrim::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.22;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px)}
.bx-root.bx-enter .bx-scrim{animation:bxFade .16s ease-out}
.bx-root.bx-enter .bx-panel{animation:bxSlide .2s cubic-bezier(.2,.8,.2,1)}
@keyframes bxFade{from{opacity:0}to{opacity:1}}
@keyframes bxSlide{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
.bx-panel{position:relative;margin-left:clamp(28px,7vw,120px);align-self:center;width:min(460px,86vw);padding:30px 0 24px}
.bx-panel.bx-wide{width:min(640px,90vw)}
.bx-hazard{height:7px;width:150px;background:repeating-linear-gradient(-45deg,${PALETTE.hazard} 0 9px,#141516 9px 18px);margin-bottom:16px;
  clip-path:polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)}
.bx-kicker{font-size:12px;letter-spacing:5px;color:${PALETTE.dim};font-weight:600;text-transform:uppercase;margin-bottom:6px}
.bx-title{font-size:58px;line-height:1;font-weight:800;letter-spacing:9px;text-transform:uppercase;margin:0 0 6px;text-shadow:0 2px 0 #000}
.bx-title b{color:${PALETTE.accent};font-weight:800;letter-spacing:2px;margin-left:6px}
.bx-sub{font-size:13px;letter-spacing:3px;color:${PALETTE.dim};text-transform:uppercase;margin-bottom:26px;display:flex;gap:10px;align-items:center}
.bx-sub i{display:inline-block;width:6px;height:6px;background:${PALETTE.light};transform:rotate(45deg)}
.bx-list{display:flex;flex-direction:column;gap:6px}
.bx-item{position:relative;display:flex;align-items:center;gap:16px;height:52px;padding:0 20px 0 18px;background:linear-gradient(90deg,rgba(43,46,49,.92),rgba(43,46,49,.55));
  border:0;border-left:3px solid transparent;color:#c4ccd2;font:inherit;font-size:19px;font-weight:700;letter-spacing:4px;text-transform:uppercase;text-align:left;cursor:pointer;outline:none;
  clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);transition:background .08s,color .08s,padding .1s}
.bx-item .bx-num{font-size:11px;letter-spacing:2px;color:#5f686f;font-weight:600;width:20px}
.bx-item .bx-chev{margin-left:auto;width:10px;height:10px;border-top:2px solid ${PALETTE.accent};border-right:2px solid ${PALETTE.accent};transform:rotate(45deg);opacity:0;transition:opacity .08s}
.bx-item.bx-focus{background:linear-gradient(90deg,${PALETTE.metal},rgba(61,66,70,.78));color:#fff;border-left-color:${PALETTE.accent};padding-left:24px;
  box-shadow:inset 0 0 0 1px rgba(57,198,255,.22),0 0 24px rgba(57,198,255,.10)}
.bx-item.bx-focus .bx-num{color:${PALETTE.accent}}
.bx-item.bx-focus .bx-chev{opacity:1}
.bx-item.bx-danger.bx-focus{border-left-color:${PALETTE.danger}}
.bx-item.bx-danger.bx-focus .bx-chev,.bx-item.bx-danger.bx-focus .bx-num{border-color:${PALETTE.danger};color:${PALETTE.danger}}
.bx-hints{display:flex;gap:18px;margin-top:22px;font-size:11px;letter-spacing:2px;color:${PALETTE.dim};text-transform:uppercase;flex-wrap:wrap}
.bx-key{display:inline-block;min-width:16px;padding:2px 6px;margin-right:7px;border:1px solid #4a5157;background:#1b1d1f;color:#d5dbe0;font-size:10px;text-align:center;letter-spacing:1px}
.bx-toast{margin-top:14px;min-height:18px;font-size:12px;letter-spacing:2px;color:${PALETTE.light};text-transform:uppercase}
.bx-sec{display:flex;align-items:center;gap:12px;margin:18px 0 8px;font-size:12px;font-weight:700;letter-spacing:5px;color:${PALETTE.hazard};text-transform:uppercase}
.bx-sec::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(201,162,39,.5),transparent)}
.bx-sec:first-child{margin-top:4px}
.bx-row{display:grid;grid-template-columns:1fr 280px;align-items:center;gap:18px;height:46px;padding:0 16px 0 15px;background:rgba(43,46,49,.62);border-left:3px solid transparent;margin-bottom:4px;cursor:pointer;
  clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)}
.bx-row .bx-lab{font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#bfc7cd}
.bx-row.bx-focus{background:rgba(61,66,70,.95);border-left-color:${PALETTE.accent};box-shadow:inset 0 0 0 1px rgba(57,198,255,.2)}
.bx-row.bx-focus .bx-lab{color:#fff}
.bx-ctl{display:flex;align-items:center;gap:14px}
.bx-track{position:relative;flex:1;height:22px;cursor:pointer;touch-action:none}
.bx-track::before{content:"";position:absolute;left:0;right:0;top:9px;height:4px;background:#1a1c1e;box-shadow:inset 0 0 0 1px #3a4045}
.bx-fill{position:absolute;left:0;top:9px;height:4px;background:linear-gradient(90deg,#1f7ea6,${PALETTE.accent})}
.bx-ticks{position:absolute;left:0;right:0;top:15px;height:4px;background:repeating-linear-gradient(90deg,#3a4045 0 1px,transparent 1px 10%)}
.bx-knob{position:absolute;top:3px;width:10px;height:16px;margin-left:-5px;background:#d9e1e6;clip-path:polygon(0 0,100% 0,100% 70%,50% 100%,0 70%)}
.bx-row.bx-focus .bx-knob{background:${PALETTE.accent};filter:drop-shadow(0 0 4px rgba(57,198,255,.7))}
.bx-val{width:58px;text-align:right;font-size:14px;font-weight:700;letter-spacing:1px;color:#e6ebef;font-variant-numeric:tabular-nums}
.bx-val.bx-off{color:#6f787f}
.bx-seg{display:flex;flex:1;gap:4px}
.bx-seg span{flex:1;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:3px;background:#1b1d1f;color:#6f787f;box-shadow:inset 0 0 0 1px #33393e}
.bx-seg span.bx-on{background:rgba(57,198,255,.16);color:${PALETTE.accent};box-shadow:inset 0 0 0 1px rgba(57,198,255,.55)}
.bx-note{font-size:11px;letter-spacing:1.5px;color:#737c83;text-transform:uppercase;margin:-1px 0 6px 18px}
.bx-actions{display:flex;gap:8px;margin-top:18px}
.bx-actions .bx-item{flex:1;height:46px;font-size:16px}
.bx-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;background:rgba(5,6,7,.55)}
.bx-dialog{width:min(440px,86vw);padding:22px 24px 20px;background:linear-gradient(180deg,#26292c,#1d1f21);border-top:3px solid ${PALETTE.hazard};box-shadow:0 20px 60px rgba(0,0,0,.6);
  clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
.bx-dialog h3{margin:0 0 8px;font-size:22px;letter-spacing:5px;text-transform:uppercase}
.bx-dialog p{margin:0 0 18px;font-size:13px;letter-spacing:1.5px;line-height:1.5;color:${PALETTE.dim};text-transform:uppercase}
.bx-dialog .bx-actions{margin-top:0}
.bx-panel{max-height:100vh;overflow-y:auto;scrollbar-width:none;box-sizing:border-box}
@media (max-height:760px){.bx-title{font-size:46px}.bx-row{height:40px}.bx-sec{margin:12px 0 6px}.bx-item{height:46px}.bx-panel{padding:18px 0 14px}.bx-sub{margin-bottom:18px}}
@media (max-height:600px){.bx-title{font-size:38px}.bx-row{height:34px}.bx-hints{display:none}}
.bx-fps{position:fixed;top:10px;right:12px;z-index:40;padding:3px 8px;background:rgba(12,13,14,.72);border-left:2px solid ${PALETTE.accent};
  font:700 12px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:1px;color:#cfe9f5;pointer-events:none}
.bx-fps.bx-low{border-left-color:${PALETTE.danger};color:#ffb3a8}
`;

let injected = false;
export function injectStyle(doc = document) {
  if (injected && doc.getElementById('breach-ui-style')) return;
  injected = true;
  const s = doc.createElement('style'); s.id = 'breach-ui-style'; s.textContent = CSS; doc.head.appendChild(s);
}

// ---- tastaturstabel: øverste skjerm får tastene. Lytter i capture-fasen på window, så spillets input aldri ser dem.
const stack = [];
let installed = false;
const PASS = new Set(['F5', 'F11', 'F12']);
function onKey(e) {
  const top = stack[stack.length - 1]; if (!top) return;
  if (top.filter && !top.filter(e)) return;              // skjermen vil ikke ha denne (f.eks. Esc under mellomsekvens)
  e.stopImmediatePropagation();
  if (!PASS.has(e.code)) e.preventDefault();
  if (e.type === 'keydown') top.onKey(e);
}
/** Legger en tastehandler øverst. Returnerer remove(). handler = { onKey(e), filter?(e) } */
export function pushKeys(handler) {
  if (!installed) { installed = true; addEventListener('keydown', onKey, true); }
  stack.push(handler);
  return () => { const i = stack.indexOf(handler); if (i >= 0) stack.splice(i, 1); };
}
export const keyStackDepth = () => stack.length;

export const isUp = (e) => e.code === 'ArrowUp' || e.code === 'KeyW';
export const isDown = (e) => e.code === 'ArrowDown' || e.code === 'KeyS';
export const isLeft = (e) => e.code === 'ArrowLeft' || e.code === 'KeyA';
export const isRight = (e) => e.code === 'ArrowRight' || e.code === 'KeyD';
export const isOk = (e) => e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space';
export const isBack = (e) => e.code === 'Escape' || e.code === 'Backspace';

export function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

/** Lydhendelser for UI (Lyd har uiClick/uiHover). world kan mangle (hovedmeny uten verden). */
export function uiSound(world, type) { try { world?.events?.emit?.(type, { ui: true }); } catch { /* lyd er valgfri */ } }
