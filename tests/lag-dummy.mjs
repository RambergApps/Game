#!/usr/bin/env node
// Lager en midlertidig dummy-side i /tmp/breach-dummy (aldri i game/) for å verifisere testriggen.
// index.html: ren side (skal gi 0 feil). src/enemies/test.html: med bevisste feil (konsollfeil, unntak, 404).
import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2] || '/tmp/breach-dummy';
fs.mkdirSync(path.join(root, 'src', 'enemies'), { recursive: true });
const game = `
const c = document.getElementById('c'), ctx = c.getContext('2d');
const keys = {}, mouse = { x: 640, y: 360, left: false };
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') world.player.inCover = !world.player.inCover;
  if (e.code === 'Space' && !world.player.roll) { world.player.roll = 0.35; world.events.emit('roll'); } });
addEventListener('keyup', e => keys[e.code] = false);
c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
c.addEventListener('mousedown', e => { if (world.paused) { world.paused = false; return; } if (e.button === 0) mouse.left = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; });
const handlers = {};
window.world = { time: 0, player: { x: 640, y: 360, hp: 100, angle: 0, inCover: false, roll: 0, cd: 0 },
  enemies: [{ type: 'grunt', x: 1000, y: 200, hp: 50 }, { type: 'heavy', x: 300, y: 150, hp: 200 }],
  cover: [{ x: 560, y: 420, w: 160, h: 32, type: 'low' }, { x: 900, y: 300, w: 32, h: 160, type: 'high' }],
  projectiles: [], effects: [], level: { id: 'dummy' }, paused: true,
  events: { emit(n, d) { (handlers[n] || []).forEach(f => f(d)); }, on(n, f) { (handlers[n] ||= []).push(f); } } };
function update(dt) {
  if (world.paused) return;
  const p = world.player; world.time += dt;
  const sp = (p.roll > 0 ? 520 : p.inCover ? 0 : 200) * dt;
  if (keys.KeyW) p.y -= sp; if (keys.KeyS) p.y += sp; if (keys.KeyA) p.x -= sp; if (keys.KeyD) p.x += sp;
  p.roll = Math.max(0, p.roll - dt);
  p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  p.cd -= dt;
  if (mouse.left && p.cd <= 0) { p.cd = 0.1; world.projectiles.push({ x: p.x, y: p.y, a: p.angle, t: 1 }); world.events.emit('shot'); }
  for (const b of world.projectiles) { b.x += Math.cos(b.a) * 900 * dt; b.y += Math.sin(b.a) * 900 * dt; b.t -= dt; }
  world.projectiles = world.projectiles.filter(b => b.t > 0);
}
function draw() {
  const p = world.player;
  ctx.fillStyle = '#2b2e31'; ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 1280; i += 32) { ctx.fillStyle = '#3d4246'; ctx.fillRect(i, 0, 1, 720); }
  for (const k of world.cover) { ctx.fillStyle = k.type === 'high' ? '#3d4246' : '#5a6068'; ctx.fillRect(k.x, k.y, k.w, k.h); }
  for (const e of world.enemies) { ctx.fillStyle = e.type === 'heavy' ? '#ff7a1a' : '#c0392b'; ctx.beginPath(); ctx.arc(e.x, e.y, 15, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffb347'; for (const b of world.projectiles) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  ctx.strokeStyle = '#39c6ff'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 40, p.y + Math.sin(p.angle) * 40); ctx.stroke();
  ctx.fillStyle = p.inCover ? '#39c6ff' : p.roll > 0 ? '#c9a227' : '#5a6068'; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fill();
  ctx.fillStyle = '#ddd'; ctx.font = '14px monospace'; ctx.fillText('DUMMY  x=' + p.x.toFixed(0) + ' y=' + p.y.toFixed(0) + ' dekning=' + p.inCover + ' kuler=' + world.projectiles.length, 10, 20);
}
let acc = 0, last = performance.now();
function frame(t) { acc += Math.min(0.25, (t - last) / 1000); last = t; while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; } draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
`;
const html = (extra = '') => `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Dummy</title>
<style>html,body{margin:0;background:#111;overflow:hidden}canvas{display:block}</style></head>
<body><canvas id="c" width="1280" height="720"></canvas><script type="module" src="${extra ? '../../game.js' : './game.js'}"></script>${extra}</body></html>`;
fs.writeFileSync(path.join(root, 'game.js'), game);
fs.writeFileSync(path.join(root, 'index.html'), html());
fs.writeFileSync(path.join(root, 'src', 'enemies', 'test.html'), html(`
<script type="module" src="./mangler.js"></script>
<img src="../../assets/finnes-ikke.png" style="display:none">
<script>console.error('Bevisst konsollfeil fra dummy'); setTimeout(() => { throw new Error('Bevisst uhåndtert unntak fra dummy'); }, 500);</script>`));
// Side som lukker seg selv (window.close) etter 4 s – riggen skal rapportere FEIL med årsak og fortsette
fs.mkdirSync(path.join(root, 'src', 'story'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'story', 'test.html'), html(`<script>setTimeout(() => window.close(), 4000);</script>`));
// Side som henger (uendelig løkke) etter 4 s – riggen skal gi tidsavbrudd og fortsette
fs.mkdirSync(path.join(root, 'src', 'levels'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'levels', 'test.html'), html(`<script>setTimeout(() => { for (;;) {} }, 4000);</script>`));
console.log('Dummy laget i ' + root);
