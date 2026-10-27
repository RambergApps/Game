// sprite34 – forhåndsrendret trekvart-sprite-stil for Warden (v3-prøve, 2026-10-23).
// Bruker det eksisterende appearance-kontraktet: style = { name, drawFigure(ctx, rig, F, opts), sortKey(F) }.
// Ingen endring i rig.js/painted.js. Atlas + manifest genereres av ../sprites/warden/gen_warden.py.
//   Underkropp: sett valgt fra F.posture.kneel / F.amp, retning (8) fra F.hipAngle, gangramme fra F.phase
//               (reversert ved baklengs gange: cos(moveAngle − hipAngle) < −0.2).
//   Overkropp:  stand/crouch, 16 retninger fra F.torsoAngle. Begge roteres om fotpunktet → komponeres eksakt.
//   Anker = fotpunkt (F.x, F.y) i verdensrom; y-sortering via PROJ.sortKey({x,y,r}).
import { PROJ } from '../../projection.js';
import { MANIFEST as M } from '../sprites/warden/manifest.js';

const TAU = Math.PI * 2;
const img = (u) => { if (typeof Image === 'undefined') return null; const i = new Image(); i.src = u; return i; };
const ATLAS = img(new URL('../sprites/warden/warden.png', import.meta.url).href);
const SHADOW = img(new URL('../sprites/warden/warden_shadow.png', import.meta.url).href);
export const ready = Promise.all([ATLAS, SHADOW].map(i => !i ? Promise.resolve() : (i.complete && i.naturalWidth ? Promise.resolve() : new Promise((r, j) => { i.onload = r; i.onerror = j; }))));

const dirIndex = (a, n) => ((Math.round(a / (TAU / n)) % n) + n) % n;
const [CW, CH] = M.cell, [AX, AY] = M.anchor, S = M.scale;
const [SW, SH] = M.shadowCell, [SAX, SAY] = M.shadowAnchor;

let tmp = null, tctx = null; // offscreen for flash/tinting
function cellOf(set, dir, frame = 0) { const s = M.sets[set]; return s.cells[`${dir}_${frame}`]; }

// Velg celler for en ramme (eksportert for verktøy/screenshots).
export function pick(F) {
  const P = F.posture || {}; const kneel = P.kneel || 0; const crouch = kneel > .5;
  const hip = F.hipAngle ?? F.moveAngle ?? 0, tor = F.torsoAngle ?? F.aimAngle ?? hip;
  let legsSet = crouch ? 'legs_crouch' : ((F.amp || 0) > .15 ? 'legs_walk' : 'legs_idle');
  const ld = dirIndex(hip, M.sets[legsSet].dirs);
  let frame = 0, p = F.phase || 0;
  if (legsSet === 'legs_walk') {
    const back = Math.cos((F.moveAngle ?? hip) - hip) < -.2;
    if (back) p = (((.5 - p) % 1) + 1) % 1;
    frame = Math.floor(p * M.sets.legs_walk.frames + .5) % M.sets.legs_walk.frames;
  }
  const torsoSet = crouch ? 'torso_crouch' : 'torso_stand';
  const td = dirIndex(tor, M.sets[torsoSet].dirs);
  return { legsSet, ld, frame, torsoSet, td, hip };
}

function blit(ctx, im, c, x, y) { ctx.drawImage(im, c[0] * CW * S, c[1] * CH * S, CW * S, CH * S, x - AX, y - AY, CW, CH); }

export const sprite34 = {
  name: 'sprite34',
  manifest: M,
  ready,
  pick,
  drawFigure(ctx, rig, F, opts = {}) {
    if (!ATLAS || !ATLAS.complete || !ATLAS.naturalWidth) return;
    const k = pick(F); const x = F.x, y = F.y;
    const a = (F.alpha ?? 1) * (opts.alpha ?? 1);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // 1) kontaktskygge (myk, gjennomskinnelig) – tegnes under figuren
    if (opts.shadow !== false && SHADOW && SHADOW.complete) {
      ctx.globalAlpha = a * (opts.shadowAlpha ?? .42);
      const c = cellOf(k.legsSet, k.ld, k.frame);
      ctx.drawImage(SHADOW, c[0] * SW, c[1] * SH, SW, SH, x - SAX, y - SAY, SW, SH);
    }
    ctx.globalAlpha = a;
    // 2) underkropp
    const lc = cellOf(k.legsSet, k.ld, k.frame); blit(ctx, ATLAS, lc, x, y);
    // 3) overkropp med gang-bob/svai (samme formel som generatoren brukte for bekkenet)
    let ox = 0, oy = 0;
    if (k.legsSet === 'legs_walk') {
      const dz = M.walkTorsoDz[k.frame], sw = M.walkSway[k.frame] * Math.min(1, F.amp / .6);
      oy = -dz * PROJ.zScale; ox = -Math.sin(k.hip) * sw; oy += Math.cos(k.hip) * sw;
    }
    const tc = cellOf(k.torsoSet, k.td, 0); blit(ctx, ATLAS, tc, x + ox, y + oy);
    // 4) treff-blink: hvit overlay av samme celler
    if (F.flash > 0) {
      if (!tmp) { tmp = document.createElement('canvas'); tmp.width = CW * S; tmp.height = CH * S; tctx = tmp.getContext('2d'); }
      for (const [c, dx, dy] of [[lc, 0, 0], [tc, ox, oy]]) {
        tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(ATLAS, c[0] * CW * S, c[1] * CH * S, CW * S, CH * S, 0, 0, CW * S, CH * S);
        tctx.globalCompositeOperation = 'source-in'; tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.globalAlpha = a * .6 * F.flash; ctx.drawImage(tmp, x + dx - AX, y + dy - AY, CW, CH);
      }
    }
    ctx.restore();
  },
  sortKey(F) { return PROJ.sortKey({ x: F.x, y: F.y, r: 12 }); },
};
export default sprite34;
