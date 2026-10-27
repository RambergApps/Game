// Node-hook: behandle game/src/**/*.js som ES-moduler (rot-package.json sier "commonjs"). Brukes av ttk.mjs.
export async function load(url, ctx, next) {
  if (url.startsWith('file:') && url.includes('/game/src/') && url.endsWith('.js')) { const r = await next(url, { ...ctx, format: 'module' }); return { ...r, format: 'module' }; }
  return next(url, ctx);
}
