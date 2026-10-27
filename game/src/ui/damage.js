// Retningsindikator for skade: rød bue ved skjermkanten mot kilden + markør ved kanten for skyttere utenfor skjermen.
// Tegnes som loopens mods.hud (før level/player-HUD), så resten av HUD-en alltid ligger oppå. Ekte tid (fader også i pause).
import { getSettings } from './settings.js';
import { PROJ } from '../shared/projection.js';
const now = () => performance.now() / 1000;
export const DAMAGE_UI = { lifeMin: 0.7, lifeMax: 0.9, fullAt: 25, mergeDeg: 22, arcDeg: [34, 58], radius: 46, z: 20, max: 8, color: [236, 72, 36] };

/** Kildepunkt i verden. Eksplosjon/granat → eksplosjonspunktet (source.x/y), også ved selvskade.
 *  Ellers eierens posisjon (levende skytter), så prosjektilets munning (ox/oy), så source.x/y.
 *  target: når eieren ER målet (egen granat) brukes aldri eierposisjonen. */
export function sourcePoint(src, target = null) {
  if (!src) return null;
  const fin = (o) => o && Number.isFinite(o.x) && Number.isFinite(o.y);
  const explosive = !!(src.grenade || src.weapon === 'grenade' || src.kind === 'explosion' || src.type === 'explosion');
  if (explosive && fin(src)) return { x: src.x, y: src.y, ent: null };
  const o = src.owner ?? src.entity ?? null;
  if (fin(o) && o !== target) return { x: o.x, y: o.y, ent: o };
  if (Number.isFinite(src.ox) && Number.isFinite(src.oy)) return { x: src.ox, y: src.oy, ent: null };
  if (fin(src) && src !== target) return { x: src.x, y: src.y, ent: src.team && src !== target ? src : null };
  return null;
}

export function createDamageIndicator(world) {
  const list = [];   // { wx, wy, ent, t0, life, k }
  const off = world.events.on('hit', ({ target, amount, blocked, source }) => {
    if (!target || target !== world.player || blocked || !(amount > 0)) return;
    const p = world.player, sp = sourcePoint(source, p); if (!sp) return;   // ingen kilde (miljø) → ingen retning
    const dx = sp.x - p.x, dy = sp.y - p.y;
    if (dx * dx + dy * dy < 4) return;                                        // kilden står i spilleren → retning udefinert
    const a = Math.atan2(dy, dx);   // verdensplanet (x,y); bakkeplanet tegnes 1:1 i view 34, så vinkelen er lik på skjermen
    // Egen hendelse (sendes også når indikatoren er slått av, så andre kan bruke den)
    world.events.emit('damageDirection', { entity: p, angle: a, amount, sourceX: sp.x, sourceY: sp.y, source });
    if (world.settings?.damageIndicator === false || getSettings?.().damageIndicator === false) return;
    const k = Math.min(1, Math.max(0.35, amount / DAMAGE_UI.fullAt));
    const t = now();
    // Slå sammen treff fra omtrent samme retning (automatild skal ikke gi en vifte av buer).
    const same = list.find((h) => Math.abs(Math.atan2(Math.sin(h.a - a), Math.cos(h.a - a))) < DAMAGE_UI.mergeDeg * Math.PI / 180);
    if (same) { same.wx = sp.x; same.wy = sp.y; same.ent = sp.ent; same.a = a; same.t0 = t; same.k = Math.min(1, Math.max(same.k * 0.6, k) + 0.15); same.life = life(same.k); return; }
    list.push({ wx: sp.x, wy: sp.y, ent: sp.ent, a, t0: t, k, life: life(k) });
    if (list.length > DAMAGE_UI.max) list.shift();
  });
  const life = (k) => DAMAGE_UI.lifeMin + (DAMAGE_UI.lifeMax - DAMAGE_UI.lifeMin) * k;

  // Rev. 2 (2026-10-26): kile rundt spilleren (ikke skjermsenteret) – kameraet er klemt ved kartkanten, og nederste kant
  // dekkes av våpen-HUD. Senter = spillerens brysthøyde via PROJ.toScreen; vinkelen er fra verdensplanet (x,y), som
  // tegnes 1:1 i view 34. Pil ved skjermkanten bare når kilden er utenfor skjermen.
  function draw(ctx, w, camera) {
    if (!list.length) return;
    const p = world.player; if (!p) { list.length = 0; return; }
    if (getSettings().damageIndicator === false) { list.length = 0; return; }
    const t = now(), W = ctx.canvas.width, H = ctx.canvas.height, [r, g, b] = DAMAGE_UI.color;
    const view34 = world.view === '34' || world.view === 34 || /[?&]view=34/.test(globalThis.location?.search ?? '');
    const c3 = view34 ? PROJ.toScreen(p.x, p.y, DAMAGE_UI.z) : { x: p.x, y: p.y };
    const ps = camera.worldToScreen(c3.x, c3.y), zoom = camera.zoom ?? 1, R = DAMAGE_UI.radius * zoom;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i], age = t - h.t0;
      if (age > h.life) { list.splice(i, 1); continue; }
      if (h.ent && !h.ent.dead && Number.isFinite(h.ent.x)) { h.wx = h.ent.x; h.wy = h.ent.y; h.a = Math.atan2(h.wy - p.y, h.wx - p.x); }
      const a = h.a, fade = Math.min(1, age / 0.05) * (1 - Math.pow(age / h.life, 1.8)), alpha = fade * (0.5 + 0.5 * h.k);
      const span = (DAMAGE_UI.arcDeg[0] + (DAMAGE_UI.arcDeg[1] - DAMAGE_UI.arcDeg[0]) * h.k) * Math.PI / 180;
      const thick = (4 + 5 * h.k) * zoom;
      // mørk kant (lesbar på lyst gulv) → rød bue → lys kjerne
      for (const [lw, col] of [[thick + 3 * zoom, `rgba(20,6,4,${0.55 * alpha})`], [thick, `rgba(${r},${g},${b},${0.95 * alpha})`], [1.5 * zoom, `rgba(255,190,150,${0.8 * alpha})`]]) {
        ctx.beginPath(); ctx.arc(ps.x, ps.y, R, a - span / 2, a + span / 2); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }
      // spiss utenfor buen peker mot kilden
      const tx = ps.x + Math.cos(a) * (R + thick * 0.5 + 9 * zoom), ty = ps.y + Math.sin(a) * (R + thick * 0.5 + 9 * zoom);
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(4 * zoom, 0); ctx.lineTo(-5 * zoom, -6 * zoom); ctx.lineTo(-5 * zoom, 6 * zoom); ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},${0.95 * alpha})`; ctx.fill(); ctx.restore();
      // pil ved skjermkanten når kilden er utenfor skjermen (samme vinkel)
      const ss = camera.worldToScreen(h.wx, h.wy);
      if (ss.x < 0 || ss.y < 0 || ss.x > W || ss.y > H) {
        const m = 34, kx = Math.cos(a), ky = Math.sin(a);
        const s1 = Math.min(kx > 0 ? (W - m - ps.x) / kx : kx < 0 ? (m - ps.x) / kx : 1e9, ky > 0 ? (H - m - ps.y) / ky : ky < 0 ? (m - ps.y) / ky : 1e9);
        ctx.save(); ctx.translate(ps.x + kx * s1, ps.y + ky * s1); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath();
        ctx.fillStyle = `rgba(${r},${g},${b},${0.95 * alpha})`; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(20,6,4,${0.8 * alpha})`; ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  return { draw, list, destroy: off, clear() { list.length = 0; } };
}
