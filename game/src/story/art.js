// BREACH – tegneprimitiver for mellomsekvens-illustrasjoner (Canvas 2D, ingen avhengigheter).
// Alle illustrasjoner tegnes i et virtuelt 1600×900-rom.

export const VW = 1600, VH = 900;

export const PAL = {
  armor: '#3a3f45', armor2: '#5a6068', cloth: '#8a7a5c', visor: '#39c6ff',
  grunt: '#c0392b', flanker: '#8e1e1e', heavy: '#ff7a1a', grenadier: '#9b59ff',
  concrete: '#2b2e31', metal: '#3d4246', hazard: '#c9a227', light: '#ffb347',
  ink: '#07080a', eye: '#ff2a1a',
};

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (a, b) => a + r() * (b - a);
  return r;
}

export function rgba(hex, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

// ---------- lys og atmosfære ----------

export function vgrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

/** Myk lysglød (additiv). */
export function glow(ctx, x, y, r, color, a = 1, sx = 1, sy = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y); ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.25, rgba(color, a * 0.45));
  g.addColorStop(0.6, rgba(color, a * 0.12)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Lyskjegle fra (x,y) nedover mot gulvlinje fy. */
export function cone(ctx, x, y, fy, spread, color, a = 0.22) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y, 0, fy);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, a * 0.15));
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + spread, fy); ctx.lineTo(x - spread, fy); ctx.closePath(); ctx.fill();
  ctx.restore();
  glow(ctx, x, fy, spread * 1.1, color, a * 0.9, 1, 0.22); // lysflekk på bakken
}

export function fog(ctx, y, h, color, a) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.5, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(0, y, VW, h);
}

export function smoke(ctx, rng, x, y, w, h, color, a, n = 40) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const px = x + rng() * w, py = y + rng() * h, r = 40 + rng() * 140;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rgba(color, a * (0.4 + rng() * 0.6))); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function rain(ctx, rng, n, a = 0.18, len = 26, slant = -0.18, color = '#9fb4c4') {
  ctx.save(); ctx.strokeStyle = rgba(color, a); ctx.lineWidth = 1.1; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = rng() * VW, y = rng() * VH, l = len * (0.5 + rng());
    ctx.moveTo(x, y); ctx.lineTo(x + slant * l, y + l);
  }
  ctx.stroke(); ctx.restore();
}

export function embers(ctx, rng, n, x, y, w, h, color = '#ffb347') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const px = x + rng() * w, py = y + rng() * h, s = 0.8 + rng() * 2.2, a = 0.3 + rng() * 0.7;
    ctx.fillStyle = rgba(color, a); ctx.fillRect(px, py, s, s * (1 + rng() * 3));
    if (rng() < 0.25) glow(ctx, px, py, 8 + s * 4, color, 0.25);
  }
  ctx.restore();
}

/** Rødt øyepar (fiende i mørket). */
export function eyes(ctx, x, y, s = 1, color = PAL.eye, a = 1) {
  glow(ctx, x, y, 26 * s, color, 0.35 * a);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(color, a);
  ctx.fillRect(x - 5 * s, y - 1 * s, 3.5 * s, 2 * s); ctx.fillRect(x + 1.5 * s, y - 1 * s, 3.5 * s, 2 * s);
  ctx.fillStyle = rgba('#ffd0c0', a * 0.8);
  ctx.fillRect(x - 4.3 * s, y - 0.5 * s, 1.6 * s, 1 * s); ctx.fillRect(x + 2.3 * s, y - 0.5 * s, 1.6 * s, 1 * s);
  ctx.restore();
}

// ---------- miljø ----------

export function hazard(ctx, x, y, w, h, a = 1, step = 18) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = rgba('#14110a', a); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(PAL.hazard, a);
  for (let i = -h; i < w + h; i += step * 2) {
    ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + step, y + h); ctx.lineTo(x + i + step + h, y); ctx.lineTo(x + i + h, y); ctx.fill();
  }
  ctx.restore();
}

/** Container sett fra siden. lit: 0..1 hvor mye varmt lys som treffer toppen. */
export function container(ctx, rng, x, y, w, h, col, lit = 0.3, lightCol = PAL.light) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mix(col, lightCol, lit * 0.35)); g.addColorStop(0.35, col); g.addColorStop(1, mix(col, '#000000', 0.55));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const rib = Math.max(6, w / 26);
  for (let i = x + rib; i < x + w - 2; i += rib) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(i, y + 3, rib * 0.35, h - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(i + rib * 0.35, y + 3, 1, h - 6);
  }
  ctx.fillStyle = rgba(lightCol, 0.18 * lit + 0.04); ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y + h - 4, w, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  for (let i = 0; i < w * h / 900; i++) { // rust og skitt
    ctx.fillStyle = rng() < 0.5 ? 'rgba(90,40,20,0.18)' : 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + rng() * w, y + rng() * h, 2 + rng() * 10, 1 + rng() * 4);
  }
}

export function lampPost(ctx, x, base, h, col = PAL.light, a = 0.24, spread = 120) {
  ctx.fillStyle = '#0d0f11'; ctx.fillRect(x - 3, base - h, 6, h);
  ctx.fillRect(x - 3, base - h, 26, 5);
  ctx.fillStyle = '#1b1e21'; ctx.fillRect(x + 12, base - h + 3, 18, 7);
  glow(ctx, x + 21, base - h + 10, 60, col, 0.9);
  glow(ctx, x + 21, base - h + 10, 14, '#fff2d8', 0.9);
  cone(ctx, x + 21, base - h + 10, base, spread, col, a);
}

/** Vertikal lysstripe i vått gulv. */
export function reflection(ctx, x, y0, len, col, a = 0.25, w = 10) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, y0, w, len);
  ctx.restore();
}

export function wetFloor(ctx, rng, y, col1 = '#15181b', col2 = '#090a0c') {
  vgrad(ctx, 0, y, VW, VH - y, [[0, col1], [1, col2]]);
  ctx.save();
  for (let i = 0; i < 160; i++) { // sølepytter / sprekker
    const px = rng() * VW, py = y + rng() * (VH - y), w = 30 + rng() * 220;
    ctx.fillStyle = rng() < 0.5 ? 'rgba(120,140,155,0.035)' : 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(px, py, w, w * 0.06 + 1, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function crane(ctx, x, base, h, col = '#0e1013') {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
  ctx.fillRect(x - 10, base - h, 20, h);
  for (let y = base - h; y < base; y += 28) { ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y + 28); ctx.stroke(); }
  ctx.fillRect(x - 140, base - h - 14, 420, 14);
  ctx.beginPath(); ctx.moveTo(x, base - h - 70); ctx.lineTo(x - 140, base - h - 12); ctx.moveTo(x, base - h - 70); ctx.lineTo(x + 280, base - h - 12); ctx.stroke();
  ctx.fillRect(x - 4, base - h - 74, 8, 64);
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 190, base - h); ctx.lineTo(x + 190, base - h + 120); ctx.stroke();
  ctx.fillRect(x + 178, base - h + 120, 24, 14);
  ctx.restore();
  glow(ctx, x + 278, base - h - 8, 10, '#ff3020', 0.9); // flylys
}

/** Tank/tårn (sylinder) med ringer og stige. */
export function tank(ctx, x, y, w, h, col = PAL.metal, rim = PAL.light, rimA = 0.25) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, mix(col, '#000000', 0.7)); g.addColorStop(0.35, mix(col, '#000000', 0.35));
  g.addColorStop(0.75, mix(col, '#000000', 0.55)); g.addColorStop(0.97, mix(col, rim, rimA)); g.addColorStop(1, mix(col, '#000000', 0.6));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.beginPath(); ctx.ellipse(x + w / 2, y, w / 2, w * 0.08, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let yy = y + 40; yy < y + h; yy += 70) ctx.fillRect(x, yy, w, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + w * 0.18, y + 10, 4, h - 10); ctx.fillRect(x + w * 0.18 + 14, y + 10, 4, h - 10);
  for (let yy = y + 14; yy < y + h; yy += 16) ctx.fillRect(x + w * 0.18, yy, 18, 2);
}

export function pipe(ctx, x1, y1, x2, y2, r, col = '#22262a', hi = PAL.light, hiA = 0.18) {
  ctx.save(); ctx.lineCap = 'butt';
  ctx.strokeStyle = mix(col, '#000000', 0.4); ctx.lineWidth = r * 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = r * 1.3; ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1), ox = Math.sin(ang) * -r * 0.6, oy = Math.cos(ang) * r * 0.6 * -1;
  ctx.strokeStyle = rgba(hi, hiA); ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath(); ctx.moveTo(x1 - ox, y1 + oy); ctx.lineTo(x2 - ox, y2 + oy); ctx.stroke();
  ctx.restore();
}

export function chain(ctx, x, y0, len, col = '#0c0d0f', sway = 0) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  for (let y = y0; y < y0 + len; y += 9) {
    const t = (y - y0) / len, xx = x + Math.sin(t * 2) * sway * t;
    ctx.beginPath(); ctx.ellipse(xx, y, (y / 9) % 2 ? 2 : 3.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ---------- figurer ----------
// Lokalt rom: føtter i (0,0), høyde ~106 enheter, ser mot høyre (+x). Kantete rustningsplater.

function P2(pts) { const p = new Path2D(); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); return p; }
const tf = (pts, sx, sy, dx, dy, rot = 0, ox = 0, oy = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i] * sx, y = pts[i + 1] * sy; out.push(ox + x * c - y * s + dx, oy + x * s + y * c + dy); }
  return out;
};

const WEAPON = {
  rifle: [[-22, -3, -8, -5, -8, 4, -20, 7], [-8, -5, 22, -5, 22, 4, -8, 4], [5, 4, 11, 4, 14, 15, 8, 15], [22, -4, 34, -4, 34, 3, 22, 3], [34, -2, 46, -2, 46, 1, 34, 1], [-1, -9, 12, -9, 12, -5, -1, -5]],
  smg: [[-10, -4, 16, -4, 16, 3, -10, 3], [2, 3, 7, 3, 8, 13, 4, 13], [16, -2, 26, -2, 26, 1, 16, 1], [-16, -2, -10, -3, -10, 2, -16, 4]],
  minigun: [[-12, -7, 30, -7, 30, 7, -12, 7], [30, -5, 58, -5, 58, 5, 30, 5], [0, 7, 18, 7, 18, 20, 0, 20], [-20, -4, -12, -6, -12, 6, -20, 4]],
  launcher: [[-12, -6, 26, -6, 26, 6, -12, 6], [26, -8, 36, -8, 36, 8, 26, 8], [2, 6, 10, 6, 10, 16, 2, 16]],
};

function figureParts(kind, pose, unarmed = false) {
  const parts = [];
  const add = (pts) => parts.push(P2(pts));
  const heavy = kind === 'heavy', hood = kind === 'flanker', gren = kind === 'grenadier';
  const k = pose === 'kneel', dy = k ? 22 : 0, W = heavy ? 1.3 : hood ? 0.9 : 1;
  const T = (pts) => tf(pts, W, 1, 0, dy);
  if (k) {
    add([-6, -30, 10, -32, 24, -28, 25, -20, 20, -3, 26, -2, 26, 0, 9, 0, 11, -18, 0, -20, -8, -22]); // kne opp
    add([-16, -32, -2, -30, -7, -12, -4, -4, -4, 0, -28, 0, -30, -5, -18, -9]);                       // kne i bakken
  } else {
    add(tf([-17, -54, -4, -54, -5, -31, -7, -9, -3, -5, -3, 0, -22, 0, -22, -6, -17, -10, -16, -31], W, 1, 0, 0));
    add(tf([-1, -54, 11, -54, 13, -31, 15, -10, 22, -6, 24, 0, 6, 0, 6, -9, 3, -31], W, 1, 0, 0));
    add(tf([-18, -36, -3, -36, -4, -26, -17, -26], W, 1, 0, 0)); add(tf([0, -37, 14, -37, 15, -27, 2, -27], W, 1, 0, 0));
  }
  if (hood) add(T([-17, -56, 15, -56, 22, -32, 8, -36, -6, -30, -24, -28]));               // frakk
  add(T([-18, -88, 12, -89, 19, -80, 21, -67, 16, -54, -15, -50, -21, -61, -23, -78]));     // torso
  add(T([-16, -58, 16, -58, 15, -50, -15, -50]));                                             // belte
  if (kind === 'warden' || gren) add(T([-32, -88, -19, -90, -17, -58, -30, -60]));          // ryggsekk
  if (gren) { add(T([-38, -84, -31, -86, -31, -62, -38, -62])); }                             // granatrør
  if (heavy) add(T([-36, -96, -20, -98, -17, -56, -34, -58]));                                // tank
  add(T([-31, -91, -12, -94, -7, -82, -13, -72, -29, -74]));                                  // skulder bak
  add(T([1, -93, 19, -92, 26, -81, 21, -71, 5, -74]));                                        // skulder foran
  const hx = heavy ? 2 : 0, hy = dy;
  if (hood) add([-11, -88 + hy, -13, -99 + hy, -5, -110 + hy, 5, -107 + hy, 12, -96 + hy, 13, -89 + hy]);
  else {
    add([-8 + hx, -93 + hy, 8 + hx, -93 + hy, 8 + hx, -87 + hy, -8 + hx, -87 + hy]);          // nakke
    add([-10 + hx, -92 + hy, -11 + hx, -101 + hy, -6 + hx, -107 + hy, 4 + hx, -108 + hy, 11 + hx, -104 + hy, 14 + hx, -98 + hy, 14 + hx, -92 + hy, 10 + hx, -89 + hy, 2 + hx, -88 + hy, -6 + hx, -89 + hy]);
  }
  // våpen i «low ready», litt ned mot høyre
  const wpn = heavy ? 'minigun' : hood ? 'smg' : gren ? 'launcher' : 'rifle';
  const rot = heavy ? 0.08 : 0.24, gx = (heavy ? 10 : 6) * W, gy = -64 + dy, ws = heavy ? 1.25 : 1;
  add(T([-14, -82, -5, -84, 9, -68, 7, -61, -1, -63, -15, -73]).map((v, i) => (i % 2 ? v : v)));   // bakre arm
  if (unarmed) add(T([6, -88, 18, -86, 17, -60, 13, -56, 8, -58, 7, -72]));                 // ubevæpnet: armen henger
  else {
    for (const w of WEAPON[wpn]) add(tf(w, ws, ws, 0, 0, rot, gx, gy));
    const fh = tf([30, 0], ws, ws, 0, 0, rot, gx, gy);                                               // fremre hånd på våpenet
    add([8 * W, -86 + dy, 21 * W, -83 + dy, fh[0] + 3, fh[1] - 2, fh[0] - 1, fh[1] + 5, fh[0] - 8, fh[1] + 2, 10 * W, -72 + dy]);
  }
  return { parts, head: { x: 10 + hx, y: -98 + dy }, chest: { x: 4, y: -74 + dy }, W };
}

const WARDEN = { rim: '#a9c0d2', armor: '#1a1e23', scarf: '#a8814f', scarfD: '#6e5232', stripe: '#2e4f66', stripeL: '#4f7894' };

/** Wardens kjennetegn fra den nye stilen: sandskjerf med haler, blå skulderstripe, sekk med cyan LED og antenne. */
function wardenGear(ctx, o, s, flip) {
  const dy = o.pose === 'kneel' ? 22 : 0;
  const lit = o.rimA ?? 0.6;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s * flip, s);
  const poly = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0], pts[1] + dy); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] + dy); ctx.closePath(); ctx.fill(); };
  // skjerfhaler bak over sekken (i motlys: mørk sand med lys kant)
  poly([-8, -92, -13, -90, -22, -66, -24, -56, -19, -60, -16, -70, -9, -86], mix(WARDEN.scarfD, '#000000', 0.6));
  poly([-6, -90, -10, -88, -15, -66, -12, -60, -11, -70, -6, -86], mix(WARDEN.scarfD, '#000000', 0.5));
  // krage rundt halsen
  poly([-9, -95, 8, -95, 11, -90, 7, -86, -7, -86, -11, -90], mix(WARDEN.scarf, '#000000', 0.62));
  poly([-9, -95, 8, -95, 9, -93.6, -9, -93.6], rgba(mix(WARDEN.scarf, '#ffffff', 0.1), 0.25 + lit * 0.25));
  // blå stripe på ytterkanten av fremre skulderplate
  poly([16, -92, 20, -92, 26, -81, 22, -80], rgba(WARDEN.stripe, 0.95));
  poly([16, -92, 20, -92, 21, -90, 17, -90], rgba(WARDEN.stripeL, 0.6));
  // antenne
  ctx.strokeStyle = 'rgba(10,12,14,0.95)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-29, -89 + dy); ctx.lineTo(-35, -107 + dy); ctx.stroke();
  ctx.strokeStyle = rgba(WARDEN.rim, 0.35 * lit); ctx.lineWidth = 0.4; ctx.stroke();
  ctx.restore();
  // cyan LED på sekken
  const lx = o.x + (-26) * s * flip, ly = o.y + (-84 + dy) * s;
  glow(ctx, lx, ly, 5 * s, o.visor || PAL.visor, 0.55 * (o.eyeA ?? 1));
  ctx.fillStyle = rgba('#bff3ff', 0.9 * (o.eyeA ?? 1)); ctx.fillRect(lx - 0.6 * s, ly - 0.6 * s, 1.2 * s, 1.2 * s);
}

/**
 * Tegn en figur. o = { x, y, s, flip, kind:'warden'|'grunt'|'flanker'|'heavy'|'grenadier', pose:'stand'|'kneel',
 *   fill, rim, rimA, rimDir (-1|1 = lyset kommer fra venstre|høyre på skjermen), eye, eyeA }
 */
export function figure(ctx, o) {
  const { parts, head, chest, W } = figureParts(o.kind || 'warden', o.pose || 'stand', !!o.unarmed);
  const s = o.s || 1, flip = o.flip ? -1 : 1, rimDir = o.rimDir ?? -1;
  const off = Math.max(1.4, s * 0.5);                       // kantlysbredde i skjerm-piksler
  const draw = (fill, dx = 0, dy = 0, stroke = null) => {
    ctx.save(); ctx.translate(o.x + dx, o.y + dy); ctx.scale(s * flip, s);
    ctx.fillStyle = fill; for (const p of parts) ctx.fill(p);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.7 / s * Math.max(1, s * 0.45); for (const p of parts) ctx.stroke(p); }
    ctx.restore();
  };
  // Warden: miljølyset (#ffb347) skal aldri farge ham (KARAKTER-SPEC §1) – kaldt stålkantlys, litt lysere rustning.
  const isW = (o.kind || 'warden') === 'warden';
  if (isW && o.rim) o = { ...o, rim: WARDEN.rim, rimA: Math.min(0.75, (o.rimA ?? 0.85) * 0.8), fill: mix(o.fill || PAL.ink, WARDEN.armor, 0.35) };
  if (o.rim) draw(rgba(o.rim, o.rimA ?? 0.85));
  const base = o.fill || PAL.ink;
  const g = ctx.createLinearGradient(0, o.y - 110 * s, 0, o.y);
  g.addColorStop(0, mix(base, o.rim || '#888888', 0.035)); g.addColorStop(1, base);
  draw(g, o.rim ? -rimDir * off : 0, o.rim ? off * 0.35 : 0);
  if (isW) wardenGear(ctx, o, s, flip);
  if (o.eye === false) return;
  const hx = o.x + head.x * s * flip, hy = o.y + head.y * s;
  const cx = o.x + chest.x * s * flip * W, cy = o.y + chest.y * s;
  const k = o.kind || 'warden', ea = o.eyeA ?? 1;
  if (k === 'warden') {
    // o.visor: overstyr visirfarge (Hale omprogrammert = rødt). o.hood: sekk over hodet (Hale føres bort).
    const vis = o.visor || PAL.visor;
    if (o.hood) {
      // lys jutesekk, tydelig større enn hjelmen, med snor rundt halsen
      ctx.save(); ctx.translate(hx, hy); ctx.scale(s * flip, s);
      const sack = new Path2D(); sack.moveTo(-19, 9); sack.bezierCurveTo(-22, -4, -18, -16, -8, -17); sack.bezierCurveTo(2, -18, 9, -12, 9, -3);
      sack.bezierCurveTo(9, 4, 6, 9, 3, 11); sack.lineTo(-4, 9); sack.lineTo(-12, 12); sack.closePath();
      const sg = ctx.createLinearGradient(-14, -17, 4, 11); sg.addColorStop(0, '#d6c094'); sg.addColorStop(0.55, '#a88c5c'); sg.addColorStop(1, '#5e4a30');
      ctx.fillStyle = sg; ctx.fill(sack);
      ctx.save(); ctx.clip(sack); ctx.strokeStyle = 'rgba(70,52,30,0.45)'; ctx.lineWidth = 0.5;
      for (let i = -20; i < 12; i += 2.2) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i + 3, 12); ctx.stroke(); } // vev
      ctx.fillStyle = 'rgba(40,28,16,0.35)'; ctx.beginPath(); ctx.ellipse(4, 2, 6, 7, 0.3, 0, Math.PI * 2); ctx.fill();    // skygge mot lyset
      ctx.restore();
      ctx.fillStyle = 'rgba(60,44,26,0.6)'; ctx.beginPath(); ctx.moveTo(-6, -17); ctx.lineTo(-3, -22); ctx.lineTo(-1, -17); ctx.fill(); // knytt flik
      ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-17, 7); ctx.quadraticCurveTo(-6, 11, 5, 7); ctx.stroke(); // snor
      ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(-8, 16); ctx.moveTo(-6, 9); ctx.lineTo(-3, 15); ctx.stroke();
      ctx.restore();
    } else if (o.visorDead) {
      // slukket visir: mørkt glass med svak kald kantrefleks, ingen glød
      ctx.save(); ctx.translate(hx, hy); ctx.scale(flip, 1);
      const vg = ctx.createLinearGradient(0, -2 * s, 0, 1.8 * s); vg.addColorStop(0, '#3a4954'); vg.addColorStop(0.35, '#121a20'); vg.addColorStop(1, '#05080a');
      ctx.fillStyle = vg; ctx.fillRect(-5 * s, -2 * s, 10.5 * s, 3.8 * s);                                   // mørkt glass
      ctx.fillStyle = rgba('#b8cad8', 0.85); ctx.fillRect(-4.6 * s, -2 * s, 9.6 * s, 0.55 * s);                 // kaldt kantlys i overkant
      ctx.fillStyle = rgba('#e6eef4', 0.9); ctx.fillRect(2.4 * s, -1.3 * s, 1.8 * s, 0.7 * s);                  // liten glassrefleks
      ctx.fillStyle = rgba('#8aa0b0', 0.35); ctx.fillRect(-4.6 * s, 1.2 * s, 9.6 * s, 0.4 * s);                 // dempet underkant
      ctx.restore();
    } else {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(vis, 0.95 * ea);
      ctx.translate(hx, hy); ctx.scale(flip, 1); ctx.fillRect(-4 * s, -1.2 * s, 8 * s, 2.2 * s); ctx.restore();
      glow(ctx, hx + 2 * s * flip, hy, 20 * s, vis, 0.45 * ea);
    }
    if (!o.visorDead) glow(ctx, cx + 6 * s * flip, cy + 2 * s, 5 * s, vis, 0.3 * ea); // brystlys
  } else {
    eyes(ctx, hx, hy + 1 * s, s * 0.5, PAL.eye, ea);
    if (k === 'heavy') { glow(ctx, cx + 6 * s * flip, cy, 24 * s, PAL.heavy, 0.5 * ea); glow(ctx, cx + 6 * s * flip, cy, 5 * s, '#ffe0b0', 0.8 * ea); }
    if (k === 'grenadier') { for (let i = 0; i < 3; i++) glow(ctx, o.x + (-34) * s * flip, o.y + (-82 + i * 8) * s, 6 * s, PAL.grenadier, 0.8 * ea); }
    if (k === 'flanker') glow(ctx, hx, hy + 2 * s, 14 * s, PAL.flanker, 0.35 * ea);
  }
}

// ---------- etterbehandling ----------

export function vignette(ctx, strength = 0.85, col = '#000000') {
  const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VW * 0.72);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, strength));
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}

/** Fargegradering: multipliser + skjerm-tone. */
export function grade(ctx, shadow = '#0a1218', shadowA = 0.25, high = '#ff9a40', highA = 0.05) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgba(mix(shadow, '#ffffff', 0.6), 1); ctx.globalAlpha = shadowA; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = highA; ctx.fillStyle = high; ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}
