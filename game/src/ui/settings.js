// BREACH – innstillinger (eies av Våpen/UI). Ingen DOM her: lagring, standardverdier og bruk på spillet.
// localStorage-nøkkel 'breach.settings', JSON { version, ...verdier }. Korrupte/manglende data → standard.
import * as audioModule from '../audio/index.js';

export const STORAGE_KEY = 'breach.settings';
export const SETTINGS_VERSION = 1;

/** Standardverdier. Volum 0..1, sensitivitet 0.25..2 (1 = nøytral), aimAssist 0..1 (0 = av), screenShake 0..1. */
export const DEFAULTS = Object.freeze({
  version: SETTINGS_VERSION,
  master: 0.8, music: 0.42, sfx: 1, voice: 1,
  mouseSensitivity: 1, aimAssist: 0,
  screenShake: 1, showFps: false, damageIndicator: true, offscreenEnemies: true,
});

/** Skjema: type, grenser og steg. Brukes til validering og av settings-skjermen. */
export const SCHEMA = {
  master: { type: 'range', min: 0, max: 1, step: 0.05 },
  music: { type: 'range', min: 0, max: 1, step: 0.05 },
  sfx: { type: 'range', min: 0, max: 1, step: 0.05 },
  voice: { type: 'range', min: 0, max: 1, step: 0.05 },   // Lyd v1.7 setVoiceVolume
  mouseSensitivity: { type: 'range', min: 0.25, max: 2, step: 0.05 },
  aimAssist: { type: 'range', min: 0, max: 1, step: 0.1 },
  screenShake: { type: 'range', min: 0, max: 1, step: 0.1 },
  showFps: { type: 'bool' },
  damageIndicator: { type: 'bool' },
  offscreenEnemies: { type: 'bool' },
};

const current = { ...DEFAULTS };
const listeners = new Set();
let loaded = false;
let audioApi = audioModule;          // kan byttes med setAudioAdapter (testsider, Arena-meny uten lyd osv.)
let bound = null;                    // { world, fps } fra applySettings

function storage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

/** Renser et vilkårlig objekt mot SCHEMA. Ukjente felt forkastes, ugyldige får standard. */
export function sanitize(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, s] of Object.entries(SCHEMA)) {
    const v = raw[k];
    if (s.type === 'bool') { if (typeof v === 'boolean') out[k] = v; continue; }
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (Number.isFinite(n)) out[k] = Math.round(Math.min(s.max, Math.max(s.min, n)) * 1000) / 1000;
  }
  out.version = SETTINGS_VERSION;
  return out;
}

/** Migrering mellom versjoner. Versjon 1 er første; ukjent/nyere versjon leses best mulig via sanitize. */
function migrate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // (fremtid) if (raw.version === 1) { ...; raw.version = 2; }
  return raw;
}

/** Leser fra localStorage (én gang, eller på nytt med force). Returnerer gjeldende innstillinger. */
export function loadSettings({ force = false } = {}) {
  if (loaded && !force) return current;
  loaded = true;
  let raw = null;
  const ls = storage();
  if (ls) {
    try { const txt = ls.getItem(STORAGE_KEY); if (txt) raw = migrate(JSON.parse(txt)); }
    catch (err) { console.info('[ui] breach.settings er korrupt – bruker standardverdier', err?.message); raw = null; }
  }
  Object.assign(current, sanitize(raw));
  return current;
}

export function saveSettings() {
  const ls = storage(); if (!ls) return false;
  try { ls.setItem(STORAGE_KEY, JSON.stringify({ ...current, version: SETTINGS_VERSION })); return true; }
  catch { return false; }   // privat modus / full kvote: spillet går videre uten lagring
}

/** Gjeldende innstillinger (levende, skrivebeskyttet for andre moduler – endre via setSetting). */
export function getSettings() { loadSettings(); return current; }

/** Endrer én verdi, bruker den på spillet, lagrer og varsler lyttere. Returnerer den rensede verdien. */
export function setSetting(key, value, { save = true } = {}) {
  loadSettings();
  if (!(key in SCHEMA)) return undefined;
  const clean = sanitize({ ...current, [key]: value })[key];
  if (current[key] === clean) return clean;
  current[key] = clean;
  applyOne(key);
  if (save) saveSettings();
  for (const fn of listeners) { try { fn(current, key); } catch (err) { console.error(err); } }
  bound?.world?.events?.emit?.('settingsChanged', { key, value: clean, settings: current });
  return clean;
}

export function resetSettings() {
  for (const k of Object.keys(SCHEMA)) setSetting(k, DEFAULTS[k], { save: false });
  saveSettings();
  return current;
}

/** Lytter på endringer: fn(settings, key). Returnerer off(). */
export function onSettingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Bytt lydkobling. Adapteren trenger setMasterVolume/setMusicVolume/setSfxVolume/setVoiceVolume (alle valgfrie). */
export function setAudioAdapter(api) { audioApi = api || null; applyAudio(); }

function applyAudio() {
  const a = audioApi; if (!a) return;
  a.setMasterVolume?.(current.master); a.setMusicVolume?.(current.music); a.setSfxVolume?.(current.sfx); a.setVoiceVolume?.(current.voice);
}

function applyOne(key) {
  if (key === 'master' || key === 'music' || key === 'sfx' || key === 'voice') applyAudio();
  const w = bound?.world;
  if (key === 'screenShake' && w?.camera) w.camera.shakeScale = current.screenShake;
  if (key === 'showFps') bound?.fps?.setVisible(current.showFps);
}

/**
 * Bruker alle innstillinger på spillet. Kall én gang ved oppstart (etter audio.init og at kameraet finnes).
 * - lyd: master/music/sfx via audio-API-et
 * - world.camera.shakeScale = screenShake
 * - world.settings = getSettings() (Karakter/Våpen leser mouseSensitivity/aimAssist herfra)
 * - fps: valgfri FPS-visning ({ setVisible(bool) }, se fps.js)
 */
export function applySettings(world, { fps = null } = {}) {
  loadSettings();
  bound = { world, fps: fps ?? bound?.fps ?? null };
  if (world) world.settings = current;
  applyAudio();
  if (world?.camera) world.camera.shakeScale = current.screenShake;
  bound.fps?.setVisible(current.showFps);
  return current;
}
