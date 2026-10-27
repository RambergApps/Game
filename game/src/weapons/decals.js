// Breach Våpen – kulehull på dekning via Arenas krok (coverHitPoint + addCoverDecal, CORE-API «Dekaler på dekning»).
// Grenser (våre, i tillegg til Arenas ringbuffer på 24 per objekt):
//  - maks én dekal per avtrekk (shotId; hagla = én per salve, ikke per hagl)
//  - minste tid mellom dekaler per skytter (TUNING.coverDecals.minInterval) og minsteavstand på samme dekning
//  - globalt tak per sekund (perSecond). All tilfeldighet via world.rng.
import { TUNING } from './data.js';

export function initCoverDecals(world, on) {
  const S = { lastShot: new Set(), byOwner: new Map(), win: 0, winN: 0, last: [], stats: { calls: 0, added: 0, skipped: 0, ms: 0 } };
  world._wDecals = S;
  on('coverHit', ({ projectile: p, cover, x, y, z }) => {
    const C = TUNING.coverDecals; if (!C || !C.enabled || !p || !cover || p.kind === 'grenade') return;
    const A = world.modules?.arena; if (!A?.coverHitPoint || !A?.addCoverDecal) return;
    S.stats.calls++; p.decalHandled = true;   // Våpen eier kulehullet for dette treffet (sendes som bulletImpact.decalHandled)
    const t = world.time || 0, key = p.shotId ?? p;
    if (S.lastShot.has(key)) { S.stats.skipped++; return; }
    if (t - S.win >= 1) { S.win = t; S.winN = 0; }
    const ow = p.owner || p.team, prev = S.byOwner.get(ow);
    const minI = C.minInterval[p.weapon] ?? C.minInterval.default;
    if (S.frameT === t) { S.stats.skipped++; return; }   // maks én bake per steg (kostnaden ligger i Arenas bake)
    if (S.winN >= C.perSecond || (prev != null && t - prev < minI)) { S.stats.skipped++; return; }
    const t0 = performance.now();
    const hp = A.coverHitPoint(world, cover, x, y, z);
    if (!hp || hp.coverId == null) { S.stats.skipped++; return; }
    for (const l of S.last) if (l.id === hp.coverId && Math.abs(l.x - hp.x) + Math.abs(l.z - hp.z) < C.minDist) { S.stats.skipped++; return; }
    const R = world.rng ? () => world.rng() : Math.random;
    const kind = hp.material === 'metal' ? 'bullet_metal' : 'bullet_concrete';
    const r = kind === 'bullet_metal' ? 2 + R() : 3 + R() * 2;
    const ok = A.addCoverDecal(world, hp.coverId, { x: hp.x + (R() - 0.5) * 2, z: hp.face === 'top' ? hp.z : Math.max(2, hp.z + (R() - 0.5) * C.zJitter), y: hp.face === 'top' ? hp.y : undefined,
      kind, r: (p.pellets > 1 ? 0.9 : 1) * r, angle: R() * Math.PI * 2, seed: (R() * 4294967295) >>> 0 });
    const dt = performance.now() - t0; S.stats.ms += dt; (S.stats.each = S.stats.each || []).push(+dt.toFixed(2)); if (S.stats.each.length > 64) S.stats.each.shift();
    if (!ok) { S.stats.skipped++; return; }
    S.stats.added++; S.winN++; S.frameT = t; S.byOwner.set(ow, t);
    S.lastShot.add(key); if (S.lastShot.size > 64) S.lastShot.delete(S.lastShot.values().next().value);
    S.last.push({ id: hp.coverId, x: hp.x, z: hp.z }); if (S.last.length > 16) S.last.shift();
  });
  const clear = () => { S.lastShot.clear(); S.byOwner.clear(); S.last.length = 0; };
  on('levelStart', clear); on('arenaLoaded', clear);
  return S;
}
export const coverDecalStats = (world) => world._wDecals?.stats || null;
