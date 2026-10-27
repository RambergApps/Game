// Én Cinderborn-sprite: modell (husk.js/lurcher.js) → paint3d → Karakters felles bakeSprite (shared/rig/faceted/bake.js).
// Brukes både på hovedtråden (reserve) og i baker-workeren (worker.js). Ingen DOM her.
import { KINDS } from './kinds.js';
import { prepare, paint, paintShadow, view } from './paint3d.js';
import { bakeSprite, yawOf, canvas } from '../../shared/rig/faceted/bake.js';

import { D } from './zoom.js';
export { D };
export const SS = 2;      // overskalering ved maling
const models = new Map(); // modellen avhenger bare av posituren: bygg én gang per (type, sett, bilde), gjenbruk for 16 vinkler
export function modelOf(kind, set, i) { const k = `${kind.name}|${set}|${i}`; let M = models.get(k); if (!M) { const S = kind.sets[set]; M = kind.build(S.pose(i, S.n)); models.set(k, M); } return M; }
export function clearModels() { models.clear(); }

export function bakeOne(kind, pose, yaw, d = D, ss = SS, model = null) {
  const prep = prepare(model || kind.build(pose), yaw, kind.scale);
  return halfGlow(bakeSprite({ bbox: prep.bodyBox, shadowBox: prep.bbox, D: d, SS: ss, pad: 3,
    paint: (bc, gc) => paint(bc, gc, prep, d <= 3 ? { ...kind.paint, px: d } : kind.paint), shadow: (sc) => paintShadow(sc, prep), glow: true,
    contour: { px: kind.contour.px, a: kind.contour.a, color: '6,4,4' }, rim: { px: kind.rim.px, a: kind.rim.a, color: kind.rim.color || '255,228,178' }, grain: 0.22 }), d);
}
export function bakeKey(type, set, dir, i) { const k = KINDS[type], S = k.sets[set]; return unsquash(trim(bakeOne(k, S.pose(i, S.n), yawOf(dir, k.buckets), D, SS, modelOf(k, set, i)))); }
/** Bakt i skjermplanet (y·G): metadata tilbake til verdens-y (kameraet forkorter med G igjen → 1:1 piksler). */
export function unsquash(s) { const G = view().G; if (G === 1 || s.unsq) return s; const k = 1 / G; s.ay *= k; s.h *= k; if (s.glow) { s.gy *= k; s.gh *= k; } if (s.shadow) { s.sy *= k; s.sh *= k; } s.unsq = true; return s; }
/** Vinkel-nøkkel for cachenavn: ny vinkel → nye cacher (gamle bilder brukes aldri). */
export const VIEWKEY = `T${view().tiltDeg.toFixed(1)}`;
/** Glødlaget er mykt (halo): lagres i halv oppløsning (kvart ved zoom ≥ 2: samme halo på skjerm) (drawSprite skalerer til gw/gh) → ≈ ¾ mindre glødminne. */
function halfGlow(s, d) {
  if (!s.glow || d > 3) return s;
  const f = d >= 2 ? 4 : 2, g = s.glow, w = Math.max(1, Math.ceil(g.width / f)), h = Math.max(1, Math.ceil(g.height / f)), c = canvas(w, h), x = c.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.drawImage(g, 0, 0, w, h);
  s.bytes += (w * h - g.width * g.height) * 4; s.glow = c; return s;
}
/** Beskjær kroppen til synlige piksler (fjerner pad/tomme kanter). Glød og skygge flyttes med (verdensposisjon uendret). */
export function trim(s) {
  if (s.shadow) { const f = s.D >= 2 ? 2 : 1, h = s.shadow, w2 = Math.max(1, Math.ceil(h.width / 2 / f)), h2 = Math.max(1, Math.ceil(h.height / 2 / f)), c2 = canvas(w2, h2), x2 = c2.getContext('2d');   // skygge: kvart oppløsning (myk flekk)
    x2.imageSmoothingQuality = 'high'; x2.drawImage(h, 0, 0, w2, h2); s.bytes -= (h.width * h.height - w2 * h2) * 4; s.shadow = c2; }
  const b = s.body, W = b.width, H = b.height, d = b.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) { const r = y * W * 4; for (let x = 0; x < W; x++) if (d[r + x * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0 || (x0 === 0 && y0 === 0 && x1 === W - 1 && y1 === H - 1)) return s;
  const NW = x1 - x0 + 1, NH = y1 - y0 + 1, c = canvas(NW, NH); c.getContext('2d').drawImage(b, -x0, -y0);
  const D = s.D, dx = x0 / D, dy = y0 / D;
  s.body = c; s.ax -= dx; s.ay -= dy; s.w = NW / D; s.h = NH / D; if (s.glow) { s.gx -= dx; s.gy -= dy; }
  s.bytes -= (W * H - NW * NH) * 4; return s;
}
