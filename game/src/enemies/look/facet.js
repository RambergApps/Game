// Fasetterte primitiver (samme prinsipp som Karakters kommende shared/rig/faceted/: kantede lavpoly-prismer og
// fasetterte plater per riggdel, skyggelagt per fasett fra LIGHT_DIR, malt overflate på toppen, bakt til sprite-cache).
// Datamodell per del:  prism = { k:'prism', pts, radii, sides }   plate = { k:'plate', c, u, v, n, outline:[[a,b]…], thick, ridge }
// Begge kompileres til fasetter (trekanter/firkanter) i paint3d-modellen. Bytt til Karakters versjon ved å la
// part()/compile() mappe til deres API når den finnes.
import { add, sub, mul, norm, cross, dot, lerp3, tube, TAU, rng, STYLE } from './paint3d.js';

/** Chaikin: avrunder et lukket omriss (én runde dobler punktene). */
export function roundOutline(pts, k = 0.25) { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], [a[0] + (b[0] - a[0]) * (1 - k), a[1] + (b[1] - a[1]) * (1 - k)]); } return out; }

/** Kantet lem/prisme: 4–5 sider, én ring per ledd, kort spiss ende. Ryggkant (twist) vender opp. */
export function prism(M, pts, radii, mat, o = {}) {
  const sides0 = o.sides || 4, sides = STYLE.soft && sides0 === 4 ? 6 : sides0;   // myk: rundere lemmer
  return tube(M, pts, radii, mat, { sides, rings: o.rings || 1, twist: o.twist ?? (sides === 6 ? Math.PI / 6 : Math.PI / 4), capLen: o.capLen ?? 0.45, seam: o.seam ?? 'dark', gap: o.gap ?? 0.16, flat: o.flat, seed: o.seed, capStart: o.capStart, capEnd: o.capEnd, jit: o.jit ?? 0.16 });
}

/** Ramme (u fram, v sideveis, n ut) fra normal og ønsket fram-retning. */
export function frame(n, fwd) {
  n = norm(n); let u = norm(sub(fwd, mul(n, dot(fwd, n))));
  if (!isFinite(u[0]) || Math.hypot(...u) < 0.5) u = norm(cross(n, [0, 1, 0]));
  return { u, v: cross(n, u), n };
}

/**
 * Fasettert plate: omriss i plateplanet (a langs u, b langs v), pyramideformet topp (ridge over sentrum, forskjøvet
 * med apexU langs u) og tykk kant. Hver topptrekant får egen valør → skarpe, malte fasetter.
 */
export function plate(M, c, F, outline, mat, o = {}) {
  const { u, v, n } = F, th = o.thick ?? 1.2, rg = o.ridge ?? 1.4;
  const soft = STYLE.soft && o.soft !== false;
  if (soft && outline.length <= 7 && (o.round ?? Math.max(...outline.map((q) => Math.abs(q[0]))) > 6)) outline = roundOutline(outline, 0.22);   // bare store plater avrundes (kostnad)
  const P = outline.map(([a, b]) => add(c, add(mul(u, a), mul(v, b))));
  const Q = P.map((p) => sub(p, mul(n, th)));
  const apex = add(c, add(mul(u, o.apexU ?? 0), mul(n, soft ? rg * 0.8 : rg)));
  const inner = sub(c, mul(n, th + 0.5)), rand = rng(o.seed || 17), N = P.length;
  const base = { seam: o.seam ?? 'dark', gap: o.gap ?? 0.14, glow: o.glow, gi: o.gi, glowBase: o.glowBase, spec: o.spec ?? 0.8 };
  // myk: avfasingsring (60 % inn, løftet) mellom kant og topp → buet plate med avrundet kant
  const R = soft ? P.map((p) => add(lerp3(p, add(c, mul(n, 0)), 0.38), mul(n, rg * 0.55))) : null;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (soft) {
      M.items.push({ k: 'q', pts: [P[i], P[j], R[j], R[i]], mat, inner, o: { ...base, seam: null, jit: 0.06, seed: rand(), edge: 0 } });
      M.items.push({ k: 'q', pts: [R[i], R[j], apex], mat, inner, o: { ...base, seam: null, jit: 0.05, seed: rand(), edge: 0 } });
    } else M.items.push({ k: 'q', pts: [P[i], P[j], apex], mat, inner, o: { ...base, jit: o.jit ?? 0.2, seed: rand(), edge: o.edgeTop ?? 0.7 } });
    M.items.push({ k: 'q', pts: [P[i], Q[i], Q[j], P[j]], mat, inner, o: { seam: null, jit: 0.1, seed: rand(), dark: 0.35, edge: soft ? 1 : (o.edgeSide ?? 0.4) } });
  }
  return { P, apex };
}

/** Spisse omriss. kite: tupp fram (+a). scute: skjell med 1–3 tagger bak. star: taggete skive (skjold). */
export const outlines = {
  kite: (L, W, back = 0.45) => [[L, 0], [L * 0.1, W * 0.5], [-L * back, W * 0.3], [-L * back * 1.1, 0], [-L * back, -W * 0.3], [L * 0.1, -W * 0.5]],
  scute: (L, W, r) => { const j = () => (r ? (r() - 0.5) * 0.25 : 0);
    return [[L * (1 + j()), W * 0.08], [L * 0.45, W * (0.5 + j())], [-L * 0.2, W * (0.55 + j())], [-L * 0.55, W * 0.25], [-L * 0.45, -W * 0.1], [-L * 0.1, -W * (0.5 + j())], [L * 0.5, -W * (0.42 + j())]]; },
  star: (R, k, inner = 0.78, rr) => { const pts = []; for (let i = 0; i < k * 2; i++) { const a = (i / (k * 2)) * TAU, r = i % 2 ? R * inner : R * (1 + (rr ? (rr() - 0.5) * 0.25 : 0)); pts.push([Math.cos(a) * r * 1.25, Math.sin(a) * r]); } return pts; },
};
export { lerp3 };
