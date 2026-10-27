// Voice-slider: spion på setVoiceVolume (oppstart + endring + lagring) og bilde av Audio i pausemenyen → shots/22-voice-slider.png
const { chromium } = require('/workspace/breach/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const port = process.argv[2] || 8790, OUT = path.join(__dirname, '../shots');
const base = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243';
const exe = path.join(base, fs.readdirSync(base).find((d) => d.startsWith('chrome-')), 'chrome-headless-shell');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: '/workspace/breach/game', stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const b = await chromium.launch({ executablePath: exe }), errs = [];
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  try {
    await p.addInitScript(() => localStorage.setItem('breach.settings', JSON.stringify({ v: 1, version: 1, voice: 0.35 })));
    await p.goto(`http://localhost:${port}/index.html?skipmenu=1`); await p.waitForTimeout(1500);
    const r = await p.evaluate(async () => {
      const A = await import('/src/audio/index.js'), S = await import('/src/ui/settings.js');
      const boot = A.getVolumes().voice, calls = [];
      S.setAudioAdapter({ ...A, setVoiceVolume: (v) => { calls.push(v); return A.setVoiceVolume?.(v); } });
      S.setSetting('voice', 0.6);
      return { bootSetting: S.getSettings().voice, bootAudio: boot, calls, after: A.getVolumes().voice, saved: JSON.parse(localStorage.getItem('breach.settings')).voice };
    });
    const r2 = await p.evaluate(async () => { const S = await import('/src/ui/settings.js'); S.setAudioAdapter({}); try { S.setSetting('voice', 0.5); return 'ok'; } catch (e) { return e.message; } });
    await p.evaluate(async () => { const S = await import('/src/ui/settings.js'), A = await import('/src/audio/index.js'); S.setAudioAdapter(A); S.setSetting('voice', 0.6); BREACH.startGame(); const L = await import('/src/levels/index.js'); L.startAt(BREACH.world, 1, 0, { skipCutscenes: true }); BREACH.world.paused = false; });
    await p.waitForTimeout(1500); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    await p.evaluate(() => { if (!document.querySelector('.bx-root')) BREACH.world.ui?.pause?.toggle?.(); }); await p.waitForTimeout(500);
    await p.getByText('Settings', { exact: true }).first().click(); await p.waitForTimeout(500);
    const v = p.getByText('Voice', { exact: true }).first(); await v.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/22-voice-slider.png` });
    console.log(JSON.stringify({ ...r, noAudio: r2, errs }));
  } finally { await b.close(); srv.kill(); }
})();
