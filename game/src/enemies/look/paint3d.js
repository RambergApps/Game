// Cinderborn – malt mini-3D for sprite-baking (Breach Fiende-design). Eies av Fiende-design (src/enemies/look/).
// Kjøres KUN når en sprite bakes (ikke per bilde). Hver kroppsdel bygges som et nett av små plater (firkanter/
// trekanter) i fiendens lokalrom (x = fram, y = høyre, z = opp, verdens-px), dreies til en av 8 retninger, projiseres
// med felles PROJ (skjerm = x, y − z·zScale) og males bakfra og fram (malers algoritme) med lys fra LIGHT_DIR:
//   plate  = valør fra lys (lo/mid/hi) + tilfeldig valørflekk + mørkning mot gulvet + varmt glødlys nedenfra
//   fuge   = mørk spalte eller glødende sprekk mellom platene (glødende fuger går også til glødlaget)
//   kant   = lyst platekant-strøk på lyssiden, glanspunkt der speilingen treffer kamera
// Glødlaget males i samme rekkefølge, og nærmere plater visker det ut (destination-out), så glød bak kroppen skjules.
import { PROJ } from '../../shared/projection.js';
import { LIGHT_DIR, LIGHT_ELEVATION, shadowOffset } from '../../shared/light.js';

export const TAU = Math.PI * 2;
/**
 * Tegneteknikk – ett bryterpunkt, så look/ kan følge den varianten Warden ender med:
 *   soft: true  → «myk fasett»: avfasede/avrundede plater (facet.plate), ingen mørke fuger inne i en del,
 *                 lineær overgang over store fasetter (bare ved baking), sterkere valørkontrast og lysere kant.
 *   soft: false → v2 «hard fasett» (skarpe plater med mørke fuger).
 * Kan overstyres for sammenligning med ?monsterLook=hard i adressen.
 */
export const STYLE = { soft: !(typeof location !== 'undefined' && /monsterLook=hard/.test(location.search)), contrast: 1.35, grad: 0.22 };
// Vinkel leses fra felles PROJ (ingen hardkodede verdier): Z = zScale = tan(tilt), G = groundScaleY (kameraets
// bakkeforkorting). Sprites bakes i SKJERMPLANET (y·G) så pikslene er 1:1 etter kameraet; bakeone strekker metadata med 1/G.
export function view() { const Z = PROJ.zScale, G = PROJ.groundScaleY || 1, VL = Math.hypot(Z, 1); return { Z, G, VV: [0, Z / VL, 1 / VL], tiltDeg: PROJ.tiltDeg }; }
const Z = PROJ.zScale;
const ce = Math.cos(LIGHT_ELEVATION), se = Math.sin(LIGHT_ELEVATION);
export const L3 = [LIGHT_DIR.x * ce, LIGHT_DIR.y * ce, se];
const VL = Math.hypot(Z, 1);
export const VV = [0, Z / VL, 1 / VL];                    // mot kamera (projeksjonsretning i trekvart)
const SL = Math.hypot(LIGHT_DIR.x, LIGHT_DIR.y - 0.6);
export const LIGHT_SCREEN = [LIGHT_DIR.x / SL, (LIGHT_DIR.y - 0.6) / SL];  // lysretning på skjermen (opp-venstre)

// ---------------------------------------------------------------- vektorer
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const smooth = (t) => t * t * (3 - 2 * t);

/** Rotasjonsmatrise (roll om x, pitch om y – positiv = nese ned, yaw om z) → funksjon p → p'. */
export function rot(yaw = 0, pitch = 0, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return (p) => {
    const y1 = p[1] * cr - p[2] * sr, z1 = p[1] * sr + p[2] * cr;
    const x2 = p[0] * cp + z1 * sp, z2 = -p[0] * sp + z1 * cp;
    return [x2 * cy - y1 * sy, x2 * sy + y1 * cy, z2];
  };
}
/** Roter p om pivot. */
export function rotAbout(p, pivot, R) { return add(pivot, R(sub(p, pivot))); }

// deterministisk tilfeldighet
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- modell
/** Ny modell: liste av tegnbare (plater, glødlinjer, glødpunkter). */
export function model() { return { items: [] }; }
/**
 * Plate: pts (3–4 punkter), mat, inner (punkt inne i volumet → normal peker bort; null = tosidig hinne),
 * o: { seam: 'dark'|'glow'|null, gap (verdens-px), jit (valør ±), glow: [r,g,b] (fugeglød), gi (glødstyrke), spec }
 */
export function quad(M, pts, mat, inner, o = {}) { M.items.push({ k: 'q', pts, mat, inner, o }); }
/** Glødende linje på en flate (sprekk, munn, årer). pts i lokalrom, w i verdens-px, col [r,g,b], a 0..1. */
export function gline(M, pts, col, w, a = 1, o = {}) { M.items.push({ k: 'l', pts, col, w, a, hot: o.hot, bias: o.bias ?? 0.8, body: o.body }); }
/** Glødende punkt (øyne, spydspiss). */
export function gspot(M, p, r, col, a = 1, o = {}) { M.items.push({ k: 's', pts: [p], r, col, a, hot: o.hot, bias: o.bias ?? 1.2 }); }

// ---------------------------------------------------------------- primitiver
/**
 * Ellipsoide-skall som plater. c senter, r [rx,ry,rz], R rotasjon, nA × nE celler mellom e0..e1 (rad) og a0..a1.
 * jitter: hjørneforskyvning (andel av celle) gir uregelmessige plater (malt, ikke rutenett).
 */
export function shell(M, c, r, R, mat, o = {}) {
  const nA = o.nA || 12, nE = o.nE || 5, e0 = o.e0 ?? -Math.PI / 2, e1 = o.e1 ?? Math.PI / 2;
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const rand = rng(o.seed || 7), J = o.jitter ?? 0.28;
  const grid = [];
  for (let j = 0; j <= nE; j++) {
    const row = [];
    for (let i = 0; i <= nA; i++) {
      const edgeE = j === 0 || j === nE, edgeA = !full && (i === 0 || i === nA);
      let a = a0 + (i / nA) * (a1 - a0), e = e0 + (j / nE) * (e1 - e0);
      if (!edgeA) a += (rand() - 0.5) * J * (a1 - a0) / nA;
      if (!edgeE) e += (rand() - 0.5) * J * (e1 - e0) / nE;
      row.push(add(c, R([Math.cos(a) * Math.cos(e) * r[0], Math.sin(a) * Math.cos(e) * r[1], Math.sin(e) * r[2]])));
    }
    if (full) row[nA] = row[0];
    grid.push(row);
  }
  const out = [];
  for (let j = 0; j < nE; j++) for (let i = 0; i < nA; i++) {
    const p = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
    const pick = typeof o.seamFn === 'function' ? o.seamFn(i, j, rand) : null;
    const it = { k: 'q', pts: p, mat, inner: c, o: { ...o, ...(pick || {}), jit: o.jit ?? 0.14, seed: rand() } };
    M.items.push(it); out.push(it);
  }
  return { grid, quads: out };
}

/** Rør langs polylinje (lemmer, hale, kropp). pts lokalrom, radii per punkt, sides, rings per segment. */
export function tube(M, pts, radii, mat, o = {}) {
  const sides = o.sides || 7, sub_ = o.rings || 2, ring = [], cen = [];
  const N = pts.length;
  const P = [], Rr = [];
  for (let i = 0; i < N - 1; i++) for (let s = 0; s < sub_; s++) { const t = s / sub_; P.push(lerp3(pts[i], pts[i + 1], t)); Rr.push(radii[i] + (radii[i + 1] - radii[i]) * t); }
  P.push(pts[N - 1]); Rr.push(radii[N - 1]);
  let prevU = null;
  for (let i = 0; i < P.length; i++) {
    const t = norm(sub(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]));
    let u = prevU ? norm(sub(prevU, mul(t, dot(prevU, t)))) : norm(cross(t, Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]));
    if (!isFinite(u[0])) u = norm(cross(t, [0, 1, 0]));
    prevU = u; const v = cross(t, u);
    const rr = []; for (let k = 0; k < sides; k++) { const a = (k / sides) * TAU + (o.twist || 0); rr.push(add(P[i], add(mul(u, Math.cos(a) * Rr[i]), mul(v, Math.sin(a) * Rr[i] * (o.flat || 1))))); }
    ring.push(rr); cen.push(P[i]);
  }
  const rand = rng(o.seed || 11);
  for (let i = 0; i < ring.length - 1; i++) for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides;
    M.items.push({ k: 'q', pts: [ring[i][k], ring[i][k2], ring[i + 1][k2], ring[i + 1][k]], mat, inner: lerp3(cen[i], cen[i + 1], 0.5), o: { ...o, jit: o.jit ?? 0.1, seed: rand() } });
  }
  // endelokk (kjegle-tupp eller avrundet)
  const cap = (i, dir) => { const c = cen[i], tip = add(c, mul(norm(sub(cen[i], cen[i - dir])), Rr[i] * (o.capLen ?? 0.8)));
    for (let k = 0; k < sides; k++) M.items.push({ k: 'q', pts: [ring[i][k], ring[i][(k + 1) % sides], tip], mat, inner: c, o: { ...o, seam: null, jit: 0.08, seed: rand() } }); };
  if (o.capEnd !== false) cap(ring.length - 1, 1);
  if (o.capStart) cap(0, -1);
  return { centers: cen, rings: ring };
}

/** Kjegle/pigg fra base til tupp. */
export function cone(M, base, tip, r, mat, o = {}) {
  const sides = o.sides || 5, ax = norm(sub(tip, base));
  const u = norm(cross(ax, Math.abs(ax[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), v = cross(ax, u);
  const rr = []; for (let k = 0; k < sides; k++) { const a = (k / sides) * TAU; rr.push(add(base, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))); }
  const inner = lerp3(base, tip, 0.25);
  for (let k = 0; k < sides; k++) M.items.push({ k: 'q', pts: [rr[k], rr[(k + 1) % sides], tip], mat, inner, o: { seam: null, jit: 0.1, seed: k * 0.13, spec: o.spec ?? 0.8 } });
}

/** Tosidig hinne (krage): trekanter fra rot til ribbetupper med innbuktning mellom ribbene. */
export function membrane(M, root, tips, mat, o = {}) {
  for (let i = 0; i < tips.length - 1; i++) {
    const a = tips[i], b = tips[i + 1], mid = lerp3(lerp3(a, b, 0.5), root, o.scallop ?? 0.18);
    const m1 = lerp3(root, a, 0.5), m2 = lerp3(root, b, 0.5), mm = lerp3(root, mid, 0.5);
    // to rader trekanter (rot-nær og ytre) for valørvariasjon
    const tri = (p) => M.items.push({ k: 'q', pts: p, mat, inner: null, o: { seam: o.seam ?? 'dark', gap: o.gap ?? 0.12, jit: 0.12, seed: i * 0.37 + p.length, membrane: true } });
    tri([root, m1, mm]); tri([root, mm, m2]); tri([m1, a, mid, mm]); tri([mm, mid, b, m2]);
  }
}

// ---------------------------------------------------------------- maling
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function ramp(m, v) { // v 0..1 → lo → mid → hi
  if (v < 0.5) { const t = v / 0.5; return [m.lo[0] + (m.mid[0] - m.lo[0]) * t, m.lo[1] + (m.mid[1] - m.lo[1]) * t, m.lo[2] + (m.mid[2] - m.lo[2]) * t]; }
  const t = (v - 0.5) / 0.5; return [m.mid[0] + (m.hi[0] - m.mid[0]) * t, m.mid[1] + (m.hi[1] - m.mid[1]) * t, m.mid[2] + (m.hi[2] - m.mid[2]) * t];
}

/**
 * Transformer modellen til verden (yaw + skala, fot i origo) og lag tegneliste sortert bakfra og fram.
 * Returnerer { list, bbox:{x0,y0,x1,y1} (verdens-px, skjermplan), shadows: [[sx,sy]...] }.
 */
export function prepare(M, yaw, scale = 1) {
  const R = rot(yaw), W = (p) => { const q = R(p); return [q[0] * scale, q[1] * scale, q[2] * scale]; };
  const { Z, G, VV } = view();
  const list = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const shadows = [];
  const so = shadowOffset(1);
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  const gb = (sx, sy) => { if (sx < bx0) bx0 = sx; if (sx > bx1) bx1 = sx; if (sy < by0) by0 = sy; if (sy > by1) by1 = sy; };
  const grow = (sx, sy) => { if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy; };
  for (const it of M.items) {
    const P = it.pts.map(W);
    let c = [0, 0, 0]; for (const p of P) c = add(c, p); c = mul(c, 1 / P.length);
    const S = P.map((p) => [p[0], (p[1] - p[2] * Z) * G]);
    for (const s of S) { grow(s[0], s[1]); gb(s[0], s[1]); }
    if (it.k === 'q') {
      let n = P.length === 4 ? cross(sub(P[2], P[0]), sub(P[3], P[1])) : cross(sub(P[1], P[0]), sub(P[2], P[0]));
      n = norm(n);
      if (it.inner) { const inn = W(it.inner); if (dot(n, sub(c, inn)) < 0) n = mul(n, -1); }
      const vis = dot(n, VV);
      let back = false;
      if (!it.inner) { if (vis < 0) { n = mul(n, -1); back = true; } } else if (vis < -0.02) {
        shadows.push(P.map((p) => [p[0] + so.x * p[2], (p[1] + so.y * p[2]) * G])); continue;
      }
      shadows.push(P.map((p) => [p[0] + so.x * p[2], (p[1] + so.y * p[2]) * G]));
      list.push({ it, P, S, c, n, back, depth: dot(c, VV) });
    } else {
      if (it.k === 's') { const r = it.r * scale * 2.4; gb(S[0][0] - r, S[0][1] - r); gb(S[0][0] + r, S[0][1] + r); grow(S[0][0] - r, S[0][1] - r); grow(S[0][0] + r, S[0][1] + r); }
      list.push({ it, P, S, c, depth: dot(c, VV) + (it.bias || 0) * scale });
    }
  }
  for (const sh of shadows) for (const s of sh) grow(s[0], s[1]);
  list.sort((a, b) => a.depth - b.depth);
  return { list, shadows, bbox: { x0, y0, x1, y1 }, bodyBox: { x0: bx0, y0: by0, x1: bx1, y1: by1 }, scale, G, VV };
}

function inset(S, g) {
  let cx = 0, cy = 0; for (const s of S) { cx += s[0]; cy += s[1]; } cx /= S.length; cy /= S.length;
  return S.map((s) => { const dx = s[0] - cx, dy = s[1] - cy, d = Math.hypot(dx, dy) || 1, k = Math.max(0.25, 1 - g / d); return [cx + dx * k, cy + dy * k]; });
}
function poly(ctx, S) { ctx.beginPath(); ctx.moveTo(S[0][0], S[0][1]); for (let i = 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1]); ctx.closePath(); }

/**
 * Mal tegnelisten. body/glow: 2D-kontekster med transform satt til verdens-px. opts: { warm:[r,g,b] (glødlys nedenfra),
 * groundH (høyde der mørkningen mot gulvet slutter), glowMul }
 */
export function paint(body, glow, prep, opts = {}) {
  const warm = opts.warm || [0, 0, 0], gH = opts.groundH || 20, sc = prep.scale;
  const hx = LIGHT_SCREEN[0], hy = LIGHT_SCREEN[1], lodPx = opts.px ? opts.px * opts.px : 0;
  for (const d of prep.list) {
    const it = d.it;
    if (it.k === 'q') {
      const m = it.mat, o = it.o, n = d.n;
      const lam = dot(n, L3);
      let v = clamp((lam + 0.42) / 1.42);
      if (STYLE.soft) v = clamp((v - 0.45) * STYLE.contrast + 0.45);   // mørkere mørke, lysere lys
      if (d.back) v *= 0.7;
      const ao = 0.5 + 0.5 * clamp(d.c[2] / (gH * sc));                // mørkere mot gulvet
      const jit = 1 + ((o.seed ?? 0.5) - 0.5) * 2 * (o.jit ?? 0.1);    // valørflekk per plate
      let col = ramp(m, v).map((x) => x * ao * jit * (1 - (o.dark || 0)));
      const under = clamp(-n[2] * 0.8 + 0.2) * (opts.warmK ?? 0.35);   // glødlys fra sprekkene/gulvet på undersider
      col = [col[0] + warm[0] * under, col[1] + warm[1] * under, col[2] + warm[2] * under];
      if (o.membrane && m.trans) { const tr = clamp(-lam) * 0.5 + 0.15; col = [col[0] + m.trans[0] * tr, col[1] + m.trans[1] * tr, col[2] + m.trans[2] * tr]; }
      const S = d.S, gap = (o.gap ?? 0.3) * sc;
      // LOD ved baking: små fasetter (i skjermpiksler ved bake-skalaen opts.px) males med ett strøk, bitte små hoppes over
      if (lodPx) { const ar = Math.abs(area(S)) * lodPx; if (ar < 0.12) continue; if (ar < (STYLE.soft ? 10 : 5)) { body.fillStyle = rgb(col); poly(body, S); body.fill(); continue; } }
      const seamGlow = o.seam === 'glow' && o.glow;
      const seamOn = o.seam && !(STYLE.soft && o.seam === 'dark');
      if (seamOn) { body.fillStyle = seamGlow ? rgb(o.glowBase || [70, 12, 8]) : rgb(m.seam || [6, 5, 5]); poly(body, S); body.fill(); }
      const In = seamOn ? inset(S, gap) : S;
      body.fillStyle = rgb(col); poly(body, In); body.fill();
      if (!seamOn) { body.strokeStyle = rgb(col); body.lineWidth = 0.12 * sc; body.stroke(); } // tett sømløst
      // myk: lineær overgang over store fasetter (lysere mot lyset) – bare ved baking, aldri per bilde
      if (STYLE.soft && STYLE.grad > 0) { const ar = Math.abs(area(S)) * (lodPx || 9); if (ar > 60) {
        // billig «gradient»: en mindre, lysere kopi av fasetten forskjøvet mot lyset (én ekstra fyll, ingen gradientobjekt)
        let cx = 0, cy = 0; for (const q of In) { cx += q[0]; cy += q[1]; } cx /= In.length; cy /= In.length;
        const k = STYLE.grad, r = Math.sqrt(Math.abs(area(In))) * 0.22;
        body.fillStyle = rgb(col.map((x) => x * (1 + 2 * k) + 14 * k), 0.55);
        body.beginPath(); In.forEach((q, i) => { const x = cx + (q[0] - cx) * 0.62 + hx * r, y = cy + (q[1] - cy) * 0.62 + hy * r; if (i) body.lineTo(x, y); else body.moveTo(x, y); }); body.closePath(); body.fill(); } }
      // platekant på lyssiden
      if (lam > -0.1 && (o.edge ?? 1) > 0) {
        const ec = m.edge, ea = clamp((lam + 0.1) * (STYLE.soft ? 1.3 : 1)) * (STYLE.soft ? 0.95 : 0.75) * (o.edge ?? 1);
        body.strokeStyle = rgb(ec, ea); body.lineWidth = (STYLE.soft ? 0.42 : 0.32) * sc; body.lineJoin = 'round'; body.beginPath();
        let cx = 0, cy = 0; for (const s of In) { cx += s[0]; cy += s[1]; } cx /= In.length; cy /= In.length;
        for (let i = 0; i < In.length; i++) {
          const a = In[i], b = In[(i + 1) % In.length], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
          if (mx * hx + my * hy > 0) { body.moveTo(a[0], a[1]); body.lineTo(b[0], b[1]); }
        }
        body.stroke();
      }
      // glans: speiling av lyset mot kamera
      const rl = sub(mul(n, 2 * lam), L3), sp = Math.pow(clamp(dot(rl, prep.VV || VV)), 10) * (o.spec ?? m.spec ?? 0.6);
      if (sp > 0.06) {
        let cx = 0, cy = 0; for (const s of In) { cx += s[0]; cy += s[1]; } cx /= In.length; cy /= In.length;
        const rr = Math.max(0.35 * sc, Math.min(1.2 * sc, Math.sqrt(Math.abs(area(In))) * 0.22));
        body.fillStyle = rgb(m.gloss || [255, 236, 210], clamp(sp) * 0.75);
        body.beginPath(); body.ellipse(cx + hx * rr * 0.6, cy + hy * rr * 0.6, rr, rr * 0.7, Math.atan2(hy, hx), 0, TAU); body.fill();
      }
      // glødlaget: fuger gløder, platen selv dekker (visker ut glød bak)
      if (glow) {
        if (seamGlow) { glow.globalCompositeOperation = 'source-over'; glow.fillStyle = rgb(o.glow, o.gi ?? 1); poly(glow, S); glow.fill(); }
        if (o.emit) { glow.globalCompositeOperation = 'source-over'; glow.fillStyle = rgb(o.emit, o.ei ?? 0.6); poly(glow, S); glow.fill(); }
        else { glow.globalCompositeOperation = 'destination-out'; glow.fillStyle = '#000'; poly(glow, In); glow.fill(); }
        if (!o.seam && !o.emit) { glow.lineWidth = 0.12 * sc; glow.strokeStyle = '#000'; glow.stroke(); }
        glow.globalCompositeOperation = 'source-over';
      }
    } else if (it.k === 'l') {
      const S = d.S, w = it.w * sc;
      if (it.body !== false) { body.strokeStyle = rgb(it.body || [60, 10, 6], 0.9); body.lineWidth = w * 1.6; body.lineCap = 'round'; body.lineJoin = 'round'; body.beginPath(); body.moveTo(S[0][0], S[0][1]); for (let i = 1; i < S.length; i++) body.lineTo(S[i][0], S[i][1]); body.stroke(); }
      if (glow) {
        glow.lineCap = 'round'; glow.lineJoin = 'round';
        glow.strokeStyle = rgb(it.col, it.a); glow.lineWidth = w * 1.5; glow.beginPath(); glow.moveTo(S[0][0], S[0][1]); for (let i = 1; i < S.length; i++) glow.lineTo(S[i][0], S[i][1]); glow.stroke();
        if (it.hot) { glow.strokeStyle = rgb(it.hot, it.a); glow.lineWidth = w * 0.55; glow.stroke(); }
      }
    } else if (it.k === 's') {
      const s = d.S[0], r = it.r * sc;
      body.fillStyle = rgb(it.hot || it.col); body.beginPath(); body.arc(s[0], s[1], r * 0.8, 0, TAU); body.fill();
      if (glow) {
        glow.fillStyle = rgb(it.col, 0.35 * it.a); glow.beginPath(); glow.arc(s[0], s[1], r * 2.2, 0, TAU); glow.fill();
        glow.fillStyle = rgb(it.col, it.a); glow.beginPath(); glow.arc(s[0], s[1], r * 1.2, 0, TAU); glow.fill();
        glow.fillStyle = rgb(it.hot || [255, 230, 200], it.a); glow.beginPath(); glow.arc(s[0], s[1], r * 0.6, 0, TAU); glow.fill();
      }
    }
  }
}
function area(S) { let a = 0; for (let i = 0; i < S.length; i++) { const p = S[i], q = S[(i + 1) % S.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

/** Kastet skygge på gulvet (felles lysretning) som én samlet flate. */
export function paintShadow(ctx, prep) {
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.3 * prep.scale;
  for (const S of prep.shadows) { poly(ctx, S); ctx.fill(); ctx.stroke(); }
}
