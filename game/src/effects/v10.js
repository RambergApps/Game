// v10 (Effekter 28.10, godkjent av Alexander 09:35): urørt vegg + liten LED i veggkanten. Alt annet står på gulvet. Ingen skrå flater.
// Geometri fra t.opening (ruter). Ramme: x = verden-px, y = verden·G (som drawObject). Gulvlys: transitionFloor (gulvlaget).
// Objekter: transitionParts(t, s) → [{ y (ruter, fotpunkt), draw(ctx) }] for y-sortering med Warden.
import { PROJ } from '../shared/projection.js';
const G = PROJ.groundScaleY, SZ = PROJ.screenZ, T = 32, Y = (t) => t * T * G, U = (h) => h * SZ, WALL = 72;
const PIPE = '120,140,160', RED = '255,60,36', GRN = '90,255,130', WARM = '255,178,100', COLD = '170,210,255';
let WHEEL = null; export function setWheel(fn) { WHEEL = fn; }
const kindOf = (t) => t.kind === 'pry' || t.kind === 'valve' ? 'door' : t.kind === 'crawl' ? 'pipe' : t.kind === 'ladder' ? (t.dir === 'down' ? 'hatch' : 'ladder') : null;
export const handlesV10 = (t) => { const k = t && kindOf(t); return !!k && k !== 'hatch'; };
const stOf = (s) => s.used ? 'used' : s.unlocked ? 'open' : 'locked';
function frame(ctx, fn) { ctx.save(); ctx.scale(1, 1 / G); try { fn(ctx); } finally { ctx.restore(); } }
function lin(x, x0, y0, x1, y1, st) { const g = x.createLinearGradient(x0, y0, x1, y1); st.forEach(([q, c]) => g.addColorStop(q, c)); return g; }
function hazard(x, x0, y0, w, h, s = 4) { x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip(); x.fillStyle = '#1b1b19'; x.fillRect(x0, y0, w, h); x.fillStyle = 'rgba(214,170,40,.85)'; if (h > w) for (let k = y0; k < y0 + h; k += s * 2) x.fillRect(x0, k, w, s); else for (let k = x0; k < x0 + w; k += s * 2) x.fillRect(k, y0, s, h); x.restore(); }
function spillW(x, x0, y0, x1, y1, col, a) {   // myk lysflate i gulvplanet mot vest (rektangler, ikke skrått)
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 4; k++) { const e = k * 6; x.globalAlpha = a * (0.3 - k * 0.06); x.fillStyle = lin(x, x1, 0, x0 - e, 0, [[0, `rgba(${col},1)`], [1, `rgba(${col},0)`]]); x.fillRect(x0 - e, y0 - e * 0.5, x1 - x0 + e, y1 - y0 + e); }
  x.restore();
}
// LED: i veggkanten mot rommet (vestkanten av veggtoppen), helt nede ved den synlige sørenden av åpningen – liten, innfelt
function led(x, o, st, now) {
  const px = o.x * T + 5, py = Y(o.y + o.h) - U(WALL) - 7.5,   // v10b: midt i den synlige sørfronten av veggstykket nord for åpningen (det eneste rette, synlige frontfeltet ved en N–S-vegg)
    col = st === 'locked' ? RED : GRN, a = st === 'locked' ? (Math.sin(now * 4) > 0 ? 0.85 : 0.45) : 0.9;
  x.fillStyle = '#111214'; x.fillRect(px - 2.5, py - 2, 5, 4);
  x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(px, py, 0, px, py, 10); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.4, `rgba(${col},${a * 0.35})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(px - 10, py - 10, 20, 20);
  x.fillStyle = `rgb(${col})`; x.fillRect(px - 1.4, py - 1, 2.8, 2); x.restore();
}
const GL = new Map();   // bufrede lyssprites (ingen shadowBlur): kjegle i gulvplanet + munningsglød
function glowSprite(col) { let c = GL.get(col); if (c) return c; c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(128, 64) : Object.assign(document.createElement('canvas'), { width: 128, height: 64 });
  const x = c.getContext('2d'), g = x.createLinearGradient(128, 0, 0, 0); g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(0.35, `rgba(${col},0.4)`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.beginPath(); x.moveTo(128, 20); x.lineTo(128, 44); x.lineTo(0, 64); x.lineTo(0, 0); x.closePath(); x.fill();
  x.globalCompositeOperation = 'destination-in'; const v = x.createLinearGradient(0, 0, 0, 64); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(0.7, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, 128, 64);
  GL.set(col, c); return c; }
const span = (o, m = 0.6) => [o.y + Math.min(m, o.h * 0.2), o.y + o.h - Math.min(m, o.h * 0.2)];
export function transitionFloor(ctx, t, s = {}) {
  const k = kindOf(t), o = t.opening || t.block; if (!k || k === 'hatch' || !o) return;
  const st = stOf(s), p = 0.85 + 0.15 * Math.sin((s.t || 0) * 3), X = o.x * T, [g0, g1] = span(o);
  frame(ctx, (x) => {
    if (k === 'door') { if (st !== 'locked') spillW(x, X - T * (st === 'used' ? 2.6 : 1.1), Y(g0), X, Y(g1), WARM, (st === 'used' ? 1 : 0.5) * p); else spillW(x, X - T * 0.6, Y(g0), X, Y(g1), RED, 0.3); hazard(x, X - 12, Y(g0), 11, Y(g1) - Y(g0), 3); }
    if (k === 'pipe') { const [a, b] = span(o, 0.8), X0 = X - 24; if (st !== 'locked') { const col = st === 'used' ? WARM : PIPE, L = T * (st === 'used' ? 1.8 : 1.3), h = Y(b) - Y(a);
        x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.27 * p; x.drawImage(glowSprite(col), X0 - L, Y(a) - h * 0.4, L, h * 1.8); x.globalAlpha = 0.14 * p; x.drawImage(glowSprite(col), X0 - L * 0.5, Y(a) - h * 0.1, L * 0.5, h * 1.2);
        x.globalAlpha = 0.22; x.fillStyle = `rgb(${col})`; const now = s.t || 0;   // trekk: korte strøk som drives vestover ut av stussen
        for (let i = 0; i < 6; i++) { const ph = (now * 0.9 + i / 6) % 1, sx = X0 - 4 - ph * L * 0.9, sy = Y(a) + h * (0.15 + 0.7 * ((i * 0.37) % 1)); x.globalAlpha = 0.12 * (1 - ph); x.fillRect(sx, sy, 7 + 6 * (1 - ph), 0.8); }
        x.restore(); } x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X0, Y(b) - 1, 24, 4); }
    if (k === 'ladder') { const x0 = X - 1.5 * T, a = o.y + 1, b = o.y + 2.6; x.fillStyle = 'rgba(0,0,0,.38)'; x.fillRect(x0 - 3, Y(a) + 2, X - x0 + 3, Y(b) - Y(a) + 5); if (st !== 'locked') spillW(x, x0 - T * 0.6, Y(b), X, Y(b + 0.9), WARM, 0.45 * p); }
  });
}
function steelTop(x, x0, y0, w, h) { x.fillStyle = '#565b5f'; x.fillRect(x0, y0, w, h); x.fillStyle = 'rgba(0,0,0,.5)'; for (let k = x0 + 2; k < x0 + w - 1; k += 3) x.fillRect(k, y0 + 1.5, 1, h - 3); for (let k = y0 + 2; k < y0 + h - 1; k += 3) x.fillRect(x0 + 1, k, w - 2, 0.7);
  x.fillStyle = 'rgba(220,214,200,.4)'; x.fillRect(x0, y0, w, 0.8); x.strokeStyle = '#151618'; x.lineWidth = 1; x.strokeRect(x0, y0, w, h); }
function post(x, px, yBase, h) { x.fillStyle = '#9aa0a4'; x.fillRect(px - 0.7, yBase - U(h), 1.4, U(h)); }
function platform(x, x0, x1, yN, yS, PH, st) {
  const top0 = Y(yN) - U(PH), top1 = Y(yS) - U(PH), RH = 26;
  for (const px of [x0 + 2, x1 - 2]) { x.fillStyle = '#26292c'; x.fillRect(px - 1.5, top1, 3, U(PH)); }
  x.fillStyle = lin(x, 0, top1, 0, top1 + 4, [[0, '#4a4f53'], [1, '#33373a']]); x.fillRect(x0, top1, x1 - x0, 4); x.strokeStyle = '#121314'; x.strokeRect(x0, top1, x1 - x0, 4);
  steelTop(x, x0, top0, x1 - x0, top1 - top0);
  if (st !== 'locked') { x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = lin(x, x1, 0, x0, 0, [[0, `rgba(${WARM},${st === 'used' ? 0.45 : 0.25})`], [1, `rgba(${WARM},0)`]]); x.fillRect(x0, top0, x1 - x0, top1 - top0); x.restore(); }
  x.strokeStyle = '#9aa0a4'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(x0 + 1, top0 - U(RH)); x.lineTo(x0 + 1, top1 - U(RH)); x.moveTo(x0 + 1, top1 - U(RH)); x.lineTo(x0 + (x1 - x0) * 0.28, top1 - U(RH)); x.stroke();
  post(x, x0 + 1, top0, RH); post(x, x0 + 1, top1, RH); post(x, x0 + (x1 - x0) * 0.28, top1, RH);
  const la = x0 + (x1 - x0) * 0.4, lb = x1 - 5, foot = Y(yS) + 3, topY = top1 - U(18);
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(la - 1, foot - 1, lb - la + 2, 2.5);
  for (let h = 6; h < PH; h += 7) { const yy = foot - U(h); x.fillStyle = '#5e6367'; x.fillRect(la, yy, lb - la, 1.7); x.fillStyle = 'rgba(225,218,200,.55)'; x.fillRect(la, yy, lb - la, 0.6); }
  for (const lx of [la, lb]) { x.fillStyle = '#8d9397'; x.fillRect(lx - 1.2, topY, 2.2, foot - topY); x.fillStyle = '#16181a'; x.fillRect(lx + 1, topY, 0.9, foot - topY); }
}
function pipeStub(x, X0, y0, y1, st, now = 0) { const H = 22, t0 = y0 - U(H) + 2, t1 = y1 - 2;
  x.fillStyle = lin(x, 0, t0, 0, t1, [[0, '#2a2d30'], [0.35, '#6a7074'], [0.6, '#4a4f53'], [1, '#1c1e20']]); x.fillRect(X0 - 22, t0, 22, t1 - t0);
  x.fillStyle = '#5c6165'; x.fillRect(X0 - 24, t0 - 2, 4, t1 - t0 + 4); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(X0 - 20, t0, 1, t1 - t0);
  x.fillStyle = 'rgba(20,20,20,.8)'; for (const yy of [t0 + 2, t1 - 4]) x.fillRect(X0 - 23, yy, 2, 2);
  if (st && st !== 'locked') { const col = st === 'used' ? WARM : PIPE, p = 0.85 + 0.15 * Math.sin(now * 3); x.save(); x.globalCompositeOperation = 'lighter';   // munning: lys inne i stussen
    const g = x.createLinearGradient(X0 - 24, 0, X0, 0); g.addColorStop(0, `rgba(${col},${0.2 * p})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(X0 - 20, t0 + 3, 14, t1 - t0 - 6);
    x.fillStyle = `rgba(${col},${0.18 * p})`; x.fillRect(X0 - 20, t0 + 3, 1, t1 - t0 - 6); x.restore(); } }
export function transitionParts(t, s = {}) {
  const k = kindOf(t), o = t.opening || t.block; if (!k || k === 'hatch' || !o) return null;
  const st = stOf(s), now = s.t || 0, X = o.x * T, out = [], add = (y, fn) => out.push({ y, cx: o.x, draw: (ctx) => frame(ctx, fn) });
  add(o.y + o.h + 0.02, (x) => led(x, o, st, now));   // rett etter veggen (samme bunn) – står i veggkanten
  if (k === 'door') { const w = t.wheel || { x: o.x - 0.2, y: o.y + o.h + 0.4 }, wx = Math.min(w.x, o.x - 0.55), wy = Math.max(w.y, o.y + o.h + 0.3);
    add(wy, (x) => { if (WHEEL) WHEEL(x, wx * T, Y(wy), st === 'used' ? 4 : 0); }); }
  if (k === 'ladder') { const a = o.y + 1, b = o.y + 2.6; add(b + 0.1, (x) => platform(x, X - 1.5 * T, X, a, b, 30, st)); }
  if (k === 'pipe') { const [a, b] = span(o, 0.8); add(b, (x) => pipeStub(x, X, Y(a), Y(b), st, now)); }
  return out;
}
