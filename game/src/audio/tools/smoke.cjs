// Røyktest: testside + selve spillet i headless Chromium. Skjermbilder + konsollfeil + lydstatus.
const { chromium } = require('playwright-core');
const out = process.argv[2] || '/workspace/breach/reviews/lyd-2026-10-23';
const base = process.argv[3] || 'http://localhost:8765';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=user-gesture-required'] });
  const report = {}; const checks = {};
  for (const [name, url, act] of [
    ['testside', '/src/audio/test.html', async (page) => {
      await page.mouse.click(600, 300); await page.waitForTimeout(300);
      const B = (t) => page.locator('#btns button', { hasText: t }).first().click();
      const ts = () => page.evaluate(() => import('/src/audio/index.js').then((m) => m.getState()));
      for (const t of ['Assault rifle', 'Shotgun', 'Marksman rifle', 'Chamber: rifle', 'Chamber: shotgun', 'Chamber: marksman', 'Enemy shotgun', 'Enemy marksman', 'Enemy: pump', 'Enemy: bolt',
        'Explosion', 'Enter high cover', 'Cover hit metal', 'Wave starts']) { await B(t); await page.waitForTimeout(350); }
      for (const t of ['Reload rifle (normal)', 'Reload rifle: perfect', 'Reload rifle: fail', 'Dry fire: shotgun', 'Switch → shotgun', 'Grenade bounce metal', 'Grenade bounce ×6', 'Enemy grenade lands', 'Upgrade cards open', 'Upgrade card picked', 'Level starts', 'Wave restart', 'Boss starts', 'Boss phase', 'Boss ends', 'Credits start', 'Credits end']) { await B(t); await page.waitForTimeout(t.startsWith('Reload') ? 2500 : 500); }
      checks.testV13 = await ts();
      // v1.4 CINDER + minigun-lading på testsiden
      for (const t of ['Kiln reload (minigun)', 'Kiln reload: perfect', 'Reload unknown weapon', 'Husk emerges', 'Lurcher emerges', 'Kiln emerges', 'Spitter emerges', 'Wave of 6 emerging', 'Husk steps', 'Lurcher steps', 'Kiln steps',
        'Husk telegraph', 'Lurcher charge', 'Kiln spin-up', 'Hit Husk', 'Hit Kiln', 'Husk dies', 'Kiln dies', 'Spitter sac (height', 'Kiln minigun',
        'Husk spine shot', 'Husk spine volley', 'Kiln slag spray', 'Spitter acid shot', 'Spitter sac (land', 'Kiln Alpha emerges', 'Kiln Alpha steps', 'Kiln Alpha slag', 'Hit Kiln Alpha', 'Kiln Alpha dies', 'Mass death']) { await B(t); await page.waitForTimeout(/reload|sac|emerg|spin|slag|dies|death/i.test(t) ? 3300 : 700); }
      { const pl = (await ts()).played; checks.testCinder = Object.fromEntries(Object.entries(pl).filter(([k]) => /^(spawn|chitin|lurcher|kiln|hitChitin|cinder|ember|spit|sac|acid|reload|active|heavy|hitBody|death$|grenadePin|grenadeThrow|grenadeBounce|explosion|spine|slag|upgrade|enemyRifle)/.test(k))); }
      await B('Level complete'); await page.waitForTimeout(300); await B('Fallen (death)'); await page.waitForTimeout(1200); checks.fallen1 = await ts();
      await B('Skip cutscene'); await page.waitForTimeout(600);
      await B('Fallen (death)'); await page.waitForTimeout(1200); checks.fallen2 = await ts(); await B('Skip cutscene'); await page.waitForTimeout(600);
      await B('Game complete'); await page.waitForTimeout(800);
      // vanlig pause: dukking, men ALDRI radiostøy
      await page.click('#pauseB'); await page.waitForTimeout(500); checks.testPlainPause = await ts(); await page.click('#pauseB'); await page.waitForTimeout(300);
      // hel sekvens (intro) med stubb, så hopp over
      await B('Cutscene: intro'); await page.waitForTimeout(3500); checks.testInCutscene = await ts();
      await B('Skip cutscene'); await page.waitForTimeout(800); checks.testAfterSkip = await ts();
      checks.testBroadcastPlayed = (await ts()).played; checks.testBroadcastPlayed = Object.fromEntries(Object.entries(checks.testBroadcastPlayed).filter(([k]) => /^(bcast|radio)|^fallen$/.test(k)));
      await page.click('#afAll'); await page.waitForTimeout(3500);
      await page.locator('#vHp').fill('20'); await page.locator('#vHp').dispatchEvent('input'); await page.waitForTimeout(1200);
    }],
    ['spill', '/index.html', async (page) => {
      const pre = await page.evaluate(() => import('/src/audio/index.js').then((m) => m.getState()));
      checks.preClick = pre;
      // v1.4.1 volum-API før opplåsing: klemming, getVolumes, localStorage, innlesing etter omlasting
      checks.volumeApi = await page.evaluate(() => import('/src/audio/index.js').then((m) => {
        const r = { set: [m.setMasterVolume(0.55), m.setMusicVolume(-1), m.setSfxVolume(1.7), m.setSfxVolume('x')], muteT: m.mute(true), muteF: m.mute(false) };
        r.get = m.getVolumes(); r.stored = JSON.parse(localStorage.getItem('breach.audio.volumes')); r.ready = m.getState().ready; return r; }));
      await page.reload(); await page.waitForTimeout(800);
      checks.volumeApi.afterReload = await page.evaluate(() => import('/src/audio/index.js').then((m) => m.getVolumes()));
      await page.evaluate(() => import('/src/audio/index.js').then((m) => { m.setMasterVolume(0.8); m.setMusicVolume(0.42); m.setSfxVolume(1); }));
      await page.reload(); await page.waitForTimeout(800);
      const st = () => page.evaluate(() => import('/src/audio/index.js').then((m) => ({ ...m.getState(), worldPaused: window.BREACH.world.paused })));
      // hendelseslogg fra world.events (ekte hendelser fra story/levels/weapons)
      await page.evaluate(() => {
        const w = window.BREACH.world; window.__ev = [];
        for (const t of ['cutsceneStart', 'cutsceneLine', 'cutsceneEnd', 'levelStart', 'waveStart', 'reload', 'activeReload', 'reloadDone', 'chamber', 'shot', 'dryFire', 'weaponSwitch', 'grenadeBounce', 'melee', 'refill'])
          w.events.on(t, (p) => window.__ev.push({ t, phase: p?.phase, result: p?.result, weapon: p?.weapon ?? p?.projectile?.weapon, team: p?.team ?? p?.projectile?.team, speaker: p?.speaker, id: p?.id, skipped: p?.skipped, n: p?.targets?.length, crateId: p?.crateId, ms: Math.round(performance.now()) }));
      });
      await page.click('#start-screen'); await page.waitForTimeout(1500);
      checks.afterStart = await st();
      await page.screenshot({ path: out + '/skjerm-spill-mellomsekvens.png' });
      // HEL intro-sekvens med ekte story-hendelser – ingen Escape
      const t0 = Date.now();
      // story venter på spilleren (autoAdvance 0): Enter fullfører/går videre linje for linje – ekte forløp, ikke skip
      checks.midCutscene = null;
      for (let i = 0; i < 120; i++) {
        if (await page.evaluate(() => window.__ev.some((e) => e.t === 'cutsceneEnd'))) break;
        await page.waitForTimeout(900);
        if (i === 6) checks.midCutscene = await st();
        await page.keyboard.press('Enter');
      }
      checks.cutsceneMs = Date.now() - t0;
      await page.waitForTimeout(600);
      checks.afterFullCutscene = await st();
      let ws; for (let i = 0; i < 40 && !(ws = await st()).played.waveStart; i++) await page.waitForTimeout(250);
      checks.firstWave = ws;
      // spilleren holdes i live under testen (ellers kan 'fallen' avbryte)
      await page.evaluate(() => { const P = window.BREACH.world.player; window.__god = setInterval(() => { P.hp = P.maxHp; }, 100); });
      const mark = () => page.evaluate(() => window.__ev.length);
      const m0 = await mark(), p0 = (await st()).played;
      // 1) gevær: automatild, så R (vanlig lading til slutt)
      await page.mouse.move(900, 380);
      await page.keyboard.press('Digit1'); await page.waitForTimeout(600);
      await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up(); await page.waitForTimeout(200);
      await page.keyboard.press('KeyR'); await page.waitForTimeout(2600);
      // 2) gevær: aktiv lading PERFEKT – trykk R midt i vinduet
      await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(200);
      await page.keyboard.press('KeyR');
      checks.dbgBeforePerfect = await page.evaluate(() => { const P = window.BREACH.world.player, L = P.loadout; return { hasLoadout: !!L, idx: L?.index, slot: L && { ...L.slots[L.index] }, reload: L?.reload, paused: window.BREACH.world.paused, dead: P.dead }; });
      await page.waitForFunction(() => { const r = window.BREACH.world.player.loadout?.reload; return r && r.t / r.base >= 0.415; }, null, { timeout: 5000, polling: 'raf' }).catch((e) => { checks.perfectWaitFail = String(e).slice(0, 80); });
      await page.keyboard.press('KeyR'); await page.waitForTimeout(900);
      // 3) gevær: aktiv lading FEIL (for tidlig etter 'from') → jam → end
      await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(200);
      await page.keyboard.press('KeyR');
      await page.waitForFunction(() => { const r = window.BREACH.world.player.loadout?.reload; return r && r.t / r.base >= 0.22; }, null, { timeout: 5000, polling: 'raf' }).catch((e) => { checks.failWaitFail = String(e).slice(0, 80); });
      await page.keyboard.press('KeyR'); await page.waitForTimeout(3600);
      // 4) bytte til hagle, tre skudd (ekte chamber), så presisjon to skudd
      await page.keyboard.press('Digit2'); await page.waitForTimeout(700);
      for (let i = 0; i < 3; i++) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(1100); }
      await page.keyboard.press('Digit3'); await page.waitForTimeout(800);
      for (let i = 0; i < 2; i++) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(1500); }
      // 5) tomt klikk: tøm presisjonsmagasin + reserve
      await page.evaluate(() => { const L = window.BREACH.world.player.loadout; const s = L.slots[L.index]; s.mag = 0; s.reserve = 0; });
      await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(500);
      const ev = await page.evaluate((m) => window.__ev.slice(m).filter((e) => e.team !== 'enemy'), m0);
      const p1 = (await st()).played, d = (k) => (p1[k] || 0) - (p0[k] || 0);
      const cnt = (f) => ev.filter(f).length;
      checks.weaponsReal = {
        events: {
          reloadStart: cnt((e) => e.t === 'reload' && e.phase === 'start'), reloadActive: cnt((e) => e.t === 'reload' && e.phase === 'active'),
          activeResults: ev.filter((e) => e.t === 'reload' && e.phase === 'active').map((e) => e.result),
          reloadEnd: cnt((e) => e.t === 'reload' && e.phase === 'end'), activeReloadEvt: cnt((e) => e.t === 'activeReload'),
          chamber: cnt((e) => e.t === 'chamber'), shotShotgun: cnt((e) => e.t === 'shot' && e.weapon === 'shotgun'), shotMarksman: cnt((e) => e.t === 'shot' && e.weapon === 'marksman'),
          dryFire: cnt((e) => e.t === 'dryFire'), weaponSwitch: cnt((e) => e.t === 'weaponSwitch'),
        },
        shots: { shotgunPlayed: d('shotgun'), marksmanPlayed: d('marksman') },
        played: { reloadStart: d('reloadStart'), activePerfect: d('activePerfect'), activeGood: d('activeGood'), activeFail: d('activeFail'), reloadDone: d('reloadDone'), oldReload: d('reload'),
          chamberShotgun: d('chamberShotgun'), chamberMarksman: d('chamberMarksman'), chamberFallback: d('_chamberFallback'), dryFire: d('dryFire'), weaponSwitch: d('weaponSwitch'), reloadDeduped: d('_reloadDeduped') },
      };
      // 6) v1.3.1 nærkamp (F) – først midt i lading (ekte cancel fra melee.js), så med en fiende plassert foran (treff)
      const m1 = await mark(), q0 = (await st()).played;
      await page.keyboard.press('Digit1'); await page.waitForTimeout(700);
      await page.evaluate(() => { const L = window.BREACH.world.player.loadout; const s = L.slots[L.index]; s.reserve = Math.max(s.reserve, 60); });
      await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(200);
      await page.keyboard.press('KeyR'); await page.waitForTimeout(400);
      checks.reloadingBeforeF = await page.evaluate(() => !!window.BREACH.world.player.loadout?.reload);
      await page.keyboard.press('KeyF'); await page.waitForTimeout(1000);
      checks.meleeTarget = await page.evaluate(() => { const w = window.BREACH.world, P = w.player, g = (w.enemies || []).find((x) => !x.dead);
        if (!g) return null; const a = P.aim ?? 0; g.x = P.x + Math.cos(a) * 26; g.y = P.y + Math.sin(a) * 26; g.hp = Math.max(g.hp || 0, 500); window.__meleeDummy = g; return { aim: a, type: g.type }; });
      await page.keyboard.press('KeyF'); await page.waitForTimeout(150);
      await page.evaluate(() => { const g = window.__meleeDummy, P = window.BREACH.world.player; if (g) { const a = P.aim ?? 0; g.x = P.x + Math.cos(a) * 26; g.y = P.y + Math.sin(a) * 26; } });
      await page.waitForTimeout(900);
      // 7) ammokasse (ekte world.arena.ammoCrates): lading pågår → gå til kassen → cancel fra refill + refill; så klar-pip
      await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(200);
      await page.keyboard.press('KeyR'); await page.waitForTimeout(300);
      checks.crate = await page.evaluate(() => { const w = window.BREACH.world, P = w.player, c = (w.arena?.ammoCrates || [])[0]; if (!c) return null;
        c.readyAt = 0; const L = P.loadout, s = L.slots[L.index]; s.reserve = Math.min(s.reserve, 10); window.__home = { x: P.x, y: P.y }; P.x = c.x; P.y = c.y; return { id: c.id, n: w.arena.ammoCrates.length, reloading: !!L.reload }; });
      await page.waitForTimeout(900);
      checks.crateAfter = await page.evaluate(() => { const w = window.BREACH.world, P = w.player, c = w.arena.ammoCrates[0]; P.x = window.__home.x; P.y = window.__home.y;
        const left = c.readyAt - w.time; c.readyAt = w.time + 1.0; return { cooldownLeft: +left.toFixed(1), ready: c.ready }; });
      await page.waitForTimeout(2200);
      { const ev2 = await page.evaluate((m) => window.__ev.slice(m).filter((e) => e.team !== 'enemy'), m1);
        const q1 = (await st()).played, dq = (k) => (q1[k] || 0) - (q0[k] || 0), c2 = (f) => ev2.filter(f).length;
        checks.meleeRefillLive = {
          events: { reloadCancel: c2((e) => e.t === 'reload' && e.result === 'cancel'), meleeStart: c2((e) => e.t === 'melee' && e.phase === 'start'),
            meleeHit: ev2.filter((e) => e.t === 'melee' && e.phase === 'hit').map((e) => e.n), meleeEnd: c2((e) => e.t === 'melee' && e.phase === 'end'),
            refill: ev2.filter((e) => e.t === 'refill').map((e) => e.crateId),
            seq: ev2.filter((e) => e.t === 'melee' || e.t === 'refill' || (e.t === 'reload' && e.result === 'cancel')).map((e) => e.t + (e.phase ? ':' + e.phase : '') + (e.result ? ':' + e.result : '')) },
          played: { reloadCancel: dq('reloadCancel'), cancelMelee: dq('_cancel_melee'), cancelRefill: dq('_cancel_refill'), cancelOther: dq('_cancel_other'),
            meleeStart: dq('meleeStart'), meleeHit: dq('meleeHit'), meleeMiss: dq('meleeMiss'), meleeEnd: dq('meleeEnd'), refill: dq('refill'), crateReady: dq('crateReady'), reloadDone: dq('reloadDone') } };
      }
      // 8) v1.3.1 blokkert treff: rull mens fiender skyter → core sender hit {amount:0, blocked:true}; ingen playerHurt skal spilles
      { const r0 = (await st()).played;
        await page.evaluate(async () => { const w = window.BREACH.world, P = w.player, am = await import('/src/audio/index.js');
          window.__ph = { blocked: 0, real: 0, projOnPlayer: 0, hurtOnBlocked: 0, grazeOnBlocked: 0, bodyOnBlockedProj: 0 };
          const em = w.events.emit; window.__emOrig = em; const hp = () => am.getState().played;
          // måler lyd per hendelse: playerHurt/bulletGraze før og etter hver blokkerte 'hit', hitBody rundt projectileHit
          w.events.emit = function (t, p) {
            const tgt = p?.target ?? p?.entity;
            if (t === 'hit' && tgt === P) { if (!p.blocked) { window.__ph.real++; return em.call(this, t, p); }
              window.__ph.blocked++; const b = hp(); const r = em.call(this, t, p); const a2 = hp();
              if ((a2.playerHurt || 0) !== (b.playerHurt || 0)) window.__ph.hurtOnBlocked++; if ((a2.bulletGraze || 0) !== (b.bulletGraze || 0)) window.__ph.grazeOnBlocked++; return r; }
            if (t === 'projectileHit' && p?.target === P) { window.__ph.projOnPlayer++; const b = hp().hitBody || 0; const r = em.call(this, t, p); if ((hp().hitBody || 0) !== b) window.__ph.bodyOnBlockedProj++; return r; }
            return em.call(this, t, p); };
          const live = (w.enemies || []).filter((g) => !g.dead).slice(0, 4);
          live.forEach((g, i) => { const a = i * Math.PI / 2 + 0.4; g.x = P.x + Math.cos(a) * 100; g.y = P.y + Math.sin(a) * 100; }); window.__nEnemies = live.length; });
        for (let i = 0; i < 28; i++) { const k = ['KeyA', 'KeyD', 'KeyW', 'KeyS'][i % 4]; await page.keyboard.down(k); await page.keyboard.press('Space'); await page.waitForTimeout(420); await page.keyboard.up(k); await page.waitForTimeout(60); }
        const rollPhase = await page.evaluate(() => ({ ...window.__ph }));
        // garanti: P.invuln låst til true i 3 s (getter – tilstandsmaskinen nullstiller ellers flagget hver frame) mens fiendene skyter
        await page.evaluate(() => { const w = window.BREACH.world, P = w.player; Object.defineProperty(P, 'invuln', { get: () => true, set() {}, configurable: true });
          (w.enemies || []).filter((g) => !g.dead).slice(0, 4).forEach((g, i) => { const a = i * Math.PI / 2 + 0.4; g.x = P.x + Math.cos(a) * 100; g.y = P.y + Math.sin(a) * 100; }); });
        await page.waitForTimeout(3000);
        await page.evaluate(() => { const P = window.BREACH.world.player; delete P.invuln; P.invuln = false; });
        const ph = await page.evaluate(() => { window.BREACH.world.events.emit = window.__emOrig; return { ...window.__ph, enemies: window.__nEnemies }; });
        const r1 = (await st()).played, dr = (k) => (r1[k] || 0) - (r0[k] || 0);
        checks.blockedHitLive = { rollPhase, events: ph, played: { playerHurt: dr('playerHurt'), bulletGraze: dr('bulletGraze'), hitBody: dr('hitBody') } };
      }
      // 10) v1.4 CINDER live: Kiln + Spitter dukker opp ved spilleren (spawnWithWarning – samme modul som spillet), 22 s kamp
      { await page.evaluate(() => { const w = window.BREACH.world; window.__cin = {}; window.__cinW = {};
          for (const t of ['spawnWarn', 'spawnRise', 'telegraph', 'meleeCharge', 'spinup', 'spindown', 'grenadeWindup', 'grenade', 'grenadeBounce', 'explosion', 'footstep', 'reload', 'heavyReload', 'death', 'projectileHit', 'shot'])
            w.events.on(t, (p) => { const k = t === 'footstep' ? (p?.team === 'enemy' ? 'footstep_enemy' : 'footstep_player') : t === 'reload' ? 'reload_' + (typeof p?.weapon === 'string' ? p.weapon : p?.weapon?.id) + '_' + p?.phase : t === 'shot' ? 'shot_' + p?.team + '_' + (p?.weapon ?? p?.projectile?.weapon) : t;
              window.__cin[k] = (window.__cin[k] || 0) + 1; if (t === 'spawnWarn') window.__cinW[p.type] = (window.__cinW[p.type] || 0) + 1; }); });
        const c0 = (await st()).played;
        await page.evaluate(() => import('/src/enemies/spawn.js').then((m) => { const w = window.BREACH.world, P = w.player;
          m.spawnWithWarning(w, 'heavy', P.x + 260, P.y - 60); m.spawnWithWarning(w, 'grenadier', P.x - 330, P.y + 120); m.spawnWithWarning(w, 'heavy', P.x + 300, P.y + 40, { variant: 'alpha' }); m.spawnWithWarning(w, 'flanker', P.x + 200, P.y + 160); }));
        await page.waitForTimeout(3000);
        // spilleren skyter på nærmeste levende Cinderborn i ~24 s (sikter via kameraets worldToScreen)
        const tEnd = Date.now() + 24000;
        while (Date.now() < tEnd) {
          const aim = await page.evaluate(() => { const B = window.BREACH, w = B.world, P = w.player, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect();
            P.hp = P.maxHp; const e = (w.enemies || []).filter((x) => !x.dead && x.type !== 'grenadier').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; if (!e) return null;
            const s = B.camera.worldToScreen(e.x, e.y); return { x: r.left + s.x * r.width / cv.width, y: r.top + s.y * r.height / cv.height }; });
          if (aim) { await page.mouse.move(aim.x, aim.y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up(); }
          await page.waitForTimeout(250);
        }
        await page.screenshot({ path: out + '/skjerm-spill-cinder.png' });
        const c1 = (await st()).played, dc = (k) => (c1[k] || 0) - (c0[k] || 0);
        const keys = ['spawnWarn', 'spawnRise', 'chitinStep', 'chitinRattle', 'lurcherCharge', 'kilnSpinup', 'kilnSpindown', 'hitChitin', 'cinderDeath', 'emberIdle', 'spitWindup', 'spitPlop', 'sacSplat', 'sacBounce', 'acidBurst',
          'reloadStart', 'reloadDone', 'enemyRifle', 'heavy', 'hitBody', 'death', 'footstep', 'grenadeThrow', 'explosion', 'spineShot', 'slagSpray'];
        checks.cinderLive = { events: await page.evaluate(() => window.__cin), warnTypes: await page.evaluate(() => window.__cinW), played: Object.fromEntries(keys.map((k) => [k, dc(k)])),
          enemies: await page.evaluate(() => (window.BREACH.world.enemies || []).filter((e) => !e.dead).map((e) => e.type)), voices: c1.voices };
      }
      // 9) v1.3.1 granat (Våpen rev. 3): hold G, slipp → grenade windup → throw → land. Én splint + én kastlyd per kast.
      { await page.evaluate(() => { const w = window.BREACH.world; window.__gr = []; w.events.on('grenade', (p) => window.__gr.push({ phase: p.phase, team: p.team }));
          (w.enemies || []).forEach((g) => { g.x = -9999; g.y = -9999; }); const L = w.player.loadout; L.grenades = Math.max(L.grenades || 0, 2); L.grenadeCd = 0; });
        const g0 = (await st()).played;
        await page.mouse.move(1000, 300); await page.keyboard.down('KeyG'); await page.waitForTimeout(400); await page.keyboard.up('KeyG'); await page.waitForTimeout(3000);
        const g1 = (await st()).played, dg = (k) => (g1[k] || 0) - (g0[k] || 0);
        const gr = await page.evaluate(() => window.__gr);
        checks.grenadeLive = { events: gr, played: { grenadePin: dg('grenadePin'), grenadeThrow: dg('grenadeThrow'), grenadeBounce: dg('grenadeBounce'), explosion: dg('explosion') } };
      }
      checks.cutsceneEvents = await page.evaluate(() => { const e = window.__ev; const c = (f) => e.filter(f).length;
        return { start: e.filter((x) => x.t === 'cutsceneStart').map((x) => x.id), lines: c((x) => x.t === 'cutsceneLine'), speakers: [...new Set(e.filter((x) => x.t === 'cutsceneLine').map((x) => x.speaker))],
          end: e.filter((x) => x.t === 'cutsceneEnd').map((x) => ({ id: x.id, skipped: x.skipped })), order: e.filter((x) => /^(cutsceneStart|cutsceneEnd|levelStart|waveStart)$/.test(x.t)).map((x) => x.t) }; });
      checks.gameBroadcastPlayed = Object.fromEntries(Object.entries((await st()).played).filter(([k]) => /^(bcast|radio)/.test(k)));
      await page.evaluate(() => clearInterval(window.__god));
      // pause-test
      await page.evaluate(() => { window.BREACH.world.paused = true; }); await page.waitForTimeout(1200);
      checks.paused = await page.evaluate(() => import('/src/audio/index.js').then((m) => m.getState()));
      await page.screenshot({ path: `${out}/skjerm-spill-pause.png` });
      await page.evaluate(() => { window.BREACH.world.paused = false; }); await page.waitForTimeout(800);
      checks.resumed = await page.evaluate(() => import('/src/audio/index.js').then((m) => ({ paused: m.getState().paused, driver: m.getState().driver })));
    }],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
    await page.goto(base + url); await page.waitForTimeout(600);
    await act(page);
    const state = await page.evaluate(() => import('/src/audio/index.js').then((m) => m.getState()));
    await page.screenshot({ path: `${out}/skjerm-${name}.png` });
    report[name] = { state, logs };
    await page.close();
  }
  console.log(JSON.stringify({ report, checks }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
