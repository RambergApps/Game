// BREACH – oppgraderingskort (3 kort, velg 1). Tegnes på spillets canvas i skjermkoordinater.
// Eget input (capture på window) fordi loop ikke kaller level.update mens world.paused.
import { byId } from './upgrades.js';
import { C, ROLE, font, rgba, clamp, ease, spaced, spacedWidth, platePath, hazard, wrap } from './ui-kit.js';

const now = () => performance.now() / 1000;

/** Åpne kortvalg. Returnerer et objekt som drawCards() tegner; onPick(id) kalles én gang. */
export function openCards(offer, stacks, onPick, canvas) {
  const ui = { offer, stacks, t0: now(), hover: -1, sel: -1, picked: -1, tPick: 0, rects: [], done: false, canvas };
  const ready = () => now() - ui.t0 > 0.55 && ui.picked < 0;
  const choose = (i) => {
    if (!ready() || i < 0 || i >= offer.length) return;
    ui.picked = i; ui.tPick = now();
    setTimeout(() => { ui.done = true; cleanup(); onPick(offer[i]); }, 520);
  };
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  const hit = (p) => ui.rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
  const onKey = (e) => {
    const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    let used = true;
    if (k !== undefined) choose(k);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') ui.sel = ui.sel <= 0 ? offer.length - 1 : ui.sel - 1;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') ui.sel = (ui.sel + 1) % offer.length;
    else if ((e.code === 'Enter' || e.code === 'Space') && ui.sel >= 0) choose(ui.sel);
    else used = e.code !== 'F1' && e.code !== 'F5' && e.code !== 'F12';
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  const onMove = (e) => { const i = hit(toCanvas(e)); ui.hover = i; if (i >= 0) ui.sel = i; };
  const onDown = (e) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.button === 0) choose(hit(toCanvas(e))); };
  const swallow = (e) => { e.stopImmediatePropagation(); };
  addEventListener('keydown', onKey, true); /* keyup/mouseup slippes ALLTID gjennom til core/input.js – ellers henger tasten (S-feilen 26.10) */
  addEventListener('pointermove', onMove, true);
  addEventListener('mousedown', onDown, true); addEventListener('pointerdown', swallow, true);
  function cleanup() {
    removeEventListener('keydown', onKey, true); 
    removeEventListener('pointermove', onMove, true);
    removeEventListener('mousedown', onDown, true); removeEventListener('pointerdown', swallow, true);
  }
  ui.cleanup = cleanup;
  ui.choose = choose; // for tester
  return ui;
}

export function drawCards(ctx, ui, levelNo) {
  const W = ctx.canvas.width, H = ctx.canvas.height, t = now() - ui.t0;
  const u = clamp(Math.min(W / 1600, H / 900), 0.62, 1.5);
  const pickT = ui.picked >= 0 ? now() - ui.tPick : 0;
  const outA = ui.picked >= 0 ? 1 - clamp((pickT - 0.25) / 0.27, 0, 1) : 1;
  ctx.save();
  // Bakteppe: nedtonet spill, vignett, kald tone
  ctx.globalAlpha = clamp(t / 0.3, 0, 1) * outA;
  ctx.fillStyle = 'rgba(7,8,10,0.74)'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.2, W / 2, H * 0.52, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // varm lysstripe bak kortene
  const lg = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, 520 * u);
  lg.addColorStop(0, rgba(C.light, 0.07)); lg.addColorStop(1, rgba(C.light, 0));
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

  // Overskrift
  const cw = 292 * u, ch = 410 * u, gap = 34 * u;
  const totalW = ui.offer.length * cw + (ui.offer.length - 1) * gap;
  const x0 = (W - totalW) / 2, y0 = H * 0.53 - ch / 2;
  ctx.fillStyle = rgba(C.visor, 0.9); ctx.font = font(14 * u, 600);
  ctx.textBaseline = 'alphabetic';
  spaced(ctx, `FIELD SUPPLY  //  DROP ${String(levelNo).padStart(2, '0')}`, W / 2, y0 - 66 * u, 4 * u, 'center');
  ctx.fillStyle = C.ink; ctx.font = font(40 * u, 600);
  spaced(ctx, 'CHOOSE ONE', W / 2, y0 - 26 * u, 6 * u, 'center');
  ctx.fillStyle = rgba(C.light, 0.55); ctx.fillRect(W / 2 - 22 * u, y0 - 14 * u, 44 * u, 2 * u);

  ui.rects = [];
  ui.offer.forEach((id, i) => {
    const up = byId(id); if (!up) return;
    const role = ROLE[up.role] || ROLE.taktikk, rare = up.rarity === 'sjelden';
    const col = rare ? '#e9dcb4' : role.col;
    const appear = ease((t - 0.08 - i * 0.09) / 0.42);
    const hov = (ui.sel === i) && ui.picked < 0;
    const isPicked = ui.picked === i, other = ui.picked >= 0 && !isPicked;
    let x = x0 + i * (cw + gap), y = y0 + (1 - appear) * 46 * u - (hov ? 8 * u : 0);
    ui.rects.push({ x, y, w: cw, h: ch });
    ctx.save();
    ctx.globalAlpha = appear * (other ? clamp(1 - pickT / 0.25, 0, 1) : outA);
    // skygge
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; platePath(ctx, x + 6 * u, y + 10 * u, cw, ch, [16 * u, 0, 16 * u, 0]); ctx.fill();
    // glød ved hover/valg
    if (hov || isPicked) {
      ctx.save(); ctx.fillStyle = rgba(col, 0.25); platePath(ctx, x, y, cw, ch, [16 * u, 0, 16 * u, 0]); ctx.fill();
      // glød uten skyggeblur: kortkanten strøket bredt og svakt
      ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(col, isPicked ? 0.32 : 0.2);
      for (const k of [0.35, 0.7, 1.1]) { ctx.lineWidth = (isPicked ? 40 : 26) * u * k; ctx.globalAlpha = 1.15 - k * 0.8; ctx.stroke(); }
      ctx.restore();
    }
    // plate
    const g = ctx.createLinearGradient(x, y, x, y + ch);
    g.addColorStop(0, hov ? '#3a3f45' : '#33373c'); g.addColorStop(0.42, '#25282c'); g.addColorStop(1, '#17191b');
    ctx.fillStyle = g; platePath(ctx, x, y, cw, ch, [16 * u, 0, 16 * u, 0]); ctx.fill();
    // børstet metall-tekstur (fine horisontale streker, deterministisk)
    ctx.save(); platePath(ctx, x, y, cw, ch, [16 * u, 0, 16 * u, 0]); ctx.clip();
    for (let k = 0; k < 60; k++) {
      const yy = y + ((k * 97.13 + i * 31) % 1) * ch + k * ch / 60;
      ctx.fillStyle = `rgba(255,255,255,${0.012 + ((k * 7) % 5) * 0.004})`; ctx.fillRect(x, yy, cw, 1);
    }
    // ikonfelt med glød
    const iy = y + 128 * u;
    const rg = ctx.createRadialGradient(x + cw / 2, iy, 0, x + cw / 2, iy, 120 * u);
    rg.addColorStop(0, rgba(col, hov || isPicked ? 0.26 : 0.16)); rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg; ctx.fillRect(x, y, cw, ch);
    ctx.restore();
    // kant: lys topp, mørk bunn
    ctx.lineWidth = 1.2 * u;
    ctx.strokeStyle = hov || isPicked ? rgba(col, 0.85) : 'rgba(150,160,170,0.22)';
    platePath(ctx, x + 0.5, y + 0.5, cw - 1, ch - 1, [16 * u, 0, 16 * u, 0]); ctx.stroke();
    // topp-bånd
    if (rare) hazard(ctx, x + 16 * u, y, cw - 16 * u, 7 * u, 0.95, 7 * u);
    else { ctx.fillStyle = col; ctx.fillRect(x + 16 * u, y, cw - 16 * u, 3 * u); }
    // rolle-etikett
    ctx.fillStyle = rgba(col, 0.95); ctx.font = font(13 * u, 600);
    spaced(ctx, rare ? `RARE  ·  ${role.label}` : role.label, x + 20 * u, y + 34 * u, 3 * u);
    // nøkkel-merke
    const kx = x + cw - 40 * u, ky = y + 16 * u;
    ctx.strokeStyle = hov ? col : 'rgba(200,205,210,0.35)'; ctx.lineWidth = 1.2 * u;
    platePath(ctx, kx, ky, 24 * u, 24 * u, [5 * u, 0, 5 * u, 0]); ctx.stroke();
    ctx.fillStyle = hov ? col : 'rgba(220,225,230,0.7)'; ctx.font = font(15 * u, 600);
    ctx.textAlign = 'center'; ctx.fillText(String(i + 1), kx + 12 * u, ky + 17.5 * u);
    // ikon
    ctx.save(); ctx.translate(x + cw / 2, iy); ctx.scale(u, u);
    drawIcon(ctx, id, col, hov || isPicked);
    ctx.restore();
    // skillelinje
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 20 * u, y + 222 * u, cw - 40 * u, 1);
    // navn
    ctx.fillStyle = C.ink; ctx.textAlign = 'left';
    const nm = up.name.toUpperCase(), maxW = cw - 40 * u;
    let fs = 27; ctx.font = font(fs * u, 600);
    while (fs > 22 && spacedWidth(ctx, nm, 1.2 * u) > maxW) { fs -= 1; ctx.font = font(fs * u, 600); }
    const nameLines = spacedWidth(ctx, nm, 1.2 * u) > maxW ? wrap(ctx, nm, maxW - 10 * u) : [nm];
    nameLines.forEach((ln, k) => spaced(ctx, ln, x + 20 * u, y + 256 * u + k * 28 * u, 1.2 * u));
    // tekst
    ctx.fillStyle = 'rgba(214,210,200,0.78)'; ctx.font = font(18 * u, 400);
    const ty = y + 256 * u + nameLines.length * 28 * u + 8 * u;
    wrap(ctx, up.text, cw - 40 * u).forEach((ln, k) => ctx.fillText(ln, x + 20 * u, ty + k * 23 * u));
    // stabel-indikator
    const have = ui.stacks[id] || 0;
    ctx.font = font(12 * u, 600); ctx.fillStyle = 'rgba(160,166,172,0.75)';
    if (up.kind === 'instant') spaced(ctx, 'SINGLE USE', x + 20 * u, y + ch - 22 * u, 3 * u);
    else {
      spaced(ctx, 'RANK', x + 20 * u, y + ch - 22 * u, 3 * u);
      for (let k = 0; k < up.max; k++) {
        const px = x + 62 * u + k * 22 * u, py = y + ch - 31 * u;
        const filled = k < have, next = k === have;
        ctx.fillStyle = filled ? col : next ? rgba(col, 0.25 + 0.2 * (hov ? Math.sin(now() * 6) * 0.5 + 0.5 : 0)) : 'rgba(255,255,255,0.08)';
        platePath(ctx, px, py, 16 * u, 10 * u, [3 * u, 0, 3 * u, 0]); ctx.fill();
        if (next) { ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
    // blits ved valg
    if (isPicked) {
      const f = clamp(1 - pickT / 0.35, 0, 1);
      ctx.fillStyle = rgba(col, 0.35 * f); platePath(ctx, x, y, cw, ch, [16 * u, 0, 16 * u, 0]); ctx.fill();
    }
    ctx.restore();
  });
  // hint
  ctx.globalAlpha = clamp((t - 0.6) / 0.4, 0, 1) * outA;
  ctx.fillStyle = 'rgba(170,176,182,0.6)'; ctx.font = font(13 * u, 600);
  spaced(ctx, 'CLICK OR PRESS 1 · 2 · 3', W / 2, y0 + ch + 48 * u, 3.5 * u, 'center');
  ctx.restore();
}

// ---------- ikoner (tegnet i en ±50-boks, strek i rollefarge) ----------
function drawIcon(ctx, id, col, hot) {
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  ctx.strokeStyle = col; ctx.fillStyle = rgba(col, 0.14); ctx.lineWidth = 3.2;
  const P = (pts, close = true, fill = true) => {
    ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (close) ctx.closePath(); if (fill && close) ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha *= hot ? 0.28 : 0.16; ctx.lineWidth *= hot ? 4 : 3; ctx.stroke(); ctx.restore();   // glød uten skyggeblur
  };
  const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  switch (id) {
    case 'plating':
      P([[-34, -40], [34, -40], [42, -20], [30, 40], [0, 50], [-30, 40], [-42, -20]]);
      P([[-24, -28], [24, -28], [28, -16], [-28, -16]], true, false);
      L(0, -10, 0, 38); L(-22, 4, 22, 4); L(-18, 20, 18, 20);
      break;
    case 'cover-plates':
      P([[-48, 10], [48, 10], [48, 46], [-48, 46]]);
      L(-48, 22, 48, 22); L(-24, 10, -24, 22); L(8, 22, 8, 46); L(30, 10, 30, 22);
      ctx.lineWidth = 2.4; L(-30, -46, -6, -6); P([[-6, -6], [-18, -12], [-10, -20]], true, true);
      L(14, -42, 4, -12); L(30, -30, 12, -8);
      break;
    case 'adrenaline':
      ctx.lineWidth = 3.4; P([[-50, 6], [-26, 6], [-16, -16], [-4, 34], [8, -40], [18, 18], [26, 6], [50, 6]], false, false);
      ctx.lineWidth = 2; P([[-12, -46], [12, -46], [12, -34], [-12, -34]]);
      L(0, -52, 0, -46); L(-6, -40, 6, -40);
      break;
    case 'ext-mag':
      P([[-14, -46], [14, -46], [20, 14], [30, 44], [4, 50], [-6, 18]]);
      L(-12, -32, 14, -32); L(-10, -18, 16, -18); L(-8, -4, 18, -4); L(-5, 10, 19, 10);
      ctx.lineWidth = 2.4; P([[-8, -54], [8, -54], [6, -46], [-6, -46]]);
      ctx.fillStyle = rgba(col, 0.6); ctx.font = '600 16px "Barlow Condensed", sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('+9', 26, -30);
      break;
    case 'fast-reload': {
      ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, 0, 42, -Math.PI * 0.85, Math.PI * 0.55); ctx.stroke();
      const a = Math.PI * 0.55, ex = Math.cos(a) * 42, ey = Math.sin(a) * 42;
      P([[ex - 12, ey - 4], [ex + 8, ey + 6], [ex - 2, ey - 16]]);
      P([[-10, -24], [10, -24], [14, 18], [-6, 22]]);
      L(-8, -12, 11, -12); L(-7, 0, 12, 0);
      break;
    }
    case 'steady-hand':
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3.2; L(-52, 0, -24, 0); L(24, 0, 52, 0); L(0, -52, 0, -24); L(0, 24, 0, 52);
      ctx.fillStyle = col; ctx.fillRect(-3, -3, 6, 6);
      break;
    case 'grenade-belt':
      for (const [gx, sc] of [[-26, 0.72], [26, 0.72], [0, 1]]) {
        ctx.save(); ctx.translate(gx, sc < 1 ? 10 : 0); ctx.scale(sc, sc);
        P([[-18, -20], [18, -20], [24, -6], [24, 26], [14, 38], [-14, 38], [-24, 26], [-24, -6]]);
        L(-24, 8, 24, 8); L(0, -20, 0, 38);
        P([[-8, -30], [8, -30], [8, -20], [-8, -20]]);
        ctx.beginPath(); ctx.arc(14, -32, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.lineWidth = 2.4; L(-52, 44, 52, 44);
      break;
    case 'servo-joints': {
      const n = 8, R = 34, r = 26; ctx.beginPath();
      for (let k = 0; k < n * 2; k++) {
        const a0 = (k / (n * 2)) * Math.PI * 2, rr = k % 2 ? r : R;
        ctx.lineTo(Math.cos(a0 - 0.12) * rr, Math.sin(a0 - 0.12) * rr); ctx.lineTo(Math.cos(a0 + 0.12) * rr, Math.sin(a0 + 0.12) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2.4; L(-50, 46, -18, 46); P([[-18, 40], [-8, 46], [-18, 52]], true, true);
      L(18, 46, 50, 46);
      break;
    }
    case 'ap-rounds':
      ctx.lineWidth = 3.2;
      P([[-50, -6], [-6, -6], [10, 0], [-6, 6], [-50, 6]]);
      L(-40, -6, -40, 6);
      ctx.fillStyle = rgba(col, 0.2); P([[14, -42], [22, -42], [22, 42], [14, 42]]);
      ctx.lineWidth = 2.2; L(26, 0, 50, 0); L(26, -6, 44, -16); L(26, 6, 44, 16);
      break;
    case 'field-kit':
      P([[-42, -24], [42, -24], [42, 36], [-42, 36]]);
      P([[-14, -36], [14, -36], [14, -24], [-14, -24]], true, false);
      ctx.fillStyle = rgba(col, 0.75);
      ctx.fillRect(-6, -14, 12, 40); ctx.fillRect(-20, 0, 40, 12);
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
  }
 
}
