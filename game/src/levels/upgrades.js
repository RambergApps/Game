// BREACH – oppgraderinger mellom bølgene (eies av Breach Nivåer og story).
// Rene data + små rene funksjoner. Eneste import er våpenets rene data (weapons/data.js har selv ingen importer,
// så det blir ingen sirkel og ingen skjult kobling via world.modules).
//
// Flyt: etter en bølge med upgradeAfter:true → rollOffer() gir 3 kort → spilleren velger 1 →
// pick() øker stabelen → computeStats() regner ut spillerens verdier på nytt fra BASE_STATS.
// Alt regnes fra bunnen hver gang, så tak/gulv kan aldri «lekke» via rekkefølge.

/** Grunnverdier som player-modulen bør lese fra (navn er forslag til Breach Karakter). */
import { WEAPONS } from '../weapons/data.js';

/** Spillerens primærvåpen – grunnverdiene for magasin og ladetid hentes fra Våpens tuning. */
const PRIMARY = WEAPONS.rifle;

export const BASE_STATS = {
  maxHp: 100,            // HP
  magSize: PRIMARY.mag,         // skudd per magasin (AR-9: 24, fra weapons/data.js)
  reloadTime: PRIMARY.reloadTime, // sekunder (AR-9: 1,8, fra weapons/data.js; = player/tuning.js reloadMs 1800)
  coverDamageMult: 1.0,  // skademultiplikator mens spilleren er i dekning
  grenades: 2,           // maks antall granater
  rollDistMult: 1.0,     // multiplikator på rullelengde (tuning.js rollDist 125 px)
  healOnKill: 0,         // HP per drap
  coverSpreadMult: 1.0,  // spredning når man skyter fra dekning (mindre = mer presis)
  pierce: 0,             // antall ekstra mål en kule kan gå gjennom
  pierceDamageMult: 0.6, // skade på mål nr. 2+
};

/** Harde grenser – sikkerhetsnett mot ubalanse uansett kombinasjon. */
export const LIMITS = {
  maxHp: [100, 140], coverDamageMult: [0.6, 1],
  grenades: [2, 4], rollDistMult: [1, 1.2], healOnKill: [0, 12], coverSpreadMult: [0.65, 1], pierce: [0, 1],
};
/** Relative grenser (× grunnverdien) for våpenavhengige tall, så de passer alle våpen. Våpen skalerer playerStats/BASE relativt. */
export const REL_LIMITS = {
  magSize: [1, 1.6],          // AR-9: 24 → maks 38
  reloadTime: [2 / 3, 1],     // AR-9: 1,8 → min 1,2 s
};

// kind: 'stack' (permanent, kan stables til max) | 'instant' (virker én gang, f.eks. helbredelse)
// role: 'forsvar' | 'angrep' | 'taktikk'   rarity: 'vanlig' | 'sjelden'
// minLevel: første nivå kortet kan dukke opp.  when(ctx): ekstra vilkår.
export const UPGRADES = [
  { id: 'plating', name: 'Reinforced Plate', role: 'forsvar', rarity: 'vanlig', max: 2, minLevel: 1, kind: 'stack',
    text: '+20 max HP.', mods: [['maxHp', 'add', 20]] },
  { id: 'cover-plates', name: 'Cover Plating', role: 'forsvar', rarity: 'vanlig', max: 2, minLevel: 1, kind: 'stack',
    text: '−20% damage taken in cover.', mods: [['coverDamageMult', 'mul', 0.8]] },
  { id: 'adrenaline', name: 'Adrenaline', role: 'forsvar', rarity: 'vanlig', max: 2, minLevel: 1, kind: 'stack',
    text: 'Each kill restores 6 HP.', mods: [['healOnKill', 'add', 6]] },
  { id: 'ext-mag', name: 'Extended Mag', role: 'angrep', rarity: 'vanlig', max: 2, minLevel: 1, kind: 'stack',
    text: '+30% magazine size.', mods: [['magSize', 'mul', 1.3]] },
  { id: 'fast-reload', name: 'Quick Loader', role: 'angrep', rarity: 'vanlig', max: 2, minLevel: 1, kind: 'stack',
    text: '−20% reload time.', mods: [['reloadTime', 'mul', 0.8]] },
  { id: 'steady-hand', name: 'Steady Hand', role: 'angrep', rarity: 'vanlig', max: 1, minLevel: 1, kind: 'stack',
    text: '−35% spread when firing from cover.', mods: [['coverSpreadMult', 'mul', 0.65]] },
  { id: 'grenade-belt', name: 'Grenade Belt', role: 'taktikk', rarity: 'vanlig', max: 2, minLevel: 1, kind: 'stack',
    text: '+1 grenade.', mods: [['grenades', 'add', 1]] },
  { id: 'servo-joints', name: 'Servo Joints', role: 'taktikk', rarity: 'vanlig', max: 1, minLevel: 1, kind: 'stack',
    text: '+20% roll distance.', mods: [['rollDistMult', 'mul', 1.2]] },
  { id: 'ap-rounds', name: 'AP Rounds', role: 'angrep', rarity: 'sjelden', max: 1, minLevel: 2, kind: 'stack',
    text: 'Rounds pierce one target. 60% damage to the second.', mods: [['pierce', 'add', 1]] },
  { id: 'field-kit', name: 'Field Kit', role: 'forsvar', rarity: 'vanlig', max: Infinity, minLevel: 1, kind: 'instant',
    text: 'Restore 50% of max HP now.', when: (ctx) => ctx.hpRatio < 0.6, instant: { healRatio: 0.5 } },
];

const WEIGHT = { vanlig: 3, sjelden: 1 };
export const byId = (id) => UPGRADES.find((u) => u.id === id) || null;

export function createUpgradeState() { return { stacks: {}, lastOffer: [], history: [] }; }

function eligible(state, ctx) {
  return UPGRADES.filter((u) => (state.stacks[u.id] || 0) < u.max && (ctx.level ?? 1) >= u.minLevel && (!u.when || u.when(ctx)));
}

function weightedPick(pool, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0); let r = rng() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return pool.length - 1;
}

/**
 * Trekk et tilbud på n kort (standard 3).
 * Regler: ingen duplikater; maksede kort og kort under minLevel utelates; sjeldne kort vektes 1 mot 3;
 * kort som ble vist men ikke valgt i forrige tilbud får halv vekt; minst ett forsvarskort hvis mulig.
 * ctx = { level: 1..3, hpRatio: 0..1 }.  rng = () => [0,1) (bruk world.rng for determinisme).
 */
export function rollOffer(state, ctx = {}, rng = Math.random, n = 3) {
  const c = { level: 1, hpRatio: 1, ...ctx };
  let pool = eligible(state, c); const out = [];
  while (out.length < n && pool.length) {
    const w = pool.map((u) => WEIGHT[u.rarity] * (state.lastOffer.includes(u.id) ? 0.5 : 1));
    const i = weightedPick(pool, w, rng); out.push(pool[i]); pool = pool.filter((_, k) => k !== i);
  }
  if (out.length === n && !out.some((u) => u.role === 'forsvar')) {
    const def = pool.filter((u) => u.role === 'forsvar');
    if (def.length) out[n - 1] = def[Math.floor(rng() * def.length)];
  }
  state.lastOffer = out.map((u) => u.id);
  return out.map((u) => u.id);
}

/** Registrer et valg. Returnerer { stats, instant } der instant er en engangseffekt (eller null). */
export function pick(state, id, base = BASE_STATS) {
  const u = byId(id); if (!u) throw new Error(`[upgrades] ukjent oppgradering '${id}'`);
  if (u.kind === 'stack') state.stacks[id] = Math.min(u.max, (state.stacks[id] || 0) + 1);
  state.history.push(id);
  return { stats: computeStats(state, base), instant: u.instant || null };
}

/** Regn ut spillerens verdier fra grunnverdier + stabler, klemt innenfor LIMITS. */
export function computeStats(state, base = BASE_STATS) {
  const s = { ...base };
  for (const [id, count] of Object.entries(state.stacks)) {
    const u = byId(id); if (!u?.mods) continue;
    for (let k = 0; k < count; k++) for (const [stat, op, v] of u.mods) s[stat] = op === 'add' ? s[stat] + v : s[stat] * v;
  }
  for (const [stat, [lo, hi]] of Object.entries(LIMITS)) s[stat] = Math.min(hi, Math.max(lo, s[stat]));
  for (const [stat, [lo, hi]] of Object.entries(REL_LIMITS)) s[stat] = Math.min(hi * base[stat], Math.max(lo * base[stat], s[stat]));
  s.magSize = Math.round(s.magSize); s.grenades = Math.round(s.grenades);
  return s;
}
