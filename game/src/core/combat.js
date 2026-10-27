import { segmentRect, dist } from './geom.js';
import { PROJ } from '../shared/projection.js';
// Prosjektiler. Low cover: kulen fortsetter, men et mål som "hugger" low cover (innenfor LOW_COVER_RANGE
// bak det langs skuddlinjen) får bare LOW_COVER_HIT_CHANCE treffsjanse og cover absorberer resten.
// Skytteren selv sitt nære low cover (innen 40 px fra origin) ignoreres, så du kan skyte over egen dekning.
export const LOW_COVER_RANGE = 48;
export const LOW_COVER_HIT_CHANCE = 0.35;
const SHOOTER_IGNORE = 40;

export const PIERCE_MULT = 0.6;
/**
 * opts: { x, y, angle, speed=900, dmg=10, team, owner?, radius=2, range=1200, color?, kind='bullet',
 *         dmgAt?(distance) → skade (skadefall; brukes i stedet for dmg), pierce? (ekstra mål), pierceMult?=0.6,
 *         weapon?, pellets?, z? (løpshøyde i verdens-px; bare visuelt + i hendelser, kollisjon er ren ovenfra) }
 * Spillerkuler uten eksplisitt pierce arver world.playerStats.pierce / pierceDamageMult (oppgraderingen 'ap-rounds').
 */
export function spawnProjectile(world, opts) {
  const p = { speed: 900, dmg: 10, radius: 2, range: 1200, kind: 'bullet', color: opts.team === 'player' ? '#9fe8ff' : '#ffb347', ...opts, travelled: 0, dead: false, ox: opts.x, oy: opts.y, px: opts.x, py: opts.y };
  p.vx = Math.cos(p.angle) * p.speed; p.vy = Math.sin(p.angle) * p.speed;
  // Høyde (Breach 23.10, player/forslag/core-api-sikte-munning.md): z = munningshøyde fra opts.z → owner.muzzle.z → owner.muzzleZ.
  // Visuelt går kula fra z0 mot siktehøyden PROJ.aimZ (bryst, 27) over de første AIM_Z_BLEND px (projectileZ). Treff er ren 2D.
  if (!Number.isFinite(p.z)) { const o = p.owner, mz = o?.muzzle?.z ?? (typeof o?.muzzleZ === 'number' ? o.muzzleZ : undefined); if (Number.isFinite(mz)) p.z = mz; }
  if (Number.isFinite(p.z)) { if (p.z0 === undefined) p.z0 = p.z; if (p.zAim === undefined) p.zAim = PROJ.aimZ; }
  const st = p.team === 'player' ? world.playerStats : null;
  if (p.pierce === undefined) p.pierce = st?.pierce || 0;
  if (p.pierceMult === undefined) p.pierceMult = st?.pierceDamageMult ?? PIERCE_MULT;
  world.projectiles.push(p);
  world.events.emit('shot', { projectile: p, owner: p.owner, team: p.team, entity: p.owner, weapon: p.weapon ?? null, pellets: p.pellets ?? 1, x: p.x, y: p.y, z: p.z ?? 0, angle: p.angle });
  return p;
}

/**
 * Påfør skade. entity: { hp, maxHp?, dead?, armor? (0..1), invuln?, damageMult? }. → faktisk skade.
 * info (valgfri): { distance?, inCover?, projectile?, kind? } – utfylles automatisk (distance fra source.x/y eller owner).
 * Rekkefølge: damageMult (tall eller fn(amount, info) → amount) → invuln (sender 'hit' amount 0, blocked:true) → armor → HP.
 */
export function damage(entity, amount, source = null, world = null, info = null) {
  if (!entity || entity.dead) return 0;
  const w = world || source?.world;
  // Breach 23.10: alle treff har source.x/y (stagger-retning, UI-skaderetning). Fylles fra entity/owner om den mangler.
  if (source && typeof source === 'object' && !Number.isFinite(source.x)) {
    const o = source.entity || source.owner;
    if (o && Number.isFinite(o.x)) { source.x = o.x; source.y = o.y; if (source.entity === undefined) source.entity = o; }
  }
  const I = { source, ...(info || {}) };
  if (I.distance === undefined) {
    const o = source && Number.isFinite(source.x) ? source : source?.owner;
    I.distance = o && Number.isFinite(o.x) ? Math.hypot(entity.x - o.x, entity.y - o.y) : null;
  }
  if (I.inCover === undefined) I.inCover = !!entity.inCover;
  const m = entity.damageMult;
  if (typeof m === 'function') amount = m(amount, I); else if (typeof m === 'number') amount *= m;
  amount = Math.max(0, +amount || 0);
  if (entity.invuln) { w?.events.emit('hit', { target: entity, amount: 0, source, blocked: true, distance: I.distance, inCover: I.inCover, raw: amount }); return 0; }
  const dmg = amount * (1 - (entity.armor || 0)); entity.hp -= dmg; entity.lastHitBy = source;
  entity.onDamage?.(dmg, source, I);
  w?.events.emit('hit', { target: entity, amount: dmg, source, blocked: false, distance: I.distance, inCover: I.inCover });
  if (entity.hp <= 0) { entity.hp = 0; entity.dead = true; entity.onDeath?.(source); w?.events.emit('death', { target: entity, source }); }
  return dmg;
}

function targetsFor(world, team) {
  if (team === 'player') return world.enemies;
  return world.player ? [world.player] : [];
}

/** Skade for prosjektil p truffet etter `distance` px: dmgAt(distance) hvis den finnes, ellers p.dmg; × pierce-skalering. */
export function projectileDamage(p, distance) {
  const base = typeof p.dmgAt === 'function' ? p.dmgAt(distance) : p.dmg;
  return base * (p.pierceScale ?? 1);
}

/** Ett simuleringssteg for alle prosjektiler (kalles av loop). */
export function updateProjectiles(dt, world) {
  const b = world.bounds;
  for (const p of world.projectiles) {
    if (p.dead) continue;
    p.px = p.x; p.py = p.y;
    let t0 = 0; // andel av steget som er brukt (pierce kan fortsette samme steg)
    const ex = p.x + p.vx * dt, ey = p.y + p.vy * dt, sx = p.x, sy = p.y, stepLen = p.speed * dt;
    for (let guard = 0; guard < 16 && !p.dead; guard++) {
      const ax = sx + (ex - sx) * t0, ay = sy + (ey - sy) * t0;
      let hitT = 1, hit = null;
      for (const c of world.cover) {
        if (c.type !== 'high') continue;
        const t = segmentRect(ax, ay, ex, ey, c, p.radius);
        if (t !== null && t < hitT) { hitT = t; hit = { cover: c }; }
      }
      for (const e of targetsFor(world, p.team)) {
        if (e.dead || e === p.owner || (p._pierced && p._pierced.includes(e))) continue;
        const t = segCircle(ax, ay, ex, ey, e.x, e.y, (e.r || 14) + p.radius);
        if (t !== null && t < hitT) { hitT = t; hit = { entity: e }; }
      }
      const tAbs = t0 + (1 - t0) * hitT; // andel av hele steget
      const hx = sx + (ex - sx) * tAbs, hy = sy + (ey - sy) * tAbs;
      const hitDist = p.travelled + stepLen * tAbs; // faktisk avstand fra munning i treff-øyeblikket
      if (hit?.entity) {
        const blocker = lowCoverProtecting(world, p, hit.entity);
        if (blocker && world.rng() > (hit.entity.coverHitChance ?? LOW_COVER_HIT_CHANCE)) { // entity.coverHitChance per positur (skjult 0.1 / popUp 0.6 / blindfire 0.25)
          p.dead = true; world.events.emit('coverHit', { projectile: p, cover: blocker, x: hx, y: hy, z: impactZ(p, blocker), partial: true });
        } else {
          p.hitDist = hitDist;
          damage(hit.entity, projectileDamage(p, hitDist), hitSource(p, world), world,
            { distance: hitDist, inCover: !!blocker || !!hit.entity.inCover, projectile: p, kind: p.kind });
          world.events.emit('projectileHit', { projectile: p, target: hit.entity, x: hx, y: hy, z: Number.isFinite(p.z) ? projectileZ(p) : 0, pierced: (p._pierced?.length || 0) });
          if ((p.pierce || 0) > 0) {
            p.pierce--; (p._pierced = p._pierced ? [...p._pierced] : []).push(hit.entity); // egen liste (hagl-kloner deler ikke)
            p.pierceScale = (p.pierceScale ?? 1) * (p.pierceMult ?? PIERCE_MULT);
            t0 = tAbs; if (t0 < 1) continue;
          } else p.dead = true;
        }
      } else if (hit?.cover) {
        p.dead = true; world.events.emit('coverHit', { projectile: p, cover: hit.cover, x: hx, y: hy, z: impactZ(p, hit.cover), partial: false });
      }
      t0 = tAbs; break;
    }
    p.x = sx + (ex - sx) * t0; p.y = sy + (ey - sy) * t0; p.travelled += stepLen * t0;
    if (p.travelled > p.range || p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) p.dead = true;
  }
  world.projectiles = world.projectiles.filter((p) => !p.dead);
}

// Lav dekning beskytter bare når den blokkerer linjen til HELE den synlige kroppen («de må ha en fri linje mot deg»):
// sentrum + 7 punkter på sirkelkanten som vender mot skytteren må alle krysse en kvalifiserende dekning.
// Kvalifiserende lav dekning: krysning >= SHOOTER_IGNORE fra munningen OG målets avstand vinkelrett til rektangelet
// (nærmeste punkt, dvs. fra bakflaten) <= LOW_COVER_RANGE + r. Høy dekning teller også som blokk for et punkt.
const LC_SAMPLES = [0, -1.4, -0.9, -0.45, 0.45, 0.9, 1.4].map(a => [Math.cos(a), Math.sin(a)]);
export function lowCoverProtecting(world, p, target) {
  const r = target.r || 14, reach = LOW_COVER_RANGE + r, near = [], high = [], low = [];
  for (const c of world.cover) {
    if (c.type === 'high') { high.push(c); continue; }
    if (c.type !== 'low') continue;
    low.push(c);
    const px = Math.max(c.x, Math.min(target.x, c.x + c.w)), py = Math.max(c.y, Math.min(target.y, c.y + c.h));
    if (dist(target.x, target.y, px, py) <= reach) near.push(c);
  }
  if (!near.length) return null;
  const L0 = dist(p.ox, p.oy, target.x, target.y) || 1, ux = (p.ox - target.x) / L0, uy = (p.oy - target.y) / L0;
  let hit = null;
  const blocked = (sx, sy, first) => {
    const L = dist(p.ox, p.oy, sx, sy);
    for (const c of near) { const t = segmentRect(p.ox, p.oy, sx, sy, c); if (t !== null && t * L >= SHOOTER_IGNORE) { if (first) hit = c; return true; } }
    if (first) return false;                         // sentrumslinjen må gå gjennom NÆR lav dekning
    for (const c of low) { const t = segmentRect(p.ox, p.oy, sx, sy, c); if (t !== null && t * L >= SHOOTER_IGNORE) return true; } // 27.10 fiks 141: kantpunkter godtar alt lavt cover
    for (const c of high) { const t = segmentRect(p.ox, p.oy, sx, sy, c); if (t !== null && t * L >= SHOOTER_IGNORE) return true; }
    return false;
  };
  if (!blocked(target.x, target.y, true)) return null;
  const rr = r * 0.95;
  for (let k = 1; k < LC_SAMPLES.length; k++) {
    const [ca, sa] = LC_SAMPLES[k], dx = ux * ca - uy * sa, dy = ux * sa + uy * ca; // roter retning-mot-skytter
    const sx = target.x + dx * rr, sy = target.y + dy * rr;
    if (!blocked(sx, sy, false) && !endShield(hit, target, sx, sy, p.ox, p.oy)) return null;
  }
  return hit;
}

// 27.10 halvplan-regel (Alexander, rev. 2 etter Tests skjult-gul #1/#2/#4): kalles bare når sentrumslinjen er blokkert av
// Wardens eget (nære) lave cover c. Et fritt kantpunkt gjør ham treffbar KUN hvis skytteren står bak ham (Wardens side
// av flaten), eller hvis punktet stikker ut forbi enden av c OG skytteren står forbi forlengelsen av den enden med
// tydelig vinkel (>= END_PEEK_DEG mot normalen, målt fra endekanten). Frie punkter innenfor coverets bredde (linje over hjørnet) skjermes.
const END_PEEK_TAN = Math.tan(30 * Math.PI / 180);
function endShield(c, t, sx, sy, ox, oy) {
  const inX = t.x >= c.x && t.x <= c.x + c.w, inY = t.y >= c.y && t.y <= c.y + c.h;
  const gx = Math.max(c.x - t.x, t.x - (c.x + c.w), 0), gy = Math.max(c.y - t.y, t.y - (c.y + c.h), 0);
  const vert = inX ? true : inY ? false : gy >= gx;            // true: Warden nord/sør for c (tangent = x)
  // a = tangentakse, b = normalakse; lo/hi = endene, fFar = flaten på skytterens side
  const a0 = vert ? c.x : c.y, a1 = vert ? c.x + c.w : c.y + c.h, tb = vert ? t.y : t.x, cb = vert ? c.y + c.h / 2 : c.x + c.w / 2;
  const sa = vert ? sx : sy, oa = vert ? ox : oy, ob = vert ? oy : ox, near0 = tb < cb;  // Warden på lav side av normalaksen
  const fWard = near0 ? (vert ? c.y : c.x) : (vert ? c.y + c.h : c.x + c.w);           // flaten Warden står inntil
  const fFar = near0 ? (vert ? c.y + c.h : c.x + c.w) : (vert ? c.y : c.x);
  if (near0 ? ob <= fWard : ob >= fWard) return false;          // skytter på Wardens side → fritt punkt teller
  if (sa >= a0 && sa <= a1) return true;                         // punktet er innenfor bredden: linje over hjørnet → skjermet
  const end = sa < a0 ? a0 : a1, lat = sa < a0 ? end - oa : oa - end; // hvor langt skytteren er forbi endens forlengelse
  if (lat <= 0) return true;                                     // skytter foran coveret
  const perp = Math.max(1, Math.abs(ob - fFar));
  return lat < perp * END_PEEK_TAN;                              // forbi enden, men for spiss vinkel → skjermet
}

function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0; if (a === 0) return null;
  const disc = b * b - 4 * a * c; if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : null;
}

/**
 * Kilde for treff fra prosjektiler (Breach 23.10, erstatter enemies.sourceForHit): skytterens posisjon i avfyrings-
 * øyeblikket (p.srcX/srcY → munning ox/oy), så stagger-retning og UI-skaderetning alltid har x/y.
 * { projectile, owner, entity, team, world, x, y, z, weapon, kind, type, variant }
 */
function hitSource(p, world) {
  const o = p.owner || null;
  return { projectile: p, owner: o, entity: o, team: p.team, world, x: p.srcX ?? p.ox, y: p.srcY ?? p.oy, z: p.z0 ?? p.z ?? 0,
    weapon: p.weapon ?? null, kind: p.kind ?? 'bullet', type: o?.type ?? null, variant: o?.variant ?? null };
}
/** Høyde for et dekningsobjekt i verdens-px (samme regel som shared/depth.js coverElev og weapons/view34 coverHeight). */
export function coverHeightZ(o) {
  if (!o) return 0;
  if (Number.isFinite(o.height)) return o.height;
  if (o.elev !== undefined) return o.elev / PROJ.zScale;
  return o.type === 'low' ? PROJ.heights.low : (o.kind === 'wall' || o.kind === 'building') ? PROJ.heights.wall : PROJ.heights.high;
}
/** Treffhøyde på dekning: kulas z klippet til dekningens høyde (en kule kan ikke treffe over toppen). */
function impactZ(p, cover) { const H = coverHeightZ(cover); return Math.max(2, Math.min(projectileZ(p), H - 2)); }

/** Standard visuell høyde for et prosjektil uten p.z (testsider o.l.): siktehøyden. */
export const DEFAULT_PROJECTILE_Z = PROJ.aimZ;
export const AIM_Z_BLEND = 60;
/** Visuell høyde nå: z0 → zAim lineært over de første AIM_Z_BLEND px, deretter zAim. Uten z0: p.z ?? DEFAULT_PROJECTILE_Z. */
export function projectileZ(p) {
  if (!Number.isFinite(p.z0)) return p.z ?? DEFAULT_PROJECTILE_Z;
  const za = p.zAim ?? PROJ.aimZ, k = Math.min(1, (p.travelled || 0) / AIM_Z_BLEND);
  return p.z0 + (za - p.z0) * k;
}
/**
 * true hvis punktet (x, y, z) ligger bak et dekningsobjekt sett fra kameraet i view '34' (samme regel som
 * weapons/view34.hidden: synslinjen går sørover og oppover; skjult hvis x er innenfor boksen, punktet ligger nord for
 * sørkanten og z + max(0, o.y − y)/zScale ≤ høyden). Ovenfra: alltid false.
 */
export function pointHidden(world, x, y, z) {
  if (world.view !== '34') return false;
  const list = world.modules?.arena?.coverObjects?.(world) || world.cover || [], zs = PROJ.zScale;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.noOcclude || x < o.x || x > o.x + o.w || y >= o.y + o.h) continue;
    const d = o.y > y ? o.y - y : 0;
    if (z + d / zs <= coverHeightZ(o)) return true;
  }
  return false;
}

/**
 * Generiske prosjektiler (uten eget tegnelag). Våpens prosjektiler (p.wfx + p.tint) tegnes av weapons/fx.drawTracers
 * med høyde og okklusjon, så de hoppes over her. I view '34': løftet p.z·zScale og klippet bort bak dekning
 * (halen deles i 4 prøver; usynlige biter tegnes ikke), så kuler ikke legger seg oppå containertak.
 */
export function drawProjectiles(ctx, world) {
  const v34 = world.view === '34', zs = v34 ? PROJ.zScale : 0;
  ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
  for (const p of world.projectiles) {
    if (p.dead || (p.wfx && p.tint && p.color === 'rgba(0,0,0,0)')) continue;   // Våpen tegner selv (TUNING.fx.ownBullets)
    const z = projectileZ(p), lift = z * zs;
    let tx = p.x - p.vx * 0.018, ty = p.y - p.vy * 0.018, hx = p.x, hy = p.y;
    if (v34) {
      if (pointHidden(world, hx, hy, z)) {             // hodet skjult: tegn bare den synlige delen av halen (om noe)
        let k = 1; while (k > 0 && pointHidden(world, tx + (hx - tx) * k, ty + (hy - ty) * k, z)) k -= 0.25;
        if (k <= 0) continue; hx = tx + (hx - tx) * k; hy = ty + (hy - ty) * k;
      } else if (pointHidden(world, tx, ty, z)) {      // halen skjult: start der den kommer frem
        let k = 0; while (k < 1 && pointHidden(world, tx + (hx - tx) * k, ty + (hy - ty) * k, z)) k += 0.25;
        tx = tx + (hx - tx) * k; ty = ty + (hy - ty) * k;
      }
    }
    ty -= lift; hy -= lift;
    const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.color);
    ctx.strokeStyle = g; ctx.lineWidth = p.radius * 1.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
  }
  ctx.restore();
}
