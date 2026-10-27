// BREACH – felles projeksjon for trekvart-utseendet (eies av Breach Karakter; brukes av rigg, arena og fiender).
// Avtalt med Breach Arena 2026-10-23.
//
// Spillogikken er fortsatt ren ovenfra: x/y i verdens-px (1 rute = 32 px), kollisjon og cover-rektangler uendret.
// Bakkeplanet tegnes 1:1 (ingen sammentrykking), så kollisjon matcher pikselrett. Bare høyde (z) løftes rett opp.
//
//   PROJ.zScale (= heightScale) – skjerm-px oppover per verdens-px høyde. 0,75 ≈ tan(tilt) for tilt ≈ 37° fra loddrett.
//   PROJ.tilt                   – kameravinkelen tegnerne maler sprites/flater for (rad), = atan(zScale).
//   PROJ.toScreen(x, y, z)      – { x, y: y − z·zScale }.
//   PROJ.sortKey(obj)           – y-sortering på bunnkant: cover-rektangel (har w/h) → y + h, aktør → y + (r ?? 0).
//   PROJ.heights                – standardhøyder i verdens-px (se under).
//   PROJ.aimHeight              – SIKTEHØYDE: 27 = høyde z (verdens-px over bakken, samme enhet som heights) som
//                                 musepunktet tolkes i i trekvart (≈ brystet på en stående figur, actor 48).
//                                 Offset i worldY = aimHeight · zScale = 27 · 0,75 = 20,25 px.
//   PROJ.aimGround(wx, wy)      – musepunktets verdenskoordinat (core input.mouse.worldX/Y, bakkeplan) → punktet på
//                                 bakken RETT UNDER det samme skjermpunktet tolket i brysthøyde: { x: wx, y: wy + 20,25 }.
//                                 Det er dette punktet spilleren sikter mot (vinkel og avstand) i view '34'. Ovenfra: bruk mus direkte.
//   PROJ.aimZ                   – = aimHeight; z som et siktet skudd «flyr i» visuelt (kuler/tracere tegnes via toScreen(x, y, aimZ)).
//
// Regler: aktører ankres i fotpunktet (x, y). Boks med høyde h: toppflaten forskyves −h·zScale, sørsiden tegnes som
// front med høyde h·zScale. Skygger ligger i bakkeplanet og bruker shadowOffset(h) fra light.js.
// 27.10 (Arena, plan pkt. 2): vinkelen er nå parameter. Standard = høyt kamera (TILT_DEG fra loddrett), bakken forkortes
// med groundScaleY = cos(tilt) (core/camera.js skalerer verdens-y), og høyde løftes zScale = tan(tilt) verdens-y-px per z-px,
// dvs. sin(tilt) skjerm-px per z-px etter kameraskaleringen. Samme vinkel for bakke og høyde (ortografisk).
//   ?view=34 / ?proj=37  → gammel vinkel (zScale 0,75, bakke 1:1)      ?tilt=<grader fra loddrett> → fri vinkel
const TILT_DEG = 55; // 27.10 12:59: Alexander valgte 55° fra loddrett
const _q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const _legacy = !!_q && (_q.get('view') === '34' || _q.get('proj') === '37');
const _t = _q ? parseFloat(_q.get('tilt')) : NaN;
const TILT = _legacy ? Math.atan(0.75) : (Number.isFinite(_t) ? _t : TILT_DEG) * Math.PI / 180;
const Z = Math.tan(TILT);                          // verdens-y per z (før kameraets bakkeskala)
const G = _legacy ? 1 : Math.cos(TILT);            // bakkens y-forkorting (skjerm/verden)
const AIM_H = 27;   // siktehøyde (bryst) i verdens-px over bakken – se PROJ.aimHeight
const HEIGHTS = Object.freeze({
  low: 24,          // lav dekning (front 18 px) – huket Warden (30) stikker så vidt over med hjelmen
  high: 64,         // høy dekning / containere (front 48 px)
  wall: 72,         // vegger (front 54 px)
  actor: 48,        // Warden/fiender stående, til toppen av hjelmen (front 36 px)
  actorCrouch: 30,  // huket bak lav dekning
});
// Standardzoom for følgekameraet (core/camera.js leser denne; look/zoom.js kan lese PROJ.zoom). Legacy ?view=34 = 1,5, ny 55° = 2,25.
// ?zoom=N overstyrer. PROJ.zoom er den faktiske startzoomen; ?camfollow=0 regner sin egen zoom (hele brettet) ved kjøring.
const BASE_ZOOM = _legacy ? 1.5 : 2.25;
const _zoom = (() => { try { const z = parseFloat(new URLSearchParams(globalThis.location?.search || '').get('zoom')); return z > 0 ? z : BASE_ZOOM; } catch (e) { return BASE_ZOOM; } })();
export const PROJ = Object.freeze({
  zoom: _zoom,
  baseZoom: BASE_ZOOM,
  zScale: Z,
  heightScale: Z,
  tilt: TILT,                       // rad fra loddrett (standard 55°, legacy ≈ 36,9°)
  tiltDeg: TILT * 180 / Math.PI,
  legacy: _legacy,
  groundScaleY: G,                  // core/camera.js: skjerm-y = verdens-y · zoom · G (bare i view '34')
  screenZ: Z * G,                   // skjerm-px (ved zoom 1) per z-px = sin(tilt) (legacy 0,75)
  heights: HEIGHTS,
  aimHeight: AIM_H,                 // z i verdens-px (bryst); worldY-offset = AIM_H · zScale ≈ 20,25
  aimZ: AIM_H,
  aimGround(wx, wy) { return { x: wx, y: wy + AIM_H * Z }; },
  toScreen(x, y, z = 0) { return { x, y: y - z * Z }; },
  sortKey(o) { return (o.w !== undefined && o.h !== undefined) ? o.y + o.h : o.y + (o.r ?? 0); },
});
export { HEIGHTS };
export const project = PROJ.toScreen;
export const sortKey = PROJ.sortKey;
export default PROJ;
