// Offline-render av Breach-lyder i headless Chromium → .f32 (interleaved stereo float32) + .json meta.
// Bruk: node render.cjs <outDir> [baseUrl]   (krever python3 -m http.server i game/)
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || '/workspace/breach/reviews/lyd-2026-10-23';
const base = process.argv[3] || 'http://localhost:8765';
fs.mkdirSync(out, { recursive: true });

const auto = (name, n, gap, extra = {}) => Array.from({ length: n }, (_, i) => ({ name, at: 0.05 + i * gap, opts: extra }));
const JOBS = {
  rifle: { dur: 1.0, sounds: [{ name: 'rifle' }] },
  enemyRifle: { dur: 0.8, sounds: [{ name: 'enemyRifle' }] },
  heavy: { dur: 1.4, sounds: [{ name: 'heavy' }] },
  shotgun: { dur: 1.4, sounds: [{ name: 'shotgun' }] },
  marksman: { dur: 2.2, sounds: [{ name: 'marksman' }] },
  enemyShotgun: { dur: 1.0, sounds: [{ name: 'enemyShotgun' }] },
  enemyMarksman: { dur: 2.2, sounds: [{ name: 'enemyMarksman' }] },
  chamber_rifle: { dur: 0.6, sounds: [{ name: 'chamberRifle' }] },
  chamber_shotgun: { dur: 0.9, sounds: [{ name: 'chamberShotgun' }] },
  chamber_marksman: { dur: 1.0, sounds: [{ name: 'chamberMarksman' }] },
  weapons_compare: { dur: 5.6, sounds: [{ name: 'rifle', at: 0.05 }, { name: 'rifle', at: 0.16 }, { name: 'rifle', at: 0.27 }, { name: 'shotgun', at: 1.1 }, { name: 'chamberShotgun', at: 1.48 }, { name: 'marksman', at: 2.6 }, { name: 'chamberMarksman', at: 3.35 }] },
  enemy_compare: { dur: 7.0, sounds: [{ name: 'shotgun', at: 0.05 }, { name: 'enemyShotgun', at: 1.0 }, { name: 'marksman', at: 2.2 }, { name: 'enemyMarksman', at: 4.4 }] },
  shotgun_x4: { dur: 3.6, sounds: auto('shotgun', 4, 0.8).flatMap((s) => [s, { name: 'chamberShotgun', at: s.at + 0.38 }]) },
  marksman_x3: { dur: 4.4, sounds: auto('marksman', 3, 1.3).flatMap((s) => [s, { name: 'chamberMarksman', at: s.at + 0.75 }]) },
  // kringkasting: musikk (dukket som i pause) + støygulv + åpning + replikker per speaker + nytt bilde + slutt
  // v1.4.1 CINDER-radio: introens faktiske rekkefølge (caption ×2 → announcer → command → warden → caption → warden)
  broadcast_intro: { dur: 13.0, music: { intensity: 0.2 }, paused: true,
    bed: [{ at: 0.05, mode: 'idle' }, { at: 3.0, mode: 'caption' }, { at: 4.6, mode: 'caption' }, { at: 6.2, mode: 'announcer' }, { at: 8.4, mode: 'command' }, { at: 9.6, mode: 'warden' }, { at: 10.4, mode: 'caption' }, { at: 11.2, mode: 'warden' }, { at: 12.2, mode: 'stop' }],
    sounds: [{ name: 'bcastStart', at: 0.05, opts: { id: 'intro' } }, { name: 'radioAnnouncer', at: 6.2 }, { name: 'radioPanel', at: 8.28 }, { name: 'radioCommand', at: 8.4 },
      { name: 'radioWarden', at: 9.6 }, { name: 'radioPanel', at: 10.28 }, { name: 'radioWarden', at: 11.2 }, { name: 'bcastEnd', at: 11.8, opts: { id: 'intro' } }] },
  broadcast_openings: { dur: 10.0, bed: [{ at: 0.05, mode: 'idle' }, { at: 9.4, mode: 'stop' }],
    sounds: [{ name: 'bcastStart', at: 0.05, opts: { id: 'yard-clear' } }, { name: 'bcastEnd', at: 1.0, opts: { id: 'yard-clear' } }, { name: 'bcastStart', at: 1.8, opts: { id: 'foundry-core' } },
      { name: 'bcastStart', at: 3.6, opts: { id: 'ending' } }, { name: 'bcastEnd', at: 4.4, opts: { id: 'ending' } }, { name: 'bcastStart', at: 5.4, opts: { id: 'fallen' } },
      { name: 'bcastStart', at: 7.0, opts: { id: 'refinery-clear' } }, { name: 'bcastEnd', at: 8.4, opts: { id: 'refinery-clear', skipped: true } }] },
  occlusion_compare: { dur: 1.6, listener: { x: 0, y: 0 }, sounds: [{ name: 'enemyRifle', at: 0.05, opts: { x: 300, y: 0, occluded: false } }, { name: 'enemyRifle', at: 0.8, opts: { x: 300, y: 0, occluded: true } }] },
  explosion: { dur: 4.0, sounds: [{ name: 'explosion' }] },
  coverSlide_metal_high: { dur: 1.6, sounds: [{ name: 'coverSlide', opts: { type: 'high', surface: 'metal' } }] },
  coverSlide_concrete_low: { dur: 1.4, sounds: [{ name: 'coverSlide', opts: { type: 'low', surface: 'concrete' } }] },
  hitBody: { dur: 0.6, sounds: [{ name: 'hitBody' }] },
  hitMetal: { dur: 1.0, sounds: [{ name: 'hitMetal' }] },
  hitConcrete: { dur: 0.8, sounds: [{ name: 'hitConcrete' }] },
  hitSand: { dur: 0.6, sounds: [{ name: 'hitSand' }] },
  footsteps: { dur: 2.0, sounds: [...auto('footstep', 3, 0.33, { surface: 'concrete' }), ...auto('footstep', 3, 0.33, { surface: 'metal' }).map((s) => ({ ...s, at: s.at + 1.0 }))] },
  reload: { dur: 1.8, sounds: [{ name: 'reload' }] },
  roll: { dur: 1.0, sounds: [{ name: 'roll' }] },
  grenadeThrow: { dur: 1.2, sounds: [{ name: 'grenadeThrow' }] },
  waveStart: { dur: 3.2, sounds: [{ name: 'waveStart' }] },
  waveEnd: { dur: 2.8, sounds: [{ name: 'waveEnd' }] },
  // v1.3: lading (én lyd per fase, slik Våpen sender), mekanikk, nivå-stingere, fallen kort/lang
  reload_rifle_normal: { dur: 2.4, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'reloadDone', at: 1.6, opts: { weapon: 'rifle' } }] },
  reload_active_perfect: { dur: 4.6, sounds: ['rifle', 'shotgun', 'marksman'].flatMap((w, i) => [{ name: 'reloadStart', at: 0.05 + i * 1.5, opts: { weapon: w } }, { name: 'activePerfect', at: 0.75 + i * 1.5, opts: { weapon: w } }, { name: 'reloadDone', at: 0.755 + i * 1.5, opts: { weapon: w } }]) },
  reload_active_good: { dur: 1.8, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'activeGood', at: 0.75, opts: { weapon: 'rifle' } }, { name: 'reloadDone', at: 0.755, opts: { weapon: 'rifle' } }] },
  reload_active_fail: { dur: 3.0, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'activeFail', at: 0.75, opts: { weapon: 'rifle' } }, { name: 'reloadDone', at: 1.85, opts: { weapon: 'rifle' } }] },
  activePerfect: { dur: 0.8, sounds: [{ name: 'activePerfect', opts: { weapon: 'rifle' } }] },
  activeGood: { dur: 0.5, sounds: [{ name: 'activeGood', opts: { weapon: 'rifle' } }] },
  activeFail: { dur: 0.9, sounds: [{ name: 'activeFail', opts: { weapon: 'rifle' } }] },
  dryFire: { dur: 1.2, sounds: [{ name: 'dryFire', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'dryFire', at: 0.45, opts: { weapon: 'shotgun' } }, { name: 'dryFire', at: 0.85, opts: { weapon: 'marksman' } }] },
  weaponSwitch: { dur: 3.0, sounds: [{ name: 'weaponSwitch', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'weaponSwitch', at: 1.0, opts: { weapon: 'shotgun' } }, { name: 'weaponSwitch', at: 2.0, opts: { weapon: 'marksman' } }] },
  grenadeBounce: { dur: 1.6, sounds: [{ name: 'grenadeBounce', at: 0.05, opts: { surface: 'concrete', k: 1 } }, { name: 'grenadeBounce', at: 0.6, opts: { surface: 'metal', k: 1 } }, { name: 'grenadeBounce', at: 1.15, opts: { surface: 'concrete', k: 0.4, gain: 0.7 } }] },
  grenadeBounce_x6: { dur: 1.0, sounds: auto('grenadeBounce', 6, 0.04, { surface: 'metal', k: 0.9 }) },
  refill: { dur: 1.0, sounds: [{ name: 'refill' }] },
  crateReady: { dur: 0.8, sounds: [{ name: 'crateReady' }] },
  melee_hit: { dur: 1.0, sounds: [{ name: 'meleeStart', at: 0.05 }, { name: 'meleeHit', at: 0.17 }, { name: 'meleeEnd', at: 0.37, opts: { gain: 0.6 } }] },
  melee_miss: { dur: 1.0, sounds: [{ name: 'meleeStart', at: 0.05 }, { name: 'meleeMiss', at: 0.17 }, { name: 'meleeEnd', at: 0.37, opts: { gain: 0.6 } }] },
  grenade_windup_throw: { dur: 1.2, sounds: [{ name: 'grenadePin', at: 0.05 }, { name: 'grenadeThrow', at: 0.30 }] },
  fallen_neutral: { dur: 6.5, sounds: [{ name: 'fallen', at: 0.05 }, { name: 'fallen', at: 4.6, opts: { short: true } }] },
  bulletGraze_x6: { dur: 1.4, sounds: auto('bulletGraze', 6, 0.15) },
  reloadCancel: { dur: 0.8, sounds: [{ name: 'reloadCancel', at: 0.05, opts: { weapon: 'rifle' } }] },
  melee_cancels_reload: { dur: 2.0, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'meleeStart', at: 0.65 }, { name: 'reloadCancel', at: 0.70, opts: { weapon: 'rifle', gain: 0.75 } }, { name: 'meleeHit', at: 0.77 }, { name: 'meleeEnd', at: 0.97, opts: { gain: 0.6 } }] },
  melee_cancels_reload_nocancel: { dur: 2.0, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'rifle' } }, { name: 'meleeStart', at: 0.65 }, { name: 'meleeHit', at: 0.77 }, { name: 'meleeEnd', at: 0.97, opts: { gain: 0.6 } }] },
  levelStart: { dur: 5.0, sounds: [{ name: 'levelStart' }] },
  upgrade_open: { dur: 1.6, sounds: [{ name: 'upgradeOpen' }] },
  upgrade: { dur: 2.0, sounds: [{ name: 'upgrade' }] },
  levelEnd: { dur: 5.0, sounds: [{ name: 'levelEnd' }] },
  levelEnd_music: { dur: 8.0, music: { intensity: 0.8, fadeAt: 3.0, fade: 2.5 }, sounds: [{ name: 'levelEnd', at: 3.0 }] },
  gameComplete: { dur: 15.0, sounds: [{ name: 'gameComplete' }] },
  fallen_full_vs_short: { dur: 5.0, bed: [{ at: 0.05, mode: 'idle' }, { at: 2.0, mode: 'stop' }, { at: 3.0, mode: 'idle' }, { at: 4.0, mode: 'stop' }],
    sounds: [{ name: 'bcastStart', at: 0.05, opts: { id: 'fallen' } }, { name: 'bcastEnd', at: 1.9, opts: { id: 'fallen' } }, { name: 'bcastStart', at: 3.0, opts: { id: 'fallen', short: true } }, { name: 'bcastEnd', at: 3.6, opts: { id: 'fallen', short: true } }] },
  // v1.4: Våpen rev. 4 (minigun-lading, Kiln) + CINDER
  reload_minigun: { dur: 4.4, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'minigun', gain: 0.6 } }, { name: 'reloadDone', at: 3.05, opts: { weapon: 'minigun', gain: 0.6 } }] },
  reload_minigun_active: { dur: 4.6, sounds: ['activePerfect', 'activeGood', 'activeFail'].flatMap((n, i) => [{ name: n, at: 0.05 + i * 1.5, opts: { weapon: 'minigun', gain: 0.6 } }]) },
  reload_unknown_fallback: { dur: 2.4, sounds: [{ name: 'reloadStart', at: 0.05, opts: { weapon: 'plasma' } }, { name: 'reloadDone', at: 1.6, opts: { weapon: 'plasma' } }] },
  cinder_spawn: { dur: 7.0, sounds: [['grunt', 0.05], ['flanker', 2.2], ['heavy', 4.2]].flatMap(([type, at]) => [{ name: 'spawnWarn', at, opts: { type, warn: 0.9 } }, { name: 'spawnRise', at: at + 0.9, opts: { type } }]) },
  cinder_steps: { dur: 4.0, sounds: ['grunt', 'flanker', 'heavy', 'grenadier'].flatMap((type, j) => auto('chitinStep', 3, 0.3, { type }).map((s) => ({ ...s, at: s.at + j * 1.0 }))) },
  cinder_attacks: { dur: 5.5, sounds: [{ name: 'chitinRattle', at: 0.05, opts: { type: 'grunt', duration: 0.5 } }, { name: 'lurcherCharge', at: 0.9, opts: { duration: 0.35 } }, { name: 'kilnSpinup', at: 1.8, opts: { duration: 1.0 } }, { name: 'heavy', at: 2.85 }, { name: 'heavy', at: 3.0 }, { name: 'kilnSpindown', at: 3.3 }, { name: 'spitWindup', at: 4.2, opts: { duration: 0.75 } }] },
  cinder_hits: { dur: 2.0, sounds: [...auto('hitChitin', 4, 0.12, { type: 'grunt' }), ...auto('hitChitin', 3, 0.15, { type: 'heavy' }).map((s) => ({ ...s, at: s.at + 1.0 }))] },
  cinder_death: { dur: 7.0, sounds: [{ name: 'cinderDeath', at: 0.05, opts: { type: 'grunt' } }, { name: 'cinderDeath', at: 2.4, opts: { type: 'flanker' } }, { name: 'cinderDeath', at: 4.3, opts: { type: 'heavy' } }] },
  cinder_embers: { dur: 3.0, sounds: [...auto('emberIdle', 8, 0.33, { type: 'grunt' }), { name: 'emberIdle', at: 1.4, opts: { type: 'heavy' } }] },
  spitter_sac: { dur: 4.0, sounds: [{ name: 'spitWindup', at: 0.05, opts: { duration: 0.75 } }, { name: 'spitPlop', at: 0.8 }, { name: 'sacBounce', at: 1.3 }, { name: 'sacSplat', at: 1.55, opts: { fuse: 0.75 } }, { name: 'acidBurst', at: 2.3 }] },
  // mange fiender samtidig: 8 spawns, 30 kitintrinn, angrep, 20 fiendeskudd + Kiln, 14 treff, 5 dødsfall, glør, 2 sekker, full kampmusikk
  cinder_horde_mix: { dur: 8.0, listener: { x: 0, y: 0 }, music: { intensity: 1 }, sounds: (() => {
    const P = () => ({ x: (Math.random() * 2 - 1) * 450, y: (Math.random() * 2 - 1) * 300 }), T4 = ['grunt', 'flanker', 'heavy', 'grenadier'], ty = (i) => T4[i % 4], L = [];
    for (let i = 0; i < 8; i++) { const at = 0.05 + i * 0.12, p = P(); L.push({ name: 'spawnWarn', at, opts: { ...p, type: ty(i), warn: 1.0 } }, { name: 'spawnRise', at: at + 1.0, opts: { ...p, type: ty(i) } }); }
    for (let i = 0; i < 30; i++) L.push({ name: 'chitinStep', at: 1.2 + i * 0.2, opts: { ...P(), type: ty(i) } });
    for (let i = 0; i < 20; i++) L.push({ name: 'enemyRifle', at: 2.0 + i * 0.22, opts: P() });
    L.push({ name: 'kilnSpinup', at: 2.2, opts: { ...P(), duration: 0.9 } }, ...auto('heavy', 8, 0.12).map((s) => ({ ...s, at: s.at + 3.1, opts: { x: 300, y: 100 } })));
    L.push({ name: 'lurcherCharge', at: 3.4, opts: P() }, { name: 'chitinRattle', at: 2.6, opts: P() }, { name: 'chitinRattle', at: 4.1, opts: P() });
    for (let i = 0; i < 14; i++) L.push({ name: 'hitChitin', at: 2.5 + i * 0.25, opts: { ...P(), type: ty(i) } });
    for (let i = 0; i < 16; i++) L.push({ name: 'rifle', at: 2.4 + i * 0.12 });
    for (let i = 0; i < 5; i++) L.push({ name: 'cinderDeath', at: 3.5 + i * 0.6, opts: { ...P(), type: ty(i) } });
    for (let i = 0; i < 16; i++) L.push({ name: 'emberIdle', at: 1.5 + i * 0.35, opts: P() });
    L.push({ name: 'spitPlop', at: 3.0, opts: P() }, { name: 'sacSplat', at: 3.6, opts: { x: 80, y: 40, fuse: 0.6 } }, { name: 'acidBurst', at: 4.2, opts: { x: 80, y: 40 } });
    L.push({ name: 'explosion', at: 5.0, opts: { x: -120, y: 60 } });
    return L; })() },
  // v1.4.1: organiske fiendeskudd, Kiln Alpha, knurregrense
  spine_shot: { dur: 2.2, listener: { x: 0, y: 0 }, sounds: [0, 0.5, 0.75, 1.0, 1.25].map((at, i) => ({ name: 'spineShot', at: at + 0.05, opts: { x: [200, -150, 250, 100, -220][i], y: [0, 80, -60, 120, -40][i] } })) },
  slag_spray: { dur: 3.0, listener: { x: 0, y: 0 }, sounds: [{ name: 'kilnSpinup', at: 0.05, opts: { x: 250, y: 50, duration: 0.8 } }, ...Array.from({ length: 16 }, (_, i) => ({ name: 'slagSpray', at: 0.85 + i * 0.09, opts: { x: 250, y: 50 } })), { name: 'kilnSpindown', at: 2.35, opts: { x: 250, y: 50 } }] },
  slag_spray_alpha: { dur: 3.0, listener: { x: 0, y: 0 }, sounds: [{ name: 'kilnSpinup', at: 0.05, opts: { x: 250, y: 50, duration: 0.8, type: 'kilnAlpha' } }, ...Array.from({ length: 16 }, (_, i) => ({ name: 'slagSpray', at: 0.85 + i * 0.09, opts: { x: 250, y: 50, type: 'kilnAlpha' } })), { name: 'kilnSpindown', at: 2.35, opts: { x: 250, y: 50 } }] },
  kiln_vs_alpha: { dur: 12.0, sounds: [{ name: 'spawnWarn', at: 0.05, opts: { type: 'heavy', warn: 1.2 } }, { name: 'spawnRise', at: 1.25, opts: { type: 'heavy' } }, { name: 'hitChitin', at: 2.8, opts: { type: 'heavy' } }, { name: 'cinderDeath', at: 3.3, opts: { type: 'heavy' } },
    { name: 'spawnWarn', at: 6.0, opts: { type: 'kilnAlpha', warn: 1.2 } }, { name: 'spawnRise', at: 7.2, opts: { type: 'kilnAlpha' } }, { name: 'hitChitin', at: 8.6, opts: { type: 'kilnAlpha' } }, { name: 'cinderDeath', at: 9.1, opts: { type: 'kilnAlpha' } }] },
  growl_limit: { dur: 4.0, listener: { x: 0, y: 0 }, sounds: ['grunt', 'flanker', 'heavy', 'grenadier', 'grunt', 'flanker'].map((type, i) => ({ name: 'cinderDeath', at: 0.05 + i * 0.05, opts: { type, x: -300 + i * 120, y: 50 } })) },
  cinder_horde_organic: { dur: 8.0, listener: { x: 0, y: 0 }, music: { intensity: 1 }, sounds: (() => {
    const P = () => ({ x: (Math.random() * 2 - 1) * 450, y: (Math.random() * 2 - 1) * 300 }), T4 = ['grunt', 'flanker', 'heavy', 'grenadier'], ty = (i) => T4[i % 4], L = [];
    for (let i = 0; i < 8; i++) { const at = 0.05 + i * 0.12, p = P(); L.push({ name: 'spawnWarn', at, opts: { ...p, type: ty(i), warn: 1.0 } }, { name: 'spawnRise', at: at + 1.0, opts: { ...p, type: ty(i) } }); }
    for (let i = 0; i < 30; i++) L.push({ name: 'chitinStep', at: 1.2 + i * 0.2, opts: { ...P(), type: ty(i) } });
    for (let i = 0; i < 20; i++) L.push({ name: 'spineShot', at: 2.0 + i * 0.22, opts: P() });
    L.push({ name: 'kilnSpinup', at: 2.2, opts: { x: 300, y: 100, duration: 0.9 } }, ...Array.from({ length: 18 }, (_, i) => ({ name: 'slagSpray', at: 3.1 + i * 0.09, opts: { x: 300, y: 100, type: 'kilnAlpha' } })));
    for (let i = 0; i < 14; i++) L.push({ name: 'hitChitin', at: 2.5 + i * 0.25, opts: { ...P(), type: ty(i) } });
    for (let i = 0; i < 16; i++) L.push({ name: 'rifle', at: 2.4 + i * 0.12 });
    for (let i = 0; i < 5; i++) L.push({ name: 'cinderDeath', at: 3.5 + i * 0.6, opts: { ...P(), type: ty(i) } });
    for (let i = 0; i < 16; i++) L.push({ name: 'emberIdle', at: 1.5 + i * 0.35, opts: P() });
    L.push({ name: 'spitPlop', at: 3.0, opts: P() }, { name: 'sacSplat', at: 3.6, opts: { x: 80, y: 40, fuse: 0.6 } }, { name: 'acidBurst', at: 4.2, opts: { x: 80, y: 40 } }, { name: 'explosion', at: 5.0, opts: { x: -120, y: 60 } });
    return L; })() },
  // v1.4.1 synk-måling for Effekter: én lyd alene, start 0,1 s
  sync_meleeHit_chitin: { dur: 3.0, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'chitin', immediate: true } }] },
  sync_meleeHit_kill: { dur: 3.0, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'chitin', killed: true, immediate: true } }] },
  sync_meleeHit_metal: { dur: 3.0, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'metal', immediate: true } }] },
  sync_meleeHit_flesh: { dur: 3.0, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'flesh', immediate: true } }] },
  sync_meleeHit_old: { dur: 3.0, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'chitin' } }] },
  menu_music: { dur: 40, menu: { at: 0.05, stopAt: 34 }, sounds: [{ name: 'menuStart', at: 33.9 }] },
  menu_ui: { dur: 2.0, sounds: [0.1, 0.25, 0.4, 0.55].map((at) => ({ name: 'uiHover', at })).concat([{ name: 'uiClick', at: 1.0 }]) },
  scene_yard_clear: { dur: 26, paused: true, scene: { id: 'yard-clear', at: 0.05, panels: [[0, 0.05], [1, 9], [2, 16]], stopAt: 23 }, sounds: [{ name: 'bcastStart', at: 0.05, opts: { id: 'yard-clear' } }, { name: 'bcastEnd', at: 23, opts: { id: 'yard-clear' } }], bed: [{ at: 0.05, mode: 'idle' }, { at: 1.5, mode: 'caption' }, { at: 3, mode: 'command' }, { at: 23.2, mode: 'stop' }] },
  scene_intro: { dur: 30, paused: true, scene: { id: 'intro', at: 0.05, panels: [[0, 0.05], [1, 8], [2, 14], [3, 20]], stopAt: 27 }, sounds: [{ name: 'bcastStart', at: 0.05, opts: { id: 'intro' } }, { name: 'bcastEnd', at: 27, opts: { id: 'intro' } }], bed: [{ at: 0.05, mode: 'idle' }, { at: 8.2, mode: 'announcer' }, { at: 27.2, mode: 'stop' }] },
  sync_hitChitin: { dur: 4.0, sounds: [{ name: 'hitChitin', at: 0.1, opts: { type: 'grunt' } }] },
  sync_hitChitin_kiln: { dur: 4.0, sounds: [{ name: 'hitChitin', at: 0.1, opts: { type: 'heavy' } }] },
  sync_hitChitin_alpha: { dur: 4.0, sounds: [{ name: 'hitChitin', at: 0.1, opts: { type: 'kilnAlpha' } }] },
  sync_hitBody: { dur: 4.0, sounds: [{ name: 'hitBody', at: 0.1, opts: {} }] },
  sync_hitMetal: { dur: 4.0, sounds: [{ name: 'hitMetal', at: 0.1, opts: {} }] },
  sync_hitConcrete: { dur: 4.0, sounds: [{ name: 'hitConcrete', at: 0.1, opts: {} }] },
  sync_playerHurt: { dur: 4.0, sounds: [{ name: 'playerHurt', at: 0.1, opts: {} }] },
  sync_bulletGraze: { dur: 4.0, sounds: [{ name: 'bulletGraze', at: 0.1, opts: {} }] },
  sync_cinderDeath: { dur: 4.0, sounds: [{ name: 'cinderDeath', at: 0.1, opts: { type: 'grunt' } }] },
  sync_cinderDeath_kiln: { dur: 4.0, sounds: [{ name: 'cinderDeath', at: 0.1, opts: { type: 'heavy' } }] },
  sync_cinderDeath_alpha: { dur: 4.0, sounds: [{ name: 'cinderDeath', at: 0.1, opts: { type: 'kilnAlpha' } }] },
  sync_death: { dur: 4.0, sounds: [{ name: 'death', at: 0.1, opts: {} }] },
  sync_death_player: { dur: 4.0, sounds: [{ name: 'death', at: 0.1, opts: { player: true } }] },
  sync_acidBurst: { dur: 4.0, sounds: [{ name: 'acidBurst', at: 0.1, opts: {} }] },
  sync_explosion: { dur: 4.0, sounds: [{ name: 'explosion', at: 0.1, opts: {} }] },
  v15_melee_rifle: { dur: 1.5, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'chitin', held: 'rifle', immediate: true } }] },
  v15_melee_shotgun_kill: { dur: 1.5, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'chitin', held: 'shotgun', killed: true, immediate: true } }] },
  v15_melee_marksman_kill: { dur: 1.5, sounds: [{ name: 'meleeHit', at: 0.1, opts: { surface: 'chitin', held: 'marksman', killed: true, immediate: true } }] },
  v15_explosion_frag: { dur: 3.5, sounds: [{ name: 'explosion', at: 0.05, opts: { kind: 'frag' } }] },
  v15_impacts: { dur: 2.0, sounds: [{ name: 'hitConcrete', at: 0.05 }, { name: 'hitMetal', at: 0.5 }, { name: 'hitSand', at: 1.0 }, { name: 'hitChitin', at: 1.4 }] },
  sync_meleeHit: { dur: 4.0, sounds: [{ name: 'meleeHit', at: 0.1, opts: {} }] },
  // v1.4.1 Story og brett: restart, boss (midlertidig), rulletekst, ashmaw-rise
  restart: { dur: 2.5, sounds: [{ name: 'restart' }] },
  credits: { dur: 40, credits: { at: 0.05, stopAt: 34 } },
  boss_start: { dur: 5.5, music: { intensity: 1 }, sounds: [{ name: 'bossStart' }] },
  boss_phase: { dur: 2.5, sounds: [{ name: 'bossPhase' }] },
  boss_end: { dur: 9.0, sounds: [{ name: 'bossEnd' }] },
  broadcast_ashmaw: { dur: 3.5, bed: [{ at: 0.05, mode: 'idle' }, { at: 2.4, mode: 'command' }, { at: 3.3, mode: 'stop' }], sounds: [{ name: 'bcastStart', at: 0.05, opts: { id: 'ashmaw-rise' } }, { name: 'radioCommand', at: 2.4 }] },
  // stresstester
  autofire_rifle_20: { dur: 3.2, sounds: auto('rifle', 20, 0.11) },
  firefight_mix: { dur: 4.5, sounds: [...auto('rifle', 16, 0.12), ...auto('enemyRifle', 14, 0.15).map((s) => ({ ...s, at: s.at + 0.07 })), ...auto('heavy', 3, 0.7).map((s) => ({ ...s, at: s.at + 0.3 })), { name: 'explosion', at: 1.2 }, { name: 'explosion', at: 1.35 }, ...auto('hitMetal', 6, 0.3)] },
  music_ambient: { dur: 20, music: { intensity: 0 }, sounds: [] },
  music_combat: { dur: 20, music: { intensity: 1 }, sounds: [] },
};

(async () => {
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/src/audio/tools/render.html');
  await page.waitForFunction(() => window.ready === true);
  for (const [name, job] of Object.entries(JOBS)) {
    if (only && !only.includes(name)) continue;
    const r = await page.evaluate((j) => window.renderJob(j), job);
    const L = new Float32Array(Buffer.from(r.L, 'base64').buffer.slice(0));
    const R = new Float32Array(Buffer.from(r.R, 'base64').buffer.slice(0));
    const inter = new Float32Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
    fs.writeFileSync(path.join(out, name + '.f32'), Buffer.from(inter.buffer));
    fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ sr: r.sr, frames: L.length }));
    console.log('rendret', name, L.length);
  }
  if (errors.length) console.log('KONSOLL:', errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
