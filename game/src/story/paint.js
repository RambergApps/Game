// BREACH – «malt» etterbehandling av prosedyrale paneler (eies av Nivåer og story).
// Gjør ren vektor om til noe skitnere og mer malerisk: penselstrøk som følger kantene,
// ujevne konturer, skitt/flekker, riper, støv og lerretstekstur. Kjøres én gang per scene (bufret).
import { VW, VH, makeRng } from './art.js';

/** Glatt verdistøy (gitter + bilineær), deterministisk. */
function valueNoise(rng, gw, gh) {
  const g = new Float32Array((gw + 1) * (gh + 1)); for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x, y) => { // x,y i 0..1
    const fx = x * gw, fy = y * gh, ix = Math.min(gw - 1, fx | 0), iy = Math.min(gh - 1, fy | 0), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), r = gw + 1;
    const a = g[iy * r + ix], b = g[iy * r + ix + 1], c = g[(iy + 1) * r + ix], d = g[(iy + 1) * r + ix + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function noiseCanvas(w, h, rng, octaves, tint, alphaFn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  const ns = octaves.map(([cells]) => valueNoise(rng, cells, Math.max(1, Math.round(cells * h / w))));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = 0, tot = 0;
    octaves.forEach(([, amp], k) => { v += ns[k](i / w, j / h) * amp; tot += amp; });
    v /= tot; const o = (j * w + i) * 4;
    d[o] = tint[0]; d[o + 1] = tint[1]; d[o + 2] = tint[2]; d[o + 3] = Math.max(0, Math.min(255, alphaFn(v) * 255));
  }
  x.putImageData(img, 0, 0); return c;
}

/**
 * paint(src, opts) → ny canvas (VW×VH).
 * opts: seed, strokes (antall, standard 26000), strokeA (0..1), keep (hvor mye av originalen som legges over igjen),
 *       grime (0..1), scratches (antall), warm (skittfarge [r,g,b])
 */
export function paint(src, opts = {}) {
  const o = { seed: 7, strokes: 26000, strokeA: 0.85, keep: 0.2, grime: 0.55, scratches: 70, warm: [38, 30, 22], ...opts };
  const rng = makeRng(o.seed);
  const W = VW, H = VH;
  const sctx = src.getContext('2d'), data = sctx.getImageData(0, 0, W, H).data;
  const at = (x, y) => { x = Math.max(0, Math.min(W - 1, x | 0)); y = Math.max(0, Math.min(H - 1, y | 0)); const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const lum = (x, y) => { const [r, g, b] = at(x, y); return r * 0.299 + g * 0.587 + b * 0.114; };
  const flow = valueNoise(rng, 9, 5);

  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  // 1) myk undermaling: originalen litt uskarp
  ctx.filter = 'blur(2.2px)'; ctx.drawImage(src, 0, 0); ctx.filter = 'none';

  // 2) penselstrøk: farge fra originalen, retning langs kanter (vinkelrett på gradienten), ellers støyfelt.
  //    Store strøk først, små og presise til slutt. På sterke kanter blir strøkene korte så silhuetten holder.
  const passes = [[0.32, 15, 5.5], [0.4, 8, 3.2], [0.28, 4, 1.8]];
  for (const [frac, len0, wid0] of passes) {
    const n = Math.round(o.strokes * frac);
    for (let k = 0; k < n; k++) {
      const x = rng() * W, y = rng() * H;
      const gx = lum(x + 2, y) - lum(x - 2, y), gy = lum(x, y + 2) - lum(x, y - 2), gm = Math.hypot(gx, gy);
      const edge = Math.min(1, gm / 60);
      const ang = gm > 6 ? Math.atan2(gy, gx) + Math.PI / 2 : (-0.55 + (flow(x / W, y / H) - 0.5) * 1.7);
      const len = len0 * (1 - edge * 0.65) * (0.6 + rng() * 0.8), wid = wid0 * (1 - edge * 0.5) * (0.7 + rng() * 0.6);
      // på kanter hentes fargen litt på tvers av kanten → ujevne, «slepne» konturer
      const jit = 2 + edge * 5;
      const [r, g, b] = at(x + (rng() - 0.5) * jit, y + (rng() - 0.5) * jit);
      const j = (rng() - 0.5) * 30 * (1 - edge * 0.6); // fargevariasjon, som ublandet maling
      ctx.fillStyle = `rgba(${Math.max(0, r + j) | 0},${Math.max(0, g + j * 0.9) | 0},${Math.max(0, b + j * 0.8) | 0},${o.strokeA * (0.55 + rng() * 0.45)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); // ujevn, tilspisset strøkform
      ctx.moveTo(-len / 2, (rng() - 0.5) * wid * 0.4);
      ctx.quadraticCurveTo(0, -wid * (0.7 + rng() * 0.5), len / 2, (rng() - 0.5) * wid * 0.3);
      ctx.quadraticCurveTo(0, wid * (0.7 + rng() * 0.5), -len / 2, (rng() - 0.5) * wid * 0.4);
      ctx.fill(); ctx.restore();
    }
  }
  // 2b) tørrpensel: lange, tynne, halvgjennomsiktige streker langs strømfeltet (overlay) – synlig penseltekstur på flate flater
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.lineCap = 'round';
  for (let k = 0; k < 2600; k++) {
    let x = rng() * W, y = rng() * H; const l = 20 + rng() * 60, light = rng() < 0.5;
    ctx.strokeStyle = light ? `rgba(255,245,230,${0.05 + rng() * 0.08})` : `rgba(0,0,0,${0.08 + rng() * 0.12})`;
    ctx.lineWidth = 0.8 + rng() * 2.2; ctx.beginPath(); ctx.moveTo(x, y);
    for (let t = 0; t < l; t += 6) { const a = (-0.55 + (flow(x / W, y / H) - 0.5) * 1.7); x += Math.cos(a) * 6; y += Math.sin(a) * 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // 3) legg originalen svakt over igjen for lesbarhet (øyne, visir, tekstur i lys)
  ctx.globalAlpha = o.keep; ctx.drawImage(src, 0, 0); ctx.globalAlpha = 1;
  // lyse punkter (glød, visir, øyne) skal fortsatt skinne: legg de lyseste delene additivt oppå
  // – bare de virkelig lyse pikslene (terskel), ellers forsvinner strøkene igjen
  const hi = document.createElement('canvas'); hi.width = W; hi.height = H; const hx = hi.getContext('2d');
  const hd = hx.createImageData(W, H);
  for (let i = 0; i < data.length; i += 4) {
    const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114, a = Math.max(0, Math.min(1, (l - 150) / 70));
    if (a > 0) { hd.data[i] = data[i]; hd.data[i + 1] = data[i + 1]; hd.data[i + 2] = data[i + 2]; hd.data[i + 3] = a * 255; }
  }
  hx.putImageData(hd, 0, 0);
  ctx.save(); ctx.globalAlpha = 0.8; ctx.filter = 'blur(0.7px)'; ctx.drawImage(hi, 0, 0); ctx.restore();

  // 4) skitt: store flekker (multiply) + mellomstore skjolder + støv
  const blot = noiseCanvas(320, 180, rng, [[4, 1], [9, 0.6], [22, 0.35]], o.warm, (v) => Math.max(0, (v - 0.42) * 1.6) * o.grime);
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingEnabled = true; ctx.drawImage(blot, 0, 0, W, H); ctx.restore();
  const film = noiseCanvas(400, 225, rng, [[40, 1], [90, 0.7]], [20, 16, 12], (v) => Math.max(0, v - 0.5) * 0.5 * o.grime);
  ctx.drawImage(film, 0, 0, W, H);
  // vannmerker / rustrenner fra toppen
  for (let i = 0; i < 14; i++) {
    const x = rng() * W, len = 80 + rng() * 260, w = 2 + rng() * 7;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(${o.warm[0]},${o.warm[1]},${o.warm[2]},${0.18 * o.grime})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, w, len);
  }
  // riper (lyse, tynne, korte buer)
  ctx.lineCap = 'round';
  for (let i = 0; i < o.scratches; i++) {
    const x = rng() * W, y = rng() * H, a = rng() * Math.PI, l = 10 + rng() * 60;
    ctx.strokeStyle = `rgba(220,210,190,${0.04 + rng() * 0.07})`; ctx.lineWidth = 0.6 + rng() * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 8, y + Math.sin(a) * l * 0.5 + (rng() - 0.5) * 8, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // støvkorn
  for (let i = 0; i < 1600; i++) {
    const x = rng() * W, y = rng() * H, r = rng() < 0.9 ? 0.6 + rng() * 0.9 : 1.5 + rng() * 2;
    ctx.fillStyle = rng() < 0.7 ? `rgba(10,8,6,${0.25 + rng() * 0.35})` : `rgba(230,220,200,${0.05 + rng() * 0.08})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // 5) lerretstekstur: fin vevstruktur i overlay
  const tex = document.createElement('canvas'); tex.width = tex.height = 128; const tx = tex.getContext('2d');
  const ti = tx.createImageData(128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
    const v = 128 + (Math.sin(i * 1.9) * 0.5 + Math.sin(j * 2.1) * 0.5) * 22 + (rng() - 0.5) * 60, p = (j * 128 + i) * 4;
    ti.data[p] = ti.data[p + 1] = ti.data[p + 2] = v; ti.data[p + 3] = 255;
  }
  tx.putImageData(ti, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.12; ctx.fillStyle = ctx.createPattern(tex, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  // 6) brente kanter
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${o.warm[0] >> 1},${o.warm[1] >> 1},${o.warm[2] >> 1},0.45)`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  return out;
}
