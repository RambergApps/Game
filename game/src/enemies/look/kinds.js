// Animasjonssett per type: hvert sett = n bilder, pose(i, n) → parametre til build().
// v2 (demo brett 1): færre bilder. Treff er tint + rykk under kjøring (ingen egne bilder). Død (2 bilder) bakes først
// når en fiende dør. Lurcher bruker samme gangsett til gange og løp (kragen halvåpen), med takt fra farten.
import { buildHusk } from './husk.js';
import { buildLurcher } from './lurcher.js';
import { buildSpitter } from './spitter.js';
import { buildKiln } from './kiln.js';
import { buildHunker, HUNKER_SCALE } from './hunker.js';

const cyc = (i, n) => i / n;
/** Spitter: varianter med 0–2 fulle sekker ('walk#1' osv., kun idle/gange, 8 retninger) – bakes kun ved behov (reserve = samme bilde med 3 sekker). */
function withSacks(S) { for (const b of ['idle', 'walk']) for (let k = 0; k < 3; k++) { const B = S[b]; S[`${b}#${k}`] = { n: B.n, dirs: 8, pose: (i, n) => ({ ...B.pose(i, n), sacks: k }) }; } return S; }
/** Vinkelbøtter per positur (som def.faceted.buckets i Karakters faceted/; monstre 16). */
export const DIRS = 16;
import { D as BAKE_D } from './zoom.js';
/** Ved nær kamera (bakezoom ≥ 1,75) får korte angrepsposer 8 retninger i stedet for 16 (minne ∝ zoom²). Se FIENDE-DESIGN.md. */
const RARE_DIRS = BAKE_D >= 1.75 ? 8 : undefined;
export const KINDS = {
  grunt: {
    name: 'husk', memShare: 8.75, build: buildHusk, scale: 1.18, buckets: DIRS, maxMB: 7.6,
    paint: { warm: [190, 42, 26], groundH: 16, warmK: 0.25 },
    rim: { a: 0.8, px: 1 }, contour: { a: 0.9, px: 0.9 }, shadowA: 0.34,
    pulse: { period: 1.6, min: 0.78 },
    sets: {
      idle: { n: 2, pose: (i, n) => ({ br: cyc(i, n) + 0.25 }) },
      walk: { n: 6, pose: (i, n) => ({ g: cyc(i, n), amp: 1 }) },
      attack: { dirs: RARE_DIRS, n: 3, pose: (i, n) => ({ atk: (i + 0.5) / n }) },
      die: { n: 2, dirs: 4, pose: (i, n) => ({ die: (i + 1) / n }) },
    },
  },
  flanker: {
    name: 'lurcher', memShare: 4.6, build: buildLurcher, scale: 0.95, buckets: DIRS, maxMB: 4.4,
    paint: { warm: [120, 22, 16], groundH: 12, warmK: 0.25 },
    rim: { a: 0.8, px: 0.8, color: '232,140,88' }, contour: { a: 0.9, px: 0.9 }, shadowA: 0.34,
    pulse: { period: 2.2, min: 0.82 },
    sets: {
      idle: { n: 2, pose: (i, n) => ({ br: cyc(i, n) + 0.25, fr: 0.45 }) },
      walk: { n: 6, pose: (i, n) => ({ g: cyc(i, n), amp: 1.1, fr: 0.8 }) },
      attack: { dirs: RARE_DIRS, n: 4, pose: (i, n) => ({ atk: (i + 0.5) / n }) },
      die: { n: 2, dirs: 4, pose: (i, n) => ({ die: (i + 1) / n }) },
    },
  },
  grenadier: {
    name: 'spitter', memShare: 6.15, build: buildSpitter, scale: 1.0, buckets: DIRS, maxMB: 4.6, sackVar: true,
    paint: { warm: [110, 60, 200], groundH: 22, warmK: 0.18 },
    rim: { a: 0.7, px: 0.7, color: '200,176,230' }, contour: { a: 0.9, px: 0.9 }, shadowA: 0.34,
    pulse: { period: 1.9, min: 0.75 },
    sets: withSacks({
      idle: { n: 1, pose: () => ({ br: 0.25 }) },
      walk: { n: 4, pose: (i, n) => ({ g: cyc(i, n), amp: 1 }) },
      attack: { dirs: RARE_DIRS, n: 4, pose: (i, n) => ({ atk: (i + 0.5) / n }) },
      die: { n: 2, dirs: 4, pose: (i, n) => ({ die: (i + 1) / n, sacks: 0 }) },
    }),
  },
  heavy: {
    name: 'kiln', memShare: 5.0, build: buildKiln, scale: 1.0, buckets: DIRS, maxMB: 4.3,
    paint: { warm: [255, 122, 26], groundH: 14, warmK: 0.3 },
    rim: { a: 0.75, px: 0.9, color: '255,206,150' }, contour: { a: 0.9, px: 0.9 }, shadowA: 0.38,
    pulse: { period: 2.6, min: 0.8 },
    sets: {
      idle: { n: 1, pose: () => ({ br: 0.25 }) },
      walk: { n: 4, pose: (i, n) => ({ g: cyc(i, n), amp: 1 }) },
      attack: { dirs: RARE_DIRS, n: 4, pose: (i, n) => ({ atk: (i + 0.5) / n }) },
      die: { n: 2, dirs: 4, pose: (i, n) => ({ die: (i + 1) / n }) },
    },
  },
  // Hunker (#e0c234): cover-bruker. cover = peek-trinn 0..3 (0 dukket, 3 reist med rifla på muren); attack = skudd (kun reist).
  hunker: {
    name: 'hunker', memShare: 7.5, build: buildHunker, scale: HUNKER_SCALE, buckets: DIRS, maxMB: 4.5, cover: true, lazyWarm: true,
    paint: { warm: [224, 194, 52], groundH: 14, warmK: 0.22 },
    rim: { a: 0.75, px: 0.9, color: '240,222,150' }, contour: { a: 0.9, px: 0.9 }, shadowA: 0.36,
    pulse: { period: 2.3, min: 0.8 },
    warm: [['cover', 0], ['cover', 3], ['attack', 0], ['walkc', 0], ['cover', 1], ['cover', 2], ['walkc', 2]],
    sets: {
      idle: { n: 1, pose: () => ({ br: 0.25 }) },
      walk: { n: 4, pose: (i, n) => ({ g: cyc(i, n), amp: 1 }) },
      walkc: { n: 4, dirs: 8, pose: (i, n) => ({ g: cyc(i, n), amp: 1.15, crouch: 1 }) },
      cover: { n: 4, pose: (i, n) => ({ cov: 1, peek: i / (n - 1), br: 0.25 }) },
      attack: { n: 2, pose: (i) => ({ cov: 1, peek: 1, atk: i ? 0.5 : 0.1 }) },
      hit: { n: 1, dirs: 4, pose: () => ({ fl: 1 }) },
      die: { n: 2, dirs: 4, pose: (i, n) => ({ die: (i + 1) / n }) },
    },
  },
};
/** Forvarming i prioritert rekkefølge: [sett, bilde]. Død bakes ved behov (med reserve-sprite). */
export const WARM_ORDER = [['idle', 0], ['walk', 0], ['walk', 3], ['walk', 1], ['walk', 4], ['walk', 2], ['walk', 5], ['attack', 1], ['attack', 2], ['attack', 0], ['attack', 3]];   // idle 1 (pust) bakes ved behov
