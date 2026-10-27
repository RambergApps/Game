const { chromium } = require('playwright-core'); const os=require('os');
(async()=>{ const b=await chromium.launch({executablePath:os.homedir()+'/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'});
const p=await b.newPage({viewport:{width:1600,height:1000}}); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8765/index.html?skipmenu=1'); await p.waitForFunction(()=>window.BREACH?.world?.arena); await p.waitForTimeout(1500);
await p.evaluate(()=>{const w=window.BREACH.world,A=w.modules.arena; window.__c={}; const orig=A.addCoverDecal; w.modules.arena={...A, addCoverDecal:(...a)=>{const s=(new Error().stack.split('\n')[2]||'').replace(/.*\/src\//,'').replace(/\).*/,''); window.__c[s]=(window.__c[s]||0)+1; return orig(...a);}}; w.player.invuln=999; window.__ev={}; w.events.on('*',(t)=>{const k=typeof t==='string'?t:(t&&t.type); window.__ev[k]=(window.__ev[k]||0)+1;});});
await p.mouse.click(800,500); await p.waitForTimeout(500); for(let i=0;i<6&&await p.evaluate(()=>window.BREACH.world.paused);i++){await p.keyboard.press('Escape');await p.waitForTimeout(300);}
await p.mouse.move(1000,400); await p.mouse.down(); await p.waitForTimeout(12000); await p.mouse.up();
console.log(JSON.stringify(await p.evaluate(()=>({calls:window.__c, ev:window.__ev, paused:window.BREACH.world.paused, en:window.BREACH.world.enemies.length, stats:window.BREACH.world.modules.arena.decalStats(window.BREACH.world), w:window.BREACH.world._wDecals?.stats&&{...window.BREACH.world._wDecals.stats,each:undefined}}))), errs);
await b.close();})();
