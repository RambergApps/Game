// BREACH – Effekter: cachede sprites og dekaler (eies av Breach Effekter).
// Alt som har gradient, støy eller mange strøk bygges ÉN gang her til offscreen-lerret og tegnes senere med drawImage.
// Ingen shadowBlur, ingen ctx.filter. Myk uskarphet lages ved å skalere ned og opp ved bygging.
import { LIGHT_DIR } from '../shared/light.js';

const TAU = Math.PI * 2;
const cache = new Map();

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') { try { return new OffscreenCanvas(Math.ceil(w), Math.ceil(h)); } catch (e) { /* fall back */ } }
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c;
}
function memo(key, build) { let c = cache.get(key); if (!c) { c = build(); cache.set(key, c); } return c; }
export const memoSprite = (key, build) => memo(key, build);   // for decals.js

// ---------------------------------------------------------------- deterministisk støy (kun ved bygging)
export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, oct = 4) { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, s + i * 17); fr *= 2; amp *= 0.5; } return f / 0.9375; }

/** Myk uskarphet: ned- og oppskalering (kun ved bygging). */
function soften(c, k = 4) {
  const w = c.width, h = c.height, t = makeCanvas(Math.max(1, w / k), Math.max(1, h / k)), g = t.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, t.width, t.height);
  const o = makeCanvas(w, h), og = o.getContext('2d'); og.imageSmoothingEnabled = true; og.drawImage(t, 0, 0, w, h); return o;
}

// ---------------------------------------------------------------- lys / glød
/** Radial glød (additiv bruk). Falloff ~ eksponentiell, så kanten aldri synes. */
export function glow(r, g, b, soft = 1) {
  return memo(`glow${r},${g},${b},${soft}`, () => {
    const S = 128, c = makeCanvas(S, S), x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (let i = 0; i <= 8; i++) { const t = i / 8, a = Math.exp(-t * t * (3.2 / soft)) * (1 - t); gr.addColorStop(t, `rgba(${r},${g},${b},${a.toFixed(3)})`); }
    x.fillStyle = gr; x.fillRect(0, 0, S, S); return c;
  });
}
/** Hvit-varm kjerne som går over i farge – for blink. */
export function hotCore(r, g, b) {
  return memo(`core${r},${g},${b}`, () => {
    const S = 64, c = makeCanvas(S, S), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,252,240,1)'); gr.addColorStop(0.18, 'rgba(255,240,205,.9)');
    gr.addColorStop(0.45, `rgba(${r},${g},${b},.35)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, S, S); return c;
  });
}

// ---------------------------------------------------------------- røyk / støv (malt, belyst fra LIGHT_DIR)
const TONES = {
  soot: [44, 40, 38], smoke: [92, 90, 88], dust: [128, 120, 108], concrete: [140, 136, 128], steam: [190, 192, 194], ash: [70, 66, 62],
};
/** Volumdott: mange myke klatter + fbm-maske, skyggelagt med normal fra tetthetsfeltet. tone: se TONES. */
export function puff(tone = 'smoke', v = 0) {
  return memo(`puff${tone}${v}`, () => {
    const S = 128, c = makeCanvas(S, S), x = c.getContext('2d'), R = mulberry(911 + v * 131 + tone.length * 7);
    for (let i = 0; i < 22; i++) {
      const a = R() * TAU, d = Math.pow(R(), 0.8) * S * 0.24, bx = 64 + Math.cos(a) * d, by = 64 + Math.sin(a) * d * 0.9, br = S * (0.1 + R() * 0.17);
      const gr = x.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
    }
    const id = x.getImageData(0, 0, S, S), d = id.data, A = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const i = y * S + xx, rr = Math.hypot(xx - 64, y - 64) / 64, n = fbm(xx / 22, y / 22, v * 13 + 5, 4);
      let a = d[i * 4 + 3] / 255; a *= Math.max(0, 1 - rr * rr) * (0.35 + 1.1 * n); A[i] = Math.min(1, a * 1.25);
    }
    const [cr, cg, cb] = TONES[tone] || TONES.smoke, lx = LIGHT_DIR.x, ly = LIGHT_DIR.y;
    for (let y = 1; y < S - 1; y++) for (let xx = 1; xx < S - 1; xx++) {
      const i = y * S + xx, dx = A[i + 1] - A[i - 1], dy = A[i + S] - A[i - S];
      // normal peker «ut av» tettheten; lys fra LIGHT_DIR (oppe til venstre) og litt ovenfra
      const nx = -dx * 6, ny = -dy * 6, nz = 1, nl = Math.hypot(nx, ny, nz), lit = (-(nx * lx + ny * ly) * 0.8 + nz * 0.55) / nl;
      const occ = 0.62 + 0.38 * (1 - A[i]);                                   // tett kjerne blir mørkere (selvskygge)
      const k = Math.max(0.45, Math.min(1.35, (0.55 + lit * 0.75) * occ + 0.18));
      d[i * 4] = Math.min(255, cr * k); d[i * 4 + 1] = Math.min(255, cg * k); d[i * 4 + 2] = Math.min(255, cb * k); d[i * 4 + 3] = A[i] * 255;
    }
    x.putImageData(id, 0, 0); return c;
  });
}

// ---------------------------------------------------------------- ild (additiv)
/** heat 0 = varm kjerne (hvit/gul), 1 = flamme (oransje), 2 = avkjølt (dyp rød/brun). */
export function flame(heat = 1, v = 0) {
  return memo(`flame${heat}${v}`, () => {
    const S = 128, c = makeCanvas(S, S), x = c.getContext('2d'), R = mulberry(4242 + v * 97 + heat * 13);
    const id = x.createImageData(S, S), d = id.data;
    const pal = heat === 0 ? [[255, 250, 230], [255, 214, 140], [255, 140, 50]] : heat === 1 ? [[255, 210, 130], [255, 128, 38], [190, 52, 14]] : [[220, 110, 40], [150, 46, 14], [70, 20, 8]];
    const ox = (R() - 0.5) * 10, oy = (R() - 0.5) * 10;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const rr = Math.hypot(xx - 64 - ox * (1 - y / S), y - 64 - oy) / 64, n = fbm(xx / 18, y / 15, v * 7 + heat * 3, 4);
      let den = Math.max(0, 1 - rr * (1.15 - 0.55 * n)); den = Math.pow(den, 1.4) * (0.55 + 0.9 * n); if (den <= 0) continue;
      const t = Math.min(1, den * 1.6), col = t > 0.6 ? pal[0] : t > 0.3 ? pal[1] : pal[2], col2 = t > 0.6 ? pal[1] : t > 0.3 ? pal[2] : pal[2];
      const f = t > 0.6 ? (1 - (t - 0.6) / 0.4) : t > 0.3 ? (1 - (t - 0.3) / 0.3) : 0, i = (y * S + xx) * 4;
      d[i] = col[0] + (col2[0] - col[0]) * f * 0.5; d[i + 1] = col[1] + (col2[1] - col[1]) * f * 0.5; d[i + 2] = col[2] + (col2[2] - col[2]) * f * 0.5;
      d[i + 3] = Math.min(255, den * 330);
    }
    x.putImageData(id, 0, 0); return c;
  });
}

// ---------------------------------------------------------------- gnist/strek og glør
/** Horisontal strek (hode til høyre). Strekkes langs fart ved tegning. */
export function streak(r, g, b) {
  return memo(`streak${r},${g},${b}`, () => {
    const W = 64, H = 8, c = makeCanvas(W, H), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(0.65, `rgba(${r},${g},${b},.55)`); gr.addColorStop(0.92, 'rgba(255,248,228,1)'); gr.addColorStop(1, 'rgba(255,248,228,0)');
    x.fillStyle = gr; x.beginPath(); x.ellipse(W / 2, H / 2, W / 2, H * 0.32, 0, 0, TAU); x.fill();
    const gv = x.createLinearGradient(0, 0, 0, H); gv.addColorStop(0, 'rgba(0,0,0,1)'); gv.addColorStop(0.5, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 0.5; x.fillStyle = gv; x.fillRect(0, 0, W, H); return c;
  });
}

// ---------------------------------------------------------------- munningsglimt (malte, per våpenstil og lag)
/** style: 'rifle' | 'shotgun' | 'marksman' | 'enemy'. Munning i x=16 (venstre), skudd mot +x. */
export function flash(style = 'rifle', v = 0) {
  return memo(`flash${style}${v}`, () => {
    const W = 128, H = 96, c = makeCanvas(W, H), x = c.getContext('2d'), R = mulberry(77 + v * 31 + style.length * 5);
    const enemy = style === 'enemy', ox = 14, oy = H / 2;
    const C0 = '255,252,236', C1 = enemy ? '255,170,80' : '255,226,160', C2 = enemy ? '230,80,20' : '255,150,60';
    x.globalCompositeOperation = 'lighter';
    const lobe = (ang, len, wid, a) => {
      x.save(); x.translate(ox, oy); x.rotate(ang);
      for (let k = 0; k < 3; k++) {                                         // tre lag: bred dempet → smal varm
        const L = len * (1 - k * 0.22), Wd = wid * (1 - k * 0.3), g = x.createLinearGradient(0, 0, L, 0);
        g.addColorStop(0, `rgba(${k === 2 ? C0 : C1},${a * (0.5 + k * 0.25)})`); g.addColorStop(0.45, `rgba(${k === 0 ? C2 : C1},${a * 0.45})`); g.addColorStop(1, `rgba(${C2},0)`);
        x.fillStyle = g; x.beginPath(); x.moveTo(0, -Wd * 0.4);
        // ujevn kant: flammeformet, ikke geometrisk stjerne
        const n = 7; for (let i = 0; i <= n; i++) { const t = i / n, jy = (R() - 0.5) * Wd * 0.35; x.lineTo(L * t, -Wd * Math.sin(Math.PI * (0.15 + 0.85 * t)) * (1 - t * 0.55) + jy); }
        for (let i = n; i >= 0; i--) { const t = i / n, jy = (R() - 0.5) * Wd * 0.35; x.lineTo(L * t, Wd * Math.sin(Math.PI * (0.15 + 0.85 * t)) * (1 - t * 0.55) + jy); }
        x.closePath(); x.fill();
      }
      x.restore();
    };
    if (style === 'shotgun') {
      lobe(0, 92, 20, 0.8); lobe(-0.22, 70, 14, 0.6); lobe(0.24, 72, 14, 0.6); lobe(-0.5, 40, 9, 0.45); lobe(0.52, 42, 9, 0.45);
    } else if (style === 'marksman') {
      lobe(0, 70, 8, 0.9); lobe(-1.5, 34, 9, 0.75); lobe(1.5, 34, 9, 0.75); lobe(-1.25, 22, 6, 0.4); lobe(1.25, 22, 6, 0.4);
    } else {
      lobe(0, enemy ? 56 : 62, enemy ? 12 : 10, 0.85); lobe(-0.6, 26, 6, 0.55); lobe(0.62, 26, 6, 0.55);
    }
    const g = x.createRadialGradient(ox + 4, oy, 0, ox + 4, oy, 18); g.addColorStop(0, `rgba(${C0},1)`); g.addColorStop(0.4, `rgba(${C1},.55)`); g.addColorStop(1, `rgba(${C2},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(ox + 4, oy, 18, 0, TAU); x.fill();
    return c;
  });
}

// ---------------------------------------------------------------- splinter, fliser, fragmenter
/** kind: 'chitin' | 'concrete' | 'metal' | 'rock'. Små polygoner med lys kant mot LIGHT_DIR. */
export function shard(kind = 'concrete', v = 0) {
  return memo(`shard${kind}${v}`, () => {
    const S = 32, c = makeCanvas(S, S), x = c.getContext('2d'), R = mulberry(31 + v * 53 + kind.length * 11);
    const n = 4 + Math.floor(R() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (R() - 0.5) * 0.9, r = (kind === 'chitin' ? 7 : 6) + R() * (kind === 'chitin' ? 8 : 5); const sx = kind === 'chitin' ? 1.3 : kind === 'wood' ? 1.7 : 1, sy = kind === 'chitin' ? 0.6 : kind === 'wood' ? 0.28 : 1; pts.push([16 + Math.cos(a) * r * sx, 16 + Math.sin(a) * r * sy]); }
    const base = kind === 'chitin' ? ['#121113', '#2a2624'] : kind === 'metal' ? ['#5a6068', '#9aa2aa'] : kind === 'rock' ? ['#3a3430', '#5e554e'] : kind === 'wood' ? ['#4a3524', '#9a7a52'] : ['#5d5e5c', '#8f8d88'];
    const g = x.createLinearGradient(16 + LIGHT_DIR.x * 12, 16 + LIGHT_DIR.y * 12, 16 - LIGHT_DIR.x * 12, 16 - LIGHT_DIR.y * 12); g.addColorStop(0, base[1]); g.addColorStop(1, base[0]);
    x.fillStyle = g; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fill();
    x.strokeStyle = kind === 'chitin' ? 'rgba(210,200,190,.55)' : 'rgba(230,226,218,.35)'; x.lineWidth = 1.2;
    x.beginPath(); for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2 - 16, my = (p[1] + q[1]) / 2 - 16; if (mx * LIGHT_DIR.x + my * LIGHT_DIR.y > 0) { x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); } } x.stroke();
    if (kind === 'chitin' && v % 2 === 0) { x.strokeStyle = 'rgba(255,110,30,.8)'; x.lineWidth = 1; x.beginPath(); const p = pts[0], q = pts[Math.floor(n / 2)]; x.moveTo(p[0], p[1]); x.lineTo((p[0] + q[0]) / 2 + 2, (p[1] + q[1]) / 2); x.stroke(); }
    return c;
  });
}
/** Glødende dråpe (ichor) – avlang, mørk skorpe og varm kjerne. Tegnes normal + glow-sprite additivt. */
export function droplet() {
  return memo('droplet', () => {
    const W = 24, H = 12, c = makeCanvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(70,24,8,0)'); g.addColorStop(0.5, 'rgba(120,40,10,.85)'); g.addColorStop(1, 'rgba(60,18,6,.95)');
    x.fillStyle = g; x.beginPath(); x.ellipse(W * 0.6, H / 2, W * 0.4, H * 0.32, 0, 0, TAU); x.fill();
    const h = x.createRadialGradient(W * 0.7, H / 2, 0, W * 0.7, H / 2, 5); h.addColorStop(0, 'rgba(255,190,90,1)'); h.addColorStop(1, 'rgba(255,90,20,0)');
    x.globalCompositeOperation = 'lighter'; x.fillStyle = h; x.beginPath(); x.arc(W * 0.7, H / 2, 5, 0, TAU); x.fill(); return c;
  });
}

// ---------------------------------------------------------------- dekaler (bakkeplan)
/** Ichor-sprut på bakken. Retning mot +x. Returnerer { base, hot } – hot tegnes additivt og avkjøles. */
export function ichorSplat(v = 0) {
  return memo(`ichor${v}`, () => {
    const S = 128, R = mulberry(5150 + v * 77), base = makeCanvas(S, S), hot = makeCanvas(S, S);
    // tetthetsfelt: hovedpøl + avlange striper i sprutretningen (+x) + løse dråper. Flatt på bakken – ingen kuleskygge.
    const B = [[46 + R() * 6, 64, 15 + R() * 4, 11 + R() * 3, 1]];
    for (let i = 0; i < 6; i++) { const a = (R() - 0.5) * 1.1; let d = 10; for (let j = 0; j < 5; j++) { d += 6 + R() * 7; const w = (1 - j / 5); B.push([46 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3.5 * w + 1.4, 1.6 * w + 1, 0.8]); } }
    for (let i = 0; i < 18; i++) { const a = (R() - 0.5) * 1.6, d = 26 + R() * 50; B.push([46 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1 + R() * 2, 0.9 + R() * 1.4, 0.9]); }
    for (let i = 0; i < 5; i++) { const a = R() * TAU, d = 8 + R() * 10; B.push([46 + Math.cos(a) * d, 64 + Math.sin(a) * d, 5 + R() * 5, 4 + R() * 4, 0.8]); }
    const F = new Float32Array(S * S);
    for (const [bx, by, sx, sy, k] of B) {
      const x0 = Math.max(0, Math.floor(bx - sx * 3)), x1 = Math.min(S - 1, Math.ceil(bx + sx * 3)), y0 = Math.max(0, Math.floor(by - sy * 3)), y1 = Math.min(S - 1, Math.ceil(by + sy * 3));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = (x - bx) / sx, dy = (y - by) / sy; F[y * S + x] += k * Math.exp(-(dx * dx + dy * dy) * 0.9); }
    }
    const bi = base.getContext('2d').createImageData(S, S), hi = hot.getContext('2d').createImageData(S, S), bd = bi.data, hd = hi.data;
    for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
      const i = y * S + x, n = fbm(x / 7, y / 7, v + 11, 3), f = F[i] * (0.75 + 0.5 * n), o = i * 4;
      const a = Math.max(0, Math.min(1, (f - 0.32) / 0.08)); if (a <= 0) continue;
      const film = Math.max(0, Math.min(1, (f - 0.32) / 0.5));                 // tynn kant = lysere brun, tykk = nesten svart tjære
      const gx = F[i + 1] - F[i - 1], gy = F[i + S] - F[i - S], spec = Math.max(0, -(gx * LIGHT_DIR.x + gy * LIGHT_DIR.y)) * 3 * film;
      bd[o] = 74 - 50 * film + spec * 120; bd[o + 1] = 32 - 20 * film + spec * 90; bd[o + 2] = 16 - 9 * film + spec * 70; bd[o + 3] = a * 235;
      // glød: bare i tykke partier, oppbrutt av årer (fbm) så det ikke blir en jevn klatt
      const hk = Math.max(0, f - 0.55) * (0.4 + 1.2 * Math.max(0, n - 0.35)); if (hk <= 0) continue;
      const t = Math.min(1, hk * 1.6);
      hd[o] = 200 + 55 * t; hd[o + 1] = 60 + 130 * t * t; hd[o + 2] = 18 + 50 * t * t * t; hd[o + 3] = Math.min(255, t * 255);
    }
    base.getContext('2d').putImageData(bi, 0, 0); hot.getContext('2d').putImageData(hi, 0, 0);
    return { base, hot };
  });
}
/** Svidd flekk etter eksplosjon. */
export function scorch(v = 0) {
  return memo(`scorch${v}`, () => {
    const S = 192, c = makeCanvas(S, S), x = c.getContext('2d'), R = mulberry(808 + v), id = x.createImageData(S, S), d = id.data;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const dx = xx - 96, dy = y - 96, rr = Math.hypot(dx, dy) / 96, a = Math.atan2(dy, dx), n = fbm(xx / 14, y / 14, v + 9, 4);
      const ray = 0.5 + 0.5 * Math.sin(a * 13 + n * 6) * Math.sin(a * 7 + 2), edge = 0.55 + 0.35 * ray + 0.25 * (n - 0.5);
      let al = rr < edge ? Math.pow(1 - rr / edge, 0.55) : 0; al *= 0.65 + 0.5 * n; const i = (y * S + xx) * 4;
      d[i] = 14 + n * 10; d[i + 1] = 12 + n * 8; d[i + 2] = 11 + n * 6; d[i + 3] = Math.min(235, al * 255);
    }
    x.putImageData(id, 0, 0);
    // lysere askekant og små sotflekker
    for (let i = 0; i < 40; i++) { const a = R() * TAU, r = 50 + R() * 40; x.fillStyle = `rgba(${R() < 0.5 ? '20,18,16' : '90,84,78'},${0.25 + R() * 0.3})`; x.beginPath(); x.arc(96 + Math.cos(a) * r, 96 + Math.sin(a) * r, 0.8 + R() * 2.2, 0, TAU); x.fill(); }
    return c;
  });
}
/** Kulehull. kind 'metal' | 'concrete'. { base, hot } – hot = glødende kant (metall) som avkjøles. */
export function bulletHole(kind = 'concrete', v = 0) {
  return memo(`hole${kind}${v}`, () => {
    const S = 32, R = mulberry(61 + v * 7 + kind.length), base = makeCanvas(S, S), hot = makeCanvas(S, S), b = base.getContext('2d'), h = hot.getContext('2d');
    if (kind === 'metal') {
      b.fillStyle = 'rgba(190,196,200,.55)'; b.beginPath(); b.arc(16, 16, 5.2, 0, TAU); b.fill();
      b.fillStyle = 'rgba(10,10,12,.95)'; b.beginPath(); b.arc(16, 16, 3, 0, TAU); b.fill();
      const g = h.createRadialGradient(16, 16, 2, 16, 16, 7); g.addColorStop(0, 'rgba(255,170,80,.9)'); g.addColorStop(1, 'rgba(255,80,20,0)'); h.fillStyle = g; h.beginPath(); h.arc(16, 16, 7, 0, TAU); h.fill();
    } else {
      for (let i = 0; i < 9; i++) { const a = R() * TAU, r = 3 + R() * 6; b.fillStyle = `rgba(${R() < 0.5 ? '150,146,138' : '40,38,36'},${0.25 + R() * 0.25})`; b.beginPath(); b.arc(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, 1 + R() * 2.4, 0, TAU); b.fill(); }
      b.fillStyle = 'rgba(16,15,14,.9)'; b.beginPath(); b.ellipse(16, 16, 3.4, 2.8, R(), 0, TAU); b.fill();
    }
    return { base, hot };
  });
}
/** Myk ring for sjokkbølge (bakkeplan, additiv). */
export function ring() {
  return memo('ring', () => {
    // tynn, oppbrutt trykkfront – lys forkant, svak hale innover; støy bryter opp sirkelen
    const S = 256, c = makeCanvas(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), d = id.data;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const rr = Math.hypot(xx - 128, y - 128) / 128; if (rr > 1 || rr < 0.5) continue;
      const a = Math.atan2(y - 128, xx - 128), n = fbm(Math.cos(a) * 4 + 9, Math.sin(a) * 4 + 9, 21, 4), e = 0.9 + (n - 0.5) * 0.06;
      const front = rr < e ? Math.pow(Math.max(0, (rr - 0.55) / (e - 0.55)), 3) : Math.exp(-Math.pow((rr - e) / 0.025, 2));
      const al = front * (0.25 + 0.95 * n), i = (y * S + xx) * 4; d[i] = 255; d[i + 1] = 214; d[i + 2] = 170; d[i + 3] = Math.min(255, al * 150);
    }
    x.putImageData(id, 0, 0); return c;
  });
}
/** Mørk ring (støv/trykk) – normalblending, gir bakken «skyv». */
export function dustRing() {
  return memo('dustRing', () => {
    const S = 256, c = makeCanvas(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), d = id.data;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const rr = Math.hypot(xx - 128, y - 128) / 128, a = Math.atan2(y - 128, xx - 128), n = fbm(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5 + rr * 4, 3, 4);
      const band = Math.exp(-Math.pow((rr - 0.82) / (0.07 + 0.05 * n), 2)) * (0.4 + 0.9 * n), i = (y * S + xx) * 4;
      d[i] = 120; d[i + 1] = 113; d[i + 2] = 102; d[i + 3] = Math.min(255, band * 200);
    }
    x.putImageData(id, 0, 0); return c;
  });
}

// ---------------------------------------------------------------- sprekker i bakken (spawnWarn)
/** Forgrenet sprekk i 4 vekststadier. Returnerer { stages:[{dark, glow}], size }. Senter i midten. */
export function crack(v = 0) {
  return memo(`crack${v}`, () => {
    const S = 256, R = mulberry(1337 + v * 101), segs = [];
    const grow = (x, y, a, len, w, depth, t0) => {
      let px = x, py = y; const n = Math.max(3, Math.round(len / 7));
      for (let i = 0; i < n; i++) {
        a += (R() - 0.5) * 0.9; const step = len / n * (0.6 + R() * 0.8), j = (R() - 0.5) * 2.2, nx = px + Math.cos(a) * step - Math.sin(a) * j, ny = py + Math.sin(a) * step * 0.95 + Math.cos(a) * j;
        const t = t0 + (i / n) * (1 - t0) * 0.85;
        segs.push({ x0: px, y0: py, x1: nx, y1: ny, w: w * (1 - (i / n) * 0.7), t });
        if (depth < 3 && R() < 0.3) grow(nx, ny, a + (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.8), len * (0.25 + R() * 0.35), w * 0.55, depth + 1, t);
        px = nx; py = ny;
      }
    };
    const nb = 5 + Math.floor(R() * 4);
    for (let i = 0; i < nb; i++) grow(128 + (R() - 0.5) * 8, 128 + (R() - 0.5) * 8, (i / nb) * TAU + (R() - 0.5) * 0.9, (i % 2 ? 40 : 70) + R() * 45, 2.6 + R() * 1.4, 0, 0);
    const stages = [];
    for (const lim of [0.3, 0.55, 0.8, 1.01]) {
      const dark = makeCanvas(S, S), dg = dark.getContext('2d'), gl = makeCanvas(S, S), gg = gl.getContext('2d');
      dg.lineCap = gg.lineCap = 'round';
      // nedtrykt rand (støv / knust betong rundt) – mørk bakkeskygge
      const pit = dg.createRadialGradient(128, 128, 0, 128, 128, 30 + lim * 40); pit.addColorStop(0, `rgba(10,8,7,${0.55 * lim})`); pit.addColorStop(1, 'rgba(10,8,7,0)');
      dg.fillStyle = pit; dg.fillRect(0, 0, S, S);
      for (const s of segs) if (s.t <= lim) { dg.strokeStyle = 'rgba(150,142,132,.28)'; dg.lineWidth = s.w + 1.6; dg.beginPath(); dg.moveTo(s.x0 - LIGHT_DIR.x * 1.4, s.y0 - LIGHT_DIR.y * 1.4); dg.lineTo(s.x1 - LIGHT_DIR.x * 1.4, s.y1 - LIGHT_DIR.y * 1.4); dg.stroke(); }
      for (const s of segs) if (s.t <= lim) { dg.strokeStyle = 'rgba(8,6,5,.95)'; dg.lineWidth = s.w; dg.beginPath(); dg.moveTo(s.x0, s.y0); dg.lineTo(s.x1, s.y1); dg.stroke(); }
      for (const s of segs) if (s.t <= lim) { gg.strokeStyle = 'rgba(210,60,22,1)'; gg.lineWidth = s.w * 3.2; gg.beginPath(); gg.moveTo(s.x0, s.y0); gg.lineTo(s.x1, s.y1); gg.stroke(); }
      const soft = soften(gl, 6), sg = soft.getContext('2d');
      sg.globalCompositeOperation = 'lighter'; sg.lineCap = 'round';
      for (const s of segs) if (s.t <= lim) { sg.strokeStyle = 'rgba(255,176,80,.9)'; sg.lineWidth = Math.max(0.7, s.w * 0.35); sg.beginPath(); sg.moveTo(s.x0, s.y0); sg.lineTo(s.x1, s.y1); sg.stroke(); }
      stages.push({ dark, glow: soft });
    }
    return { stages, size: S };
  });
}
/** Synkehull etter oppbrudd: mørk åpning med glødende rand og knust kant. { base, hot } */
export function sinkhole(v = 0) {
  return memo(`sink${v}`, () => {
    const S = 128, R = mulberry(222 + v), base = makeCanvas(S, S), hot = makeCanvas(S, S), b = base.getContext('2d'), h = hot.getContext('2d');
    const pts = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, r = 20 + R() * 9; pts.push([64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.9]); }
    const g0 = b.createRadialGradient(64, 64, 10, 64, 64, 60); g0.addColorStop(0, 'rgba(12,10,9,.8)'); g0.addColorStop(1, 'rgba(12,10,9,0)'); b.fillStyle = g0; b.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) { const a = R() * TAU, r = 28 + R() * 26; b.fillStyle = `rgba(${R() < 0.5 ? '120,114,106' : '30,28,26'},${0.4 + R() * 0.4})`; b.beginPath(); b.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + R() * 3, 0, TAU); b.fill(); }
    b.fillStyle = 'rgba(5,4,4,.97)'; b.beginPath(); pts.forEach((p, i) => (i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]))); b.closePath(); b.fill();
    b.strokeStyle = 'rgba(160,150,138,.45)'; b.lineWidth = 2; b.beginPath(); for (let i = 9; i < 16; i++) { const p = pts[i]; i === 9 ? b.moveTo(p[0], p[1]) : b.lineTo(p[0], p[1]); } b.stroke();
    // glød fra dypet: svak i midten, sterkest langs innsiden av randen, oppbrutt av støy
    const id = h.createImageData(S, S), d = id.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const rr = Math.hypot(x - 64, (y - 64) / 0.9) / 26, n = fbm(x / 8, y / 8, v + 40, 3); const band = Math.exp(-Math.pow((rr - 0.8) / 0.22, 2)) * 0.9 + 0.25 * Math.max(0, 1 - rr); const al = band * Math.max(0, n - 0.25) * 1.8; if (al <= 0) continue; const i = (y * S + x) * 4, t = Math.min(1, al); d[i] = 210 + 45 * t; d[i + 1] = 70 + 110 * t * t; d[i + 2] = 20 + 40 * t * t * t; d[i + 3] = Math.min(255, al * 230); }
    h.putImageData(id, 0, 0);
    return { base, hot };
  });
}
/** Myk sigd for nærkampslag (subtil bevegelsesuskarphet, ikke tegneseriebue). Senter i midten, bue mot +x. */
export function smear() {
  return memo('smear', () => {
    const S = 128, c = makeCanvas(S, S), x = c.getContext('2d');
    for (let i = 0; i < 14; i++) { const t = i / 13, a0 = -0.9 + t * 1.6; x.strokeStyle = `rgba(220,214,204,${0.05 + 0.13 * t})`; x.lineWidth = 2 + 6 * Math.sin(Math.PI * t); x.beginPath(); x.arc(64, 64, 48, a0, a0 + 0.22); x.stroke(); }
    return soften(c, 3);
  });
}

/** Bygg alt på forhånd (unngå hakk første gang en effekt brukes). */
export function warmup() {
  for (const t of ['soot', 'smoke', 'dust', 'concrete', 'steam']) for (let v = 0; v < 4; v++) puff(t, v);
  for (let h = 0; h < 3; h++) for (let v = 0; v < 3; v++) flame(h, v);
  for (const s of ['rifle', 'shotgun', 'marksman', 'enemy']) for (let v = 0; v < 3; v++) flash(s, v);
  for (const k of ['chitin', 'concrete', 'metal', 'rock']) for (let v = 0; v < 6; v++) shard(k, v);
  for (let v = 0; v < 4; v++) { ichorSplat(v); crack(v); } for (let v = 0; v < 3; v++) { scorch(v); sinkhole(v); }
  for (let v = 0; v < 3; v++) { bulletHole('metal', v); bulletHole('concrete', v); }
  ring(); dustRing(); smear(); droplet();
}
