// Barlow Condensed (OFL, src/story/fonts) for hovedmenyen. Lastes én gang via FontFace-API-et.
const BASE = new URL('../story/fonts/', import.meta.url);
const FACES = [['ExtraBold', 800], ['SemiBold', 600], ['Medium', 500], ['Regular', 400]];
let ready = null;
export const FAMILY = 'Breach Barlow Condensed';
/** Laster alle vektene; løses alltid (feil gir bare reservefont). */
export function loadFonts() {
  if (ready) return ready;
  if (typeof FontFace === 'undefined' || !document.fonts) return (ready = Promise.resolve(false));
  ready = Promise.all(FACES.map(([n, w]) => {
    const f = new FontFace(FAMILY, `url(${new URL(`BarlowCondensed-${n}.ttf`, BASE)}) format("truetype")`, { weight: String(w), style: 'normal' });
    return f.load().then((ff) => { document.fonts.add(ff); return true; }).catch(() => false);
  })).then((r) => r.every(Boolean));
  return ready;
}
