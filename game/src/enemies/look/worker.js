// Baker-worker (modul-worker): baker Cinderborn-sprites utenfor hovedtråden og sender ImageBitmaps tilbake.
// Hovedtråden legger dem i Karakters sharedCache med cache.warm(key, () => spr) – null bakekostnad i spillbildet.
import { bakeKey } from './bakeone.js';
const bm = (c) => (c && c.transferToImageBitmap ? c.transferToImageBitmap() : c);
self.onmessage = (e) => {
  const { id, type, set, dir, i } = e.data;
  try {
    const t0 = performance.now(), s = bakeKey(type, set, dir, i), ms = performance.now() - t0;
    const out = { ...s, body: bm(s.body), glow: bm(s.glow), shadow: bm(s.shadow) };
    self.postMessage({ id, spr: out, ms }, [out.body, out.glow, out.shadow].filter(Boolean));
  } catch (err) { self.postMessage({ id, err: String(err && err.message || err) }); }
};
