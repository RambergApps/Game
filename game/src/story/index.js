// BREACH – story-modul (Breach Nivåer og story). Modulkontrakt: init/update/draw + showCutscene(id) → Promise
// + showCredits(opts) → Promise (rulletekst etter «ending»).
import { bindWorld, preloadCutscene } from './player.js';
export { showCutscene, preloadCutscene, active as cutsceneActive, storyEvents } from './player.js';
export { showCredits, creditsActive, CREDITS } from './credits.js';
export { CUTSCENES, CUTSCENE_IDS, SPEAKERS, SPEAKER_LABEL } from './cutscenes.js';
/** Kobler verden og forhåndslaster det som trengs tidlig: introen og «fallen» (malte bilder, så første død ikke venter på nett). */
export function init(world) {
  bindWorld(world);
  if (typeof window !== 'undefined') setTimeout(() => { preloadCutscene('intro', { paintedOnly: true }); preloadCutscene('fallen', { paintedOnly: true }); }, 0);
}
export function update() {}
export function draw() {}
