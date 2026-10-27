// BREACH – forvarming av faceted-sprites for spilleren (Breach Karakter, 2026-10-23).
// Ved banestart og respawn bakes det spilleren trenger først (overkropp stå/sikte i 32 vinkler → bein i ro →
// gange fram i alle faser → bevegelige våpendeler), ÉN sprite per bilde og bare i bilder der spillet selv ikke
// bakte noe (ledig tid). Nøklene kommer fra faceted.warmJobs (samme kvantisering som tegningen).
import { faceted } from '../shared/rig/styles/faceted.js';
import { cacheReport } from '../shared/rig/faceted/bake.js';

const raf = (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : setTimeout(f, 16));
let job = null;
export const WARM = { done: 0, total: 0, ms: 0, maxMs: 0, startedAt: 0, finishedAt: 0, reason: '' };

const bakesNow = () => { let n = 0; for (const c of cacheReport()) n += c.bakes; return n; };

/** Start (eller start på nytt) forvarming for riggen. Gjør ingenting utenfor trekvart. */
export function warmFaceted(world, rig, o = {}) {
  if (job) job.cancelled = true;
  if (!rig || world?.view !== '34' || rig.style?.name !== 'faceted') return;   // bare når faceted faktisk tegner
  const me = job = { cancelled: false, list: null, i: 0, lastBakes: -1, quiet: 0 };
  Object.assign(WARM, { done: 0, total: 0, ms: 0, maxMs: 0, startedAt: performance.now(), finishedAt: 0, reason: o.reason || 'start' });
  const tick = () => {
    if (me.cancelled) return;
    if (!me.list) {                               // vent til riggen er tegnet én gang (da vet vi oppløsningen D)
      if (!rig.__fac?.D) return raf(tick);
      me.list = faceted.warmJobs(rig, { D: rig.__fac.D }).jobs; WARM.total = me.list.length;
    }
    const b = bakesNow();
    const busy = me.lastBakes >= 0 && b !== me.lastBakes;   // spillet bakte selv i forrige bilde → hopp over
    if (!busy && (o.idle?.() ?? true)) {
      while (me.i < me.list.length) { const j = me.list[me.i++]; const t0 = performance.now(); if (j.run() === 'retry') { me.i--; break; } const ms = performance.now() - t0;   // v4.3: 'retry' = arbeiderkøen full
        if (ms < .05) continue;                   // allerede i cachen (bakt av spillet i mellomtiden)
        WARM.done = me.i; WARM.ms += ms; WARM.maxMs = Math.max(WARM.maxMs, ms); break; }
    }
    me.lastBakes = bakesNow();
    if (me.i >= me.list.length) { WARM.done = me.list.length; WARM.finishedAt = performance.now(); if (job === me) job = null; return; }
    raf(tick);
  };
  raf(tick);
}
export function cancelWarm() { if (job) job.cancelled = true; job = null; }
