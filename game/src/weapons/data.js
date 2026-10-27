// BREACH – våpendata (eies av Breach Våpen). Rene data + små rene funksjoner, ingen avhengigheter.
// Enheter: avstand i px (1 rute = 32 px), tid i sekunder, vinkler i GRADER (halv kjegle), fart i px/s.
// Begrunnelse og TTK-tabell: docs/VAPEN.md (tallene der er generert av tools/ttk.mjs fra disse dataene).

export const TILE = 32;

/**
 * Felter per våpen
 *  dmg                skade per kule/hagl før skadefall
 *  pellets            antall hagl per skudd (1 = vanlig kule)
 *  falloff            { start, end, minMult } – full skade til start, lineært ned til minMult ved end (px)
 *  ramp               (valgfri) { start, end, minMult } – omvendt: minMult til start, lineært OPP til 1 ved end
 *  fireInterval       s mellom skudd (rpm = 60 / fireInterval)
 *  auto               true = hold for å skyte, false = halvautomatisk (ett skudd per klikk, 150 ms klikkbuffer)
 *  spread             grader (halv kjegle) per positur: hip = hofte, aim = sikte/popUp/lean, blind = blindfire
 *  moveSpread         ekstra grader ved full gangfart (aimMoveMult skalerer den mens man sikter)
 *  bloom              { perShot, max, decay (grader/s) } – akkumulert spredning ved vedvarende ild
 *  pelletSpread       (hagle) grader halv kjegle for haglmønsteret per positur
 *  recoil             { kick: kamerakick px, shake: [px, ms], climb: grader siktedrift per skudd, recover: grader/s }
 *  steady             (presisjon) { start, full, dmgMult, spread } – stille sikte lader bonusen lineært fra start til full (s)
 *  mag, reserve       magasin og reserve (reserve: Infinity = uendelig)
 *  reloadTime         s full lading
 *  activeReload       { from, perfect:[a,b], good:[a,b], to, jam, bonus } – brøkdeler av reloadTime
 *                     (ANIMASJON §4.3: 300–1700 ms vindu, perfekt 700–820, god 820–1000 for 1800 ms)
 *  equipTime          s fra bytte til våpenet kan skyte
 *  chamber            (valgfri) s etter skudd for pumpe/bolt → hendelsen 'chamber' og hylsa kastes ut da
 *  projectileSpeed, range, radius, color – sendes til core spawnProjectile
 *  fx                 utseende for munningsglimt/tracer/hylser (leses av fx.js)
 */
export const WEAPONS = {
  rifle: {
    // muzzle: munningspunkt (rev. 6). forward = px foran kroppskanten (e.r), side = px til høyre for sikteaksen,
    // z = løpshøyde i verdens-px (null = rigg/aktørhøyde × zFrac). Justeres etter docs/VAPEN-DESIGN.md.
    // 23.10 (skala 36): forward/side = tegnet munning i look/rifle.js ved sikteposisjon (26,7 px fra senter − e.r 14). Reserve når entity.muzzle mangler.
    muzzle: { forward: 12.7, side: 3.2, z: null, zFrac: 0.6 },   // 26.10 demo (faceted, C parkert): faceted.muzzleOf 26,7 px fra senter − e.r 14. Reserve når entity.muzzle mangler.
    id: 'rifle', slot: 1, name: 'AR-9 Vanguard', short: 'AR-9', role: 'Assault rifle – all-round, mid range',
    dmg: 14, pellets: 1,
    falloff: { start: 12 * TILE, end: 24 * TILE, minMult: 0.7 },   // rev. 2: var 10→20 r / 0,65
    fireInterval: 0.1, auto: true,
    spread: { hip: 3.0, aim: 1.2, blind: 10.0 },          // = player/tuning.js spreadHip/spreadAim/spreadBlind
    moveSpread: 2.5, aimMoveMult: 0.5,
    bloom: { perShot: 0.4, max: 3.0, decay: 8.0 },        // = tuning.js bloomPerShot/bloomMax/bloomDecay
    recoil: { kick: 1.6, shake: [1.4, 60], climb: 0.35, recover: 9 },
    mag: 24, reserve: 240, reloadTime: 1.8,   // rev. 2: var 30/180 – Heavy krever nå alltid én lading. Rev. 5: reserve 168 → 240 (10 mag) – rifla gikk tom hver bølge
    activeReload: { from: 0.17, perfect: [0.39, 0.46], good: [0.46, 0.56], to: 0.94, jam: 0.7, bonus: 1.15 },
    equipTime: 0.35,
    projectileSpeed: 1150, range: 900, radius: 1.7, color: '#a8ecff',
    fx: { flash: 'star', flashSize: 1.0, flashLen: 18, light: 90, tracer: 70, tracerW: 1.6, shell: 'brass', shellSize: 1.0, impact: 1.0 },
  },
  shotgun: {
    muzzle: { forward: 11.0, side: 3.2, z: null, zFrac: 0.6 },   // 26.10 demo: muzzleOf 25,0 − 14
    id: 'shotgun', slot: 2, name: 'S-12 Breaker', short: 'S-12', role: 'Shotgun – lethal inside 4 tiles, steep falloff',
    dmg: 16, pellets: 8,
    falloff: { start: 3 * TILE + 4, end: 8 * TILE + 4, minMult: 0.15 },   // 23.10 r2: +4 px = munningen står 4 px bak gammel forward 17 (look/shotgun.js v2), samme balanse
    fireInterval: 0.8, auto: false,
    spread: { hip: 1.5, aim: 0.6, blind: 6.0 },           // grunnfeil i sikteretning (hele mønsteret flyttes)
    pelletSpread: { hip: 6.5, aim: 4.5, blind: 10.0 },    // haglmønsteret
    moveSpread: 1.5, aimMoveMult: 0.6,
    bloom: { perShot: 0, max: 0, decay: 10 },
    recoil: { kick: 5.5, shake: [4.5, 140], climb: 0, recover: 10 },
    mag: 6, reserve: 36, reloadTime: 2.2,   // rev. 5: reserve 30 → 36
    activeReload: { from: 0.14, perfect: [0.36, 0.43], good: [0.43, 0.54], to: 0.94, jam: 0.8, bonus: 1.15 },
    equipTime: 0.4, chamber: 0.32,         // pumpe: 'chamber'-hendelse + hylse 0,32 s etter skuddet
    projectileSpeed: 1050, range: 11 * TILE, radius: 1.3, color: '#d6f4ff',
    fx: { flash: 'fan', flashSize: 1.6, flashLen: 24, light: 140, tracer: 26, tracerW: 1.2, shell: 'hull', shellSize: 1.5, impact: 0.7, smoke: 6 },
  },
  marksman: {
    muzzle: { forward: 25.9, side: 3.2, z: null, zFrac: 0.62 },   // 26.10 demo: muzzleOf 39,9 − 14 (ttk sjekket, se tools/ttk.md)
    id: 'marksman', slot: 3, name: 'M-4 Sentinel', short: 'M-4', role: 'Marksman rifle – long range, slow, punishes peeking',
    dmg: 80, pellets: 1,
    falloff: { start: 60 * TILE, end: 80 * TILE, minMult: 1.0 },  // ingen skadefall i arenaen …
    ramp: { start: 4 * TILE, end: 13 * TILE, minMult: 0.7 },      // … men kula «tar seg opp»: 70 % ≤ 4 r → 100 % ≥ 13 r (svak på nært hold)
    fireInterval: 0.95, auto: false,
    spread: { hip: 7.0, aim: 0.25, blind: 14.0 },
    moveSpread: 5.0, aimMoveMult: 0.8,
    bloom: { perShot: 2.5, max: 2.5, decay: 4.0 },
    // rev. 2: stødig sikte LADES OPP lineært fra 0,2 s til 1,0 s stille sikte: skade ×1 → ×1,3 og spredning → 0,1°.
    // Én-skudd på Grunt (104 × ramp ≥ 100) krever full lading og ≥ ~12,5 r. Trådkorset viser forventet skade.
    steady: { start: 0.2, full: 1.0, dmgMult: 1.3, spread: 0.1 },
    recoil: { kick: 7, shake: [5, 160], climb: 1.2, recover: 3 },
    mag: 5, reserve: 25, reloadTime: 2.5,
    activeReload: { from: 0.16, perfect: [0.40, 0.45], good: [0.45, 0.55], to: 0.94, jam: 0.8, bonus: 1.15 },
    equipTime: 0.5, chamber: 0.42,         // bolt: 'chamber'-hendelse + hylse 0,42 s etter skuddet
    projectileSpeed: 2600, range: 1600, radius: 2.4, color: '#eafcff',
    fx: { flash: 'brake', flashSize: 1.3, flashLen: 30, light: 160, tracer: 240, tracerW: 2.4, beam: 0.45, shell: 'brass', shellSize: 1.35, impact: 1.6 },
  },
  // FORSLAG (droppet etter beskjed fra Breach – tre startvåpen). Beholdt som referanse:
  // pistol: { id:'pistol', name:'P-2 Sidearm', dmg:22, fireInterval:0.22, auto:false, mag:12, reserve:Infinity, ... }
};

export const PLAYER_LOADOUT = ['rifle', 'shotgun', 'marksman'];

// ------------------------------------------------------------------ fiendevåpen (rev. 2)
// Nøkler = `weapon` i enemies/stats.js, så projectile.weapon/lyd-klassifisering er uendret. createLoadout() slår opp her først
// når entity.team !== 'player'. dmg / prosjektilfart / spredning = dagens tall i stats.js (utgangspunkt), nå med skadefall.
// fireInterval er litt kortere enn stats.burstInterval, så AI-ens egen salvetakt styrer (tryFire avviser aldri pga. cooldown).
// Uendelig ammo som standard for fiender (AI-en styrer pauser med salver/peekCooldown). Ingen rekyl/kamerakick, lite bloom.
// Rev. 4: profil med `limitedMag: true` bruker magasin + lading (mag, reloadTime): tryFire avviser under lading ('reloading'),
// lader automatisk når magasinet er tomt, og sender 'reload' start/end. Reserven er uendelig. I dag: Heavy (minigun).
// Valgfritt `melee: { dmg, stagger }` per profil overstyrer TUNING.melee.enemy for slag fra denne fienden.
const ENEMY_BASE = {
  pellets: 1, auto: true, aimMoveMult: 1, bloom: { perShot: 0.15, max: 1.5, decay: 4 },
  recoil: { kick: 0, shake: [0, 0], climb: 0, recover: 10 }, reserve: Infinity, reloadTime: 2.0, activeReload: null,
  equipTime: 0.3, radius: 1.6, enemy: true,
  muzzle: { forward: 20, side: 3.5, z: null, zFrac: 0.6 },   // rev. 6; per profil kan overstyre
};
const efx = (o) => ({ flash: 'star', flashSize: 0.85, flashLen: 15, light: 70, tracer: 60, tracerW: 1.4, shell: 'brass', shellSize: 0.9, impact: 0.8, ...o });
export const ENEMY_WEAPONS = {
  // Grunt: dmg 9, 820 px/s, salve 3–4 à 0,11 s, spreadDeg 7,5 (× spreadMinFactor 0,55 når den har siktet inn)
  rifle: { ...ENEMY_BASE, id: 'rifle', name: 'Grunt rifle', short: 'RIFLE', dmg: 9, fireInterval: 0.1,
    falloff: { start: 12 * TILE, end: 22 * TILE, minMult: 0.6 },
    spread: { hip: 7.5, aim: 4.1, blind: 11.5 }, moveSpread: 6, mag: 30,
    projectileSpeed: 820, range: 810, color: '#ff9a4a', fx: efx({}) },
  // Flanker: dmg 7, 860 px/s, salve 4–5 à 0,08 s, spreadDeg 11 – sterk på kort hold, faller raskt
  smg: { ...ENEMY_BASE, id: 'smg', name: 'Flanker SMG', short: 'SMG', dmg: 7, fireInterval: 0.072,
    falloff: { start: 7 * TILE, end: 15 * TILE, minMult: 0.5 },
    spread: { hip: 11, aim: 6.6, blind: 16 }, moveSpread: 7, mag: 40,
    projectileSpeed: 860, range: 730, color: '#ff8a3c', fx: efx({ flashSize: 0.75, flashLen: 12, tracer: 46, tracerW: 1.2, shellSize: 0.8 }) },
  // Heavy: dmg 4, 760 px/s, ~13 kuler/s (minigun.interval 0,075), spreadDeg 7 – sperreild, faller lite
  minigun: { ...ENEMY_BASE, id: 'minigun', name: 'Heavy minigun', short: 'MINIGUN', dmg: 4, fireInterval: 0.066,
    falloff: { start: 14 * TILE, end: 24 * TILE, minMult: 0.7 },
    spread: { hip: 7, aim: 5.3, blind: 9 }, moveSpread: 5,
    mag: 60, reloadTime: 3.0, limitedMag: true,   // rev. 4: 60 skudd ≈ 4 s sperreild, så 3 s ladepause spilleren kan utnytte bloom: { perShot: 0.05, max: 1, decay: 3 },
    projectileSpeed: 760, range: 890, radius: 1.8, color: '#ffb05a', fx: efx({ flashSize: 1.0, flashLen: 16, light: 100, tracer: 52, impact: 0.6 }) },
  // Grenadier: dmg 8, 800 px/s, salve 2–3 à 0,14 s, spreadDeg 8 (granaten: spawnGrenade med egne dmg/radius/fuse)
  carbine: { ...ENEMY_BASE, id: 'carbine', name: 'Grenadier carbine', short: 'CARBINE', dmg: 8, fireInterval: 0.126,
    falloff: { start: 9 * TILE, end: 18 * TILE, minMult: 0.6 },
    spread: { hip: 8, aim: 4.8, blind: 12 }, moveSpread: 6, mag: 20,
    projectileSpeed: 800, range: 730, color: '#ffa860', fx: efx({}) },
};

/** Granat (spillerens standard; fiender kan overstyre dmg/radius/fuse i spawnGrenade). */
export const GRENADE = {
  id: 'grenade', name: 'Frag grenade',
  count: 2,                 // = levels/upgrades.js BASE_STATS.grenades (playerStats.grenades overstyrer)
  maxThrow: 9 * TILE,       // 288 px = ANIMASJON §5.1
  minThrow: 2 * TILE,
  fuse: 1.6, cooldown: 0.6,
  dmg: 120, innerRadius: 24, radius: 3.5 * TILE, edgeMult: 0.2,
  selfMult: 0.5,            // kasterens egen skade (Gears: din egen granat er farlig)
  gravity: 900, bounce: 0.38, friction: 0.55, rollDrag: 3.2, lowCoverHeight: 16, radiusBody: 4,
  shake: [9, 380],
};

/** Skadefall-multiplikator ved avstand d (px). */
export function falloffMult(w, d) {
  const f = w.falloff, r = w.ramp; let m = 1;
  if (f && d > f.start) m = d >= f.end ? f.minMult : 1 - (1 - f.minMult) * ((d - f.start) / (f.end - f.start));
  if (r && d < r.end) m *= d <= r.start ? r.minMult : r.minMult + (1 - r.minMult) * ((d - r.start) / (r.end - r.start));
  return m;
}

/** Granatskade ved avstand d fra sentrum (før dekning/armor). */
export function grenadeDamage(g, d, r = 0) {
  const dd = Math.max(0, d - r); if (dd > g.radius) return 0;
  if (dd <= g.innerRadius) return g.dmg;
  const k = (dd - g.innerRadius) / (g.radius - g.innerRadius);
  return g.dmg * (1 - (1 - g.edgeMult) * k);
}

export const rpm = (w) => Math.round(60 / w.fireInterval);

// ------------------------------------------------------------------ tuning (samlet her, ikke egen fil: alt våpenbalansetall bor i data.js)
// Ammokasser i arenaen (logikk i crates.js). Arena legger world.arena.ammoCrates = [{id, x, y}]; vi skriver ready/readyAt.
export const TUNING = {
  // Kulehull på dekning via Arenas krok (weapons/decals.js). Én per avtrekk, tak per sekund, minsteavstand (verdens-px).
  pointBlank: { pick: true, sweep: true, pickPad: 2, range: 100 },   // 27.10: index.js pickBody (sikt på kroppen under markøren i 34) + bodySweep (fiende mellom kropp og munning)
  coverDecals: { enabled: true, perSecond: 15, minDist: 3, zJitter: 8, minInterval: { default: 0.08, rifle: 0.08, shotgun: 0, marksman: 0 } },   // 27.10: løsnet (Arena baker utsatt/budsjettert, VFX hopper over ved decalHandled). Hagle: én per shotId i fx.
  ammoCrate: {
    radius: 0.8 * TILE,       // 25,6 px: avstand kassesenter → spillersenter (spillerens r regnes IKKE med – senteret må inn)
    cooldown: 18,             // s per kasse (world.time-basert). Rev. 5: 25 → 18 (lange bølger tømte rifla før kassen var klar)
    grenades: 1,              // +1 granat per bruk …
    grenadeMax: null,         // … opp til maks (null = world.playerStats.grenades ?? loadoutens grenadeMax)
    allWeapons: true,         // true = magasin + reserve for alle våpen i loadouten; false = bare våpenet i hånda
    pulse: 0.6,               // s «klar igjen»-puls
  },
  // Granatkast: kort oppladning før granaten slippes ('grenade' phase 'windup' → 'throw'), så animasjonen kan synkes.
  grenade: { windup: 0.22 },
  // Nærkamp/kolbeslag (logikk i melee.js). Samme tall for alle tre våpen og for fiender (Flanker).
  melee: {
    arcDeg: 100,              // total bue (±50° rundt vinkelen fra start)
    range: 1.3 * TILE,        // 41,6 px fra angriperens SENTER til målets KANT (avstand − target.r ≤ range)
    dmg: 50,                  // før rustning (core damage bruker entity.armor)
    cooldown: 0.7,            // s fra start til neste slag kan startes
    contactAt: 0.165,         // s oppladning til kontakt (rev. 3: var 0,12); treffet avgjøres her, med vinkelen låst ved start
    recover: 0.155,           // s fra kontakt til phase 'end' (rev. 3: var 0,2). Skyteblokk = contactAt + recover = 0,32 s (uendret,
                              // = player/tuning.js meleeCancelAt). Nedkjøling 0,7 s fra start er uendret.
    knockback: 18,            // px dytt bort fra angriperen (rev. 5: 10 → 18, glir over knockbackTime; stoppes av høy dekning)
    knockbackTime: 0.09,      // s: dyttet fordeles over dette (ease-out) i stedet for å teleportere
    stagger: 0.4,             // s: target.staggerUntil = world.time + stagger
    shake: [3, 90],           // kamerarystelse ved treff (bare når kamera følger angriperen)
    hitstop: 0.075,           // s world.hitstop ved treff (rev. 5: 0,05 → 0,075). Lengste vinner mot Karakters 0,033
    killHitstop: 0.095,       // s når slaget dreper minst ett mål (rev. 5)
    flash: 0.1,               // s hvitt treffblink på målet (target.meleeFlashUntil = world.time + flash; vi tegner blinket, Fiende-design kan lese feltet)
    // Rev. 4: fiendens slag (team !== 'player'), mot spilleren. Overstyres per profil (ENEMY_WEAPONS[id].melee) eller per slag (opts).
    enemy: { dmg: 30, stagger: 0.25 },
    // Alias for eldre kode (enemies/behaviors/flanker.js leser TUNING.melee.windup): = contactAt.
    get windup() { return this.contactAt; },
  },
  // Hitstop ved drap (s, world.hitstop), per spillervåpen. Bare når spilleren dreper. 0 / mangler = av.
  killHitstop: { marksman: 0.03 },   // M-4: ~2 steg «tyngde» på drapsskuddet; AR-9/S-12 dreper for ofte til at det føles bra
  // Rev. 6 (skråvinkel + avtale med Effekter/VFX 23.10): flagg per effektgruppe, så VFX kan ta over med én linje per gruppe.
  // Våpen eier glimtflammen, tracere/kuler, hylser, granatbane med skygge og kassetilstand (står ikke her: alltid på).
  fx: {
    muzzleSecondary: false,  // lysflekk på bakken, røykdott og glør rundt munningsglimtet (VFX eier dette fremover)
    impacts: false,          // treffgnister, blink, støv, fliser og merker på dekning og kropp (VFX)
    explosion: false,        // granateksplosjonens grafikk (ildkule, sjokkbølge, røyk, svidd flekk) (VFX)
    meleeImpact: false,      // nærkamp: gnister/blink ved kontakt og hvitt treffblink på målet (VFX). Buestreken er vår og blir.
    blood: false,            // rødt blod ved kroppstreff (fx.bodyBlood, isolert; VFX fjerner det med egen diff)
    ownBullets: true,       // Våpen tegner egne kuler i løpshøyde med okklusjon (core drawProjectiles har ikke z; se review)
    occlusion: true,        // skjul kuler/glimt/gnister bak høy dekning i 34 (weapons/view34.js hidden)
  },
};
