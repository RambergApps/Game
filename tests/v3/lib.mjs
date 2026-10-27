// Felles hjelpere for v3-skråvinkel-testen (Breach Test). Skriver aldri i game/.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright-core');
export const BASE = process.env.V3_BASE || 'http://127.0.0.1:8000';
export const OUT = '/workspace/breach/shots/test/v3-skravinkel';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function findChrome() { const base = path.join(os.homedir(), '.cache/ms-playwright'); for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium-')).sort().reverse()) { const p = path.join(base, d, 'chrome-linux64/chrome'); if (fs.existsSync(p)) return p; } }
export async function launch() {
  return chromium.launch({ headless: true, executablePath: findChrome(), handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
}
export async function open(browser, url, errs) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message || e)));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BREACH && window.BREACH.world, null, { timeout: 20000 });
  return page;
}
// index.html: start, hopp over mellomsekvens med ESC
export async function startIndex(page) {
  await page.evaluate(() => window.BREACH.startGame());
  for (let i = 0; i < 40; i++) {
    const cs = await page.evaluate(() => !!document.querySelector('canvas.breach-cutscene, .breach-cutscene'));
    if (cs) { await page.keyboard.press('Escape'); await sleep(300); } else if (i > 6) break;
    await sleep(250);
  }
}
