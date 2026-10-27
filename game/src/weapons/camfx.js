// Kamerarist – ÉTT internt punkt for alle våpeneffekter (skudd, granat, nærkamp) og for hitstop.
// Core eier kameraet: camera.shake(amount_px, duration_ms), kappet til camera.shakeMax (10 px) og ganget med shakeScale.
// Våpen skriver ALDRI til camera.x/y (CORE-API.md: «Ingen skal flytte camera.x/y selv for rist/kick»).

/** Rist kameraet via core. amount i px (verden), ms i millisekunder – samme enheter som core, ingen konvertering. */
export function shake(world, amount, ms) {
  const cam = world.camera; if (!cam || !(amount > 0) || !(ms > 0)) return;
  cam.shake(amount, ms);
}

/** Retningsbestemt rekyl-kick. Core har ingen kick-API i dag → ingenting skjer (bare shake gjelder).
 *  Forslag til core (review rev. 3b): camera.kick(angle, px) som kappes sammen med risten. Finnes den, brukes den her. */
export function kick(world, angle, px) {
  const cam = world.camera; if (!cam || !(px > 0)) return;
  if (typeof cam.kick === 'function') cam.kick(angle, px);
}

/** Kort frys av simuleringen via core (world.hitstop(s), lengste vinner, maks 0,25 s). */
export function hitstop(world, sec) {
  if (sec > 0 && typeof world.hitstop === 'function') world.hitstop(sec);
}

/** Følger kameraet denne entiteten? */
export const follows = (world, e) => !!world.camera && world.camera.target === e;
