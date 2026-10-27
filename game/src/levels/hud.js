// BREACH – nivå-HUD: mål, bølgeindikator, bølgebanner, nedtelling, kjernesone, spawnvarsler.
// Tegnes i skjermkoordinater fra level.drawHud(ctx, world, camera).
import { BUILD } from './build.js';
import { C, font, rgba, clamp, ease, spaced, spacedWidth, platePath, hazard } from './ui-kit.js';

const now = () => performance.now() / 1000;
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function drawHud(ctx, world, camera, D) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const u = clamp(Math.min(W / 1600, H / 900), 0.62, 1.5);
  ctx.save(); ctx.textBaseline = 'alphabetic';
  if (D.zone && camera) drawZone(ctx, world, camera, D, u);
  if (camera) drawPings(ctx, camera, D, u);
  if (D.phase !== 'done') drawObjective(ctx, D, u);
  if (D.hold) drawHold(ctx, D, u, W);
  else if (D.phase === 'break' && D.breakLeft > 0 && !D.banner) drawBreak(ctx, D, u, W);
  if (D.boss && D.phase === 'wave') drawBoss(ctx, D.boss, u, W);
  if (D.banner) drawBanner(ctx, D.banner, u, W, H);
  if (!world.modules?.player?.drawHud && world.player) drawHp(ctx, world.player, u, H);
  if (D.phase === 'done') drawDone(ctx, D, u, W, H);
  drawBuild(ctx, u, W, H);
  ctx.restore();
}

function drawObjective(ctx, D, u) {
  const L = D.level; if (!L) return;
  const x = 28 * u, y = 34 * u;
  // mørk bakplate så teksten leses mot lyse arenaer
  const sg = ctx.createLinearGradient(0, 0, 460 * u, 0);
  sg.addColorStop(0, 'rgba(8,9,11,0.78)'); sg.addColorStop(0.7, 'rgba(8,9,11,0.55)'); sg.addColorStop(1, 'rgba(8,9,11,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, 460 * u, y + 82 * u);
  // tittel
  ctx.font = font(13 * u, 600); ctx.fillStyle = rgba(C.visor, 0.9);
  const tag = `${String(L.n).padStart(2, '0')}  //  ${L.name.toUpperCase()}`;
  spaced(ctx, tag, x, y, 3.5 * u);
  // mål
  ctx.font = font(19 * u, 400); ctx.fillStyle = 'rgba(232,226,212,0.86)';
  ctx.textAlign = 'left'; ctx.fillText(L.objective, x, y + 25 * u);
  // bølge-segmenter
  const n = L.waves.length, sw = 30 * u, sh = 6 * u, gy = y + 42 * u;
  for (let i = 0; i < n; i++) {
    const sx = x + i * (sw + 5 * u);
    const done = i < D.wi || (i === D.wi && D.phase !== 'wave' && D.waveDone);
    const cur = i === D.wi && D.phase === 'wave';
    ctx.fillStyle = done ? 'rgba(200,205,210,0.55)' : cur ? C.light : 'rgba(255,255,255,0.1)';
    platePath(ctx, sx, gy, sw, sh, [3 * u, 0, 3 * u, 0]); ctx.fill();
    if (cur) halo(ctx, C.light, 7 * u, 0.32);
  }
  // bølgetekst + fiender igjen
  const w = L.waves[D.wi];
  if (w) {
    ctx.font = font(14 * u, 600); ctx.fillStyle = 'rgba(200,205,210,0.8)';
    const t = `WAVE ${D.wi + 1}/${n}  ·  ${w.name.toUpperCase()}`;
    const tw = spaced(ctx, t, x, gy + 28 * u, 2 * u) || spacedWidth(ctx, t, 2 * u);
    if (D.phase === 'wave' && D.remaining > 0) {
      const ex = x + tw + 18 * u;
      ctx.fillStyle = C.grunt;
      ctx.beginPath(); ctx.arc(ex, gy + 23 * u, 3.2 * u, 0, Math.PI * 2); ctx.fill(); halo(ctx, C.grunt, 5 * u, 0.35);
      ctx.fillStyle = 'rgba(230,140,130,0.9)'; spaced(ctx, `${D.remaining}`, ex + 10 * u, gy + 28 * u, 1 * u);
    }
  }
}

function drawBanner(ctx, b, u, W, H) {
  const t = now() - b.t0, dur = b.dur;
  if (t > dur) return;
  const a = clamp(t / 0.25, 0, 1) * clamp((dur - t) / 0.5, 0, 1);
  const slide = ease(t / 0.45);
  const bw = Math.min(W * 0.9, 760 * u), bh = (b.sub ? 108 : 80) * u;
  const top = H * 0.12 - bh / 2, bx = W / 2 - bw / 2, cy = top + bh / 2;
  ctx.save(); ctx.globalAlpha = a;
  // mørkt bånd som tones ut i kantene
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  g.addColorStop(0, 'rgba(10,11,12,0)'); g.addColorStop(0.18, 'rgba(10,11,12,0.8)');
  g.addColorStop(0.82, 'rgba(10,11,12,0.8)'); g.addColorStop(1, 'rgba(10,11,12,0)');
  ctx.fillStyle = g; ctx.fillRect(bx, top, bw, bh);
  const col = b.col || C.light;
  // linjer som vokser ut fra midten
  const lw = bw * 0.62 * slide, sw = Math.min(lw, 120 * u);
  ctx.fillStyle = rgba(col, 0.85);
  ctx.fillRect(W / 2 - lw / 2, top, lw, 2 * u); ctx.fillRect(W / 2 - lw / 2, top + bh - 2 * u, lw, 2 * u);
  if (b.stripes) { hazard(ctx, W / 2 - lw / 2, top - 7 * u, sw, 5 * u, 0.9, 6 * u); hazard(ctx, W / 2 + lw / 2 - sw, top + bh + 2 * u, sw, 5 * u, 0.9, 6 * u); }
  // tekst: kicker – tittel – undertekst, stablet uten overlapp
  ctx.fillStyle = rgba(col, 0.95); ctx.font = font(13 * u, 600);
  if (b.kicker) spaced(ctx, b.kicker, W / 2, top + 24 * u, 5 * u, 'center');
  ctx.fillStyle = C.ink; ctx.font = font(38 * u, 600);
  ctx.save(); titleGlow(ctx, W / 2, top + 50 * u, spacedWidth(ctx, b.title, 6 * u) * 0.62, 26 * u, rgba(col, 0.22));
  spaced(ctx, b.title, W / 2, top + 62 * u + (1 - slide) * 6 * u, (6 + (1 - slide) * 10) * u, 'center');
  ctx.restore();
  if (b.sub) { ctx.fillStyle = 'rgba(214,210,200,0.75)'; ctx.font = font(17 * u, 400); ctx.textAlign = 'center'; ctx.fillText(b.sub, W / 2, top + 90 * u); }
  ctx.restore();
}

function drawBreak(ctx, D, u, W) {
  const s = Math.ceil(D.breakLeft), y = 54 * u;
  ctx.font = font(13 * u, 600); ctx.fillStyle = 'rgba(200,205,210,0.7)';
  spaced(ctx, D.wi < 0 ? 'GET READY' : D.retry ? 'REGROUP' : 'NEXT WAVE', W / 2, y, 4 * u, 'center');
  ctx.font = font(44 * u, 600); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
  ctx.save(); ctx.translate(W / 2, y + 46 * u);
  ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(C.light, 0.12); ctx.lineWidth = 10 * u; ctx.strokeText(String(s), 0, 0);
  ctx.fillText(String(s), 0, 0); ctx.restore();
  const f = clamp(D.breakLeft - Math.floor(D.breakLeft), 0, 1), bw = 64 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(W / 2 - bw / 2, y + 60 * u, bw, 2 * u);
  ctx.fillStyle = rgba(C.light, 0.8); ctx.fillRect(W / 2 - bw / 2, y + 60 * u, bw * f, 2 * u);
}

function drawHold(ctx, D, u, W) {
  const h = D.hold, left = Math.max(0, h.need - h.t), frac = clamp(h.t / h.need, 0, 1);
  const pw = 360 * u, ph = 84 * u, x = W / 2 - pw / 2, y = 20 * u;
  const inZ = h.inZone, col = inZ ? C.visor : C.red;
  ctx.fillStyle = 'rgba(12,13,15,0.78)'; platePath(ctx, x, y, pw, ph, [12 * u, 0, 12 * u, 0]); ctx.fill();
  ctx.strokeStyle = rgba(col, inZ ? 0.55 : 0.4 + 0.4 * (Math.sin(now() * 8) * 0.5 + 0.5)); ctx.lineWidth = 1.2 * u;
  platePath(ctx, x + 0.5, y + 0.5, pw - 1, ph - 1, [12 * u, 0, 12 * u, 0]); ctx.stroke();
  hazard(ctx, x + 12 * u, y, 90 * u, 4 * u, 0.9, 5 * u);
  ctx.font = font(13 * u, 600); ctx.fillStyle = rgba(C.light, 0.95);
  spaced(ctx, 'HOLD THE CORE', x + 18 * u, y + 26 * u, 4 * u);
  ctx.fillStyle = rgba(col, 0.95);
  spaced(ctx, inZ ? 'IN ZONE' : 'OUTSIDE — CLOCK STOPPED', x + pw - 18 * u, y + 26 * u, 2.5 * u, 'right');
  ctx.font = font(36 * u, 600); ctx.fillStyle = C.ink; ctx.textAlign = 'left';
  ctx.fillText(mmss(left), x + 18 * u, y + 64 * u);
  // fremdriftsstolpe
  const bx = x + 108 * u, bw = pw - 126 * u, by = y + 50 * u, bh = 10 * u;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, bh);
  const segs = 25, sg = bw / segs;
  for (let i = 0; i < segs * frac; i++) { ctx.fillStyle = rgba(C.light, 0.55 + 0.45 * (i / segs)); ctx.fillRect(bx + i * sg + 1, by + 1, sg - 2, bh - 2); }
}

function drawZone(ctx, world, cam, D, u) {
  const z = D.zone, s = cam.worldToScreen(z.x, z.y), r = z.r * (cam.zoom || 1);
  const W = ctx.canvas.width, H = ctx.canvas.height, t = now();
  const inZ = D.hold?.inZone;
  const col = inZ ? C.visor : C.light;
  ctx.save();
  const g = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r);
  g.addColorStop(0, rgba(col, 0.0)); g.addColorStop(0.8, rgba(col, 0.06)); g.addColorStop(1, rgba(col, 0.16));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 2 * u; ctx.setLineDash([14 * u, 9 * u]); ctx.lineDashOffset = -t * 18;
  ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  // pulsring
  const p = (t * 0.6) % 1; ctx.strokeStyle = rgba(col, 0.35 * (1 - p)); ctx.lineWidth = 1.5 * u;
  ctx.beginPath(); ctx.arc(s.x, s.y, r * (0.4 + p * 0.6), 0, Math.PI * 2); ctx.stroke();
  // hjørnemerker
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    ctx.save(); ctx.translate(s.x + Math.cos(a) * (r + 10 * u), s.y + Math.sin(a) * (r + 10 * u)); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = rgba(col, 0.9); ctx.beginPath(); ctx.moveTo(-8 * u, 0); ctx.lineTo(8 * u, 0); ctx.lineTo(0, 7 * u); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // pil i skjermkanten hvis sonen er utenfor bildet
  const m = 46 * u;
  if (s.x < -r || s.x > W + r || s.y < -r || s.y > H + r) edgeArrow(ctx, W / 2, H / 2, s.x, s.y, m, col, 'CORE', u);
  ctx.restore();
}

function drawPings(ctx, cam, D, u) {
  const W = ctx.canvas.width, H = ctx.canvas.height, t = now();
  for (const p of D.pings) {
    const age = t - p.t0; if (age > 2.2) continue;
    const s = cam.worldToScreen(p.x, p.y);
    const a = clamp(1 - age / 2.2, 0, 1) * (0.6 + 0.4 * Math.sin(age * 14));
    if (s.x > 0 && s.x < W && s.y > 0 && s.y < H) continue;
    ctx.save(); ctx.globalAlpha = a; edgeArrow(ctx, W / 2, H / 2, s.x, s.y, 30 * u, C.grunt, null, u * 0.8); ctx.restore();
  }
}

function edgeArrow(ctx, cx, cy, tx, ty, m, col, label, u) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const dx = tx - cx, dy = ty - cy, a = Math.atan2(dy, dx);
  const kx = (W / 2 - m) / Math.abs(dx || 1e-6), ky = (H / 2 - m) / Math.abs(dy || 1e-6), k = Math.min(kx, ky);
  const x = cx + dx * k, y = cy + dy * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(14 * u, 0); ctx.lineTo(-8 * u, -10 * u); ctx.lineTo(-3 * u, 0); ctx.lineTo(-8 * u, 10 * u); ctx.closePath(); ctx.fill(); halo(ctx, col, 6 * u, 0.3);
  ctx.restore();
  if (label) {
    ctx.font = font(12 * u, 600); ctx.fillStyle = rgba(col, 0.9);
    spaced(ctx, label, x - Math.cos(a) * 30 * u, y - Math.sin(a) * 30 * u + 4 * u, 3 * u, 'center');
  }
}

function drawHp(ctx, p, u, H) {
  const x = 28 * u, y = H - 40 * u, w = 230 * u, h = 10 * u;
  const bg = ctx.createLinearGradient(0, 0, 320 * u, 0);
  bg.addColorStop(0, 'rgba(8,9,11,0.7)'); bg.addColorStop(1, 'rgba(8,9,11,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, y - 34 * u, 320 * u, 60 * u);
  const frac = clamp(p.hp / (p.maxHp || 100), 0, 1);
  ctx.font = font(13 * u, 600); ctx.fillStyle = rgba(C.visor, 0.85);
  spaced(ctx, 'WARDEN', x, y - 10 * u, 4 * u);
  ctx.fillStyle = 'rgba(200,205,210,0.6)'; spaced(ctx, `${Math.ceil(Math.max(0, p.hp))}`, x + w, y - 10 * u, 1 * u, 'right');
  ctx.fillStyle = 'rgba(10,11,12,0.7)'; platePath(ctx, x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u, [4 * u, 0, 4 * u, 0]); ctx.fill();
  const segs = Math.round((p.maxHp || 100) / 10), sg = w / segs;
  const col = frac < 0.3 ? C.red : C.visor;
  for (let i = 0; i < segs; i++) {
    const f = clamp(frac * segs - i, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + i * sg + 1, y, sg - 2, h);
    if (f > 0) { ctx.fillStyle = rgba(col, 0.85); ctx.fillRect(x + i * sg + 1, y, (sg - 2) * f, h); }
  }
}

/** Enkel bosslinje øverst i midten (Ashmaw): navn, fase og hp. Effekter eier evt. pynt. */
function drawBoss(ctx, B, u, W) {
  const e = B.e; if (!e) return;
  const frac = e.maxHp > 0 ? clamp(Math.max(0, e.hp) / e.maxHp, 0, 1) : 1;
  const w = Math.min(560 * u, W * 0.5), h = 8 * u, x = (W - w) / 2, y = 52 * u;
  ctx.font = font(15 * u, 600); ctx.fillStyle = 'rgba(255,190,130,0.92)';
  spaced(ctx, String(B.name || 'BOSS').toUpperCase(), W / 2, y - 12 * u, 5 * u, 'center');
  ctx.fillStyle = 'rgba(10,11,12,0.75)'; platePath(ctx, x - 3 * u, y - 3 * u, w + 6 * u, h + 6 * u, [4 * u, 0, 4 * u, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x, y, w * frac, h); ctx.beginPath(); ctx.rect(x, y, w * frac, h); halo(ctx, '#ff7a1a', 6 * u, 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (const t of (B.phases || []).map((p) => p.at).filter((a) => a < 1)) ctx.fillRect(x + w * t - 1, y - 2 * u, 2, h + 4 * u);
  if (B.phaseName) { ctx.font = font(12 * u, 400); ctx.fillStyle = 'rgba(200,205,210,0.6)'; spaced(ctx, `PHASE ${B.phase}  ·  ${B.phaseName.toUpperCase()}`, W / 2, y + h + 18 * u, 2.5 * u, 'center'); }
}

let buildText = null;
function drawBuild(ctx, u, W, H) {
  if (!buildText) {
    let b = BUILD;
    if (!b && typeof document !== 'undefined') { const m = new Date(document.lastModified); if (!isNaN(m)) b = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')} ${String(m.getHours()).padStart(2, '0')}:${String(m.getMinutes()).padStart(2, '0')}`; }
    buildText = `BUILD ${b || '?'}`;
  }
  ctx.font = font(11 * u, 400); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(200,205,210,0.42)';
  ctx.fillText(buildText, W - 8 * u, H - 6 * u);
}

function drawDone(ctx, D, u, W, H) {
  const t = now() - D.doneT0, a = clamp(t / 1.2, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,9,11,0.82)'; ctx.fillRect(0, 0, W, H);
  ctx.font = font(14 * u, 600); ctx.fillStyle = rgba(C.visor, 0.85);
  spaced(ctx, 'GARRISON NINE  //  COLD DAWN', W / 2, H / 2 - 40 * u, 6 * u, 'center');
  ctx.font = font(54 * u, 600); ctx.fillStyle = C.ink;
  spaced(ctx, 'WELL SEALED', W / 2, H / 2 + 16 * u, 10 * u, 'center');
  ctx.font = font(14 * u, 400); ctx.fillStyle = 'rgba(200,205,210,0.6)';
  spaced(ctx, 'RELOAD TO PLAY AGAIN', W / 2, H / 2 + 56 * u, 3 * u, 'center');
  ctx.restore();
}

// Glød uten skyggeblur (Effekter/VFX): stryk gjeldende sti bredt og svakt to ganger.
function halo(ctx, col, w, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = w; ctx.stroke(); ctx.globalAlpha *= 0.45; ctx.lineWidth = w * 2.2; ctx.stroke(); ctx.restore();
}
// Flat, elliptisk glød bak en tekstlinje (erstatter skyggeblur på store titler).
function titleGlow(ctx, x, y, rx, ry, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / Math.max(1, rx));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
}
