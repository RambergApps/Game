// Breach – lyd: oppskrifter for lydeffekter. Lagdelt syntese:
// transient (filtrert støy) + kropp (lavfrekvent sinus/pitch-drop, mettet) + mekanikk/hale.
// Signatur: recipe(ac, out, send, t, o) → varighet i sekunder.
//   out  = tørr inngang for stemmen (går via pan/avstand til sfx-bussen)
//   send = ekstra romklang-send (for lag som skal «fylle hallen»)
import { rand, pick, chance, noiseLayer as N, toneLayer as T, metalLayer as M, clickLayer as C } from './synth.js';
import { RADIO_SOUNDS } from './radio.js';
import { MECH_SOUNDS } from './mech.js';
import { STINGER_SOUNDS } from './stingers.js';
import { CINDER_SOUNDS } from './cinder.js';

// ---------- Våpen ----------

function rifle(ac, out, send, t, o) {
  const p = rand(0.94, 1.06), fv = rand(0.85, 1.15);
  // transient: munningssmell (bredbåndet «crack» + mellomtone-smell)
  N(ac, out, t, { type: 'highpass', f: 1500 * fv, q: 0.7, d: 0.035, peak: 1.0 });
  N(ac, out, t, { type: 'bandpass', f: 5500 * fv, q: 0.6, d: 0.022, peak: 0.6 });
  N(ac, out, t, { type: 'bandpass', f: 2600 * fv, f2: 900, q: 0.9, d: 0.07, peak: 0.7, drive: 2 });
  // kropp: tungt dunk med pitch-drop, mettet for overtoner
  T(ac, out, t, { f: 165 * p, f2: 46 * p, drop: 0.09, d: 0.22, peak: 1.0, drive: 2.4 });
  T(ac, out, t, { wave: 'triangle', f: 340 * p, f2: 120 * p, drop: 0.035, d: 0.07, peak: 0.45 });
  // trykkbølge / romslag
  N(ac, out, t + 0.004, { color: 'brown', type: 'lowpass', f: 1100 * fv, f2: 220, q: 0.8, d: 0.38, peak: 0.55 });
  N(ac, send, t, { color: 'pink', type: 'bandpass', f: 1400, q: 0.6, d: 0.12, peak: 0.6 });
  // mekanikk: sluttstykke sykler
  C(ac, out, t + rand(0.05, 0.065), { f: rand(4200, 5200), peak: 0.10, body: 0.4 });
  if (chance(0.5)) C(ac, out, t + rand(0.085, 0.1), { f: rand(2800, 3400), peak: 0.06, body: 0.6 });
  return 0.5;
}

function enemyRifle(ac, out, send, t, o) {
  // Fiendevåpen: mer mellomtone, rå og «surrende» energivåpen-karakter.
  const p = rand(0.93, 1.07), fv = rand(0.85, 1.15);
  N(ac, out, t, { type: 'bandpass', f: 1800 * fv, f2: 700, q: 1.4, d: 0.06, peak: 0.85, drive: 3 });
  N(ac, out, t, { type: 'highpass', f: 2500, q: 0.7, d: 0.03, peak: 0.75 });
  T(ac, out, t, { wave: 'sawtooth', f: 230 * p, f2: 72 * p, drop: 0.07, d: 0.14, peak: 0.42, lp: 1400, drive: 2 });
  T(ac, out, t, { f: 130 * p, f2: 52 * p, drop: 0.08, d: 0.17, peak: 0.75, drive: 2 });
  N(ac, out, t + 0.003, { color: 'brown', type: 'lowpass', f: 900, f2: 200, d: 0.28, peak: 0.4 });
  N(ac, send, t, { color: 'pink', type: 'bandpass', f: 1100, q: 0.7, d: 0.1, peak: 0.5 });
  // svak elektrisk «zap»-hale
  T(ac, out, t + 0.01, { wave: 'square', f: 900 * p, f2: 300, drop: 0.06, d: 0.06, peak: 0.05, lp: 2500 });
  return 0.4;
}

function heavy(ac, out, send, t, o) {
  // Heavy: dyp, tregere, kanon-aktig.
  const p = rand(0.95, 1.05), fv = rand(0.9, 1.1);
  N(ac, out, t, { type: 'lowpass', f: 3200 * fv, q: 0.7, d: 0.08, peak: 0.9, drive: 2.5 });
  N(ac, out, t, { type: 'highpass', f: 1500, q: 0.7, d: 0.03, peak: 0.45 });
  T(ac, out, t, { f: 105 * p, f2: 30 * p, drop: 0.16, d: 0.45, peak: 1.1, drive: 3 });
  T(ac, out, t, { wave: 'square', f: 62 * p, f2: 34 * p, drop: 0.12, d: 0.22, peak: 0.35, lp: 260 });
  T(ac, out, t + 0.008, { wave: 'triangle', f: 210 * p, f2: 70, drop: 0.05, d: 0.12, peak: 0.4 });
  N(ac, out, t + 0.01, { color: 'brown', type: 'lowpass', f: 700, f2: 120, d: 0.8, peak: 0.7 });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 1200, d: 0.3, peak: 0.9 });
  // tungt mekanisk «chunk»
  C(ac, out, t + rand(0.11, 0.14), { f: rand(1800, 2300), peak: 0.14, body: 1 });
  M(ac, out, t + 0.13, { f: rand(260, 320), d: 0.25, peak: 0.05 });
  return 0.95;
}


// Hjelper: StereoPanner-lag inne i en oppskrift (for bredde i smellet / ekko fra sidene).
function panned(ac, out, p) {
  if (!ac.createStereoPanner) return out;
  const sp = ac.createStereoPanner(); sp.pan.value = p; sp.connect(out); return sp;
}

// Hagle og presisjonsrifle: o.enemy = fiendevariant (tynnere og litt fjernere, som enemyRifle):
// mindre sub-kropp, mer rå mellomtone, mørkere transient, mer rom. Pumpe/bolt ligger IKKE her – se chamber*.
function shotgun(ac, out, send, t, o = {}) {
  // Hagle: bredt, kraftig smell, mye lav kropp, kort hale.
  const en = !!o.enemy, p = rand(0.95, 1.05) * (en ? 1.12 : 1), fv = rand(0.9, 1.1);
  const L = panned(ac, out, en ? -0.25 : -0.45), R = panned(ac, out, en ? 0.25 : 0.45);
  N(ac, out, t, { type: 'lowpass', f: (en ? 4200 : 7000) * fv, q: 0.5, d: 0.06, peak: en ? 0.8 : 1.0, drive: 3 });
  N(ac, L, t + 0.0015, { type: 'bandpass', f: 2200 * fv, q: 0.7, d: 0.05, peak: 0.6 });
  N(ac, R, t + 0.003, { type: 'bandpass', f: 3100 * fv, q: 0.7, d: 0.045, peak: 0.55 });
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: (en ? 1300 : 850) * fv, f2: en ? 450 : 240, q: en ? 1.3 : 0.8, d: 0.2, peak: 0.95, drive: en ? 3 : 2.2 });
  // kropp: dyp trykkbølge (fiende: grunnere og svakere)
  T(ac, out, t, { f: 125 * p, f2: 36 * p, drop: 0.12, d: en ? 0.2 : 0.3, peak: en ? 0.7 : 1.25, drive: 3 });
  if (!en) T(ac, out, t, { f: 72 * p, f2: 30 * p, drop: 0.15, d: 0.34, peak: 0.6 });
  T(ac, out, t, { wave: en ? 'sawtooth' : 'triangle', f: 270 * p, f2: 90 * p, drop: 0.04, d: 0.08, peak: en ? 0.35 : 0.5, lp: en ? 1600 : 0 });
  // kort hale
  N(ac, out, t + 0.005, { color: 'brown', type: 'lowpass', f: 700, f2: 150, d: 0.32, peak: en ? 0.4 : 0.6 });
  N(ac, send, t, { color: 'pink', type: 'bandpass', f: 900, q: 0.6, d: en ? 0.2 : 0.12, peak: en ? 0.75 : 0.55 });
  return 0.45;
}

function marksman(ac, out, send, t, o = {}) {
  // Presisjonsrifle: skarp supersonisk crack, kraftig kropp, lang romklang med diskrete ekko.
  const en = !!o.enemy, p = rand(0.97, 1.03) * (en ? 1.1 : 1), fv = rand(0.92, 1.08);
  N(ac, out, t, { type: 'highpass', f: 2200 * fv, q: 0.7, d: 0.022, peak: en ? 0.75 : 1.0 });           // crack
  N(ac, out, t, { type: 'bandpass', f: (en ? 5200 : 7500) * fv, q: 0.8, d: 0.016, peak: en ? 0.45 : 0.7 });
  N(ac, out, t, { type: 'bandpass', f: 4200 * fv, q: 0.9, d: 0.035, peak: 0.75, drive: 2 });
  N(ac, out, t + 0.001, { type: 'bandpass', f: (en ? 2100 : 1700) * fv, f2: en ? 800 : 550, q: en ? 1.4 : 0.9, d: 0.11, peak: 0.9, drive: 3 }); // munning
  T(ac, out, t, { f: 150 * p, f2: 40 * p, drop: 0.1, d: en ? 0.24 : 0.36, peak: en ? 0.65 : 1.15, drive: 2.6 });
  T(ac, out, t, { wave: en ? 'sawtooth' : 'triangle', f: 380 * p, f2: 130, drop: 0.03, d: 0.06, peak: en ? 0.3 : 0.4, lp: en ? 1800 : 0 });
  if (en) T(ac, out, t + 0.008, { wave: 'square', f: 1100 * p, f2: 380, drop: 0.07, d: 0.07, peak: 0.05, lp: 2600 }); // svak «zap» som enemyRifle
  // lang hale + stor send
  N(ac, out, t + 0.006, { color: 'brown', type: 'lowpass', f: 1600, f2: 180, d: 1.3, peak: en ? 0.3 : 0.42, sweep: 0.9 });
  N(ac, send, t, { color: 'pink', type: 'bandpass', f: 1300, q: 0.6, d: 0.35, peak: 1.0 });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 1200, d: 0.6, peak: 0.7 });
  // ekko fra fjerne vegger (stadig mørkere, vekselvis venstre/høyre)
  [[0.27, 0.26, 3000, -0.6], [0.58, 0.15, 2000, 0.55], [0.98, 0.08, 1300, -0.35], [1.42, 0.04, 900, 0.3]].forEach(([dt, g, f, pan]) => {
    const e = panned(ac, out, pan);
    N(ac, e, t + dt * rand(0.97, 1.03), { color: 'pink', type: 'lowpass', f, q: 0.7, d: 0.22, peak: g, drive: 1.5 });
    T(ac, e, t + dt, { f: 90, f2: 45, drop: 0.08, d: 0.2, peak: g * 0.9 });
  });
  return 1.75;
}

// ---------- Kammer ('chamber' {weapon,x,y,team}): pumpe / bolt / ladehåndtak ----------
// Hylsa kastes ut når pumpa/bolten går bakover, så hylsedryppet ligger her (ikke på shot).

function chamberShotgun(ac, out, send, t, o = {}) {
  // pumpe: tilbake (sleide + klakk + hylse) … fram (tyngre klakk)
  const pb = t + 0.02, pf = pb + rand(0.15, 0.19);
  N(ac, out, pb - 0.02, { type: 'bandpass', f: 1400, f2: 900, q: 1.6, a: 0.02, d: 0.07, peak: 0.16 });
  C(ac, out, pb, { f: 2700, peak: 0.18, body: 1 });
  T(ac, out, pb, { f: 190, f2: 110, drop: 0.03, d: 0.06, peak: 0.22 });
  N(ac, out, pf - 0.025, { type: 'bandpass', f: 1000, f2: 1600, q: 1.6, a: 0.02, d: 0.06, peak: 0.14 });
  C(ac, out, pf, { f: 2200, peak: 0.22, body: 1.0 });
  T(ac, out, pf, { f: 160, f2: 85, drop: 0.03, d: 0.08, peak: 0.32, drive: 1.5 });
  M(ac, out, pf, { f: rand(650, 800), ratios: [1, 2.4, 3.9], d: 0.12, peak: 0.08 });
  if (o.shell !== false) M(ac, panned(ac, out, rand(-0.6, 0.6)), pb + rand(0.3, 0.4), { f: rand(1700, 2100), ratios: [1, 2.1, 3.3], d: 0.08, peak: 0.05 });
  return 0.65;
}

function chamberMarksman(ac, out, send, t, o = {}) {
  // bolt: løft → tilbake → hylse → fram → lås
  const b = t + 0.01;
  C(ac, out, b, { f: 3300, peak: 0.2, body: 0.5 });
  N(ac, out, b + 0.03, { type: 'bandpass', f: 1900, f2: 1150, q: 1.8, a: 0.025, d: 0.09, peak: 0.16 });
  C(ac, out, b + 0.14, { f: 2900, peak: 0.18, body: 0.8 });
  if (o.shell !== false) M(ac, panned(ac, out, 0.5), b + 0.3, { f: rand(3000, 3600), ratios: [1, 2.3, 3.7], d: 0.18, peak: 0.06 }); // messinghylse
  N(ac, out, b + 0.34, { type: 'bandpass', f: 1150, f2: 1900, q: 1.8, a: 0.025, d: 0.07, peak: 0.15 });
  C(ac, out, b + 0.43, { f: 2300, peak: 0.24, body: 1.0 });
  T(ac, out, b + 0.43, { f: 170, f2: 90, drop: 0.03, d: 0.08, peak: 0.3, drive: 1.5 });
  M(ac, out, b + 0.43, { f: rand(900, 1100), ratios: [1, 2.7, 4.4], d: 0.14, peak: 0.08 });
  return 0.7;
}

function chamberRifle(ac, out, send, t, o = {}) {
  // ladehåndtak: kort fjærbelastet drag bakover … slipp → sluttstykket smeller fram
  const b = t + 0.01, f = b + rand(0.11, 0.14);
  N(ac, out, b, { type: 'bandpass', f: 2400, f2: 1300, q: 2, a: 0.01, d: 0.06, peak: 0.12 });
  C(ac, out, b + 0.005, { f: 3800, peak: 0.12, body: 0.4 });
  C(ac, out, f, { f: 2600, peak: 0.22, body: 0.9 });
  T(ac, out, f, { f: 210, f2: 120, drop: 0.025, d: 0.06, peak: 0.25, drive: 1.4 });
  M(ac, out, f, { f: rand(1100, 1300), ratios: [1, 2.6, 4.1], d: 0.1, peak: 0.06 });
  return 0.35;
}

// ---------- Granat / eksplosjon ----------

function grenadeThrow(ac, out, send, t, o) {
  C(ac, out, t, { f: 5200, peak: 0.12, body: 0.3 }); // splint ut
  M(ac, out, t + 0.02, { f: rand(2400, 2900), ratios: [1, 1.48, 2.3], d: 0.12, peak: 0.05 });
  N(ac, out, t + 0.08, { color: 'pink', type: 'bandpass', f: 500, f2: 1700, q: 1.6, a: 0.09, d: 0.18, peak: 0.25 });
  // første sprett
  const b = t + rand(0.42, 0.5);
  M(ac, out, b, { f: rand(1100, 1400), ratios: [1, 2.32, 3.81, 5.1], d: 0.18, peak: 0.16 });
  T(ac, out, b, { f: 180, f2: 90, drop: 0.03, d: 0.06, peak: 0.25 });
  M(ac, out, b + rand(0.16, 0.22), { f: rand(1100, 1400), ratios: [1, 2.32, 3.81], d: 0.1, peak: 0.07 });
  return 0.9;
}

function explosion(ac, out, send, t, o) {
  const p = rand(0.92, 1.08);
  // knall
  N(ac, out, t, { type: 'lowpass', f: 9000, q: 0.5, d: 0.09, peak: 1.0, drive: 3 });
  N(ac, out, t, { type: 'highpass', f: 2500, q: 0.6, d: 0.05, peak: 0.6 });
  N(ac, out, t, { type: 'bandpass', f: 1600, f2: 300, q: 0.7, d: 0.35, peak: 0.8, drive: 2 });
  // sub-boom
  T(ac, out, t, { f: 78 * p, f2: 26 * p, drop: 0.55, a: 0.003, d: 1.3, peak: 1.25, drive: 2.2 });
  T(ac, out, t, { wave: 'triangle', f: 140 * p, f2: 45, drop: 0.25, d: 0.5, peak: 0.5 });
  // kropp + rumling
  N(ac, out, t + 0.005, { color: 'brown', type: 'lowpass', f: 1500, f2: 140, q: 0.9, d: 1.8, peak: 0.95, sweep: 1.2 });
  N(ac, out, t + 0.05, { color: 'brown', type: 'lowpass', f: 220, q: 1.2, a: 0.08, d: 2.8, peak: 0.55 });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 2500, f2: 300, d: 1.2, peak: 1.0 });
  // rusk/splinter
  const n = 5 + ((Math.random() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const tt = t + rand(0.18, 1.5);
    if (chance(0.5)) M(ac, out, tt, { f: rand(900, 2600), ratios: [1, 2.4, 3.9], d: rand(0.05, 0.15), peak: rand(0.02, 0.06) });
    else N(ac, out, tt, { type: 'bandpass', f: rand(1500, 5000), q: 2, d: rand(0.02, 0.06), peak: rand(0.04, 0.1) });
  }
  return 3.2;
}

// ---------- Treff ----------

function hitBody(ac, out, send, t, o) {
  const p = rand(0.9, 1.1);
  N(ac, out, t, { color: 'pink', type: 'lowpass', f: 700 * p, q: 1, d: 0.08, peak: 0.8 });
  T(ac, out, t, { f: 120 * p, f2: 58, drop: 0.05, d: 0.11, peak: 0.7, drive: 1.5 });
  N(ac, out, t, { type: 'bandpass', f: 2200 * p, q: 3, d: 0.02, peak: 0.2 }); // rustningsplate
  if (chance(0.5)) M(ac, out, t, { f: rand(700, 1100), ratios: [1, 2.6, 4.1], d: 0.08, peak: 0.05 });
  return 0.25;
}

function hitMetal(ac, out, send, t, o) {
  const f = rand(900, 1500);
  N(ac, out, t, { type: 'highpass', f: 2500, q: 0.7, d: 0.03, peak: 0.6 });
  M(ac, out, t, { f, ratios: [1, 2.76, 4.1, 5.4, 8.9], d: rand(0.3, 0.55), peak: 0.32, decayTilt: 0.7 });
  T(ac, out, t, { f: 220, f2: 110, drop: 0.03, d: 0.07, peak: 0.35 });
  M(ac, send, t, { f, ratios: [1, 2.76], d: 0.3, peak: 0.12 });
  if (chance(0.45)) {
    // ricochet-hyl
    const osc = ac.createOscillator(); osc.type = 'sine';
    const f0 = rand(2600, 3800);
    osc.frequency.setValueAtTime(f0, t + 0.01);
    osc.frequency.exponentialRampToValueAtTime(f0 * rand(0.35, 0.55), t + 0.38);
    const vib = ac.createOscillator(); vib.frequency.value = rand(25, 40);
    const vg = ac.createGain(); vg.gain.value = 60; vib.connect(vg); vg.connect(osc.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g); g.connect(out); g.connect(send);
    osc.start(t + 0.01); vib.start(t + 0.01); osc.stop(t + 0.42); vib.stop(t + 0.42);
  }
  return 0.6;
}

function hitConcrete(ac, out, send, t, o) {
  const fv = rand(0.85, 1.15);
  N(ac, out, t, { type: 'bandpass', f: 1500 * fv, q: 0.9, d: 0.06, peak: 0.85, drive: 2 });
  T(ac, out, t, { f: 150, f2: 70, drop: 0.04, d: 0.08, peak: 0.45 });
  N(ac, out, t + 0.01, { color: 'brown', type: 'lowpass', f: 900, f2: 300, d: 0.18, peak: 0.4 });
  N(ac, send, t, { type: 'bandpass', f: 1200, q: 0.8, d: 0.06, peak: 0.4 });
  const n = 2 + ((Math.random() * 4) | 0); // grus/fliser
  for (let i = 0; i < n; i++) N(ac, out, t + rand(0.03, 0.25), { type: 'bandpass', f: rand(2500, 6000), q: 3, d: rand(0.008, 0.02), peak: rand(0.05, 0.14) });
  return 0.45;
}

function hitSand(ac, out, send, t, o) {
  // sandsekk: dempet «thwump» + sandsprut, nesten ingen ring
  N(ac, out, t, { color: 'pink', type: 'lowpass', f: 900, q: 0.8, d: 0.07, peak: 0.8 });
  T(ac, out, t, { f: 130, f2: 65, drop: 0.04, d: 0.08, peak: 0.45 });
  N(ac, out, t + 0.01, { type: 'bandpass', f: 4000, f2: 2500, q: 0.8, a: 0.01, d: 0.18, peak: 0.08 });
  return 0.3;
}

function playerHurt(ac, out, send, t, o) {
  N(ac, out, t, { color: 'pink', type: 'lowpass', f: 600, q: 1, d: 0.12, peak: 0.9 });
  T(ac, out, t, { f: 95, f2: 42, drop: 0.08, d: 0.22, peak: 0.9, drive: 2 });
  M(ac, out, t, { f: rand(500, 700), ratios: [1, 2.3, 3.7, 5.2], d: 0.25, peak: 0.14 });
  // dempet visir-«krasj»: kort mellomtonestøy
  N(ac, out, t + 0.01, { type: 'bandpass', f: 900, q: 2, d: 0.09, peak: 0.25, drive: 2 });
  return 0.4;
}

function heartbeat(ac, out, send, t, o) {
  T(ac, out, t, { f: 62, f2: 40, drop: 0.08, d: 0.16, peak: 0.8, lp: 150 });
  T(ac, out, t + 0.26, { f: 55, f2: 38, drop: 0.08, d: 0.2, peak: 0.6, lp: 150 });
  return 0.6;
}

// ---------- Død ----------

function death(ac, out, send, t, o) {
  // kropp + rustning i bakken
  const fall = t + rand(0.12, 0.2);
  N(ac, out, t, { color: 'pink', type: 'lowpass', f: 800, d: 0.1, peak: 0.4 });
  T(ac, out, fall, { f: 90, f2: 40, drop: 0.08, d: 0.25, peak: 0.85, drive: 2 });
  N(ac, out, fall, { color: 'brown', type: 'lowpass', f: 600, f2: 150, d: 0.3, peak: 0.6 });
  for (let i = 0; i < 3; i++) M(ac, out, fall + rand(0, 0.18), { f: rand(500, 1200), ratios: [1, 2.5, 4.2], d: rand(0.08, 0.2), peak: rand(0.04, 0.09) });
  if (o.big) {
    // Heavy: maskin som slås av
    T(ac, out, t, { wave: 'sawtooth', f: 140, f2: 22, drop: 0.9, a: 0.01, d: 1.0, peak: 0.25, lp: 500 });
    T(ac, out, fall + 0.1, { f: 60, f2: 28, drop: 0.2, d: 0.6, peak: 0.9, drive: 2.5 });
    N(ac, send, fall, { color: 'brown', type: 'lowpass', f: 800, d: 0.6, peak: 0.7 });
    return 1.3;
  }
  if (o.player) {
    T(ac, out, t, { f: 48, f2: 30, drop: 1.0, a: 0.02, d: 2.2, peak: 0.8, drive: 1.5 });
    N(ac, send, t, { color: 'brown', type: 'lowpass', f: 500, a: 0.05, d: 2, peak: 0.6 });
    return 2.4;
  }
  return 0.6;
}

// ---------- Bevegelse / dekning ----------

function scrape(ac, out, t, dur, f, peak) {
  // ru skrape: båndpasset støy amplitudemodulert av lavfrekvent støy
  const g = N(ac, out, t, { color: 'white', type: 'bandpass', f, f2: f * 0.5, q: 1.3, a: 0.02, hold: dur * 0.5, d: dur * 0.5, peak });
  const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rand(22, 38);
  const lg = ac.createGain(); lg.gain.value = peak * 0.45;
  lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + dur + 0.05);
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 500, a: 0.02, hold: dur * 0.5, d: dur * 0.5, peak: peak * 0.8 });
}

function coverSlide(ac, out, send, t, o) {
  const high = o.type === 'high';
  const metal = o.surface === 'metal';
  const dur = rand(0.2, 0.26);
  scrape(ac, out, t, dur, rand(1000, 1400), 0.35);
  // rustning rasler
  for (let i = 0; i < 3; i++) M(ac, out, t + rand(0, dur), { f: rand(1400, 2600), ratios: [1, 2.2, 3.5], d: 0.05, peak: 0.04 });
  const h = t + dur;
  // tungt dunk mot dekning
  T(ac, out, h, { f: high ? 120 : 100, f2: 38, drop: 0.09, d: 0.3, peak: 1.0, drive: 2.5 });
  N(ac, out, h, { color: 'pink', type: 'lowpass', f: high ? 1300 : 900, f2: 200, d: 0.16, peak: 0.85 });
  N(ac, send, h, { color: 'brown', type: 'lowpass', f: 900, d: 0.2, peak: 0.6 });
  if (metal) {
    M(ac, out, h, { f: rand(180, 240), ratios: [1, 2.76, 5.4, 8.93, 13.3], d: 0.9, peak: high ? 0.32 : 0.22, decayTilt: 0.75 });
    M(ac, send, h, { f: 210, ratios: [1, 2.76], d: 0.8, peak: 0.1 });
  } else {
    N(ac, out, h, { type: 'bandpass', f: 2200, q: 1, d: 0.05, peak: 0.3 });
    for (let i = 0; i < 3; i++) N(ac, out, h + rand(0.02, 0.2), { type: 'bandpass', f: rand(3000, 6000), q: 3, d: 0.015, peak: 0.07 });
  }
  M(ac, out, h + 0.01, { f: rand(600, 800), ratios: [1, 2.3, 3.7], d: 0.12, peak: 0.08 }); // rustningsplate
  return dur + 1.0;
}

function coverExit(ac, out, send, t, o) {
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: 1800, q: 1.2, a: 0.03, d: 0.12, peak: 0.18 });
  for (let i = 0; i < 2; i++) M(ac, out, t + rand(0.01, 0.1), { f: rand(1300, 2400), ratios: [1, 2.2, 3.5], d: 0.05, peak: 0.05 });
  T(ac, out, t + 0.06, { f: 85, f2: 50, drop: 0.05, d: 0.09, peak: 0.25 });
  return 0.3;
}

function roll(ac, out, send, t, o) {
  N(ac, out, t, { color: 'pink', type: 'bandpass', f: 700, f2: 1500, q: 1.2, a: 0.08, d: 0.2, peak: 0.25 }); // sus
  T(ac, out, t + 0.12, { f: 95, f2: 45, drop: 0.07, d: 0.18, peak: 0.75, drive: 2 }); // skulder i bakken
  scrape(ac, out, t + 0.14, 0.22, 900, 0.22);
  T(ac, out, t + 0.42, { f: 110, f2: 50, drop: 0.06, d: 0.15, peak: 0.6, drive: 2 }); // opp på føttene
  N(ac, out, t + 0.12, { color: 'brown', type: 'lowpass', f: 700, d: 0.4, peak: 0.4 });
  for (let i = 0; i < 4; i++) M(ac, out, t + rand(0.1, 0.5), { f: rand(1200, 2600), ratios: [1, 2.3, 3.6], d: 0.06, peak: 0.045 });
  return 0.7;
}

function footstep(ac, out, send, t, o) {
  const metal = o.surface === 'metal';
  const p = rand(0.88, 1.12);
  T(ac, out, t, { f: 90 * p, f2: 48, drop: 0.05, d: 0.09, peak: 0.6, drive: 1.5 });
  N(ac, out, t, { color: 'pink', type: 'lowpass', f: 800 * p, q: 1, d: 0.06, peak: 0.5 });
  N(ac, out, t, { type: metal ? 'bandpass' : 'highpass', f: metal ? 2400 : 3000, q: 1.2, d: 0.025, peak: 0.12 });
  if (metal) M(ac, out, t, { f: rand(280, 360), ratios: [1, 2.6, 4.3], d: 0.28, peak: 0.12 }); // hult gulv
  if (chance(0.6)) M(ac, out, t + rand(0.01, 0.04), { f: rand(1600, 3200), ratios: [1, 2.3], d: 0.05, peak: 0.03 }); // utstyr
  return 0.35;
}

function reload(ac, out, send, t, o) {
  // magasin ut
  C(ac, out, t, { f: 3800, peak: 0.18, body: 0.6 });
  N(ac, out, t + 0.06, { type: 'bandpass', f: 1300, f2: 900, q: 1.5, a: 0.01, d: 0.1, peak: 0.15 });
  T(ac, out, t + 0.18, { f: 140, f2: 80, drop: 0.03, d: 0.06, peak: 0.12 });
  // nytt magasin inn
  const m = t + rand(0.5, 0.58);
  N(ac, out, m - 0.05, { type: 'bandpass', f: 1100, f2: 1600, q: 1.5, a: 0.03, d: 0.05, peak: 0.12 });
  C(ac, out, m, { f: 2600, peak: 0.28, body: 1 });
  T(ac, out, m, { f: 180, f2: 90, drop: 0.03, d: 0.08, peak: 0.35, drive: 1.5 });
  M(ac, out, m, { f: rand(700, 900), ratios: [1, 2.4, 3.9], d: 0.1, peak: 0.08 });
  // ladegrep
  const b = m + rand(0.28, 0.34);
  C(ac, out, b, { f: 4400, peak: 0.2, body: 0.4 });
  N(ac, out, b + 0.01, { type: 'bandpass', f: 2000, f2: 1200, q: 2, a: 0.01, d: 0.07, peak: 0.12 });
  C(ac, out, b + 0.09, { f: 3100, peak: 0.3, body: 0.8 });
  M(ac, out, b + 0.09, { f: rand(1000, 1200), ratios: [1, 2.7, 4.4], d: 0.12, peak: 0.07 });
  return 1.3;
}

// ---------- Bølger / UI ----------

function waveStart(ac, out, send, t, o) {
  // dypt slag + fjern industrialarm
  T(ac, out, t, { f: 70, f2: 30, drop: 0.5, d: 1.6, peak: 0.8, drive: 2 });
  N(ac, out, t, { color: 'brown', type: 'lowpass', f: 900, f2: 120, d: 1.4, peak: 0.6 });
  N(ac, send, t, { color: 'brown', type: 'lowpass', f: 1500, d: 1.2, peak: 0.8 });
  M(ac, send, t, { f: 110, ratios: [1, 2.76, 5.4, 8.93], d: 2.5, peak: 0.25, decayTilt: 0.8 });
  for (let i = 0; i < 3; i++) {
    const tt = t + 0.35 + i * 0.55;
    [1, 1.19].forEach((r) => {
      const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 196 * r;
      const lp = ac.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 700; lp.Q.value = 2;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.06, tt + 0.06);
      g.gain.setValueAtTime(0.06, tt + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.45);
      osc.connect(lp); lp.connect(g); g.connect(send); g.connect(out);
      osc.start(tt); osc.stop(tt + 0.5);
    });
  }
  return 2.8;
}

function waveEnd(ac, out, send, t, o) {
  // kort stinger: lav akkord som løser seg (D-moll → åpen kvint) + trykkluft-utblåsing
  const notes = [[73.4, 87.3, 110], [73.4, 110, 146.8]];
  notes.forEach((ch, k) => {
    ch.forEach((f) => {
      [-7, 7].forEach((det) => {
        const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f; osc.detune.value = det;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.8;
        const g = ac.createGain(); const tt = t + k * 0.45;
        g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + (k ? 1.8 : 0.6));
        osc.connect(lp); lp.connect(g); g.connect(out); g.connect(send);
        osc.start(tt); osc.stop(tt + 2);
      });
    });
  });
  T(ac, out, t, { f: 60, f2: 35, drop: 0.3, d: 0.8, peak: 0.5 });
  N(ac, out, t + 0.5, { type: 'highpass', f: 2500, f2: 5000, q: 0.7, a: 0.02, d: 0.9, peak: 0.08 });
  return 2.4;
}

function uiClick(ac, out, send, t, o) {
  // v1.4.1 (MENY-STIL: «metallisk klikk»): stålbryter – skarpt klikk + kort metallklang + lite dunk
  C(ac, out, t, { f: 3000, peak: 0.32, body: 0.7, d: 0.014 });
  M(ac, out, t, { f: rand(1250, 1400), ratios: [1, 2.32, 3.81], d: 0.07, peak: 0.07, decayTilt: 0.5 });
  T(ac, out, t, { f: 140, f2: 90, drop: 0.02, d: 0.05, peak: 0.26 });
  return 0.1;
}

function uiHover(ac, out, send, t, o) {
  // svakt metallisk tikk + en glø som knitrer (rolig nok for raske musebevegelser)
  N(ac, out, t, { type: 'bandpass', f: 4500, q: 4, d: 0.008, peak: 0.1 });
  M(ac, out, t, { f: rand(2300, 2600), ratios: [1, 2.32], d: 0.035, peak: 0.025, decayTilt: 0.5 });
  return 0.05;
}

// name → { fn, gain (miks), max (stemmer), minGap (s), send (romklang-andel), spatial }
export const SOUNDS = {
  rifle:        { fn: rifle,        gain: 0.80, max: 6, minGap: 0.03, send: 0.18 },
  enemyRifle:   { fn: enemyRifle,   gain: 0.62, max: 8, minGap: 0.02, send: 0.2 },
  heavy:        { fn: heavy,        gain: 0.85, max: 4, minGap: 0.05, send: 0.25 },
  shotgun:      { fn: shotgun,      gain: 0.85, max: 3, minGap: 0.2,  send: 0.14 },
  marksman:     { fn: marksman,     gain: 0.85, max: 2, minGap: 0.35, send: 0.3 },
  enemyShotgun: { fn: (ac, out, send, t, o) => shotgun(ac, out, send, t, { ...o, enemy: true }),  gain: 0.66, max: 4, minGap: 0.12, send: 0.24 },
  enemyMarksman:{ fn: (ac, out, send, t, o) => marksman(ac, out, send, t, { ...o, enemy: true }), gain: 0.64, max: 3, minGap: 0.2,  send: 0.36 },
  chamberRifle:    { fn: chamberRifle,    gain: 0.7,  max: 2, minGap: 0.15, send: 0.08 },
  chamberShotgun:  { fn: chamberShotgun,  gain: 0.8,  max: 2, minGap: 0.2,  send: 0.1 },
  chamberMarksman: { fn: chamberMarksman, gain: 0.8,  max: 2, minGap: 0.3,  send: 0.1 },
  grenadeThrow: { fn: grenadeThrow, gain: 0.7,  max: 3, minGap: 0.05, send: 0.15 },
  explosion:    { fn: explosion,    gain: 1.0,  max: 4, minGap: 0.04, send: 0.35 },
  hitBody:      { fn: hitBody,      gain: 0.6,  max: 6, minGap: 0.02, send: 0.1 },
  hitMetal:     { fn: hitMetal,     gain: 0.5,  max: 6, minGap: 0.02, send: 0.2 },
  hitConcrete:  { fn: hitConcrete,  gain: 0.55, max: 6, minGap: 0.02, send: 0.15 },
  hitSand:      { fn: hitSand,      gain: 0.55, max: 6, minGap: 0.02, send: 0.08 },
  playerHurt:   { fn: playerHurt,   gain: 0.8,  max: 2, minGap: 0.12, send: 0.1, spatial: false },
  heartbeat:    { fn: heartbeat,    gain: 0.6,  max: 1, minGap: 0.5,  send: 0,   spatial: false },
  death:        { fn: death,        gain: 0.75, max: 4, minGap: 0.03, send: 0.2 },
  coverSlide:   { fn: coverSlide,   gain: 0.75, max: 2, minGap: 0.15, send: 0.15 },
  coverExit:    { fn: coverExit,    gain: 0.6,  max: 2, minGap: 0.1,  send: 0.1 },
  roll:         { fn: roll,         gain: 0.7,  max: 2, minGap: 0.2,  send: 0.12 },
  footstep:     { fn: footstep,     gain: 0.35, max: 5, minGap: 0.06, send: 0.08 },
  reload:       { fn: reload,       gain: 0.7,  max: 2, minGap: 0.3,  send: 0.1 },
  waveStart:    { fn: waveStart,    gain: 0.7,  max: 1, minGap: 1.0,  send: 0.4, spatial: false },
  waveEnd:      { fn: waveEnd,      gain: 0.7,  max: 1, minGap: 1.0,  send: 0.4, spatial: false },
  uiClick:      { fn: uiClick,      gain: 0.45, max: 3, minGap: 0.03, send: 0.02, spatial: false, ui: true },
  ...RADIO_SOUNDS,
  ...MECH_SOUNDS,
  ...STINGER_SOUNDS,
  ...CINDER_SOUNDS,
  uiHover:      { fn: uiHover,      gain: 0.35, max: 2, minGap: 0.04, send: 0,   spatial: false, ui: true },
};
