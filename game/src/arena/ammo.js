// Ammokasser (Breach Våpen eier logikken). Arena tegner bare kassekroppen, sentrert på (x, y), radius ≈ 26 px.
// crate.ready === false (satt av Våpen) → lukket lokk og dempet lys. Våpen tegner statuslys/nedtellingsring oppå.
// Kassene er IKKE cover. Toppen holdes rolig (flat lokkflate) så ringen synes.
import { makeCanvas, roundRect, shade } from './paint.js';

const S = 2;               // sprite-oppløsning
const BW = 44, BD = 30;    // fotavtrykk (px): bredde × dybde – innenfor r ≈ 26
const BODY = '#3f4a26', BODY_HI = '#5a6a34', TRIM = '#c9a227';
const cache = new Map();

// e = løftehøyde for toppen (px på skjermen). Top-down bruker liten e, trekvart bruker PROJ-høyde.
function sprite(open, e) {
  const key = `${open ? 1 : 0}|${e}`; let c = cache.get(key); if (c) return c;
  const W = BW + 16, H = BD + e + 18;
  c = makeCanvas(W * S, H * S); const x = c.getContext('2d'); x.scale(S, S);
  const ox = 8, oy = e + 8;            // fotavtrykkets øvre venstre hjørne i spriten
  // bakkeskygge
  x.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(x, ox + 3, oy + 4, BW + 2, BD + 1, 5); x.fill();
  // frontflate (sørsiden)
  const fy = oy + BD - e;
  x.fillStyle = shade(BODY, -0.35); x.fillRect(ox, fy, BW, e);
  x.fillStyle = 'rgba(0,0,0,0.35)'; for (const sx of [ox + 6, ox + BW - 9]) x.fillRect(sx, fy, 3, e); // håndtaksbeslag
  x.fillStyle = TRIM; x.fillRect(ox, fy + e - 2, BW, 2);
  if (e >= 9) { x.font = 'bold 7px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(240,235,215,0.9)'; x.fillText('AMMO', ox + BW / 2, fy + e / 2 + 3); }
  // topp (lokk)
  const ty = oy - e;
  x.fillStyle = BODY; roundRect(x, ox, ty, BW, BD, 3); x.fill();
  x.strokeStyle = shade(BODY, -0.5); x.lineWidth = 1.4; roundRect(x, ox + 0.7, ty + 0.7, BW - 1.4, BD - 1.4, 3); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(ox + 2, ty + 1.2, BW - 4, 1);
  // gul/svart kant i endene – skiller kassen fra vanlige kasser og dekning
  for (const ex of [ox + 1.5, ox + BW - 6.5]) {
    x.save(); x.beginPath(); x.rect(ex, ty + 2, 5, BD - 4); x.clip();
    x.fillStyle = '#16171a'; x.fillRect(ex, ty + 2, 5, BD - 4);
    x.strokeStyle = TRIM; x.lineWidth = 2; for (let k = -10; k < BD + 10; k += 5) { x.beginPath(); x.moveTo(ex - 2, ty + k); x.lineTo(ex + 7, ty + k + 7); x.stroke(); }
    x.restore();
  }
  if (open) {
    // åpent lokk: patronrekker (messing) i et mørkt rom, lokket vippet mot nord
    x.fillStyle = '#121310'; x.fillRect(ox + 9, ty + 5, BW - 18, BD - 10);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
      const cx = ox + 11.5 + k * 3.6, cy = ty + 8 + r * 6;
      x.fillStyle = '#b8862e'; x.fillRect(cx, cy, 2.4, 4.2);
      x.fillStyle = '#f0c46a'; x.fillRect(cx, cy, 2.4, 1.1);
    }
    x.fillStyle = shade(BODY, -0.2); x.fillRect(ox + 7, ty - 5, BW - 14, 5);   // vippet lokk
    x.fillStyle = BODY_HI; x.fillRect(ox + 7, ty - 5, BW - 14, 1);
  } else {
    // lukket: rolig flate med sentral stensil
    x.fillStyle = shade(BODY, -0.12); x.fillRect(ox + 9, ty + 5, BW - 18, BD - 10);
    x.font = 'bold 8px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(235,230,210,0.55)';
    x.fillText('AMMO', ox + BW / 2, ty + BD / 2 + 3);
  }
  x.textAlign = 'left';
  c._ox = ox; c._oy = oy; c._W = W; c._H = H;
  cache.set(key, c); return c;
}

/** Tegn alle kasser (i gulvpasset, under aktører). e = løftehøyde. */
export function drawAmmoCrates(ctx, crates, e, t = 0) {
  if (!crates || !crates.length) return;
  for (const cr of crates) {
    const ready = cr.ready !== false;
    const sp = sprite(ready, e);
    const x0 = cr.x - BW / 2 - sp._ox, y0 = cr.y - BD / 2 - sp._oy;
    ctx.save();
    if (!ready) ctx.globalAlpha = 0.72;
    ctx.drawImage(sp, x0, y0, sp._W, sp._H);
    ctx.restore();
    // svak varm glød fra patronene når kassen er klar (ikke ring – det er Våpens jobb)
    if (ready) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const a = 0.16 + 0.05 * Math.sin(t * 2 + cr.x * 0.01);
      const g = ctx.createRadialGradient(cr.x, cr.y - e, 0, cr.x, cr.y - e, 34);
      g.addColorStop(0, `rgba(255,190,90,${a})`); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.fillRect(cr.x - 34, cr.y - e - 34, 68, 68);
      ctx.restore();
    }
  }
}
export const AMMO_BODY = { w: BW, d: BD, r: 26 };
