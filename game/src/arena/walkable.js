// Gangbart område for aktører (Arena). Ingen import fra index.js/render.js – leser bare world.cover/world.bounds/world.view.
// Problem (Test 26.10, 1-3 softlock): ytre mur er dekning ved kanten. I view 34 tegnes sørmurens toppflate 54 px
// nord for fotavtrykket (y 874..928 i Yard), så en aktør i stripa er skjult bak muren og under HUD-en. Objekter som
// ligger flush mot sørmuren (Yard: container 19,27 og B5 33,25) gjør at resolveCircleVsCover kan skyve en aktør
// UT av bunnen og INN i muren (y ≈ 942), der Wardens kuler stoppes av objektet foran.
//
// API (for Fiende-AI, Spiller, Nivåer):
//   walkableRect(world)            → { x, y, w, h } aktørens SENTRUM skal ligge her (inkl. sørmargin i view 34)
//   clampWalkable(world, e, r?)    → muterer e.x/e.y inn i rektangelet; returnerer true hvis flyttet
//   isWalkable(world, x, y, r?)    → innenfor rektangelet og ikke inne i dekning
//   southBlocker(world)            → { x, y, w, h, type:'high', kind:'blocker', invisible:true } (legg i nav-gridet)
//   rescueStuck(world, e, r?)      → flytter en aktør som står inne i dekning/mur til nærmeste frie punkt nordover
import { PROJ } from '../shared/projection.js';
const WALL_ELEV_34 = PROJ.heights.wall * PROJ.zScale; // verdens-y-px (72 × zScale; 54 i legacy 37°, ≈ 41,6 ved 30°)

function edgeWall(world, side) {
  const b = world.bounds;
  for (const c of world.cover || []) {
    if (c.w < b.w * 0.8) continue;
    if (side === 's' && Math.abs(c.y + c.h - (b.y + b.h)) < 1) return c;
    if (side === 'n' && Math.abs(c.y - b.y) < 1) return c;
  }
  return null;
}

export function walkableRect(world) {
  const b = world.bounds, s = edgeWall(world, 's'), n = edgeWall(world, 'n');
  const v34 = (world.view || world.arena?.view) !== 'top';
  const south = s ? s.y - (v34 ? WALL_ELEV_34 : 0) : b.y + b.h; // øverste synlige kant av sørmuren
  const north = n ? n.y + n.h : b.y;
  const side = 32; // øst/vest-mur er 1 rute i alle brett
  return { x: b.x + side, y: north, w: b.w - 2 * side, h: south - north };
}

export function clampWalkable(world, e, r = e.r || 14) {
  const R = walkableRect(world), x0 = e.x, y0 = e.y;
  e.x = Math.max(R.x + r, Math.min(R.x + R.w - r, e.x));
  e.y = Math.max(R.y + r, Math.min(R.y + R.h, e.y)); // sør: føttene (sentrum) til toppflatens kant, ingen r-margin
  return e.x !== x0 || e.y !== y0;
}

function inCover(world, x, y, r) {
  for (const c of world.cover || []) if (x > c.x - r && x < c.x + c.w + r && y > c.y - r && y < c.y + c.h + r) {
    const px = Math.max(c.x, Math.min(c.x + c.w, x)), py = Math.max(c.y, Math.min(c.y + c.h, y));
    if ((x - px) ** 2 + (y - py) ** 2 < r * r) return true;
  }
  return false;
}

export function isWalkable(world, x, y, r = 14) {
  const R = walkableRect(world);
  return x >= R.x + r && x <= R.x + R.w - r && y >= R.y + r && y <= R.y + R.h && !inCover(world, x, y, r);
}

export function southBlocker(world) {
  const b = world.bounds, R = walkableRect(world);
  return { x: b.x, y: R.y + R.h, w: b.w, h: b.y + b.h - (R.y + R.h), type: 'high', kind: 'blocker', invisible: true };
}

export function rescueStuck(world, e, r = e.r || 14) {
  clampWalkable(world, e, r);
  if (isWalkable(world, e.x, e.y, r)) return false;
  for (let d = 8; d <= 256; d += 8) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [-0.7, -0.7], [0.7, -0.7]]) {
    const x = e.x + dx * d, y = e.y + dy * d;
    if (isWalkable(world, x, y, r)) { e.x = x; e.y = y; return true; }
  }
  return false;
}
