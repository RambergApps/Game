// Logo «BREACH» i skrapet stål med oransje glo-kant og én sprekk gjennom E (docs/MENY-STIL.md).
// Tegnes én gang til to lerreter: stål (fyll + skygge + sprekk) og glød (pulserer separat via opasitet).
import { FAMILY } from './fonts.js';

const TEXT = 'BREACH';
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/**
 * @param {number} px  fontstørrelse i lerretspiksler (250 ved 1920-skala × oppløsning)
 * @returns {{ steel: HTMLCanvasElement, glow: HTMLCanvasElement, crack: HTMLCanvasElement, w: number, h: number, pad: number }}
 */
export function renderLogo(px) {
  const R = rng(1977), font = `800 ${px}px "${FAMILY}", "Arial Narrow", sans-serif`, sp = px * 0.05;
  const probe = mk(4, 4).getContext('2d'); probe.font = font; if ('letterSpacing' in probe) probe.letterSpacing = `${sp}px`;
  const m = probe.measureText(TEXT);
  const pad = Math.ceil(px * 0.22), tw = Math.ceil(m.width), asc = Math.ceil(m.actualBoundingBoxAscent || px * 0.72), desc = Math.ceil(m.actualBoundingBoxDescent || 0);
  const W = tw + pad * 2, H = asc + desc + pad * 2, bx = pad, by = pad + asc;
  const setFont = (x) => { x.font = font; if ('letterSpacing' in x) x.letterSpacing = `${sp}px`; x.textBaseline = 'alphabetic'; };

  // 1) maske: bare bokstavene
  const mask = mk(W, H), mx = mask.getContext('2d'); setFont(mx); mx.fillStyle = '#fff'; mx.fillText(TEXT, bx, by);

  // 2) stålfyll: vertikal gradient + horisontal børstet støy + få tynne riper, klippet til bokstavene
  const fill = mk(W, H), fx = fill.getContext('2d');
  const g = fx.createLinearGradient(0, by - asc, 0, by + desc);
  g.addColorStop(0, '#dcd8d0'); g.addColorStop(0.42, '#aeaaa3'); g.addColorStop(0.5, '#8c8983'); g.addColorStop(0.62, '#9a968f'); g.addColorStop(1, '#4a4846');
  fx.fillStyle = g; fx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 1) {                       // børstet: korte horisontale strøk med varierende lyshet
    for (let k = 0; k < 3; k++) {
      const x0 = R() * W, len = W * (0.1 + R() * 0.45), a = 0.04 + R() * 0.08;
      fx.fillStyle = R() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; fx.fillRect(x0, y, len, 1);
    }
  }
  fx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {                          // riper: tynne, mørke, litt skrå
    const x0 = bx + R() * tw, y0 = by - asc + R() * (asc + desc), l = px * (0.08 + R() * 0.35), a = (R() - 0.5) * 0.5;
    fx.strokeStyle = `rgba(30,28,26,${0.25 + R() * 0.3})`; fx.lineWidth = Math.max(1, px / 260);
    fx.beginPath(); fx.moveTo(x0, y0); fx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); fx.stroke();
    fx.strokeStyle = 'rgba(255,250,240,0.18)'; fx.beginPath(); fx.moveTo(x0, y0 + 1); fx.lineTo(x0 + Math.cos(a) * l, y0 + 1 + Math.sin(a) * l); fx.stroke();
  }
  // avskalling på høyre kant av H: små mørke hakk
  const hEnd = bx + tw;
  for (let i = 0; i < 7; i++) { fx.fillStyle = 'rgba(25,23,22,0.85)'; const y = by - asc + R() * (asc + desc), s = px * (0.01 + R() * 0.025); fx.beginPath(); fx.moveTo(hEnd + 2, y); fx.lineTo(hEnd - s * 1.6, y + s * 0.4); fx.lineTo(hEnd + 2, y + s * 1.3); fx.fill(); }
  // skrå kant: lys topplinje og mørk bunnlinje inne i bokstavene (gir tykkelse)
  fx.globalCompositeOperation = 'destination-in'; fx.drawImage(mask, 0, 0); fx.globalCompositeOperation = 'source-over';
  const edge = mk(W, H), ex = edge.getContext('2d');
  ex.drawImage(mask, 0, 2); ex.globalCompositeOperation = 'source-out'; ex.drawImage(mask, 0, 0);       // nedre kant av hver form
  ex.globalCompositeOperation = 'source-in'; ex.fillStyle = 'rgba(20,18,17,0.7)'; ex.fillRect(0, 0, W, H);

  // 3) sprekk gjennom E (andre bokstav etter B, R): finn E sin x-posisjon
  probe.font = font; const xE = bx + probe.measureText('BR').width + sp * 2, wE = probe.measureText('E').width;
  const crack = mk(W, H), cx = crack.getContext('2d');
  // sprekken går gjennom E-stammen (sammenhengende innenfor bokstaven), sikksakk innenfor stammebredden
  const stem = xE + wE * 0.16, amp = wE * 0.07;
  const pts = []; let y = by - asc - px * 0.02, x = stem;
  while (y < by + desc + px * 0.02) { pts.push([x, y]); y += px * (0.04 + R() * 0.05); x = stem + (R() - 0.5) * 2 * amp; }
  pts.push([stem + (R() - 0.5) * amp, by + desc + px * 0.03]);
  const path = () => { cx.beginPath(); pts.forEach(([a, b], i) => (i ? cx.lineTo(a, b) : cx.moveTo(a, b))); };
  cx.lineJoin = 'miter'; cx.lineCap = 'butt';
  path(); cx.strokeStyle = 'rgba(40,12,2,0.9)'; cx.lineWidth = px * 0.024; cx.stroke();
  path(); cx.strokeStyle = '#ffaa46'; cx.lineWidth = px * 0.012; cx.stroke();
  path(); cx.strokeStyle = '#ffea9c'; cx.lineWidth = px * 0.005; cx.stroke();
  // en liten gren
  const k = Math.floor(pts.length * 0.5), [ax, ay] = pts[k];
  cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(ax + wE * 0.22, ay + px * 0.02); cx.lineTo(ax + wE * 0.38, ay - px * 0.01);
  cx.strokeStyle = '#ffaa46'; cx.lineWidth = px * 0.008; cx.stroke();
  cx.globalCompositeOperation = 'destination-in'; cx.drawImage(mask, 0, 0);

  // 4) stål-lag: mørk skygge (6, 8) blur 6, så fyll, kant, sprekk
  const steel = mk(W, H), sx = steel.getContext('2d'), u = px / 250;
  sx.save(); sx.shadowColor = 'rgba(0,0,0,.8)'; sx.shadowBlur = 6 * u; sx.shadowOffsetX = 6 * u; sx.shadowOffsetY = 8 * u; sx.drawImage(mask, 0, 0); sx.restore();
  // skyggen ble tegnet sammen med en hvit maske – fyllet dekker masken (samme form), så bare skyggen står igjen utenfor
  sx.drawImage(fill, 0, 0); sx.drawImage(edge, 0, 0); sx.drawImage(crack, 0, 0);

  // 5) glød-lag: ytre glød #ff7a1a, blur 18, bare utenfor bokstavene
  const glow = mk(W, H), gx = glow.getContext('2d');
  gx.save(); gx.shadowColor = '#ff7a1a'; gx.shadowBlur = 18 * u; gx.drawImage(mask, 0, 0); gx.drawImage(mask, 0, 0); gx.restore();
  gx.globalCompositeOperation = 'destination-out'; gx.drawImage(mask, 0, 0);
  // sprekkens egen glød (til opp-blussing ved PLAY)
  const cg = mk(W, H), cgx = cg.getContext('2d'); cgx.filter = `blur(${6 * u}px)`; cgx.drawImage(crack, 0, 0); cgx.drawImage(crack, 0, 0);
  return { steel, glow, crack: cg, w: W, h: H, pad };
}
