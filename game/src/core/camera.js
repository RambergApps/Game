// Kamera: (x,y) = verdenspunkt i skjermens senter.
import { createRng } from './world.js';
import { PROJ } from '../shared/projection.js';
const shakeRng = createRng(9001);
// 27.10: standard zoom for følgekamera (ny vinkel 55°); ?zoom=N overstyrer. Legacy ?view=34 beholder 1,5.
export const DEFAULT_ZOOM = PROJ.zoom; // = PROJ.zoom: 2,25 (legacy 1,5), ?zoom=N overstyrer (shared/projection.js) // Warden ≈ 100 px høy ved 1280×720 (målbildet ≈ 106)
export function createCamera(canvas) {
  const cam = {
    x: 0, y: 0, zoom: DEFAULT_ZOOM, g: 1, fixed: !PROJ.legacy && (() => { try { return new URLSearchParams(location.search).get('camfollow') === '0'; } catch (e) { return false; } })(), // 27.10: følg er standard; ?camfollow=0 = fast, hele brettet // g = bakkens y-forkorting (PROJ.groundScaleY i view '34', 1 ovenfra)
    target: null, lerp: 6, lead: 0.30, leadMax: 160, leadMaxX: 160, leadMaxY: 160, // lead: 30 % av Warden–sikte, maks 160 verdens-px (radielt)
    shakeX: 0, shakeY: 0, shakeMax: 10, shakeScale: 1, _shakes: [],
    get width() { return canvas.width; }, get height() { return canvas.height; },
    worldToScreen(wx, wy) { return { x: (wx - cam.x - cam.shakeX) * cam.zoom + canvas.width / 2, y: (wy - cam.y - cam.shakeY) * cam.zoom * cam.g + canvas.height / 2 }; },
    screenToWorld(sx, sy) { return { x: (sx - canvas.width / 2) / cam.zoom + cam.x + cam.shakeX, y: (sy - canvas.height / 2) / (cam.zoom * cam.g) + cam.y + cam.shakeY }; },
    /** ÉN eier for kamerarist. amount i px (verden), duration i ms. Aktive rister summeres (lineært fallende),
     *  summen kappes til cam.shakeMax (10 px). cam.shakeScale (0..1) = global innstilling (tilgjengelighet). */
    shake(amount, duration = 120) {
      if (!(amount > 0) || !(duration > 0)) return;
      if (cam._shakes.length >= 16) cam._shakes.shift();
      cam._shakes.push({ i: amount, t: duration / 1000, dur: duration / 1000 });
    },
    /** Nåværende ristamplitude i px (kappet sum). */
    shakeAmount() { let a = 0; for (const s of cam._shakes) a += s.i * Math.max(0, s.t / s.dur); return Math.min(cam.shakeMax, a) * cam.shakeScale; },
    follow(entity) { cam.target = entity; },
    update(dt, world) {
      cam.g = world && world.view === '34' ? PROJ.groundScaleY : 1;
      const t = cam.target, b0 = world && world.bounds;
      // 27.10: fast kamera høyt over brettet (ny standardvinkel). Hele brettet passes inn; ingen følging/lead. ?camfollow=1 slår av.
      if (cam.fixed && world && world.view === '34' && b0 && cam.width) {
        const bw = b0.w ?? b0.width, bh = b0.h ?? b0.height;
        cam.zoom = Math.min(cam.width / (bw - 48), cam.height / ((bh - 24) * cam.g));
        cam.x = b0.x + bw / 2; cam.y = b0.y + bh / 2 + 6;
      } else if (t) {
        let tx = t.x, ty = t.y; const m = world.input?.mouse;
        // lead mot siktepunktet: i 34 tolkes musa i brysthøyde (PROJ.aimGround, +20 worldY), ovenfra rå mus
        if (m) { const cl = (v, a) => Math.max(-a, Math.min(a, v)), my = world.view === '34' ? PROJ.aimGround(m.worldX, m.worldY).y : m.worldY;
          let lx = cl((m.worldX - t.x) * cam.lead, cam.leadMaxX), ly = cl((my - t.y) * cam.lead, cam.leadMaxY); const ll = Math.hypot(lx, ly);
          if (ll > cam.leadMax) { lx *= cam.leadMax / ll; ly *= cam.leadMax / ll; } tx += lx; ty += ly; }
        const k = 1 - Math.exp(-cam.lerp * dt); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
        const b = world.bounds;
        if (b && cam.width) { const hw = cam.width / 2 / cam.zoom, hh = cam.height / 2 / (cam.zoom * cam.g);
          cam.x = (b.w ?? b.width) <= hw * 2 ? b.x + (b.w ?? b.width) / 2 : Math.max(b.x + hw, Math.min(b.x + (b.w ?? b.width) - hw, cam.x));
          cam.y = (b.h ?? b.height) <= hh * 2 ? b.y + (b.h ?? b.height) / 2 : Math.max(b.y + hh, Math.min(b.y + (b.h ?? b.height) - hh + (cam.padBottom ?? 110) / (cam.zoom * cam.g), cam.y)); } // padBottom: sørkanten kan løftes over HUD-panelet (Yard v2, 27.10)
      }
      // rist: egen kosmetisk rng (ikke world.rng → påvirker ikke simuleringens determinisme). dt er ekte tid (rister også under hitstop).
      for (const s of cam._shakes) s.t -= dt; cam._shakes = cam._shakes.filter((s) => s.t > 0);
      const a = cam._shakes.length ? cam.shakeAmount() : 0;
      if (a > 0) { cam.shakeX = (shakeRng() * 2 - 1) * a; cam.shakeY = (shakeRng() * 2 - 1) * a; } else cam.shakeX = cam.shakeY = 0;
    },
    /** Sett ctx-transform til verdenskoordinater. */
    apply(ctx) { ctx.setTransform(cam.zoom, 0, 0, cam.zoom * cam.g, canvas.width / 2 - (cam.x + cam.shakeX) * cam.zoom, canvas.height / 2 - (cam.y + cam.shakeY) * cam.zoom * cam.g); },
  };
  return cam;
}
