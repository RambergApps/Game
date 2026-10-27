// BREACH UI (eies av Våpen): pausemeny, SETTINGS-skjerm, innstillingslager og FPS-visning.
// Ett kall fra main.js: initUI(world, { loop, onRestartWave?, onQuit? }). Se docs/UI.md.
import { applySettings, getSettings } from './settings.js';
import { createPauseMenu } from './pauseMenu.js';
import { createFpsCounter } from './fps.js';
import { createDamageIndicator } from './damage.js';
import { createOffscreenIndicator } from './offscreen.js';

export * from './settings.js';
export { openSettings, SETTINGS_LAYOUT } from './settingsScreen.js';
export { createPauseMenu } from './pauseMenu.js';
export { createFpsCounter } from './fps.js';
export { createDamageIndicator, sourcePoint, DAMAGE_UI } from './damage.js';
export { createOffscreenIndicator, OFFSCREEN_UI } from './offscreen.js';
export { PALETTE, injectStyle } from './style.js';

/**
 * Kobler alt på: leser breach.settings, bruker dem (lyd, kamerarist, world.settings), lager FPS-visning og pausemeny.
 * @returns {{ pause, fps, damage, hud, settings }}
 */
export function initUI(world, opts = {}) {
  const fps = createFpsCounter({ loop: opts.loop ?? null });
  applySettings(world, { fps });
  const pause = createPauseMenu(world, opts);
  const damage = createDamageIndicator(world);
  const offscreen = createOffscreenIndicator(world);
  // hud: gi som mods.hud i createLoop – tegnes før level/player-HUD, så HUD-en ligger oppå indikatoren.
  const hud = { draw: (ctx, w, camera) => { offscreen.draw(ctx, w, camera); damage.draw(ctx, w, camera); } };
  world.ui = { pause, fps, damage, offscreen, getSettings };
  return { pause, fps, damage, offscreen, hud, settings: getSettings() };
}
