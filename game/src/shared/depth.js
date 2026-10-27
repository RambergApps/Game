// BREACH – felles dybdesortering for trekvart (shared/depth.js). Laget av Breach Arena 2026-10-23, godkjent av Breach.
//
// drawSorted(ctx, world, camera, opts) tegner dekningsobjekter og aktører i én liste sortert på PROJ.sortKey
// (rektangel: y + h, aktør: y + r). Hver modul tegner sine egne ting:
//   - dekning: opts.drawCover(ctx, obj, world, camera)        (arena: arena.drawCoverObject)
//   - aktører: opts.drawActor(ctx, a, world, camera)          hvis gitt, ellers
//              world.modules.player.drawActor  for world.player,
//              world.modules.enemies.drawActor for world.enemies,
//              a.drawActor(ctx, world, camera)                for ekstraaktører (opts.extra).
// Dybdetoning (Test v3-skråvinkel pkt. 3, 14:04): står en aktør bak dekning som tegnes etter den, tones dekningen ned
// til ~35 % lokalt rundt aktøren (myk ellipse), så positur og sikteretning synes i beltet 48–54 px nord for høy
// dekning. Terskel: bare når dekningen er HØY, eller når skjult andel av aktørhøyden > HIDE_THRESHOLD (0,5) – en
// stående aktør bak lav dekning (24 av 48) gir dermed verken toning eller omriss. Et tynt stiplet omriss uten fyll
// (1 px, alfa 0,7) tegnes bare der toningen ikke er mulig; ellers et svakt supplement (alfa 0,3). Ingen allokering per bilde (gjenbrukt pool + sorteringsfunksjon), deterministisk ved lik
// nøkkel: dekning før aktør, deretter innsettingsrekkefølge (dekningslisten, player, enemies, extra).
import { PROJ } from './projection.js';

const COVER = 0, ACTOR = 1;
export const HIDE_THRESHOLD = 0.5;  // skjult andel av aktørhøyden som gir toning/omriss bak dekning som ikke er høy
export const FADE_ALPHA = 0.35;     // gjenværende opasitet i dekningen rett rundt en skjult aktør
const HIGH_ELEV = (PROJ.heights.low + PROJ.heights.high) / 2 * PROJ.zScale; // over dette (skjerm-px) regnes dekning som høy
const pool = [], order = [], hidden = [];
let n = 0, nh = 0, frame = 0;
const stats = { items: 0, cover: 0, actors: 0, hidden: 0, missing: 0, frame: 0 };

function slot() {
  let it = pool[n];
  if (!it) { it = pool[n] = { kind: 0, ref: null, key: 0, seq: 0, x0: 0, y0: 0, x1: 0, y1: 0, area: 0, team: '', crouch: false, hs: 0, elev: 0, fade: [], nf: 0, lip: [], nl: 0, toned: false }; }
  it.seq = n; it.nf = 0; it.nl = 0; it.toned = false; order[n] = it; n++;
  return it;
}
function cmp(a, b) { return (a.key - b.key) || (a.kind - b.kind) || (a.seq - b.seq); }

/** Synlig høyde (skjerm-px) for et dekningsobjekt: obj.elev hvis satt, ellers PROJ.heights[type] · zScale. */
export function coverElev(o) {
  if (o.elev !== undefined) return o.elev;
  const h = PROJ.heights[o.type] ?? PROJ.heights.high;
  return h * PROJ.zScale;
}
/** Synlig høyde (skjerm-px) for en aktør. */
export function actorElev(a) {
  return ((a.crouch || a.crouching || a.inCover === 'low') ? PROJ.heights.actorCrouch : PROJ.heights.actor) * PROJ.zScale;
}
function teamOf(a, world) { return a.team || (a === world.player ? 'player' : 'enemy'); }

function pushActor(a, world) {
  // Død Warden må fortsatt tegnes (dødsanimasjon/lik): player.draw hopper over kroppen når loopen sorterer.
  // Døde fiender tegnes som lik av enemies.draw og sorteres ikke.
  if (!a || (a.dead && a !== world.player) || !isFinite(a.x) || !isFinite(a.y)) return;
  const it = slot(), r = a.r ?? a.radius ?? 14, Hs = actorElev(a);
  it.kind = ACTOR; it.ref = a; it.key = PROJ.sortKey(a);
  it.x0 = a.x - r * 0.95; it.x1 = a.x + r * 0.95; it.y0 = a.y - Hs; it.y1 = a.y - 2; // bare kroppen over fotpunktet teller (lav dekning foran føttene utløser ikke silhuett)
  it.area = (it.x1 - it.x0) * (it.y1 - it.y0); it.team = teamOf(a, world); it.crouch = Hs < PROJ.heights.actor * PROJ.zScale; it.hs = Hs;
}

/**
 * opts: {
 *   cover?: Array<{x,y,w,h, elev?, type?, round?, noOcclude?}>, drawCover?(ctx, o, world, camera),
 *   actors?: Array (erstatter player + enemies), extra?: Array (legges til), drawActor?(ctx, a, world, camera),
 *   silhouettes?: bool (true), hideFrac?: number (0.12), tone?: bool (true – dybdetoning av dekning foran skjulte aktører)
 * }
 * Returnerer et gjenbrukt stats-objekt { items, cover, actors, hidden, missing, frame }.
 */
export function drawSorted(ctx, world, camera, opts = {}) {
  const cover = opts.cover, drawCover = opts.drawCover;
  if (!ctx || !world) return stats;
  n = 0; nh = 0;
  if (cover && drawCover) for (let i = 0; i < cover.length; i++) {
    const o = cover[i], it = slot(), e = coverElev(o);
    it.kind = COVER; it.ref = o; it.key = o.sortKey ?? PROJ.sortKey(o);
    // synlig flate: topp løftet e px + front. Sylindre (round) krympes litt så hjørnene ikke teller.
    const sh = o.round ? 0.12 : 0; it.elev = e;
    it.x0 = o.x + o.w * sh; it.x1 = o.x + o.w * (1 - sh); it.y0 = o.y - e + o.h * sh; it.y1 = o.y + o.h * (1 - sh);
  }
  const nCover = n;
  if (opts.actors) for (let i = 0; i < opts.actors.length; i++) pushActor(opts.actors[i], world);
  else {
    pushActor(world.player, world);
    const es = world.enemies; if (es) for (let i = 0; i < es.length; i++) pushActor(es[i], world);
  }
  if (opts.extra) for (let i = 0; i < opts.extra.length; i++) pushActor(opts.extra[i], world);
  order.length = n;
  order.sort(cmp);

  // okklusjon FØR tegning: hvilke aktører skjules av dekning som tegnes etter dem (og skal tones)?
  const lim = opts.hideFrac ?? 0.12, canTone = opts.tone !== false && toneReady(ctx);
  if (opts.silhouettes !== false && nCover) {
    for (let i = 0; i < n; i++) {
      const it = order[i]; if (it.kind !== ACTOR) continue;
      let cov = 0, any = false; it.deep = false;
      // Breach 27.10 14:09: helt dukket fiende (cover 1, peek 0 – alle typer) får ikke silhuett bak LAV dekning; bare høy (container/vegg) teller.
      // Warden (team 'player') beholder dagens regel.
      const duck = it.team !== 'player' && isDucked(it.ref);
      for (let j = i + 1; j < n; j++) {
        const c = order[j]; if (c.kind !== COVER || c.ref.noOcclude) continue;
        const w = Math.min(it.x1, c.x1) - Math.max(it.x0, c.x0); if (w <= 0) continue;
        const h = Math.min(it.y1, c.y1) - Math.max(it.y0, c.y0); if (h <= 0) continue;
        // terskel: høy dekning, eller skjult andel av aktørhøyden > HIDE_THRESHOLD (lav 24 / stående 48 = 0,5 → nei)
        if (c.elev < HIGH_ELEV && (duck || Math.min(1, c.elev / it.hs) <= HIDE_THRESHOLD)) continue;
        cov += w * h;
        // Arena-silhuett-kant 27.10: kroppen helt innenfor takflaten på høy dekning → ingen utskjæring (taket helt dekkende), bare kaldt omriss
        if (c.elev >= HIGH_ELEV) { it.deep = true; if (c.nl < 8) c.lip[c.nl++] = it; continue; }
        if (c.nf < 8) { c.fade[c.nf++] = it; any = true; }
      }
      if (cov / it.area > lim) { hidden[nh++] = it; it.toned = canTone && any; }
      else if (any) for (let j = i + 1; j < n; j++) { const c = order[j]; if (c.kind === COVER && c.nf && c.fade[c.nf - 1] === it) c.nf--; }
    }
  }

  const mods = world.modules || {};
  const pDraw = mods.player?.drawActor, eDraw = mods.enemies?.drawActor, own = opts.drawActor;
  let missing = 0;
  for (let i = 0; i < n; i++) {
    const it = order[i];
    if (it.kind === COVER) {
      if (it.nf && canTone) drawCoverToned(ctx, it, world, camera, drawCover);
      else drawCover(ctx, it.ref, world, camera);
      if (it.nl) drawRoofLip(ctx, it, it.lip, it.nl);
      // varme dekaler (VFX): rett etter objektet, bare når VFX har flagget det
      if (it.ref.pendDecals) world.arena?.drawPendingDecals?.(ctx, it.ref, world);
      if (it.ref.hotDecals) { const hook = world.arena?.onCoverDraw; if (hook) { ctx.save(); try { hook(ctx, it.ref, world); } catch (e) { /* VFX-feil skal ikke stoppe tegningen */ } ctx.restore(); } }
      continue;
    }
    const a = it.ref;
    const fn = own || (a === world.player ? pDraw : (a.drawActor ? null : eDraw));
    ctx.save();
    if (fn) fn(ctx, a, world, camera);
    else if (a.drawActor) a.drawActor(ctx, world, camera);
    else { missing++; if (opts.fallback !== false) drawFallback(ctx, a, it); }
    ctx.restore();
  }
  if (nh) drawSilhouettes(ctx, nh);
  for (let i = 0; i < n; i++) { const it = order[i]; if (it.nf) { for (let k = 0; k < it.nf; k++) it.fade[k] = null; it.nf = 0; } if (it.nl) { for (let k = 0; k < it.nl; k++) it.lip[k] = null; it.nl = 0; } }
  world._depthDrawn = true; // arena.drawTop hopper da over dekning som allerede er tegnet (bare tak/overhead igjen)
  stats.items = n; stats.cover = nCover; stats.actors = n - nCover; stats.hidden = nh; stats.missing = missing; stats.frame = ++frame;
  return stats;
}

// ---------------------------------------------------------------- dybdetoning
// Dekningen tegnes i et kladdelerret med samme transform, en myk ellipse rundt hver skjult aktør trekkes ut
// (destination-out, 1 − FADE_ALPHA), og resultatet blittes tilbake innenfor dekningens skjermrektangel.
let scratch = null, sctx = null, fadeImg = null;
function mk(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}
function toneReady(ctx) {
  if (!ctx || !ctx.canvas || !ctx.getTransform) return false;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (!scratch || scratch.width !== W || scratch.height !== H) {
    scratch = mk(W, H); sctx = scratch && scratch.getContext('2d');
    if (!sctx) { scratch = null; return false; }
  }
  if (!fadeImg) {
    fadeImg = mk(64, 64); const g = fadeImg && fadeImg.getContext('2d'); if (!g) return false;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), k = 1 - FADE_ALPHA;
    gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(0.55, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  return true;
}
function drawCoverToned(ctx, it, world, camera, drawCover) {
  const o = it.ref, m = ctx.getTransform(), W = scratch.width, H = scratch.height;
  // skjermrektangel: sprite-utsnitt (inkl. skygge) hvis kjent, ellers boks + løftet topp
  const wx0 = Math.min(o.x, o.sx ?? o.x) - 4, wy0 = Math.min(o.y - it.elev, o.sy ?? o.y) - 4;
  const wx1 = Math.max(o.x + o.w, (o.sx ?? o.x) + (o.sw ?? 0)) + 4, wy1 = Math.max(o.y + o.h, (o.sy ?? o.y) + (o.sh ?? 0)) + 4;
  const x0 = Math.max(0, Math.floor(m.a * wx0 + m.e)), y0 = Math.max(0, Math.floor(m.d * wy0 + m.f));
  const x1 = Math.min(W, Math.ceil(m.a * wx1 + m.e)), y1 = Math.min(H, Math.ceil(m.d * wy1 + m.f));
  if (x1 <= x0 || y1 <= y0) return;
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1;
  sctx.clearRect(x0, y0, x1 - x0, y1 - y0);
  sctx.save(); sctx.beginPath(); sctx.rect(x0, y0, x1 - x0, y1 - y0); sctx.clip();
  sctx.setTransform(m); drawCover(sctx, o, world, camera);
  sctx.setTransform(m); sctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < it.nf; k++) {
    const a = it.fade[k], r = (a.x1 - a.x0) / 2, ax = a.ref.x, ay = a.ref.y;
    const rx = r * 1.9 + 8, ry = a.hs * 0.5 + r + 8, cy = ay - a.hs * 0.5;
    // Arena-silhuett 27.10: bak HØY dekning skjæres bare ~1/3 ut (fienden ~30 %, taket forblir tak), svakere jo dypere bak.
    sctx.globalAlpha = it.elev >= HIGH_ELEV ? Math.max(0.3, 0.55 - Math.max(0, o.y - ay) / 160) : 1;
    sctx.drawImage(fadeImg, ax - rx, cy - ry, rx * 2, ry * 2);
  }
  sctx.globalAlpha = 1;
  sctx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
// Arena-silhuett-kant 27.10: takets nordkant tegnes OVER skjulte aktører (mørk kontaktlinje + 2 px lys takleppe), så taket
// leses foran; krysser kroppen kanten, får siden over kanten en kort mørk spalte. 3–4 fillRect per skjult aktør, ingen shadowBlur.
function drawRoofLip(ctx, it, L, nL) {
  const o = it.ref, ey = o.y - it.elev;
  for (let k = 0; k < nL; k++) {
    const a = L[k], lx0 = Math.max(o.x, a.x0 - 6), lw = Math.min(o.x + o.w, a.x1 + 6) - lx0; if (lw <= 0) continue;
    if (a.y0 < ey) { ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(lx0, ey - 3, lw, 3); }   // spalte/skygge på aktørsiden
    ctx.fillStyle = 'rgba(6,8,10,0.92)'; ctx.fillRect(lx0, ey - 0.6, lw, 1.3);                  // kontaktlinje
    ctx.fillStyle = 'rgba(190,205,215,0.34)'; ctx.fillRect(lx0, ey + 0.7, lw, 1.1);             // takleppe, lys
    ctx.fillStyle = 'rgba(190,205,215,0.14)'; ctx.fillRect(lx0, ey + 1.8, lw, 1.4);
  }
}

// Reserve når modulen ikke har drawActor ennå: enkel stående kapsel i lagfarge (krasjer aldri).
function drawFallback(ctx, a, it) {
  const r = (it.x1 - it.x0) / 2, col = COL[it.team] || COL.enemy;
  ctx.beginPath(); ctx.arc(a.x, it.y0 + r, r, Math.PI, 0); ctx.lineTo(a.x + r, a.y); ctx.ellipse(a.x, a.y, r, r * 0.45, 0, 0, Math.PI); ctx.closePath();
  ctx.fillStyle = '#3a3f44'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col[1]; ctx.stroke();
}
// Dukket = i dekningsposisjon uten å kikke: tilstand inCover/suppressed med spot (enemies/pose.js gir da cover 1, peek 0),
// eller eksplisitt a.cover ≥ 1 og a.peek 0 hvis en type setter dem selv.
function isDucked(a) {
  if (!a || a.dead) return false;
  if (typeof a.peek === 'number' && a.peek > 0) return false;
  if (typeof a.cover === 'number') return a.cover >= 1;
  return !!a.spot && (a.state === 'inCover' || a.state === 'suppressed');
}
const COL = { player: ['rgba(57,198,255,0.22)', 'rgba(57,198,255,0.8)'], enemy: ['rgba(255,110,60,0.22)', 'rgba(255,110,60,0.8)'] };
const GHOST = { player: 'rgba(120,200,235,0.8)', enemy: 'rgba(165,185,200,0.8)' };   // skjult: kald, avmettet (Arena-silhuett 27.10)
const DASH = [3, 2], NODASH = [];
function drawSilhouettes(ctx, k) {
  ctx.save();
  ctx.setLineDash(DASH); ctx.lineWidth = 1; // tynt omriss uten fyll (Karakter/Test 13:55)
  for (let i = 0; i < k; i++) {
    const it = hidden[i], a = it.ref, r = (it.x1 - it.x0) / 2, top = it.y0 + r;
    ctx.globalAlpha = it.toned || it.deep ? 0.25 : 0.4; // tonet: bare et svakt supplement (Arena-silhuett 27.10: lavere, kald)
    ctx.beginPath();
    ctx.arc(a.x, top, r, Math.PI, 0); ctx.lineTo(a.x + r, a.y); ctx.ellipse(a.x, a.y, r, r * 0.45, 0, 0, Math.PI); ctx.closePath();
    ctx.strokeStyle = GHOST[it.team] || GHOST.enemy; ctx.stroke();
  }
  ctx.setLineDash(NODASH);
  ctx.restore();
  for (let i = 0; i < k; i++) hidden[i] = null;
}

/** true når både player- og enemies-modulen eksponerer drawActor (ellers bør kjernen bruke modulenes draw). */
export function canSort(world) { const m = world.modules || {}; return !!(m.player?.drawActor && m.enemies?.drawActor); }
export const depthStats = stats;
