// BREACH – testside for look/free.js: alle tre våpen i 16 retninger, 1× og 2×, på asfalt ved en container,
// med muzzle (rød) og muzzleDraw (gul) prikker, fore (grønn) og stock (blå). ?zoom=1|2 (standard: begge).
import { drawWeapon, weaponAnchors, weaponBehind, WEAPON_IDS, weaponLength } from './free.js';
import { hidden } from '../view34.js';
import { PROJ } from '../../shared/projection.js';

const q = new URLSearchParams(location.search), only = q.get('zoom');
const ZOOMS = only ? [+only] : [1, 2];
const CELL = 64, COLS = 16, ROWH = 70;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const W = Math.max(...ZOOMS.map(z => COLS * CELL * z)) + 20;
const H = ZOOMS.reduce((a, z) => a + (WEAPON_IDS.length * ROWH + 40) * z, 0) + 20;
cv.width = W; cv.height = H;
const world = { view: '34', cover: [], modules: {}, events: { on() { return () => {}; }, emit() {} } };
window.BREACH = { world, perf: {}, anchors: {} };

function asphalt(x0, y0, w, h) {
  ctx.fillStyle = '#26292c'; ctx.fillRect(x0, y0, w, h);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < w * h / 60; i++) { ctx.fillStyle = r() > .5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(x0 + r() * w, y0 + r() * h, 1, 1); }
}
function container(o) {   // høy dekning 64: front 48 px, topp forskjøvet −48
  const e = PROJ.heights.high * PROJ.zScale;
  ctx.fillStyle = '#3d4246'; ctx.fillRect(o.x, o.y + o.h - e, o.w, e);                 // sørfront
  ctx.fillStyle = '#566068'; ctx.fillRect(o.x, o.y - e, o.w, o.h);                     // tak
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .6;
  for (let x = o.x + 4; x < o.x + o.w; x += 4) { ctx.beginPath(); ctx.moveTo(x, o.y + o.h - e); ctx.lineTo(x, o.y + o.h); ctx.stroke(); }
  ctx.fillStyle = '#c9a227'; ctx.fillRect(o.x, o.y + o.h - 3, o.w, 2);
}
const dot = (p, col, z) => { const s = PROJ.toScreen(p.x, p.y, p.z); const hid = hidden(world, p.x, p.y, p.z); ctx.beginPath(); ctx.arc(s.x, s.y, 1.1 / z * 1.4, 0, Math.PI * 2); if (hid) { ctx.strokeStyle = col; ctx.lineWidth = .5 / z; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); } };

let y0 = 10; const A = {};
for (const z of ZOOMS) {
  ctx.save(); ctx.translate(10, y0); ctx.scale(z, z);
  const w = COLS * CELL, h = WEAPON_IDS.length * ROWH + 40;
  asphalt(0, 0, w, h);
  ctx.fillStyle = '#9aa3ab'; ctx.font = '9px sans-serif'; ctx.fillText(`${z}x – 16 directions (0 = east, clockwise) – red: muzzle, yellow: muzzleDraw, hollow = hidden`, 4, 10);
  // container: én bak raden (nord) og én foran (sør) for kolonne 10–12 i midtre rad
  const back = { x: 6 * CELL, y: 14, w: 3 * CELL, h: 22, type: 'high' };
  const front = { x: 10 * CELL + 10, y: 40 + ROWH + 30, w: 2.4 * CELL, h: 20, type: 'high' };
  world.cover = [{ ...back, x: back.x, y: back.y }, { ...front }];
  container(back);
  WEAPON_IDS.forEach((id, r) => {
    for (let i = 0; i < COLS; i++) {
      const aim = i / COLS * Math.PI * 2, cx = i * CELL + CELL / 2, cy = 40 + r * ROWH + 26;
      // skygge + markør for fotpunktet
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      const origin = { x: cx, y: cy, z: PROJ.aimHeight - 2 };
      drawWeapon(ctx, id, origin, aim, { zoom: z });
      const an = weaponAnchors(id, origin, aim);
      if (z === ZOOMS[0]) A[`${id}@${i}`] = JSON.parse(JSON.stringify(an));
      if (q.get('dots') !== '0') { dot(an.fore, '#5fe08a', z); dot(an.stock, '#5aa0ff', z); } if (q.get('dots') !== '0') dot(an.muzzle, '#ff4a3a', z); if (q.get('dots') !== '0') dot(an.muzzleDraw, '#ffd84a', z);
    }
    ctx.fillStyle = '#9aa3ab'; ctx.fillText(`${id} (${weaponLength(id)} px)`, 4, 40 + r * ROWH + 52);
  });
  container(front);   // foran (sør) – skal dekke våpnene bak seg
  ctx.restore(); y0 += h * z + 10;
}
// ytelse: gjennomsnitt per drawWeapon-kall (2× detalj, vilkårlige vinkler) på et skjult lerret
const off = document.createElement('canvas'); off.width = 256; off.height = 256; const oc = off.getContext('2d');
for (const id of WEAPON_IDS) {
  for (let i = 0; i < 200; i++) drawWeapon(oc, id, { x: 128, y: 128, z: 25 }, i * 0.37, { zoom: 2 });
  const N = 1000, runs = [];
  for (let r = 0; r < 7; r++) { const t0 = performance.now(); for (let i = 0; i < N; i++) drawWeapon(oc, id, { x: 128, y: 128, z: 25 }, i * 0.0137, { zoom: 2, outline: q.get('outline') !== '0', move: { pump: (i % 10) / 10, bolt: 0, mag: 0 } }); runs.push((performance.now() - t0) / N); }
  runs.sort((a, b) => a - b); const t0 = 0, Nn = 1;
  window.BREACH.perf[id] = +runs[3].toFixed(4);
}
// konsistens: muzzle og muzzleDraw ligger alltid 0,5 px fra hverandre langs løpet
let maxGap = 0; for (const k in A) { const a = A[k]; maxGap = Math.max(maxGap, Math.abs(Math.hypot(a.muzzleDraw.x - a.muzzle.x, a.muzzleDraw.y - a.muzzle.y) - 0.5)); }
window.BREACH.anchors = A; window.BREACH.maxGap = maxGap; window.BREACH.behind = [0, 1, 2, 3].map(k => weaponBehind(-Math.PI / 2 + k * .3));
window.BREACH.ready = true;
console.log('free-test perf ms/weapon', JSON.stringify(window.BREACH.perf));
