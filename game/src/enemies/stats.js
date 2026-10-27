// Datadrevet stats-tabell for fiendetyper. Avstander i px (1 rute = 32 px), tider i sekunder,
// vinkler i grader der det står Deg.
// Skyting går via Breach Våpen (weapon.js → weapons.createEnemyLoadout/tryFire). weapon = profil-id i Våpens
// ENEMY_WEAPONS (rifle/smg/minigun/carbine: skade, kulefart, skadefall eies av Våpen). dmg/bulletSpeed her er
// referanseverdier som SKAL være lik profilen (weapon.js gir bare en override hvis dmg avviker). band = foretrukket
// skuddhold i ruter, valgt ut fra profilens skadefall (cover.js scoreSpot). Nye typer: legg til her + behaviors/<navn>.js.

/**
 * CINDER (story låst 23.10): fiendene er Cinderborn. Visningsnavn (engelsk spilltekst) per intern type – mekanikk og
 * typenavn er uendret, så Nivåer/Våpen ikke brytes. Mini-boss og boss har ingen egen type ennå (bygger på heavy).
 */
export const DISPLAY_NAMES = Object.freeze({ grunt: 'Husk', flanker: 'Lurcher', heavy: 'Kiln', grenadier: 'Spitter', kilnAlpha: 'Kiln Alpha', ashmaw: 'Ashmaw', hunker: 'Hunker' });
/** Navnenøkkel per type+variant (Levels VARIANTS.alpha.nameKey = 'kilnAlpha'). */
export const VARIANT_NAME_KEYS = Object.freeze({ heavy: { alpha: 'kilnAlpha' } });
export const displayName = (typeOrEnemy, variant) => {
  if (typeOrEnemy && typeof typeOrEnemy === 'object' && typeOrEnemy.displayName) return typeOrEnemy.displayName;
  const t = typeof typeOrEnemy === 'string' ? typeOrEnemy : typeOrEnemy?.type;
  const v = variant ?? (typeof typeOrEnemy === 'object' ? typeOrEnemy?.variant : null);
  const vk = v && VARIANT_NAME_KEYS[t]?.[v];
  return (vk && DISPLAY_NAMES[vk]) || DISPLAY_NAMES[t] || ENEMY_TYPES[t]?.name || String(t);
};

export const ENEMY_TYPES = {
  grunt: {
    name: 'Grunt', displayName: 'Husk',   // CINDER: Cinderborn-navn (vises i spill); type/name er interne og uendret
    color: '#c0392b', dark: '#7a2119', accent: '#ffb347',
    radius: 16, hp: 100,   // 16 (var 15). Monsterdesign ønsker 18–19, men 18 satte Husker fast i smale passasjer i regresjonen 26.10 – tas etter Arena-passasjene
    speed: 105, runSpeed: 140,
    behavior: 'grunt',
    vision: 720, reaction: [0.45, 0.7],
    idealRange: 320, minRange: 200, maxRange: 560,
    band: [8, 12],       // ruter: foretrukket skuddhold – rifle har fullt skadefall til 12 r (Våpen ENEMY_WEAPONS)
    coverBias: { low: 1.3, high: 0 },  // poeng per dekningstype (low: skyter over uten å kikke rundt hjørner)
    telegraph: 0.55,             // varsel før salve
    burst: [3, 4], burstInterval: 0.11,
    peekCooldown: [1.4, 2.4],
    dmg: 9, bulletSpeed: 820, weapon: 'rifle', shotEventId: 'spine',   // CINDER: organisk id i 'shot'-hendelsen (profilen over er uendret)
    spreadDeg: 7.5, spreadMinFactor: 0.55, moveSpreadDeg: 14, coverSpreadDeg: 6,
    minErrPx: 80,        // sidefeil-gulv ved målet (px): ≈40 % treff mot stillestående spiller i det åpne på 8–12 r (Breach: 35–45 %)
    turnRate: 4.2,
    suppressThreshold: 1.0,
    repositionAfter: [9, 14],
  },
  flanker: {
    name: 'Flanker', displayName: 'Lurcher',   // CINDER: Cinderborn-navn (vises i spill); type/name er interne og uendret
    color: '#8e1e1e', dark: '#4e0f0f', accent: '#ff5a3c',
    radius: 13, hp: 70,
    speed: 140, runSpeed: 210,
    behavior: 'flanker',
    vision: 680, reaction: [0.35, 0.55],
    idealRange: 200, minRange: 120, maxRange: 480,
    band: [4, 7],        // ruter: SMG har fullt skade til 7 r (6,6 på 8 r, 4,8 på 12 r) – kort hold
    coverBias: { low: 0.3, high: 0.5 },
    telegraph: 0.45,
    burst: [4, 5], burstInterval: 0.08,
    peekCooldown: [1.0, 1.8],
    dmg: 7, bulletSpeed: 860, weapon: 'smg', shotEventId: 'barb',   // CINDER: organisk id i 'shot'-hendelsen (profilen over er uendret)
    spreadDeg: 11, spreadMinFactor: 0.6, moveSpreadDeg: 7, coverSpreadDeg: 5,
    turnRate: 5.5,
    suppressThreshold: 0.8,
    repositionAfter: [5, 8],
    flank: {
      ringMin: 150, ringMax: 250, cooldown: 4.0, maxTime: 7, engageBursts: 2,
      telegraphMul: 1.75,  // første salve bakfra: 0.45 s × 1.75 ≈ 0.8 s varsel
      telegraphMulNext: 1.3,
      spreadMul: 2.8,      // mindre presis bakfra (mål: 35–40 % treff mot stillestående spiller; spreadRad overstyrer Våpen-profilen)
      burst: [3, 4],       // kortere salver bakfra
    },
    melee: {               // kolbeslag når den er helt inne på spilleren fra siden/bakfra (kun flank-token-holder)
      trigger: 300,        // px: innenfor ≈9 ruter kan den storme inn (fra flankeposisjonen)
      minVolleys: 1,       // må ha skutt minst én telegrafert flankesalve først (spilleren vet hvor den er)
      start: 46,           // px: oppladningen starter innen ≈1,5 ruter
      rushMax: 1.6,        // s maks innstorming (210 px/s) før den gir opp
      charge: 0.3,         // s AI-oppladning FØR tryMelee; + Våpens windup 0,12 s = 0,42 s synlig varsel (krav 0,35–0,45)
      recover: 0.45,       // s etter slaget (sårbar)
      cooldown: 5,         // s mellom nærkampforsøk
      fireBlock: 0.7,      // s uten skudd etter slaget, og ingen nærkamp innen 0,7 s etter et skudd
      sideAngle: 40,       // grader: kun hvis flankeren er mer enn dette utenfor spillerens sikteretning (side/bak; 40° ≈ utenfor fokusfeltet)
      // skade/bue/rekkevidde eies av Våpen (rev. 4: TUNING.melee.enemy 30 skade / 0,25 s stagger, 100°, 1,3 r til målets kant)
    },
  },
  heavy: {
    name: 'Heavy', displayName: 'Kiln',   // CINDER: Cinderborn-navn (vises i spill); type/name er interne og uendret
    color: '#ff7a1a', dark: '#7a3a0c', accent: '#ffd08a',
    radius: 18, hp: 320, armor: 0.2, speed: 62, runSpeed: 78,   // 36 px kropp (PROSJEKT.md)
    behavior: 'heavy', attackState: 'spinup',   // oppspinning erstatter vanlig telegraf
    vision: 760, reaction: [0.6, 0.9],
    idealRange: 380, minRange: 240, maxRange: 640,
    band: [8, 14],       // ruter: minigun faller først fra 14 r – sperreild på mellomhold
    coverBias: { low: 1.6, high: 0 },   // står bak lav dekning og skyter over den
    telegraph: 0.8, burst: [12, 16], burstInterval: 0.08, peekCooldown: [2.2, 3.2],
    dmg: 4, bulletSpeed: 760, weapon: 'minigun', shotEventId: 'slag',   // CINDER: organisk id i 'shot'-hendelsen (profilen over er uendret)
    spreadDeg: 7, spreadMinFactor: 0.75, moveSpreadDeg: 5, coverSpreadDeg: 2,
    turnRate: 1.6, staggerMul: 0.5, suppressThreshold: 2.6, suppressResist: 0.35, maxSuppressed: 2.5, repositionAfter: [14, 20], // tank: lar seg nesten ikke pinne
    minigun: {
      spinUp: 1.15,          // s oppspinning før første kule (varsel: synlig + 'spinup'-hendelse)
      spinDown: 0.8,         // s nedspinning
      sustain: [2.4, 3.2],   // s vedvarende ild per runde
      interval: 0.075,       // s mellom kuler (~13/s)
      rampSpread: 6,         // ekstra grader spredning i starten av salven (avtar over 0.5 s)
      sweepRate: 1.1,        // rad/s – maks sveipefart under ild (spilleren kan løpe fra strålen)
      suppressRadius: 80,    // px – kuler som passerer så nær spilleren gir undertrykking
      suppressAmount: 0.22,  // per 0.25 s
      marchFireAfter: 2.2,   // s etter første syn: spinner opp der den står hvis den ikke har skutt ennå (dekning langt unna)
      marchFireEvery: 6,     // s mellom marsjsalver mens den fortsatt er på vei
      suppressMemory: 6, holdDown: 1.8,   // s – hvor lenge den holder sperreild mot sist kjente dekning
    },
  },
  // Hunker 27.10 (docs/FIENDE-COVER-SKISSE.md): bruker KUN lavt cover, dukker med ryggskjold (×0,5 forfra), reiser seg og skyter over.
  hunker: {
    name: 'Hunker', displayName: 'Hunker',
    color: '#e0c234', dark: '#6e5e14', accent: '#fff1a8',
    radius: 18, hp: 120, speed: 92, runSpeed: 128,
    behavior: 'hunker',
    vision: 700, reaction: [0.45, 0.7],
    idealRange: 300, minRange: 180, maxRange: 520,
    band: [7, 12],
    coverBias: { low: 2.0, high: -99 },   // kun lavt cover
    telegraph: 0.5,                       // ×0,9–1,15 → ≥ 0,45 s (peek 0→1)
    burst: [3, 3], burstInterval: 0.13,
    peekCooldown: [1.2, 2.0],             // = dukketid
    dmg: 9, bulletSpeed: 800, weapon: 'rifle', shotEventId: 'slag',
    spreadDeg: 7, spreadMinFactor: 0.55, moveSpreadDeg: 14, coverSpreadDeg: 5,
    minErrPx: 80, turnRate: 4.0, suppressThreshold: 1.3, repositionAfter: [8, 12],
    shield: { mult: 0.5, arcDeg: 60 }, moveCrouch: 0.5, spotOffset: 20, flankDeg: 70, shiftEvery: [2, 3],
  },
  grenadier: {
    name: 'Grenadier', displayName: 'Spitter',   // CINDER: Cinderborn-navn (vises i spill); type/name er interne og uendret
    color: '#9b59ff', dark: '#4b2a80', accent: '#d7b8ff',
    radius: 15, hp: 90, speed: 95, runSpeed: 130,
    behavior: 'grenadier',
    vision: 700, reaction: [0.5, 0.75],
    idealRange: 250, minRange: 160, maxRange: 480,
    band: [5, 9],        // ruter: må innenfor kastehold (288 px = 9 r); karabin fullt til 9 r
    coverBias: { low: 0.4, high: 0.6 },
    telegraph: 0.6, burst: [2, 3], burstInterval: 0.14, peekCooldown: [2, 3],
    dmg: 8, bulletSpeed: 800, weapon: 'carbine', shotEventId: 'acid',   // CINDER: organisk id i 'shot'-hendelsen (profilen over er uendret)
    spreadDeg: 8, spreadMinFactor: 0.6, moveSpreadDeg: 6, coverSpreadDeg: 4,
    turnRate: 3.5, suppressThreshold: 1.2, repositionAfter: [10, 14],
    grenade: {
      campTime: 1.5,         // s i samme dekning før granat vurderes (P1 23.10: 2.5 → 1.5)
      stillTime: 1.5,        // s i ro (< 48 px), også i det åpne → kast (P1)
      groupRadius: 96,       // px: ≥ 2 på spillerlaget innenfor → kast mot midtpunktet (P1)
      firstMin: 6.5,         // s etter egen kontakt før første kast er lov (windup → granaten lander ~8 s+)
      firstStale: 5,         // s – første kast kan sikte på eldre «sist kjent» (spiller som gjemmer seg)
      pressAfter: [8, 10],    // s etter kontakt uten kast → første kast (P1: mål 8–12 s etter kontakt)
      cooldown: 7,           // s personlig cooldown
      windup: 0.75,          // s kastebevegelse (varsel + landingsmarkør vises fra start)
      recover: 0.4,          // s etter kast
      flight: 0.7,           // s flytid
      fuse: 1.1,             // s etter landing før eksplosjon
      radius: 90, dmg: 55,   // eksplosjon (fall-off mot kanten; high cover skjermer)
      minRange: 120, maxRange: 285, // = Våpens GRENADE.maxThrow (288) – samme kastehold som spilleren
      error: 22,             // px tilfeldig bom rundt målpunktet
    },
  },  // Sluttboss – PLASSHOLDER (docs/BOSS.md). Typen finnes for tegning/test; kampoppførselen er ikke bygd ennå.
  ashmaw: {
    name: 'Ashmaw', displayName: 'Ashmaw', boss: { ventHp: 150, closeArcDeg: 70, vents: 8 },
    color: '#ff7a1a', dark: '#3e3530', accent: '#ff5a1a',
    radius: 60, hp: 1200, armor: 0.5, speed: 0, runSpeed: 0,   // ~120 px kuppel; HP-tall er forslag (BOSS.md)
    behavior: 'ashmaw', bossType: true, staggerImmune: true,
    vision: 1400, reaction: [0.3, 0.5],
    idealRange: 300, minRange: 0, maxRange: 900, band: [0, 30],
    coverBias: { low: 0.5, high: 0.5 },
    telegraph: 0.8, burst: [1, 1], burstInterval: 0.2, peekCooldown: [3, 4],
    dmg: 4, bulletSpeed: 760, weapon: 'minigun', shotEventId: 'slag',   // plassholder-loadout; Ashmaw skyter ikke ennå
    spreadDeg: 6, spreadMinFactor: 1, moveSpreadDeg: 0, coverSpreadDeg: 0,
    turnRate: 0.6, suppressThreshold: 999, suppressResist: 0, repositionAfter: [999, 999],
  },

};

/** Squad-regler (rettferdighet/koordinering). */
export const SQUAD_RULES = {
  maxShooters: 2,          // samtidig i telegraf/skyting
  minShotGap: 0.35,        // min. tid mellom to salvestarter (s) – unngår synkrone telegrafer
  maxFlankers: 1,          // samtidig aktive flankere
  alertSpread: [0.25, 0.6], // forsinkelse før lagkamerater varsles (s)
  maxThrowers: 1,          // samtidige granatkast
  grenadeGap: 4.5,         // s mellom to granater fra laget
};

/** P1 23.10: jakt etter tap av sikt + stillstands-vakthund (hunt.js). enabled=false kun for før/etter-måling. */
// Demo 26.10 (Test v5: 6 s uten fremdrift i 1-2): blind 2,6–3,6 s → rykk fram / flank. Én av gangen (advanceGap s mellom
// hver fiendes framrykk i laget), de andre holder. flankChance: andel av jaktstegene som prøver flank (krever ledig flank-token).
export const HUNT = { enabled: true /* kun for før/etter-måling */, delay: [2.6, 3.6], watchdog: 3.5, advanceMin: 64, repath: 1.2, stepGap: [1.6, 2.4], maxHuntT: 12,
  advanceGap: 0.7, flankChance: { grunt: 0.35, flanker: 0.8 }, stuckT: 1.2 };

/**
 * Kroppshøyder i trekvart (verdens-px z over bakken, samme enhet som PROJ.heights; Warden: høyde 48, huket 30,
 * løp 28,8 / 18, siktehøyde PROJ.aimHeight 27). Kilde: docs/FIENDE-DESIGN.md (front-px / zScale 0,75).
 *   height / crouchHeight – toppen av kroppen (Våpen bodyHitZ leser e.height)
 *   muzzleZ / crouchMuzzleZ – hvor skuddet kommer ut ≈ 0,7 × høyden (Warden-design 23.10) → e.muzzleZ / e.muzzle.z (Våpen view34.muzzleZ)
 *   aimHeight / crouchAimHeight – brysthøyde: der spillerens skudd treffer / sikter (som PROJ.aimHeight for Warden)
 * Logikken sikter fortsatt på spillerens fotpunkt (treffsirkelen). Kun visuelt: skudd/telegraf tegnes fra e.muzzle.z mot
 * spillerens bryst z = PROJ.aimHeight (27) → e.aimPoint.z.
 */
export const BODY = {
  grunt:     { height: 37, crouchHeight: 26, muzzleZ: 26, crouchMuzzleZ: 18, aimHeight: 21, crouchAimHeight: 15 },   // Husk: pukkel 37
  flanker:   { height: 16, crouchHeight: 12, muzzleZ: 11, crouchMuzzleZ: 8,  aimHeight: 9,  crouchAimHeight: 7 },    // Lurcher: lavest
  heavy:     { height: 35, crouchHeight: 28, muzzleZ: 25, crouchMuzzleZ: 20, aimHeight: 20, crouchAimHeight: 16 },   // Kiln: front 26 → 35
  grenadier: { height: 44, crouchHeight: 30, muzzleZ: 31, crouchMuzzleZ: 21, aimHeight: 30, crouchAimHeight: 20 },   // Spitter: høyest av småtypene
  hunker:    { height: 39, crouchHeight: 18.6, muzzleZ: 27, crouchMuzzleZ: 27, aimHeight: 24, crouchAimHeight: 14 },   // muzzleZ overskrives fra HUNKER_MUZZLE (behaviors/hunker.js)
  ashmaw:    { height: 52, crouchHeight: 52, muzzleZ: 36, crouchMuzzleZ: 36, aimHeight: 26, crouchAimHeight: 26 },   // kuppel 52, kjeft midt på
};
/** Skalering per variant (Kiln Alpha: front 40 mot 26 → ×1,5; kammen gir høyden). */
export const BODY_VARIANT = { 'heavy:alpha': 1.5 };

/** Kroppsmål for en fiende akkurat nå (huk 0..1 interpolert, variant skalert). */
export function bodyOf(e) {
  const B = BODY[e.type] || BODY.grunt, s = BODY_VARIANT[`${e.type}:${e.variant}`] ?? 1;
  const k = Math.max(0, Math.min(1, e.crouch || 0)), L = (a, b) => (a + (b - a) * k) * s;
  return { height: L(B.height, B.crouchHeight), muzzleZ: L(B.muzzleZ, B.crouchMuzzleZ), aimHeight: L(B.aimHeight, B.crouchAimHeight) };
}
