// Register for fiendetegning (Fiende-design plugger inn her; Fiende-AI eier oppførsel og varsler).
// Se src/enemies/RENDER.md for hele kontrakten.
//
//   registerEnemyArt(type, variant, drawFn)   type: 'grunt'|'flanker'|'heavy'|'grenadier'|…; variant: null/'*' = standard,
//                                             ellers f.eks. 'alpha'. Returnerer en avregistreringsfunksjon.
//   drawFn(ctx, P, info) → void | false       P = poseOf(world, e) (KUN lesing). info = { world, camera, view: 'top'|'34',
//                                             layer: 'body'|'corpse', proj: PROJ, lift, enemy }. Returner false for å
//                                             falle tilbake til plassholderen denne framen.
// Oppslag: type+variant → type+standard → plassholder. Kaster drawFn, logges det én advarsel og plassholderen brukes
// (ctx gjenopprettes alltid). Tegneren skal aldri endre fienden eller world.

const REG = new Map();
const warned = new Set();
const key = (type, variant) => `${type}|${variant && variant !== '*' ? variant : ''}`;

export function registerEnemyArt(type, variant, drawFn) {
  if (typeof type !== 'string' || typeof drawFn !== 'function') throw new TypeError('registerEnemyArt(type, variant, drawFn)');
  const k = key(type, variant);
  REG.set(k, drawFn); warned.delete(k);
  return () => { if (REG.get(k) === drawFn) REG.delete(k); };
}
export function unregisterEnemyArt(type, variant) { REG.delete(key(type, variant)); }
/** Tegner for type/variant, eller null (= plassholder). */
export function getEnemyArt(type, variant) { return REG.get(key(type, variant)) || REG.get(key(type, null)) || null; }
export function listEnemyArt() { return [...REG.keys()]; }

/** Kall registrert tegner trygt. → true hvis den tegnet, false = bruk plassholder. */
export function drawWithArt(ctx, P, info) {
  const fn = getEnemyArt(P.type, P.variant);
  if (!fn) return false;
  ctx.save();
  try { return fn(ctx, P, info) !== false; }
  catch (err) {
    const k = key(P.type, P.variant);
    if (!warned.has(k)) { warned.add(k); console.warn(`[enemies] art for ${k} feilet – bruker plassholder`, err); }
    return false;
  } finally { ctx.restore(); }
}
