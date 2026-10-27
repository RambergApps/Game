// Engangsklipp som data/kurver. Tider i ms ut fra ANIMASJON §4.1 og KARAKTER-SPEC §5.1–5.2.
// Hvert klipp: { duration (s), sample(tms, opts) → overlag-parametere, events:[{t (ms), type}] }.
// Klipp kan overstyres per def: def.clips = { roll: { duration: .55 } , ... } (valgfritt).
import { clamp, lerp, easeOut3, easeOutBack, easeInOutSine, smooth01 } from './math.js';

const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/** Kollbøtte i 4 faser (500 ms). Figuren roterer ALDRI i planet – rotasjonen vises med hjelm/sekk/støvler/lysbånd. */
export const roll = {
  duration: 0.5,
  events: [{ t: 0, type: 'rollStart' }, { t: 330, type: 'land' }, { t: 500, type: 'end' }],
  sample(t) {
    const o = { phase: 'dive', k: 0, height: 1, sx: 1, sy: 1, helmetX: 0, helmetS: 1, helmetHidden: false, visor: 1,
      packTop: 0, packX: 0, band: -1, boots: null, feetPlanted: 0, scale: 1, ghosts: 0, shadowLift: 1 };
    if (t < 90) { const k = easeOut3(seg(t, 0, 90)); o.phase = 'dive'; o.k = k;
      o.sx = 1 + .15 * k; o.sy = 1 - .05 * k; o.helmetX = 6 * k; o.helmetS = 1 - .2 * k; o.visor = 1 - .5 * k; o.height = 1 - .2 * k; o.shadowLift = 1.1; }
    else if (t < 330) { const k = seg(t, 90, 330); o.phase = 'over'; o.k = k;
      const inK = smooth01(0, .18, k), outK = 1 - smooth01(.82, 1, k), ball = inK * outK; // ballform inn/ut
      o.sx = lerp(1.15, .96, inK) * outK + (1 - outK) * .98; o.sy = lerp(.95, 1.0, inK); o.helmetHidden = true; o.visor = 0;
      o.packTop = ball; o.packX = 11 * ball; o.band = k; o.height = .8; o.ghosts = 1; o.shadowLift = 1.05;
      if (t >= 200) { const b = seg(t, 200, 330); o.boots = lerp(-10, 12, easeInOutSine(b)); } }
    else if (t < 420) { const k = seg(t, 330, 420); o.phase = 'land'; o.k = k;
      o.feetPlanted = 1; o.helmetX = -4; o.helmetS = .9 + .1 * k; o.visor = smooth01(0, .6, k); o.height = .8; o.scale = .9; o.sx = .92; o.sy = 1; }
    else { const k = easeOut3(seg(t, 420, 500)); o.phase = 'rise'; o.k = k;
      o.helmetX = lerp(-4, 0, k); o.visor = 1; o.height = lerp(.8, 1, k); o.scale = lerp(.9, 1, k); o.feetPlanted = 1 - k; }
    return o;
  },
};

/** Hard stopp mot dekning: hitstop (eieren fryser riggen i 2 tick) + squash langs normalen ut med easeOutBack. */
export const impact = {
  duration: 0.2, // impact 80 + settle 120
  sample(t, opts = {}) { const k = seg(t, 0, 200); const st = opts.strength ?? 1;
    const e = t < 80 ? 1 : 1 - easeOutBack(seg(t, 80, 200));
    return { squashN: 1 - (1 - .88) * e * st, stretchT: 1 + .08 * e * st, nx: opts.nx || 0, ny: opts.ny || 0, k }; },
};

/** Vault: opp 0–80 · over 80–300 · ned 300–400. Skala 1 → 1,12 → 1, skygge 3 → 9 → 3 px. */
export const vault = {
  duration: 0.4,
  events: [{ t: 300, type: 'land' }],
  sample(t) { const k = t < 80 ? easeInOutSine(seg(t, 0, 80)) * .6 : t < 300 ? .6 + .4 * Math.sin(seg(t, 80, 300) * Math.PI) : .6 * (1 - easeInOutSine(seg(t, 300, 400)));
    return { height: 1 + .12 * k / 1, shadowLift: 1 + k * 1.6, scale: 1 + .12 * k }; },
};

/** Flinch (120 ms) og stagger (380 ms): torso bort fra kilden, hvitt blink 60 ms. */
export const hurt = {
  duration: 0.12,
  sample(t, opts = {}) { const k = t < 30 ? seg(t, 0, 30) : 1 - seg(t, 30, 120); return { twist: (opts.big ? 18 : 4) * Math.PI / 180 * k * (opts.side || 1), push: 2 * k, flash: t < 60 ? 1 - t / 60 : 0 }; },
};
export const stagger = { duration: 0.38, sample(t, opts = {}) { const k = t < 60 ? seg(t, 0, 60) : 1 - easeOut3(seg(t, 60, 380)); return { twist: 18 * Math.PI / 180 * k * (opts.side || 1), push: 4 * k, flash: t < 60 ? 1 - t / 60 : 0, weaponDown: k }; } };

/** Død: fall 0–450 (easeIn), glid/settle til 1100. Visiret slukker over 400 ms. */
export const death = { duration: 1.1, sample(t) { const k = clamp(t / 450, 0, 1); return { fall: k * k, visor: 1 - seg(t, 0, 400), height: lerp(1, .55, k * k), u: clamp(t / 1000, 0, 1) }; } };   // u: paintedC-dødsanim (segne 0–400, fall 380–680, krølle 620–950, holdt)

export const fire = { duration: 0.1, sample() { return {}; } };
export const exitCover = { duration: 0.16, sample(t) { return { pop: 1 - seg(t, 0, 160) }; } };

export const CLIPS = { roll, impact, vault, hurt, stagger, death, fire, exitCover };

/** Nærkamp / kolbeslag (F): oppladning 0–120 · slag 120–220 · tilbakegang 220–520 ms.
 *  twist = torso relativt sikte (rad), lunge = rotforskyvning fram (px), w = vekt mot melee-positurene. */
export const melee = {
  duration: 0.52,
  events: [{ t: 0, type: 'meleeStart' }, { t: 120, type: 'meleeSwing' }, { t: 170, type: 'meleeContact' }, { t: 520, type: 'end' }],
  sample(t) {
    if (t < 120) { const k = easeOut3(seg(t, 0, 120)); return { phase: 'windup', k, twist: -0.62 * k, lunge: -2 * k, wind: k, strike: 0, sx: 1 - .04 * k, sy: 1 + .03 * k, step: 0 }; }
    if (t < 220) { const k = easeOut3(seg(t, 120, 220)); return { phase: 'strike', k, twist: lerp(-0.62, 0.26, k), lunge: lerp(-2, 7, k), wind: 1 - k, strike: k, sx: 1 + .1 * Math.sin(k * Math.PI), sy: 1 - .06 * Math.sin(k * Math.PI), step: k }; }
    const k = easeInOutSine(seg(t, 220, 520)); return { phase: 'recover', k, twist: lerp(0.26, 0, k), lunge: lerp(7, 0, k), wind: 0, strike: 1 - k, sx: 1, sy: 1, step: 1 - k * .0 };
  },
};
CLIPS.melee = melee;
