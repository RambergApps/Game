// Menybakgrunn: meny-bakgrunn-base + meny-glow med additiv blanding ('lighter'), puls 0,55–1,0 (sinus ~2,7 s + litt støy),
// parallakse maks 8 px med musen (glo følger nøyaktig), aske (110 flak) og noen få gnister fra sprekkene nede til høyre.
// Reserve: meny-bakgrunn.webp alene (aldri med glo over – da dobbelteksponeres gløden).
const ASSETS = new URL('../../assets/menu/', import.meta.url);
const REF_W = 1920, REF_H = 1080, PAR = 8;

function loadImg(names) {
  return new Promise((res) => {
    const tryN = (i) => { if (i >= names.length) return res(null); const im = new Image(); im.decoding = 'async';
      im.onload = () => res(im); im.onerror = () => tryN(i + 1); im.src = new URL(names[i], ASSETS).href; };
    tryN(0);
  });
}

export function createBackground(canvas) {
  const ctx = canvas.getContext('2d');
  let base = null, glow = null, flat = null, W = 0, H = 0, dpr = 1, raf = 0, running = false, t0 = performance.now();
  let mx = 0, my = 0, px = 0, py = 0, boost = 0;  // boost: kort overeksponering ved PLAY
  const ash = [], sparks = [];
  const R = Math.random;
  const ready = Promise.all([loadImg(['meny-bakgrunn-base.webp', 'meny-bakgrunn-base.png']), loadImg(['meny-glow.webp', 'meny-glow.png'])]).then(async ([b, g]) => {
    if (b && g) { base = b; glow = g; } else flat = await loadImg(['meny-bakgrunn.webp', 'meny-bakgrunn.png']);
    return !!(base || flat);
  });

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(canvas.clientWidth * dpr)); H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (!ash.length) for (let i = 0; i < 110; i++) ash.push(newAsh(true));
  }
  function newAsh(any) { return { x: R(), y: any ? R() : -0.02, s: 1 + R() * 2, a: 0.3 + R() * 0.4, vy: 0.012 + R() * 0.02, vx: 0.004 + R() * 0.01, ph: R() * 6.28 }; }
  function newSpark() { return { x: 0.55 + R() * 0.4, y: 0.72 + R() * 0.22, vy: -(0.03 + R() * 0.05), vx: (R() - 0.3) * 0.015, life: 0, max: 1.5 + R() * 2.5, s: 1 + R() * 1.4 }; }

  // Tilpasning: «cover» opp til 16:9. Bredere skjermer (ultrabred) skaleres etter HØYDEN og forankres til høyre, så
  // tårntoppen aldri kuttes; gapet til venstre fylles med bildets venstre kantkolonne strukket ut (samme mørke farge).
  // Smalere skjermer: venstre del kuttes først (tårnet og Warden beholdes). Ingen zoom utover cover + parallaksemarg.
  function fit() {
    const m = PAR * 2 * dpr, wide = W / H > REF_W / REF_H + 0.01;
    const s = wide ? (H + m) / REF_H : Math.max((W + m) / REF_W, (H + m) / REF_H);
    const dw = REF_W * s, dh = REF_H * s;
    const ox = wide ? W - dw + PAR * dpr : Math.min(0, (W - dw) * 0.75), oy = (H - dh) * 0.6;
    return { s, dw, dh, ox, oy, wide };
  }
  function drawLayer(img, f, ox, oy) {
    ctx.drawImage(img, ox, oy, f.dw, f.dh);
    if (f.wide && ox > 0) ctx.drawImage(img, 0, 0, 3, REF_H, 0, oy, ox + 1, f.dh);   // kantkolonnen strukket over gapet
  }
  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (canvas.clientWidth * dpr !== W || canvas.clientHeight * dpr !== H) resize();
    const t = (now - t0) / 1000;
    px += (mx - px) * Math.min(1, dt * 3); py += (my - py) * Math.min(1, dt * 3);
    const f = fit(), ox = f.ox - px * PAR * dpr, oy = f.oy - py * PAR * dpr;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, W, H);
    if (base) {
      drawLayer(base, f, ox, oy);
      const n = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 4.3 + 1) * 0.3;               // litt «støy»
      let a = 0.775 + 0.225 * Math.sin((t / 2.7) * Math.PI * 2) + n * 0.03;
      a = Math.max(0.55, Math.min(1, a)) + boost;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, a); drawLayer(glow, f, ox, oy);
      if (a > 1) { ctx.globalAlpha = Math.min(1, a - 1); drawLayer(glow, f, ox, oy); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (flat) drawLayer(flat, f, ox, oy);
    boost = Math.max(0, boost - dt * 1.2);
    // aske
    ctx.fillStyle = '#9a958d';
    for (const p of ash) {
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * 0.7 + p.ph) * 0.004) * dt;
      if (p.y > 1.02 || p.x > 1.02) Object.assign(p, newAsh(false), { x: R() * 1.1 - 0.1 });
      ctx.globalAlpha = p.a; ctx.fillRect(p.x * W, p.y * H, p.s * dpr, p.s * dpr);
    }
    // gnister fra sprekkene (nedre høyre kvadrant)
    if (sparks.length < 14 && R() < dt * 5) sparks.push(newSpark());
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.life += dt; if (s.life > s.max) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; const k = s.life / s.max;
      ctx.globalAlpha = (k < 0.15 ? k / 0.15 : 1 - k) * 0.9; ctx.fillStyle = k < 0.4 ? '#ffd27a' : '#ff7a1a';
      ctx.fillRect(s.x * W, s.y * H, s.s * dpr, s.s * dpr * 1.6);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  const onMove = (e) => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; };
  return {
    ready,
    /** Glo-pulsen (0..1) for logoens glødkant, så de går i takt. */
    pulse() { const t = (performance.now() - t0) / 1000; return 0.5 + 0.5 * Math.sin((t / 2.7) * Math.PI * 2); },
    flare(v = 0.6) { boost = v; },
    start() { if (running) return; running = true; resize(); last = performance.now(); addEventListener('pointermove', onMove); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); removeEventListener('pointermove', onMove); },
  };
}
