// FPS-visning (DOM). Måler selv med requestAnimationFrame, eller leser loop.stats.fps hvis loop er gitt.
import { injectStyle, el } from './style.js';

export function createFpsCounter({ loop = null, parent = document.body } = {}) {
  injectStyle();
  const node = el('div', 'bx-fps'); node.dataset.ui = 'fps'; node.style.display = 'none';
  parent.appendChild(node);
  let visible = false, raf = 0, last = 0, ema = 60, shownAt = 0;
  function tick(t) {
    raf = requestAnimationFrame(tick);
    if (last) { const dt = (t - last) / 1000; if (dt > 0 && dt < 1) ema += (1 / dt - ema) * 0.08; }
    last = t;
    if (t - shownAt < 250) return;   // oppdater teksten 4 ganger i sekundet
    shownAt = t;
    const f = loop?.stats?.fps ?? ema;
    node.textContent = `${Math.round(f)} FPS`;
    node.classList.toggle('bx-low', f < 45);
  }
  return {
    el: node,
    setVisible(on) {
      visible = !!on; node.style.display = visible ? '' : 'none';
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
      if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    get visible() { return visible; },
    destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; node.remove(); },
  };
}
