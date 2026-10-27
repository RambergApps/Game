// Breach v4.3 (A3): bakearbeider for faceted-sprites (valgfri, brukes kun når CFG.worker er på).
// Hovedtråden bygger modellen (billig) og sender den hit; maling + nedskalering + kontur/kantlys/glød skjer her,
// så spillrammen aldri venter på en bake. Svar: { id, spr (ImageBitmap-er), ms } eller { id, err }.
import { bakeSprite } from './bake.js';
import { paintModel, paintShadow, bounds } from './paint.js';
self.onmessage = (e) => {
  const { id, M, mats, D, cfg, popts } = e.data;
  try {
    const t0 = performance.now();
    const spr = bakeSprite({ bbox: bounds(M, false), shadowBox: bounds(M, true), D, SS: cfg.SS, downQ: cfg.downQ, glow: true, contour: cfg.contour, rim: cfg.rim,
      paint: (bc, gc, o) => paintModel(bc, gc, M, mats, { ...popts, px: o.px }), shadow: (sc) => paintShadow(sc, M) });
    const out = { ...spr }, tr = [];
    for (const k of ['body', 'glow', 'shadow']) if (spr[k]) { out[k] = spr[k].transferToImageBitmap(); tr.push(out[k]); }
    self.postMessage({ id, spr: out, ms: performance.now() - t0 }, tr);
  } catch (err) { self.postMessage({ id, err: String(err && err.stack || err) }); }
};
