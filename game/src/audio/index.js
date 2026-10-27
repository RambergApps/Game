// Breach – lydmodul (src/audio). Web Audio, prosedyrisk syntese, ingen avhengigheter.
// Modulkontrakt: init(world), update(dt, world), draw(ctx, world, camera).
// Offentlig API: play(name, opts), setIntensity(v), unlock(), getState().
// Volum-API (stabilt, v1.4.1 – for Våpens innstillinger; full beskrivelse i README.md):
//   setMasterVolume(v) / setMusicVolume(v) / setSfxVolume(v)  v 0..1, klemmes inn (ikke-tall ignoreres), returnerer satt verdi
//   getVolumes() → { master, music, sfx }     isMuted() → bool     mute(on) → bool (uten argument: veksle)
//   Lagres i localStorage 'breach.audio.volumes' og leses ved lasting av modulen. Virker før AudioContext er
//   låst opp: verdiene huskes og brukes ved unlock().
//   Våpens ui/settings.js (applyAudio) kaller allerede setMaster/Music/SfxVolume – ingen tilpasning trengs; initUI må
//   kjøres etter audio.init (main.js gjør det ikke ennå). Se README «Innstillinger».
// Meny-API (v1.4.1, for Arenas hovedmeny – virker også uten world, f.eks. på en egen menyside):
//   menuOpen()  – hovedmeny-stemning starter (venter på første klikk/tast hvis lyden er låst); spillmusikken tones ned
//   menuStart() – PLAY trykket: start-stinger, menystemningen tones ut; intro-kringkastingen venter til stingeren har landet
//   menuClose() – menyen lukkes uten å starte (f.eks. til innstillinger i spillet): stemningen tones ut
//   Samme som hendelser på world.events: 'menuOpen' / 'menuStart' / 'menuClose'. Hover/klikk: 'uiHover' / 'uiClick'.
// Tilfeldig variasjon bruker Math.random med vilje – lyd skal ikke forbruke world.rng (determinisme i spillet).
import { AudioEngine } from './engine.js';
import { createMusic } from './music.js';
import { createYardMusic } from './yard-music.js';
import { createVoice } from './voice.js';
import { SOUNDS } from './sfx.js';
import { createCredits, createMenuMusic } from './stingers.js';
import { createScene } from './scene.js';
import { CUTSCENE_EVENTS, SPEAKER_SOUND, IDLE_BED, createBed } from './radio.js';
export { CUTSCENE_EVENTS, SPEAKER_SOUND } from './radio.js';
import { lineOfSight } from '../core/geom.js';

let ac = null, engine = null, music = null, world = null;
let wantMusic = false, lastExternalUpdate = 0, driver = null;
// v1.7: music = aktiv spillmusikk (yard-music.js i brett 1 «yard», ellers music.js). voice = cutscene-stemmer.
let cinderMusic = null, yardMusic = null, musicId = null, voice = null, lastShotDuck = 0, calmT = 0;
let waveBoost = 0, heat = 0, lastIntensity = -1, manualIntensity = null;
// CINDER (v1.4.1): radio.js er skrevet om – announcer = nasjonal nødkringkasting (AM), command = militær feltradio,
// warden = hjelmradio, caption = dempet. Alle Protocol-elementer (jingler, «on air», «signal lost») er fjernet.
const BROADCAST_ENABLED = true; // v1.4.1: radio.js er Cinder-tilpasset (nødkringkasting/feltradio/hjelmradio)
let bed = null, cutscene = null; // cutscene = { id, panel, t } mens en mellomsekvens kringkastes
// v1.3: nivå-/fallen-tilstand
let curLevel = null, lastFallen = null, pendingLevelStart = false, stingerUntil = 0;
// v1.4.1: boss (midlertidig: bossStart → intensitet maks til bossEnd) og rulletekst (egen musikkløkke)
let bossActive = false, credits = null, credOut = null, gcUntil = 0;
// v1.4.1 demo: hovedmeny (egen loop via credOut-bussen) og stemning under mellomsekvenser (scene.js)
let menuEventsSeen = false;
let menuMus = null, wantMenu = false, scene = null, unlockedAt = 0, levelStarts = 0, lastUpgradeMs = -1e9, menuStartedAt = 0;
const credVol = () => 0.75 * settings.music / 0.42; // rulleteksten følger musikkvolumet (0.42 = standard → 0.75)
let heartbeatT = 0, footT = 0, gotFootstepEvent = false, lastPX = null, lastPY = null;
const settings = { master: 0.8, music: 0.42, sfx: 1, voice: 1, muted: false };
// v1.4.1 Volum-API (se README.md): lagres i localStorage og leses inn ved lasting – virker før AudioContext finnes.
export const VOLUME_KEY = 'breach.audio.volumes';
const clamp01 = (v, old) => { const n = +v; return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : old; };
function loadVolumes() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(VOLUME_KEY); if (!raw) return;
    const o = JSON.parse(raw);
    for (const k of ['master', 'music', 'sfx', 'voice']) if (o && o[k] !== undefined) settings[k] = clamp01(o[k], settings[k]);
    if (o && typeof o.muted === 'boolean') settings.muted = o.muted;
  } catch (_) { /* privat modus / ødelagt JSON: behold standard */ }
}
function saveVolumes() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(VOLUME_KEY, JSON.stringify({ master: settings.master, music: settings.music, sfx: settings.sfx, voice: settings.voice, muted: settings.muted })); } catch (_) {}
}
loadVolumes();
const offs = [];
const played = {}; // statistikk: antall avspilte stemmer per lyd

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const isPlayer = (e) => !!e && (e === world?.player || e.team === 'player');

/** Hent posisjon fra payload (x,y), eller fra projectile/entity/target/owner/cover. */
function pos(p) {
  if (!p || typeof p !== 'object') return {};
  if (num(p.x) !== undefined && num(p.y) !== undefined) return { x: p.x, y: p.y };
  for (const k of ['projectile', 'entity', 'target', 'owner']) {
    const o = p[k];
    if (o && num(o.x) !== undefined) return { x: o.ox ?? o.x, y: o.oy ?? o.y };
  }
  const c = p.cover; if (c && num(c.x) !== undefined) return { x: c.x + (c.w || 0) / 2, y: c.y + (c.h || 0) / 2 };
  return {};
}

/** Materiale for cover: eksplisitt surface/material, ellers konvensjon high=metall, low=betong. */
function surfaceOf(p) {
  const s = p?.surface ?? p?.cover?.surface ?? p?.cover?.material;
  if (s === 'metal' || s === 'concrete') return s;
  const t = p?.cover?.type ?? p?.type;
  return t === 'high' ? 'metal' : 'concrete';
}

/**
 * Våpen-id → lyd. Id-ene er låst i PROSJEKT.md: 'rifle', 'shotgun', 'marksman' (på shot.weapon /
 * projectile.weapon). Disse matches eksakt først; navnemønstrene under er bare reserve for ukjente id-er.
 * weapon kan være en streng eller et objekt { id | name | kind }.
 */
export const WEAPON_CLASS = { rifle: 'assault', shotgun: 'shotgun', marksman: 'sniper', grenade: 'grenade' };
/** klasse → [spiller-lyd, fiende-lyd, kammer-lyd] */
const CLASS_SOUND = {
  assault: ['rifle', 'enemyRifle', 'chamberRifle'],
  shotgun: ['shotgun', 'enemyShotgun', 'chamberShotgun'],
  sniper:  ['marksman', 'enemyMarksman', 'chamberMarksman'],
  heavy:   ['heavy', 'heavy', 'chamberRifle'],
};
export function weaponId(w) {
  if (!w) return '';
  if (typeof w === 'object') w = w.id ?? w.name ?? w.kind ?? w.type ?? '';
  return String(w).toLowerCase();
}
export function classifyWeapon(id) {
  if (!id) return null;
  if (WEAPON_CLASS[id]) return WEAPON_CLASS[id];
  if (/grenade|granat/.test(id)) return 'grenade';
  if (/sniper|precision|presisjon|dmr|marksman|longshot|rail/.test(id)) return 'sniper';
  if (/shotgun|hagle|scatter|gnasher|(^|[^a-z])sg([^a-z]|$)/.test(id)) return 'shotgun';
  if (/heavy|cannon|minigun|(^|[^a-z])mg([^a-z]|$)|launcher|mortar/.test(id)) return 'heavy';
  if (/assault|rifle|gev(æ|ae)r|lancer|automat|(^|[^a-z])ar([^a-z0-9]|$)/.test(id)) return 'assault';
  return null;
}
function shooterOf(p) { return p?.owner ?? p?.entity ?? p?.projectile?.owner; }
function teamOf(p) { return p?.team ?? p?.projectile?.team ?? shooterOf(p)?.team; }
function weaponClass(p) {
  const pr = p?.projectile, ow = shooterOf(p);
  const id = weaponId(p?.weapon ?? pr?.weapon ?? ow?.weapon);
  if (String(pr?.kind ?? '').toLowerCase() === 'grenade') return 'grenade';
  return classifyWeapon(id) ?? (ow?.type === 'heavy' ? 'heavy' : 'assault');
}
const isEnemyShot = (p) => teamOf(p) === 'enemy' && !isPlayer(shooterOf(p));
function weaponSound(p) {
  const cls = weaponClass(p);
  if (cls === 'grenade') return 'grenadeThrow';
  return CLASS_SOUND[cls][isEnemyShot(p) ? 1 : 0];
}

// Én shot per avtrekk er avtalt (også hagle). 60 ms-sammenslåingen per skytter er bare en sikkerhet.
const lastShotBy = new WeakMap();
function dedupeShot(p, sound) {
  const ow = p?.owner ?? p?.entity ?? p?.projectile?.owner;
  if (!ow || typeof ow !== 'object' || !engine) return false;
  const now = engine.ac.currentTime, prev = lastShotBy.get(ow);
  if (prev && prev.sound === sound && now - prev.t < 0.06) return true;
  lastShotBy.set(ow, { sound, t: now });
  return false;
}

// ---------------- Offentlig API ----------------

export function play(name, opts = {}) {
  if (!engine || !SOUNDS[name]) return null;
  if (!driver && lastExternalUpdate && performance.now() - lastExternalUpdate > 500) ensureDriver();
  try { const v = engine.play(name, opts || {}); if (v) { count(name); if (v.occluded) played._occluded = (played._occluded || 0) + 1; } return v; } catch (e) { console.warn('[audio] play', name, e); return null; }
}
/** Volum 0..1 (klemmes inn; ikke-tall ignoreres). Lagres i localStorage. Returnerer verdien som ble satt. */
export function setMasterVolume(v) { settings.master = clamp01(v, settings.master); engine?.setMaster(settings.master); saveVolumes(); return settings.master; }
export function setMusicVolume(v) { settings.music = clamp01(v, settings.music); engine?.setMusic(settings.music); if (credOut) credOut.gain.value = credVol(); saveVolumes(); return settings.music; }
export function setSfxVolume(v) { settings.sfx = clamp01(v, settings.sfx); engine?.setSfx(settings.sfx); saveVolumes(); return settings.sfx; }
/** → { master, music, sfx } (0..1) – også før opplåsing. muted leses med isMuted(). */
export function getVolumes() { return { master: settings.master, music: settings.music, sfx: settings.sfx, voice: settings.voice }; }
/** v1.7: stemmevolum i mellomsekvensene (0..1, ganges med sfx). */
export function setVoiceVolume(v) { settings.voice = clamp01(v, settings.voice); engine?.setVoice(settings.voice); saveVolumes(); return settings.voice; }
export function isMuted() { return settings.muted; }
/** mute(true|false); uten argument = veksle (eldre bruk). Lagres. Returnerer ny tilstand. */
export function mute(on) { settings.muted = on === undefined ? !settings.muted : !!on; engine?.mute(settings.muted); saveVolumes(); return settings.muted; }
/** Overstyr intensitet (0..1), eller null for automatisk. */
export function setIntensity(v) { manualIntensity = v === null || v === undefined ? null : Math.max(0, Math.min(1, +v)); }
/** Test/feilsøking (v1.6): faktisk utgangsnivå. AnalyserNode henger på klipperens utgang (det som går til høyttaleren),
 *  opprettes ved opplåsing (ikke ved første kall). _meter() → RMS i dBFS (tall, som før); _meter(true) → { rms, peak, state }. */
let meterNode = null, meterBuf = null;
function ensureMeter() {
  if (!engine || meterNode) return;
  meterNode = engine.ac.createAnalyser(); meterNode.fftSize = 2048; meterNode.smoothingTimeConstant = 0;
  meterBuf = new Float32Array(meterNode.fftSize);
  engine.clip.output.connect(meterNode); // etter master → kompressor → klipper
}
export function _meter(detail = false) {
  if (!engine) return null;
  ensureMeter();
  meterNode.getFloatTimeDomainData(meterBuf);
  let e = 0, pk = 0; for (const v of meterBuf) { e += v * v; const a = Math.abs(v); if (a > pk) pk = a; }
  const rms = 10 * Math.log10(e / meterBuf.length + 1e-12), peak = 20 * Math.log10(pk + 1e-6);
  return detail ? { rms, peak, state: engine.ac.state } : rms;
}
const count = (k) => { played[k] = (played[k] || 0) + 1; played._total = (played._total || 0) + 1; };
export function startMusic() { wantMusic = true; if (ac && music && !wantMenu) music.start(ac.currentTime + 0.05); }

// ---------------- Hovedmeny ----------------
function directOut() { if (!credOut) { credOut = engine.ac.createGain(); credOut.gain.value = credVol(); credOut.connect(engine.master); } return credOut; }
function startMenuMusic() {
  if (!engine || menuMus?.active) return;
  music?.fadeOut(1.5);
  menuMus = createMenuMusic(engine.ac, directOut(), engine.reverbSend);
  menuMus.start(engine.ac.currentTime + 0.05); count('_menuMusic');
  // menyen stopper spill-loopen (update() kalles ikke) → egen enkel timer for frasene så lenge stemningen går
  const mm = menuMus, iv = setInterval(() => { if (!mm.active) clearInterval(iv); else mm.update(); }, 500);
}
// Arenas meny (src/menu, overlegg i index.html) sender ingen menyhendelser i dag. Uten å røre deres filer følger vi
// DOM-en: [data-ui="main-menu"] dukker opp → menuOpen; får klassen 'bm-out' (PLAY) → menuStart; forsvinner uten → menuClose.
// Sender menyen senere 'menuOpen'/'menuStart'/'menuClose' selv, er kallene idempotente (ingen dobbel stinger).
function watchMenu() {
  if (watchMenu.done || typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !document.body) return;
  watchMenu.done = true;
  let el = null, out = false;
  const check = () => {
    if (menuEventsSeen) return; // v1.6: Arenas meny sender hendelsene – DOM-lesing er bare reserve
    const cur = document.querySelector('[data-ui="main-menu"]');
    if (cur && cur !== el) { el = cur; out = false; menuOpen(); }
    if (el && !out && el.classList.contains('bm-out')) { out = true; menuStart(); }
    if (el && !cur) { if (!out) menuClose(); el = null; }
  };
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  check();
}
export function menuOpen() { bindUnlock(); if (wantMenu && menuMus?.active) return; music?.fadeOut(0.8); wantMenu = true; menuStartedAt = 0; startMenuMusic(); }
export function menuClose(fade = 0.7) { wantMenu = false; menuMus?.stop(fade); resumeGameMusic(); }
// spillmusikken (stemningsloopen fra arenaLoaded) tas opp igjen når menyen forsvinner – demo-gjennomgangen fant 1–3 s stillhet mellom bølgene uten den
function resumeGameMusic() { if (engine && music && wantMusic) music.start(engine.ac.currentTime + 0.4); }
export function menuStart() {
  if (nowMs() - menuStartedAt < 2000) return; // samme PLAY meldt to ganger (DOM + hendelse)
  menuStartedAt = nowMs();
  const wasMenu = wantMenu || !!menuMus?.active;
  wantMenu = false;
  if (!engine) return;
  menuMus?.stop(0.72); // v1.6: ut i takt med sveipet (~720 ms før lukking)
  resumeGameMusic();
  play('menuStart', { force: true });
  stingerUntil = Math.max(stingerUntil, nowMs() + (wasMenu ? 1100 : 700)); // intro-kringkastingen starter etter stingeren
}
export function getState() {
  return { ready: !!engine, state: ac?.state ?? 'none', intensity: music?.intensity ?? 0, voices: engine?.activeVoices() ?? 0, played: { ...played }, driver: !!driver, cutscene: cutscene?.id ?? null, fallenShort: !!cutscene?.short, level: curLevel, pendingLevelStart, radioBed: !!bed?.active, broadcast: BROADCAST_ENABLED, paused: !!engine?.paused, outputLatency: ac ? (ac.outputLatency || ac.baseLatency || 0) : 0, menuMusic: !!menuMus?.active, menuGain: menuMus ? +menuMus.output.gain.value.toFixed(4) : 0, menuEvents: menuEventsSeen, scene: scene?.id ?? null, musicId, ...settings, voiceState: voice?.state() ?? null };
}
export const SOUND_NAMES = Object.keys(SOUNDS);

/** Oppretter/gjenopptar AudioContext. Må kalles fra en brukerhandling (gjøres automatisk). */
export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  if (!ac) {
    ac = new AC({ latencyHint: 'interactive' });
    engine = new AudioEngine(ac);
    engine.occlusionTest = (x, y, lx, ly) => !!(world?.cover?.length) && !lineOfSight(world, x, y, lx, ly);
    bed = BROADCAST_ENABLED ? createBed(ac, engine.radio) : null;
    engine.setMaster(settings.master); engine.setMusic(settings.music); engine.setSfx(settings.sfx); engine.mute(settings.muted);
    engine.setVoice(settings.voice);
    cinderMusic = createMusic(ac, engine.music, engine.reverbSend);
    yardMusic = createYardMusic(ac, engine.music, engine.reverbSend);
    music = musicId === 'yard' ? yardMusic : cinderMusic;
    voice = createVoice(ac, engine.voice, { onSpeech: (on) => { engine.duckRadio(on); if (on) count('_voice'); } });
    scene = createScene(ac, engine.radio, engine.reverbSend);
    unlockedAt = nowMs();
    ensureMeter();
    if (wantMenu) startMenuMusic();
    else if (wantMusic) music.start(ac.currentTime + 0.05);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
}

// ---------------- Modulkontrakt ----------------

function bindUnlock() {
  if (typeof window === 'undefined' || bindUnlock.done) return;
  bindUnlock.done = true;
  const u = () => unlock();
  window.addEventListener('pointerdown', u, { capture: true });
  window.addEventListener('keydown', u, { capture: true });
  window.addEventListener('touchstart', u, { capture: true, passive: true });
}

export function init(w) {
  world = w;
  offs.forEach((f) => f()); offs.length = 0;
  bindUnlock();
  watchMenu();
  const ev = w?.events; if (!ev?.on) { console.warn('[audio] world.events mangler – lyd kobles ikke på hendelser'); return; }
  const on = (type, fn) => {
    const off = ev.on(type, (p) => { try { fn(p || {}); } catch (e) { console.warn(`[audio] '${type}'`, e); } });
    offs.push(typeof off === 'function' ? off : () => ev.off?.(type, fn));
  };

  on('arenaLoaded', (p) => { selectMusic(p.id); startMusic(); });
  on('shot', (p) => {
    const oid = weaponId(p?.weapon ?? p?.projectile?.weapon);
    if (ORGANIC_SHOT[oid]) { organicShot(p, oid); return; } // v1.4.1: spine/slag/acid – eksakt match først
    const s = weaponSound(p);
    if (dedupeShot(p, s)) return;
    play(s, pos(p));
    musicDuck(4, 220, true);
    chamberFallback(p);
    if (p.team === 'enemy' || p.projectile?.team === 'enemy') heat += 0.025; else heat += 0.01;
  });
  // Kjerne: hit {target, amount, source}. Kuletreff lydlegges via projectileHit (har treffpunkt) – unngå dobbel.
  // Rolle-/stubformat: hit {x,y,entity,surface,team}.
  // Blokkert treff (core combat.js: usårbar → hit {amount:0, blocked:true, raw}) – aldri playerHurt/kroppstreff,
  // men et svakt streif/sus. Core sender 'hit' synkront FØR 'projectileHit' for samme kule, så vi merker kula.
  const blockedProj = new WeakMap(); // kule → blokkert mål (gjennomslag kan treffe et ekte mål etterpå)
  on('hit', (p) => {
    const target = p.target ?? p.entity;
    if (p.blocked) {
      if (p.source?.projectile && target) blockedProj.set(p.source.projectile, target);
      const tp = target && num(target.x) !== undefined ? { x: target.x, y: target.y } : pos(p);
      play('bulletGraze', { ...tp, gain: isPlayer(target) ? 1 : 0.7 });
      return;
    }
    if (target && isPlayer(target)) { play('playerHurt', {}); heat += 0.08; checkLowHealth(true); return; }
    if (p.source?.projectile) return; // projectileHit tar den
    if (!target && (p.surface === 'metal' || p.surface === 'concrete')) { play(p.surface === 'metal' ? 'hitMetal' : 'hitConcrete', pos(p)); return; }
    if (target && isCinder(target)) { play('hitChitin', { ...pos(p), type: ctype(target, p.variant), gain: 0.8 }); heat += 0.02; return; }
    play('hitBody', pos(p)); heat += 0.02;
  });
  // v1.5 – ÉN kilde per kuletreff: 'bulletImpact' (Våpen rev. 6, har surface/z) er hovedkilden. coverHit/projectileHit
  // er bare reserve: de legges i en mikrooppgave og spilles kun hvis samme prosjektil IKKE fikk en bulletImpact
  // (uavhengig av lytterrekkefølge, siden Våpen sender bulletImpact synkront inne i coverHit/projectileHit).
  const impacted = new WeakSet();
  const bodyHit = (p, target) => {
    if ((p.projectile && blockedProj.get(p.projectile) === target) || p.blocked || target?.invuln) return; // blokkert: 'hit' har alt spilt streif
    if (isPlayer(target)) return; // playerHurt kommer fra 'hit'
    const sf = String(p.surface ?? '');
    play(isCinder(target) || sf === 'chitin' ? 'hitChitin' : sf === 'metal' && !target ? 'hitMetal' : 'hitBody', { ...pos(p), type: ctype(target, p.variant) }); heat += 0.02;
  };
  const coverSnd = (p) => {
    const s = String(p.surface ?? surfaceOf(p)), soft = /sand|dirt/.test(s) || /sand/.test(String(p.cover?.kind ?? ''));
    play(soft ? 'hitSand' : s === 'metal' || s === 'grate' ? 'hitMetal' : 'hitConcrete', { ...pos(p), gain: p.partial ? 0.7 : 1 });
  };
  on('bulletImpact', (p) => {
    if (p.projectile && typeof p.projectile === 'object') { if (impacted.has(p.projectile)) return; impacted.add(p.projectile); }
    if (p.kind === 'body' || p.target || p.targetId != null) bodyHit(p, p.target); else coverSnd(p);
  });
  const fallback = (p, fn) => { const pr = p.projectile; queueMicrotask(() => { if (pr && typeof pr === 'object' && impacted.has(pr)) return; fn(); }); };
  on('projectileHit', (p) => fallback(p, () => bodyHit(p, p.target)));
  on('coverHit', (p) => { if (p.projectile?.kind === 'grenade') return; fallback(p, () => coverSnd(p)); });
  on('death', (p) => {
    const t = p.target ?? p.entity ?? {};
    const type = p.type ?? t.type;
    if (!isPlayer(t) && (isCinder(t) || CINDER_TYPES.has(type))) play('cinderDeath', { ...pos(p), type: ctype({ type, variant: t.variant }, p.variant), force: true });
    else play('death', { ...pos(p), big: type === 'heavy', player: isPlayer(t), force: true });
    if (isPlayer(t)) { waveBoost = 0; heat = 0; } else heat += 0.06;
  });
  // Våpen rev. 3: grenade {phase:'windup'|'throw'|'land'}. Uten phase = eldre format → kastlyd som før.
  on('grenade', (p) => {
    const ph = p.phase, enemy = p.team === 'enemy';
    if (ph === 'land' && isSac(p)) { landSeen = true; if (!(p.grenade && sacs.get(p.grenade)?.landed)) play('sacSplat', { ...pos(p), fuse: num(p.fuse) ?? 1 }); if (p.grenade && sacs.has(p.grenade)) sacs.get(p.grenade).landed = true; return; }
    if (ph === 'land') { grenadeBounce({ ...p, k: 0.6 }); return; } // granat lander: tungt dunk, ikke kast-lyd
    if (ph === 'windup' && enemy && p.owner?.type === 'grenadier') return; // Spitter: grenadeWindup tar den
    if (ph === 'windup') { play('grenadePin', { ...pos(p), gain: enemy ? 0.7 : 1 }); return; } // splint + grep
    if (ph !== undefined && ph !== 'throw') return; // ukjente faser: stille (ingen dobbel kastlyd)
    if (isSac(p)) { if (!recentSpit(p.owner ?? p.grenade?.owner)) play('spitPlop', pos(p)); if (p.grenade && typeof p.grenade === 'object') sacs.set(p.grenade, { landed: false }); heat += 0.05; return; }
    play('grenadeThrow', pos(p)); heat += 0.05;
  });
  on('grenadeBounce', (p) => { if (p.grenade && sacs.has(p.grenade) || isSac(p)) play('sacBounce', pos(p)); else grenadeBounce(p); });
  on('explosion', (p) => {
    if (isSac(p) || (p.grenade && sacs.has(p.grenade))) { play('acidBurst', pos(p)); if (p.grenade) sacs.delete(p.grenade); }
    else if (/acid|sac/.test(String(p.kind ?? ''))) play('acidBurst', pos(p));
    else play('explosion', { ...pos(p), kind: p.kind ?? 'frag', ...(p.kind === 'small' || (num(p.radius) !== undefined && p.radius < 50) ? { gain: 0.6 } : {}) }); // v1.5: kind velger lyd ('frag' = standard granat)
    heat += 0.15; musicDuck(8, 900);
  });
  // ---- CINDER (Historie låst 23.10): Cinderborn fra under bakken. Se cinder.js. ----
  on('spawnWarn', (p) => musicDuck(6, 500));
  on('spawnWarn', (p) => play('spawnWarn', { ...pos(p), type: ctype({ type: p.type }, p.variant), warn: num(p.t) ?? num(p.duration) ?? 0.9 }));
  on('spawnRise', (p) => { play('spawnRise', { ...pos(p), type: ctype({ type: p.type ?? p.entity?.type, variant: p.entity?.variant }, p.variant) }); heat += 0.03; });
  on('telegraph', (p) => {
    if (p.spinup || p.melee) return; // Kiln: 'spinup' tar den · Lurcher: 'meleeCharge' tar den
    if (Math.random() < 0.6) play('chitinRattle', { ...pos(p), type: p.entity?.type, duration: p.duration });
  });
  on('meleeCharge', (p) => play('lurcherCharge', { ...pos(p), type: p.entity?.type ?? 'flanker', duration: p.duration }));
  on('spinup', (p) => play('kilnSpinup', { ...pos(p), type: ctype(p.entity ?? { type: 'heavy' }, p.variant), duration: p.duration }));
  on('spindown', (p) => play('kilnSpindown', pos(p)));
  on('grenadeWindup', (p) => play('spitWindup', { ...pos(p), type: p.entity?.type ?? 'grenadier', duration: p.duration }));
  // 'heavyReload' er et duplikat av reload {weapon:'minigun'} → ignoreres bevisst.
  on('coverEnter', (p) => play('coverSlide', { ...pos(p), type: p.type ?? p.cover?.type, surface: surfaceOf(p), gain: !p.entity || isPlayer(p.entity) ? 1 : 0.5 }));
  on('coverExit', (p) => play('coverExit', pos(p)));
  on('roll', (p) => play('roll', pos(p)));
  on('footstep', (p) => {
    const e = p.entity;
    if (p.team === 'enemy' || (e && !isPlayer(e) && isCinder(e))) { // kitin, sparsomt: Lurcher tripper oftere men lettere
      const ty = ctype(e), ch = ty === 'flanker' ? 0.55 : ty === 'heavy' || ty === 'kilnAlpha' ? 0.9 : 0.45;
      if (Math.random() < ch) play('chitinStep', { ...pos(p), type: ty });
      return;
    }
    gotFootstepEvent = true; play('footstep', { ...pos(p), surface: p.surface, gain: isPlayer(p.entity) || !p.entity ? 1 : 0.7 }); });
  // Våpen v1: ÉN hendelse 'reload' {weapon, phase:'start'|'active'|'end', result} – én lyd per fase.
  // 'activeReload' er bare et ekstrasignal og gir IKKE lyd. 'reloadDone' (ikke sendt i dag) gir bare lyd
  // hvis ingen reload phase:'end' kom for samme enhet like før/etter.
  on('reload', (p) => {
    const ph = p.phase ?? 'start';
    if (ph === 'start') reloadPhase(p, 'start', 'reloadStart');
    else if (ph === 'active') reloadPhase(p, 'active', p.result === 'perfect' ? 'activePerfect' : p.result === 'fail' ? 'activeFail' : 'activeGood');
    else if (ph === 'end' && p.result === 'cancel') reloadCancelled(p);
    else if (ph === 'end') reloadPhase(p, 'end', 'reloadDone');
  });
  on('reloadDone', (p) => reloadPhase(p, 'end', 'reloadDone'));
  // Ammokasse: refill {entity, x, y, crateId}. «Klar»-pip: Våpen sender ingen egen hendelse → vi ser på
  // world.arena.ammoCrates[].ready (false→true) i tick; ellers reserve-nedtelling 25 s spilltid (stopper i pause).
  on('refill', (p) => {
    markCancelSource(p, 'refill');
    play('refill', { ...pos(p), gain: isPlayer(p.entity) || !p.entity ? 1 : 0.6 });
    if (p.crateId !== null && p.crateId !== undefined) crateWatch.set(p.crateId, { x: p.x, y: p.y, left: CRATE_COOLDOWN, seenBusy: false });
  });
  // Nærkamp: melee {entity, x, y, angle, phase:'start'|'hit'|'end', targets}
  on('melee', (p) => {
    const o = { ...pos(p), gain: isPlayer(p.entity) || !p.entity ? 1 : 0.7 };
    if (p.phase === 'start') { markCancelSource(p, 'melee'); play('meleeStart', o); }
    else if (p.phase === 'hit') { const m = meleeInfo(p); if (m) play('meleeHit', { ...o, ...m, immediate: true, force: true }); else play('meleeMiss', o); }
    else if (p.phase === 'end') play('meleeEnd', { ...o, gain: o.gain * 0.6 });
  });
  on('dryFire', (p) => play('dryFire', mechOpts(p)));
  on('weaponSwitch', (p) => play('weaponSwitch', mechOpts(p, p.to ?? p.weapon)));
  on('chamber', (p) => { const c = weaponClass(p); chamberSeen.add(c); lastChamberBy.set(shooterOf(p) ?? ANON, nowMs()); playChamber(p); });
  on(CUTSCENE_EVENTS.start, (p) => cutsceneStart(p));
  on(CUTSCENE_EVENTS.line, (p) => cutsceneLine(p));
  on(CUTSCENE_EVENTS.end, (p) => cutsceneEnd(p));
  on('waveStart', () => { play('waveStart', {}); musicDuck(6, 500); calmT = 0; waveBoost = Math.max(waveBoost, 0.85); });
  on('waveEnd', () => { play('waveEnd', {}); waveBoost = Math.min(waveBoost, 0.15); heat = 0; calmT = 3; });
  // Nivåer: levelStart spilles når spillet faktisk går (etter evt. cutsceneBefore), ikke oppå kringkastingen.
  on('levelStart', (p) => {
    curLevel = p.level ?? p.id ?? world?.level?.n ?? curLevel; pendingLevelStart = true;
    // Startskjermen i main.js («CLICK TO START») sender ingen menyhendelse: første levelStart rett etter at lyden ble
    // låst opp (samme klikk) behandles som PLAY. Faller bort av seg selv når Arenas meny sender 'menuStart'.
    if (levelStarts++ === 0 && engine && nowMs() - unlockedAt < 1500 && !played.menuStart) menuStart();
    else if (menuMus?.active) menuClose(1.2);
  });
  // Oppgraderingskort: levels sender 'upgrade' {id,stats,instant} ETTER valget (cards.js: ~520 ms etter klikk/tast).
  // Åpning: ingen hendelse i dag (v1.4.1) – navnet avtales med Nivåer og story. Foreløpig lyttes det på UPGRADE_OPEN.
  on('upgrade', () => { lastUpgradeMs = nowMs(); play('upgrade', {}); });
  on(UPGRADE_OPEN, () => play('upgradeOpen', {}));
  on('levelEnd', () => {
    music?.fadeOut(2.5); waveBoost = 0; heat = 0;
    // demo-gjennomgang: siste oppgraderingskort velges i samme øyeblikk som levelEnd → to krigstrommer oppå hverandre.
    // Er 'upgrade' spilt de siste 0,5 s, venter levelEnd-stingeren 0,9 s (kortlyden lander først).
    const late = nowMs() - lastUpgradeMs < 500 ? 0.9 : 0;
    play('levelEnd', late && engine ? { when: engine.ac.currentTime + late } : {}); stingerUntil = performance.now() + 2200 + late * 1000; // kringkastingen etterpå venter til stingeren har landet
  });
  on('gameComplete', () => { music?.fadeOut(1.5); bossActive = false; if (engine) gcUntil = radioAt() + 0.2 + 14.5; play('gameComplete', { when: radioAt() + 0.2 }); });
  // v1.4.1 Story og brett: restart {level, waveId, cause:'death'} – kort «tilbake i kamp», intensiteten nullstilles
  on('restart', () => {
    play('restart', {}); waveBoost = 0; heat = 0; bossActive = false;
    if (music) { music.setIntensity(0, 0.3); lastIntensity = 0; }
  });
  // Boss (MIDLERTIDIG til docs/BOSS.md): bossStart {id, wave} → tung stinger + intensitet maks; bossPhase {id, phase} →
  // kort fasestøt; bossEnd {id, skipped} → lang utpust (ikke ved skipped).
  on('bossStart', () => { bossActive = true; play('bossStart', {}); });
  on('bossPhase', () => play('bossPhase', {}));
  on('bossEnd', (p) => { const was = bossActive; bossActive = false; waveBoost = Math.min(waveBoost, 0.15); heat = 0; if (was && !p?.skipped) play('bossEnd', {}); });
  // Rulletekst (story/credits.js): creditsStart {} → rolig gameComplete-tema i løkke; creditsEnd {skipped} → tones ut
  on('creditsStart', () => startCredits());
  on('creditsEnd', (p) => credits?.stop(p?.skipped ? 1.5 : 4));
  on('menuOpen', () => { menuEventsSeen = true; menuOpen(); });
  on('menuStart', () => { menuEventsSeen = true; menuStart(); });
  on('menuClose', () => { menuEventsSeen = true; menuClose(); });
  on('uiClick', () => play('uiClick', {}));
  on('uiHover', () => play('uiHover', {}));
  on('playerHurt', () => { play('playerHurt', {}); checkLowHealth(true); });
  on('lowHealth', () => play('heartbeat', {}));

  on('arenaLoaded', () => { if (cutscene) cutsceneEnd({ id: cutscene.id, quiet: true }); });
  // Selvdrevet fallback: hvis ingen kaller update() (f.eks. testsider), driver modulen seg selv.
  ensureDriver();
}

/** Start reserve-timeren bare når update() ikke er kalt de siste ~500 ms. Stoppes ved første update(). */
function ensureDriver() {
  if (typeof window === 'undefined' || driver) return;
  if (lastExternalUpdate && performance.now() - lastExternalUpdate < 500) return;
  driver = setInterval(() => {
    if (lastExternalUpdate && performance.now() - lastExternalUpdate < 500) { clearInterval(driver); driver = null; return; }
    tick(0.1);
  }, 100);
}

// ---------------- Kammer (pumpe / bolt / ladehåndtak) ----------------

function playChamber(p) {
  const cls = weaponClass(p); if (cls === 'grenade') return;
  play(CLASS_SOUND[cls][2], { ...pos(p), gain: isEnemyShot(p) ? 0.6 : 1 });
}
// Reserve bare for våpen som ennå ikke har sendt ekte 'chamber' (Våpen v1 sender den for hagle/presisjon).
// Timeren ligger 0,1 s etter Våpens chamber-tid, og hopper over hvis ekte chamber kom fra samme skytter → aldri dobbel.
const CHAMBER_FALLBACK_DELAY = { shotgun: 0.42, sniper: 0.52 }; // = chamber i src/weapons/data.js + 0,1 s
const chamberSeen = new Set(), lastChamberBy = new WeakMap();
function chamberFallback(p) {
  if (!engine) return;
  const cls = weaponClass(p), d = CHAMBER_FALLBACK_DELAY[cls]; if (!d || chamberSeen.has(cls)) return;
  const at = pos(p), who = shooterOf(p) ?? ANON, t0 = nowMs();
  setTimeout(() => {
    if (chamberSeen.has(cls) || (lastChamberBy.get(who) ?? 0) >= t0) return;
    played._chamberFallback = (played._chamberFallback || 0) + 1;
    play(CLASS_SOUND[cls][2], { ...at, gain: isEnemyShot(p) ? 0.6 : 1 });
  }, d * 1000);
}

// ---------------- Våpenmekanikk (v1.3) ----------------

const CRATE_COOLDOWN = 25; // s – TUNING.ammoCrate.cooldown i src/weapons/data.js
const crateWatch = new Map(); // crateId → { x, y, left, seenBusy }
function tickCrates(dt) {
  if (!crateWatch.size) return;
  const list = Array.isArray(world?.arena?.ammoCrates) ? world.arena.ammoCrates : [];
  for (const [id, w] of crateWatch) {
    const c = list.find((k) => k && k.id === id);
    if (c && typeof c.ready === 'boolean') {           // ekte tilstand fra Våpen
      if (!c.ready) w.seenBusy = true;
      else if (w.seenBusy) { crateWatch.delete(id); play('crateReady', { x: c.x ?? w.x, y: c.y ?? w.y }); continue; }
    }
    if (!world?.paused) w.left -= dt;                   // reserve
    if (w.left <= 0 && !(c && typeof c.ready === 'boolean' && w.seenBusy)) { crateWatch.delete(id); play('crateReady', { x: c?.x ?? w.x, y: c?.y ?? w.y }); }
    else if (w.left < -2) crateWatch.delete(id);
  }
}

// Våpen rev. 4: 'minigun' (Kiln) har egne tunge, fjernere faser. Alle andre/ukjente id-er → riflevarianten.
const MECH_ID = { assault: 'rifle', heavy: 'rifle', shotgun: 'shotgun', sniper: 'marksman' };
function mechOpts(p, w) {
  const id = weaponId(w !== undefined ? w : (p.weapon ?? p.projectile?.weapon ?? shooterOf(p)?.weapon));
  const cls = w !== undefined ? (classifyWeapon(id) ?? 'assault') : weaponClass(p);
  const ent = p.entity ?? p.owner, enemy = (p.team ?? ent?.team) === 'enemy' && !isPlayer(ent);
  return { ...pos(p), weapon: id === 'minigun' ? 'minigun' : (MECH_ID[cls] ?? 'rifle'), gain: enemy ? 0.6 : 1 };
}
// ---- CINDER-hjelpere ----
const CINDER_TYPES = new Set(['grunt', 'flanker', 'heavy', 'grenadier']);
const isCinder = (e) => !!e && typeof e === 'object' && !isPlayer(e) && (e.team === 'enemy' || CINDER_TYPES.has(e.type));
const isSac = (p) => (p.team === 'enemy' || p.grenade?.team === 'enemy') && (p.owner?.type === 'grenadier' || p.grenade?.owner?.type === 'grenadier' || p.team === 'enemy');
const sacs = new Map(); // Spitter-sekk (Våpen-granat) → { landed } · nedslag: grenade phase 'land', ellers g.z === 0 i tick
let landSeen = false; // v1.4.1: når 'land' er sett én gang, slås høydesjekken av (den er bare reserve)
/** Kiln Alpha: e.variant === 'alpha' (eller variant i payload) → intern lydtype 'kilnAlpha'. */
function ctype(e, variant) {
  const ty = e?.type, v = variant ?? e?.variant;
  return v === 'alpha' && (ty === 'heavy' || ty === undefined || ty === 'kilnAlpha') ? 'kilnAlpha' : ty;
}
// v1.4.1 organiske fiendeskudd: shot.weapon-id (eksakt) → lyd. Ukjente id-er går videre til menneskevåpen-lydene.
const ORGANIC_SHOT = { spine: 'spineShot', slag: 'slagSpray', acid: 'spitPlop', barb: 'spineShot' }; // barb: Lurcher (stats.js shotEventId), lettere pigg
const spitAt = new WeakMap(); // Spitter → ms for siste spitPlop (acid-skudd og sekk-kast kan komme for samme kast)
function recentSpit(owner) {
  if (!owner || typeof owner !== 'object') return false;
  const prev = spitAt.get(owner), now = nowMs(); spitAt.set(owner, now);
  return prev !== undefined && now - prev < 400;
}
function organicShot(p, oid) {
  const ow = shooterOf(p), s = ORGANIC_SHOT[oid];
  if (oid === 'acid') { if (!recentSpit(ow)) play(s, pos(p)); heat += 0.04; return; }
  if (dedupeShot(p, s)) return;
  const enemy = isEnemyShot(p) || !isPlayer(ow);
  play(s, { ...pos(p), type: ctype(ow, p.variant), gain: (enemy ? 1 : 0.9) * (oid === 'barb' ? 0.75 : 1), barb: oid === 'barb' });
  heat += oid === 'slag' ? 0.02 : 0.025;
}
let emberT = 0.3;
function tickCinder(dt) {
  for (const [g, st] of sacs) {
    if (g.dead || g.exploded) { sacs.delete(g); continue; }
    if (!landSeen && !st.landed && num(g.z) !== undefined && g.z <= 0.01 && (g.t ?? 1) > 0.04) {
      st.landed = true;
      play('sacSplat', { x: g.x, y: g.y, fuse: Math.max(0.3, (num(g.def?.fuse) ?? 1.1) - (num(g.t) ?? 0)) });
    }
  }
  if (sacs.size > 24) sacs.clear(); // vern mot lekkasje
  // svakt brennende lag: én glør-klynge om gangen ved en tilfeldig levende Cinderborn innen hørevidde
  emberT -= dt;
  if (emberT > 0 || !Array.isArray(world?.enemies) || world.paused) return;
  emberT = 0.2 + Math.random() * 0.25;
  const L = engine.listener, near = [];
  for (const e of world.enemies) {
    if (!e || e.dead || num(e.x) === undefined) continue;
    if (L && Math.hypot(e.x - L.x, e.y - L.y) > 520) continue;
    near.push(e); if (near.length >= 12) break;
  }
  if (!near.length) return;
  const e = near[(Math.random() * near.length) | 0];
  // v1.4.1: glørne dukker frem når det er få fiender igjen (≤2 levende: +3,5 dB, 3–5: +1,6 dB)
  const alive = world.enemies.reduce((n, x) => n + (x && !x.dead ? 1 : 0), 0);
  play('emberIdle', { x: e.x, y: e.y, type: ctype(e), gain: alive <= 2 ? 1.5 : alive <= 5 ? 1.2 : 1 });
}
// Høyst én lyd per fase per enhet innen 0,3 s (vern mot dobbel 'end' via reloadDone).
const reloadState = new WeakMap(), ANON = {};
const nowMs = () => performance.now();
export const UPGRADE_OPEN = 'upgradeOffer'; // avtalt med Breach 2026-10-26 (sendes fra offerUpgrade() i levels)
function reloadPhase(p, phase, sound) {
  const key = p.entity ?? p.owner ?? ANON, st = reloadState.get(key) ?? {}, t = nowMs();
  if (st[phase] && t - st[phase] < 300) { played._reloadDeduped = (played._reloadDeduped || 0) + 1; return; }
  reloadState.set(key, { ...st, [phase]: t });
  play(sound, mechOpts(p));
}
// 'cancel' kommer fra to steder i src/weapons, alltid SYNKRONT rett før kilden sin:
//   melee.js startMelee → reload end cancel → melee start      (kolbeslag avbryter lading)
//   index.js refill     → reload end cancel → refill            (ammokasse midt i lading)
// Vi venter derfor én mikrooppgave og ser hvilken hendelse som fulgte:
//   melee  → kort avbruddslyd (magasinet slenges halvveis tilbake og rasler), litt dempet og 50 ms etter svinget,
//            så svinget leder og raslingen forteller at ladingen gikk tapt
//   refill → ingen egen lyd (refill-lyden har magasinene)
//   ukjent → avbruddslyd i full styrke
const pendingCancel = new Map(); // entity → { p, src }
function reloadCancelled(p) {
  const key = p.entity ?? p.owner ?? ANON;
  pendingCancel.set(key, { p, src: null });
  queueMicrotask(() => {
    const c = pendingCancel.get(key); if (!c || c.p !== p) return; pendingCancel.delete(key);
    played['_cancel_' + (c.src ?? 'other')] = (played['_cancel_' + (c.src ?? 'other')] || 0) + 1;
    if (c.src === 'refill') return;
    const o = mechOpts(p);
    if (c.src === 'melee') play('reloadCancel', { ...o, gain: o.gain * 0.75, when: (engine?.ac.currentTime ?? 0) + 0.05 });
    else play('reloadCancel', o);
  });
}
function markCancelSource(p, src) { const c = pendingCancel.get(p.entity ?? p.owner ?? ANON); if (c && !c.src) c.src = src; }
// v1.4.1 nærkamp (Våpen melee.js): hits[i] {target, killed, surface, x, y}; p.killed; targets[] (entiteter).
// killed: p.killed → hits[i].killed / targets[i].killed → target.hp <= 0. surface: første treff med surface, ellers kitin.
function meleeInfo(p) {
  const hits = Array.isArray(p.hits) ? p.hits : [], tg = Array.isArray(p.targets) ? p.targets : [];
  if (!hits.length && !tg.length && !p.hit) return null;
  const ent = (h) => h?.target ?? h?.entity ?? h;
  const killed = p.killed === true || hits.some((h) => h?.killed) || tg.some((h) => h?.killed)
    || [...hits, ...tg].some((h) => { const e = ent(h); return e && typeof e.hp === 'number' && e.hp <= 0; });
  const surface = hits.find((h) => h?.surface)?.surface ?? tg.find((h) => h?.surface)?.surface ?? 'chitin';
  const h0 = hits[0];
  return { killed, surface, held: String(p.heldWeapon ?? (p.weapon !== 'stock' ? p.weapon : '') ?? ''), ...(num(h0?.x) !== undefined ? { x: h0.x, y: h0.y } : num(p.hx) !== undefined ? { x: p.hx, y: p.hy } : {}) };
}
function grenadeBounce(p) {
  const at = pos(p), g = p.grenade;
  const sp = num(g?.vx) !== undefined ? Math.hypot(g.vx, g.vy) : null;
  const k = p.k ?? (sp === null ? 0.7 : Math.max(0.3, Math.min(1, sp / 420)));
  // Våpen (VAPEN.md): material = klang ('metal'|'concrete'|…), surface = sted ('wall'|'cover'|'floor'). Eldre: surface = materiale.
  const MATS = new Set(['metal', 'concrete', 'sand', 'dirt', 'wood', 'grate', 'stone']);
  const surface = p.material ?? (MATS.has(p.surface) ? p.surface : null) ?? (at.x !== undefined ? world?.modules?.arena?.surfaceAt?.(world, at.x, at.y) : null) ?? 'concrete';
  play('grenadeBounce', { ...at, surface, place: p.surface, k, gain: 0.5 + 0.5 * k });
}
function startCredits() {
  if (!engine) return;
  const ac2 = engine.ac;
  directOut().gain.value = credVol();
  if (credits?.active) return;
  music?.fadeOut(2);
  credits = createCredits(ac2, credOut, engine.reverbSend); count('_credits');
  credits.start(Math.max(ac2.currentTime + 0.05, gcUntil - 3)); // la gameComplete-stingeren nesten klinge ut først
}
/** Tidligste ac-tid radio/kringkasting kan starte (venter på levelEnd-stingeren). */
function radioAt() { return engine.ac.currentTime + Math.max(0, (stingerUntil - nowMs()) / 1000); }

// ---------------- Mellomsekvens: kringkasting / radio ----------------
// Støy kun mellom cutsceneStart og cutsceneEnd. world.paused alene (vanlig pause) gir aldri radiostøy.

function cutsceneStart(p) {
  if (!engine) return;
  voice?.prepare(p.id);
  if (cutscene) { bed?.stop(engine.ac.currentTime, 0.1); scene?.stop(engine.ac.currentTime, 0.1); }
  // fallen: gjentatt død (samme nivå, eller innen 3 min) → kort variant
  let short = false;
  if (p.id === 'fallen') {
    const lv = curLevel ?? world?.level?.n ?? null;
    short = !!lastFallen && ((lv !== null && lastFallen.level === lv) || nowMs() - lastFallen.t < 180000);
    lastFallen = { t: nowMs(), level: lv };
  }
  cutscene = { id: p.id, panel: null, t: performance.now(), short };
  engine.setPaused(true); // musikk dukkes med den vanlige pause-logikken – ingen støy/klikk
  const at = radioAt();
  if (p.id === 'fallen') play('fallen', { short, force: true, when: at }); // nøytral, tung dødslyd
  if (!BROADCAST_ENABLED) return;
  if (menuMus?.active) menuClose(1.0);
  scene?.start(p.id, at);
  bed?.start(at); bed?.setMode(IDLE_BED, at);
  play('bcastStart', { id: p.id, short, force: true, when: at });
}
function cutsceneLine(p) {
  if (!engine) return;
  if (!cutscene) cutsceneStart({ id: p.id }); // tålt: linje uten start
  cutscene.t = performance.now();
  if (!BROADCAST_ENABLED) { if (p.panel !== undefined) cutscene.panel = p.panel; voice?.line(p); return; }
  const sp = SPEAKER_SOUND[p.speaker] ?? SPEAKER_SOUND.caption;
  bed?.setMode(sp);
  const newPanel = cutscene.panel !== null && p.panel !== undefined && p.panel !== cutscene.panel;
  if (p.panel !== undefined) { cutscene.panel = p.panel; scene?.panel(p.panel); }
  if (newPanel) play('radioPanel', {});
  if (sp.click) play(sp.click, { when: radioAt() + (newPanel ? 0.12 : 0) });
  voice?.line(p, radioAt() + (newPanel ? 0.12 : 0));
}
function cutsceneEnd(p = {}) {
  if (!engine || !cutscene) return;
  const id = p.id ?? cutscene.id, short = cutscene.short; cutscene = null;
  voice?.end(p);
  if (!p.quiet && BROADCAST_ENABLED) play('bcastEnd', { id, skipped: !!p.skipped, short, force: true });
  bed?.stop(engine.ac.currentTime + (p.skipped ? 0.02 : 0.25), p.skipped ? 0.12 : 0.5);
  scene?.stop(engine.ac.currentTime + (p.skipped ? 0.02 : 0.25), p.skipped ? 0.15 : 1.2);
  engine.setPaused(!!world?.paused);
}

function checkLowHealth(immediate) {
  const p = world?.player; if (!p || p.dead || !num(p.hp) || !num(p.maxHp)) return false;
  const low = p.hp / p.maxHp < 0.3;
  if (low && immediate && heartbeatT <= 0) { play('heartbeat', {}); heartbeatT = 1.0; }
  return low;
}

function tick(dt) {
  if (!engine) return;
  const p = world?.player;
  engine.listener = p && num(p.x) !== undefined ? { x: p.x, y: p.y } : null;
  // sikkerhet: glemt cutsceneEnd → støyen stopper etter 90 s uten cutscene-hendelser
  if (cutscene && performance.now() - cutscene.t > 90000) cutsceneEnd({ quiet: true });
  engine.setPaused(!!world?.paused || !!cutscene);
  tickCrates(dt);
  tickCinder(dt);
  if (pendingLevelStart && !world?.paused && !cutscene) { pendingLevelStart = false; play('levelStart', { when: engine.ac.currentTime + 0.3 }); }

  // intensitet: bølgeløft (synker sakte) + kamp-«varme» (synker raskt) + gulv når fiender lever
  if (!world?.paused) { // intensiteten fryses i pause
    // v1.7 Kessa Yard: etter waveEnd faller intensiteten mot ~0,1 på ca. 3 s (calmT); ellers som før
    if (musicId === 'yard' && calmT > 0) { calmT -= dt; waveBoost = Math.max(0, waveBoost - dt * 0.05); heat = Math.max(0, heat - dt * 0.3); }
    else waveBoost = Math.max(0, waveBoost - dt * 0.012);
    heat = Math.max(0, Math.min(0.6, heat) - dt * heat * 0.25);
  }
  const alive = Array.isArray(world?.enemies) ? world.enemies.some((e) => e && !e.dead) : false;
  let target = Math.min(1, waveBoost + heat + (alive ? 0.2 : 0));
  if (musicId === 'yard') { // gulv 0,25 + 0,1 per levende fiende; uten fiender ~0,1
    const n = alive ? world.enemies.filter((e) => e && !e.dead).length : 0;
    target = Math.min(1, Math.max(n ? 0.25 + 0.1 * n : 0.1, calmT > 0 ? Math.min(waveBoost + heat, 0.1 + calmT / 3 * 0.75) : waveBoost + heat));
  }
  if (bossActive) target = 1; // v1.4.1 midlertidig boss: maks til bossEnd
  if (p?.dead) target = 0.05;
  if (manualIntensity !== null) target = manualIntensity;
  if (music && Math.abs(target - lastIntensity) > 0.02) { music.setIntensity(target); lastIntensity = target; }
  music?.update(dt);
  credits?.update();
  menuMus?.update();

  // hjerteslag ved lav helse
  heartbeatT -= dt;
  if (heartbeatT <= 0 && checkLowHealth(false)) { play('heartbeat', {}); heartbeatT = 1.0; }

  // reserve-fottrinn for spilleren til Karakter-modulen sender 'footstep'
  if (!gotFootstepEvent && p && !p.dead && num(p.x) !== undefined) {
    if (lastPX !== null) {
      const v = Math.hypot(p.x - lastPX, p.y - lastPY) / Math.max(dt, 1e-3);
      if (v > 40) { footT -= dt; if (footT <= 0) { play('footstep', { x: p.x, y: p.y, surface: world.modules?.arena?.surfaceAt?.(world, p.x, p.y) ?? 'concrete', gain: 0.8 }); footT = v > 220 ? 0.28 : 0.38; } }
      else footT = 0.05;
    }
    lastPX = p.x; lastPY = p.y;
  }
}

export function update(dt, w) {
  if (w) world = w;
  lastExternalUpdate = performance.now();
  if (driver) { clearInterval(driver); driver = null; }
  tick(num(dt) ?? 1 / 60);
}

export function draw(ctx, w, camera) { /* lyd tegner ingenting */ }

// ---------------- v1.7: valg av spillmusikk og sidechain ----------------
/** arenaLoaded → 'yard' (brett 1) bruker yard-music.js, andre brett music.js. Bytter med kort kryssfade. */
function selectMusic(id) {
  const want = id === 'yard' ? 'yard' : 'cinder';
  if (want === musicId) return;
  musicId = want;
  if (!engine) return; // unlock() velger når AudioContext finnes
  const next = want === 'yard' ? yardMusic : cinderMusic;
  if (music && music !== next) music.fadeOut(1.2);
  music = next; lastIntensity = -1;
}
/** Sidechain på aktiv musikk (bare yard-music har duck). Skudd: maks én duck per 150 ms. */
function musicDuck(db, ms, isShot = false) {
  if (!engine || !music?.duck || wantMenu) return;
  if (isShot) { const t = nowMs(); if (t - lastShotDuck < 150) return; lastShotDuck = t; }
  music.duck(engine.ac.currentTime, db, ms);
}
/** Testverktøy (v1.7): MediaStream av ferdig miks (etter klipperen) – for opptak i headless (tools/voice/clip.cjs). */
export function _tap() {
  if (!engine) return null;
  if (!engine._tapDest) { engine._tapDest = engine.ac.createMediaStreamDestination(); engine.clip.output.connect(engine._tapDest); }
  return engine._tapDest.stream;
}
