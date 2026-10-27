// BREACH – felles lysretning (eies av Breach Karakter, brukes av rigg, arena og alt som kaster skygge).
//
// Ett nøkkellys «oppe fra venstre» (nordvest på skjermen), som i Warden v2 og arenaens skygger.
// Konvensjon: canvas-rom, vinkel 0 = øst, positiv med klokka, y nedover.
//   LIGHT_DIR        – enhetsvektor FRA et punkt MOT lyset (for høylys: lyse kanter vender hit).
//   LIGHT_ANGLE      – samme retning som vinkel (rad) = atan2(LIGHT_DIR.y, LIGHT_DIR.x) ≈ −2,145 rad (−122,9°).
//   LIGHT_ELEVATION  – lysets høyde over gulvet (rad). 0,96 rad ≈ 55°: bratt «takarmatur»-lys.
//   SHADOW_DIR       – enhetsvektor skyggen faller i (= −LIGHT_DIR), dvs. ned mot høyre.
//   shadowOffset(h)  – skyggeforskyvning i verdens-px for en gjenstand med høyde h px: h / tan(elevasjon) langs SHADOW_DIR.
// Endres lyset, endres det HER – riggens sprite-cache og arenaens skygger leser samme konstant.
const LX = -0.55, LY = -0.85, LL = Math.hypot(LX, LY);
export const LIGHT_DIR = Object.freeze({ x: LX / LL, y: LY / LL });          // ≈ { x: −0.5432, y: −0.8396 }
export const LIGHT_ANGLE = Math.atan2(LIGHT_DIR.y, LIGHT_DIR.x);            // ≈ −2.1446 rad
export const LIGHT_ELEVATION = 0.96;                                         // rad ≈ 55°
export const SHADOW_DIR = Object.freeze({ x: -LIGHT_DIR.x, y: -LIGHT_DIR.y });
export const LIGHT_COLOR = 'rgb(255,236,206)';                               // varm, svak høylystone
export function shadowOffset(h) { const k = h / Math.tan(LIGHT_ELEVATION); return { x: SHADOW_DIR.x * k, y: SHADOW_DIR.y * k }; }

// ---------------------------------------------------------------- lesbarhet (figur mot travelt gulv)
// Felles parametere for figurseparasjon i 'painted'-stilen. Brukes av Warden OG Protocol-fiender (samme rigg/stil),
// og kan leses av andre tegnere (f.eks. en sprite-stil) for samme uttrykk. Overstyr per def: def.readability = { rim: 1.2, … }
// (tall = multiplikator på hele gruppen) eller per gruppe via def.readabilityPreset = { rim: { alpha: … } }.
//   rim        – silhuett-kantlys på lyssiden (LIGHT_DIR): alpha, bredde (px ved zoom 1), farge = skin.rim
//   back       – svakt kaldt motlys på skyggesiden (skiller mørk rustning fra mørkt gulv)
//   halo       – mørk, myk kontur rundt silhuetten (skiller fra lyst gulv)
//   groundAO   – myk mørk pøl under figuren (kontakt), radius i px
//   ring       – diskret kontaktring i skin-farge + sikteretningsbue (under = mørk underlinje, 0 = av)
//   topFalloff – hvor mye ekstremitetene mørknes mot gulvet (lavere = mer lesbar på mørkt gulv)
// NB: verdiene under er v2-portens (uendret utseende). Sterkere lesbarhet i index.html er IKKE innstilt ennå (arbeidet stoppet 23.10 13:09).
export const READABILITY = Object.freeze({
  rim: Object.freeze({ alpha: 0.62, width: 1.25 }),
  back: Object.freeze({ alpha: 0.26, width: 1.0, color: '120,150,175' }),
  halo: Object.freeze({ alpha: 0.9, spread: 0.8 }),
  groundAO: Object.freeze({ alpha: 0, r: 25 }),
  ring: Object.freeze({ alpha: 0.10, aimAlpha: 0.32, r: 21, pool: 0.10, under: 0 }),
  topFalloff: 0.5,
  // Trekvart-stilen «oblique» (Warden v3), innstilt for normal spillzoom 1,5 (runde 2, 23.10). Påvirker ikke 'painted'.
  //   scale      – figurens bakkeplan-skala rundt fotpunktet (kropp ≈ 29 → 32 px; høyden følger PROJ.heights.actor)
  //   rim        – varmt kantlys på lyssiden: alpha, bredde/forskyvning i SKJERM-px (uavhengig av zoom), farge
  //   contour    – mørk kontur i skjerm-px og alpha
  oblique: Object.freeze({
    scale: 1.1,
    rim: Object.freeze({ alpha: 0.95, px: 1.5, color: '255,228,178' }),
    contour: Object.freeze({ px: 1.35, alpha: 0.95 }),
  }),
});
