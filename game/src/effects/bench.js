// BREACH – Effekter: Arenas standard testscenario (Kessa Yard, view 34, 1600×1000, median og p95 over 10 s), simulert via fx.spawn.
// Brukes av test.html ?scenario=typical|heavy og _tools/perf.html. Deterministisk (egen rng, fast dt 1/60).
//  typical: 6 fiender, ~8 skudd/s totalt, 1 eksplosjon / 6 s, ~40 % av kulene treffer dekning (resten: ~35 % fiende, resten bom)
//  heavy:  10 fiender, ~20 skudd/s, 1 eksplosjon / 1,5 s med 3 samtidige granater i topp (hvert 6. s), 2 Cinderborn-dødsfall/s med ichor
export const SCENARIOS = {
  typical: { enemies: 6, shot: 8, cover: 0.4, body: 0.35, nade: 1 / 6, burst: 0, death: 1 / 4, spawn: 1 / 5 },
  heavy: { enemies: 10, shot: 20, cover: 0.4, body: 0.35, nade: 1 / 1.5, burst: 1 / 6, death: 2, spawn: 1 / 2 },
};
const MAT = ['metal', 'concrete', 'concrete', 'wood'];
/** drive(world) kalles én gang per fast steg (etter world.time += dt). Kulens treff kommer ~0,08 s etter skuddet. */
export function makeDriver(FX, name = 'typical', seed = 7, area = [1000, 620]) {
  const C = SCENARIOS[name] || SCENARIOS.typical; let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const X = () => (R() - 0.5) * area[0], Y = () => (R() - 0.5) * area[1];
  const foes = Array.from({ length: C.enemies }, () => ({ x: X(), y: Y() })), pl = { x: 0, y: 40 };
  const next = { shot: 0.05, nade: 0.7, burst: C.burst ? 3 : Infinity, death: 1, spawn: 0.4 }, pend = [];
  return function drive(w) {
    const t = w.time;
    for (const f of foes) { f.x += (R() - 0.5) * 1.2; f.y += (R() - 0.5) * 1.2; }
    while (t > next.shot) {
      next.shot += 1 / C.shot; const mine = R() < 0.45, f = foes[Math.floor(R() * foes.length)], src = mine ? pl : f, dst = mine ? f : pl;
      const a = Math.atan2(dst.y - src.y, dst.x - src.x) + (R() - 0.5) * 0.12;
      FX.spawn(w, 'muzzle', { x: src.x, y: src.y, angle: a, weapon: mine ? (R() < 0.2 ? 'shotgun' : 'rifle') : 'rifle', team: mine ? 'player' : 'enemy', flash: false });
      const u = R(), d = Math.hypot(dst.x - src.x, dst.y - src.y) * (u < C.cover ? 0.5 + R() * 0.4 : 1);
      if (u < C.cover + C.body) pend.push({ at: t + 0.08, x: src.x + Math.cos(a) * d, y: src.y + Math.sin(a) * d, a, surface: u < C.cover ? MAT[Math.floor(R() * MAT.length)] : (mine ? 'chitin' : 'metal'), partial: u >= C.cover });
    }
    for (let i = pend.length - 1; i >= 0; i--) { const h = pend[i]; if (h.rise || t < h.at) continue; pend.splice(i, 1); FX.spawn(w, 'impact', { x: h.x, y: h.y, angle: h.a, surface: h.surface, partial: h.partial }); }
    while (t > next.nade) { next.nade += 1 / C.nade; FX.spawn(w, 'explosion', { x: X(), y: Y(), radius: 90 }); }
    while (t > next.burst) { next.burst += 1 / C.burst; for (let k = 0; k < 3; k++) FX.spawn(w, 'explosion', { x: X(), y: Y(), radius: 90 }); }
    while (t > next.death) { next.death += 1 / C.death; const f = foes[Math.floor(R() * foes.length)]; FX.spawn(w, 'death', { x: f.x, y: f.y, angle: R() * 6.28 }); f.x = X(); f.y = Y(); }
    while (t > next.spawn) { next.spawn += 1 / C.spawn; const x = X(), y = Y(), id = 'b' + Math.floor(t * 1000); FX.spawn(w, 'crack', { x, y, t: 0.9, id }); pend.push({ at: t + 0.9, rise: true, x, y, id }); }
    for (let i = pend.length - 1; i >= 0; i--) { const h = pend[i]; if (!h.rise || t < h.at) continue; pend.splice(i, 1); FX.spawn(w, 'rise', { x: h.x, y: h.y, id: h.id }); }
  };
}
