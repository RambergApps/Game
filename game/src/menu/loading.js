// Breach-lasteskjerm (Hakk 27.10): svart som #boot-black, vises mens arenaen bakes over flere bilder (world.arenaBake).
// Løses opp når bakingen er ferdig; deretter tar hovedmenyen (eller spillet med ?skipmenu=1) over.
let fxDone = false, fxP = 0, fxLabel = ''; // Effekters sprites.warmupChunked (FX.init kjøres med warmup:false i core/loop.js)
// Fallback: uten warmupChunked kjøres synkron warmup() her
import('../effects/sprites.js').then(async (m) => { await (m.warmupChunked ? m.warmupChunked({ budgetMs: 8, onProgress: ({ done, total, label }) => { fxP = total ? done / total : 1; fxLabel = label || ''; } }) : m.warmup?.()); })
  .then(() => { fxDone = true; fxP = 1; }, () => { fxDone = true; fxP = 1; });
const look = () => globalThis.__cinderLook?.lookStats;
const lookDone = () => { const l = look(); return fxDone && (!l || l.reserveDone !== false); };
// samlet fremdrift: arenabaking (65 %) + effektsprites (15 %) + fiendereserve (20 %)
const prog = (b) => { const l = look(), r = l && l.reserveN ? l.reserveI / l.reserveN : 1; return Math.min(1, b.p * 0.65 + fxP * 0.15 + r * 0.2); };
export function showLoading(world) {
  if ((!world?.arenaBake || world.arenaBake.done) && lookDone()) return Promise.resolve();
  world.arenaBake = world.arenaBake || { p: 1, label: 'Ready', done: true };
  const el = document.createElement('div'); el.className = 'bl-root'; el.dataset.ui = 'loading';
  el.innerHTML = `<style>.bl-root{position:fixed;inset:0;background:#000;z-index:101;display:flex;align-items:center;justify-content:center;font:600 12px/1 system-ui,sans-serif;letter-spacing:.32em;color:#8a8f96;text-transform:uppercase;opacity:0;transition:opacity .25s}
.bl-root.bl-in{opacity:1}.bl-box{width:min(360px,60vw)}.bl-t{display:flex;justify-content:space-between;margin-bottom:10px}.bl-t b{color:#d7dbe0;font-weight:700}
.bl-bar{height:2px;background:#1b1e22;overflow:hidden}.bl-bar i{display:block;height:100%;width:0;background:#e8a33a;transition:width .15s linear}</style>
<div class="bl-box"><div class="bl-t"><b>Breach</b><span class="bl-p">0%</span></div><div class="bl-bar"><i></i></div><div class="bl-l" style="margin-top:10px;font-size:10px;letter-spacing:.24em;color:#5d6268">Preparing</div></div>`;
  document.body.appendChild(el);
  const bar = el.querySelector('.bl-bar i'), pct = el.querySelector('.bl-p'), lab = el.querySelector('.bl-l');
  let t0 = performance.now(), raf = 0;
  // Kort på rask maskin: vises først etter 120 ms, så en rask lasting bare er svart (som før)
  const tick = () => { const b = world.arenaBake; if (performance.now() - t0 > 120) el.classList.add('bl-in');
    const pp = prog(b); bar.style.width = Math.round(pp * 100) + '%'; pct.textContent = Math.round(pp * 100) + '%'; lab.textContent = !b.done ? b.label : !fxDone ? 'Warming effects' : 'Waking the swarm'; if (!b.done || !lookDone()) raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return new Promise((res) => { const done = () => { cancelAnimationFrame(raf); bar.style.width = '100%'; pct.textContent = '100%';
    res(); setTimeout(() => el.remove(), 0); }; // menyen/svart-laget ligger allerede under når laget fjernes: ingen arenablink
    const poll = () => (world.arenaBake.done && lookDone() ? done() : setTimeout(poll, 30));
    poll(); });
}
