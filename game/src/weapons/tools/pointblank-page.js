// Kloss-hold-test (kjøres i index.html via pointblank.cjs). Manuell stepping, fast seed, ekte input-sti (mus + E-tast fra cjs).
export async function setup() {
  const B = window.BREACH, W = B.world; B.loop.stop();
  const C = await import('/src/core/index.js'), Wd = await import('/src/core/world.js'), E = await import('/src/enemies/index.js');
  window.__PROJ = (await import('/src/shared/projection.js')).PROJ;
  const st = { W, B, C, Wd, E, shots: new Map(), track: [] };
  W.events.on('weaponFire', (e) => { if (e.entity === W.player) st.shots.set(e.shotId, { hits: 0, pellets: e.pellets, z: e.z, posture: e.posture }); });
  W.events.on('projectileHit', ({ projectile: p, target, z }) => { const s = st.shots.get(p.shotId); if (s && target?.team === 'enemy') { s.hits++; (s.hz ||= []).push(z); } });
  window.__PB = st; return { view: W.view, zoom: B.camera.zoom };
}
const step = (n = 1) => { const { B, W } = window.__PB; for (let i = 0; i < n; i++) { W.paused = false; document.querySelectorAll('.bx-root').forEach((n) => n.remove()); B.loop.step(1 / 60); trackZ(); } B.loop.render?.(); };
function trackZ() {   // z ved passering: for hver levende spillerpellet, z når den er nærmest fiendens senter
  const { W, C, foe } = window.__PB; if (!foe) return;
  for (const p of W.projectiles) { if (p.team !== 'player' || !p.shotId) continue;
    const d = Math.hypot(p.x - foe.x, p.y - foe.y); if (!(p._pbD <= d)) { p._pbD = d; p._pbZ = C.projectileZ(p); }
    (window.__PB.live ||= new Set()).add(p); }
}
export async function place(o) {   // o: { px, py, type, gap, deg, seed }
  const S = window.__PB, { W, Wd, E } = S, pl = W.player;
  W.rng = Wd.createRng(o.seed || 1234);
  W.enemies.length = 0; W.projectiles.length = 0; pl.hp = pl.maxHp = 99999; pl.invuln = 999;
  pl.x = o.px; pl.y = o.py; pl.vx = pl.vy = 0;
  const a = (o.deg ?? -90) * Math.PI / 180, r = (pl.r || 12) + 16 + o.gap;   // nordover (+ vinkel)
  const e = E.createEnemy(W, o.type, pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r); e.hp = e.maxHp = 1e9; e.invuln = false;
  S.foe = e; S.zc = (await import('/src/enemies/stats.js')).BODY[o.type]?.aimHeight ?? 27; S.fx = e.x; S.fy = e.y; S.center = r + (e.r - 16);
  const Wp = await import('/src/weapons/index.js'); Wp.switchWeapon(W, pl, o.weapon || 'shotgun'); pl.loadout.infinite = true; step(60);
  e.x = S.fx; e.y = S.fy;
  return { r, er: e.r, pr: pl.r, w: pl.loadout.slots[pl.loadout.index].id };
}
export function shoot(o) {   // o: { n, aim:bool, weapon } – siktet mot fiendens bryst på skjermen
  const S = window.__PB, { W, B, C } = S, pl = W.player, e = S.foe, inp = W.input, PROJ = { aimZ: 27 };
  const res = []; S.shots.clear();
  for (let k = 0; k < o.n; k++) {
    e.x = S.fx; e.y = S.fy; e.vx = e.vy = 0; e.stunned = 1; e.staggerUntil = 1e9;
    const zl = W.view === '34' ? (o.zc ?? S.zc) * window.__PROJ.zScale : 0;
    const s = B.camera.worldToScreen(e.x, e.y - zl); inp.mouse.x = s.x; inp.mouse.y = s.y; inp.mouse.right = !!o.aim;
    step(o.aim ? 20 : 4);
    e.x = S.fx; e.y = S.fy;
    const before = S.shots.size; inp.mouse.left = true; inp.mouse.leftPressed = true; S.live = new Set(); step(3); inp.mouse.left = false;
    for (let i = 0; i < 12; i++) { e.x = S.fx; e.y = S.fy; step(1); }
    const id = [...S.shots.keys()][before]; const sh = S.shots.get(id);
    if (!sh) { const L = pl.loadout; S.why = { state: pl.state, dead: pl.dead, hp: pl.hp, idx: L.index, cd: L.cooldown, sw: L.switchT, rl: !!L.reload, melee: !!L.melee, gr: !!L.grenadeThrow, mag: L.slots[L.index].mag, paused: W.paused, hs: W.hitstopT }; res.push(null); step(30); continue; }
    const zs = [...S.live].filter((p) => p.shotId === id).map((p) => p._pbZ).filter(Number.isFinite);
    const miss = [...S.live].filter((p) => p.shotId === id && Number.isFinite(p._pbD)).map((p) => p._pbD - (e.r + (p.radius || 1)));
    res.push({ hz: sh.hz ? sh.hz.reduce((a, b) => a + b, 0) / sh.hz.length : null, hits: sh.hits, pellets: sh.pellets, z0: sh.z, zPass: zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : null, missMin: miss.length ? Math.min(...miss) : null, posture: sh.posture, state: pl.state, mz: pl.muzzle && [pl.muzzle.x - pl.x, pl.muzzle.y - pl.y, pl.muzzle.z].map((v) => +v.toFixed(1)) });
    step(8); { const L = pl.loadout; L.cooldown = 0; L.recoil = 0; L.chamberT = 0; L.queued = null; }   // nedkjøling nullstilles (testfiksur, ellers 48 steg/skudd)
  }
  if (S.why) res.why = S.why; S.why = null;
  return res.length && res.why ? [...res, { why: res.why }] : res;
}
export const snap = () => step(0);
