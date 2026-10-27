// Kjør: node game/src/weapons/tools/ttk.mjs [trials]  → skriver markdown-tabeller til stdout og weapons/tools/ttk.json
import fs from 'node:fs';
import { register } from 'node:module';
register('./esm-hook.mjs', import.meta.url);
const { buildTable, simulateTTK, damageAt, grenadeAt, DISTS } = await import('../ttk.js');
const { WEAPONS, ENEMY_WEAPONS, rpm } = await import('../data.js');
const { falloffMult } = await import('../index.js');
const trials = +(process.argv[2] || 200);
const f = (r) => (r.killRate < 0.5 ? '–' : r.mean.toFixed(2) + (r.killRate < 0.98 ? `*` : ''));
const out = { trials, generated: new Date().toISOString() };
let md = '';
const table = (title, t) => {
  md += `\n### ${title}\n\n| Våpen | Mål | ${t.dists.map((d) => `${d} r (${d * 32} px)`).join(' | ')} |\n|---|---|${t.dists.map(() => '---').join('|')}|\n`;
  for (const r of t.rows) md += `| ${WEAPONS[r.weapon].short} | ${r.target} | ${r.cells.map(f).join(' | ')} |\n`;
};
md += `\n### Skade per avtrekk (formel, alle hagl treffer)\n\n| Våpen | rpm | ${DISTS.map((d) => `${d} r`).join(' | ')} |\n|---|---|${DISTS.map(() => '---').join('|')}|\n`;
for (const id of Object.keys(WEAPONS)) md += `| ${WEAPONS[id].short} | ${rpm(WEAPONS[id])} | ${DISTS.map((d) => damageAt(id, d).perShot.toFixed(0)).join(' | ')} |\n`;
md += `| Granat | – | ${[0, 1, 2, 3, 4].map((d) => `${d} r: ${grenadeAt(d).toFixed(0)}`).join(' · ')} |  |\n`;
const open = buildTable({ trials }); out.open = open; table('TTK (s), sikter, mål i åpent lende', open);
const hip = buildTable({ trials, targets: ['grunt'], posture: 'hip' }); out.hip = hip; table('TTK (s), hoftefyr (uten sikte), Grunt', hip);
const blind = buildTable({ trials, targets: ['grunt'], posture: 'blind' }); out.blind = blind; table('TTK (s), blindfire fra dekning, Grunt', blind);
const low = buildTable({ trials, targets: ['grunt'], cover: 'low', dists: [4, 8, 16] }); out.low = low; table('TTK (s), Grunt skjult bak LAV dekning (35 % treff)', low);
const pop = buildTable({ trials, targets: ['grunt'], cover: 'lowPopUp', dists: [4, 8, 16] }); out.pop = pop; table('TTK (s), Grunt kikker ut over lav dekning (popUp, 60 % treff)', pop);
// reaksjon: målet dukker opp nå (ingen forhåndssikte/lading). Presisjon venter smart på lading når det dreper raskere.
const react = buildTable({ trials, targets: ['grunt', 'grenadier'], preAim: false }); out.react = react; table('TTK (s), reaksjon – målet dukker opp, sikting/lading starter nå (målt fra målet dukker opp)', react);
// presisjon: fin oppløsning rundt én-skudd-grensen
const FINE = [8, 10, 11, 12, 13, 14, 16, 20];
const fine = { dists: FINE, rows: [] };
for (const t of ['grunt', 'grenadier', 'flanker']) for (const pre of [true, false]) fine.rows.push({ weapon: 'marksman', target: t + (pre ? ' (forhåndssiktet)' : ' (reaksjon)'), cells: FINE.map((d) => simulateTTK({ weapon: 'marksman', target: t, tiles: d, posture: 'aim', preAim: pre, trials })) });
out.fine = fine; table('TTK (s), M-4 rundt én-skudd-grensen', fine);
// fiendeprofiler (ENEMY_WEAPONS): skade per treff mot spilleren
md += `\n### Fiendeprofiler: skade per treff (før rustning/dekning)\n\n| Profil | rpm | ${DISTS.map((d) => `${d} r`).join(' | ')} |\n|---|---|${DISTS.map(() => '---').join('|')}|\n`;
for (const id of Object.keys(ENEMY_WEAPONS)) { const w = ENEMY_WEAPONS[id]; md += `| ${id} | ${rpm(w)} | ${DISTS.map((d) => (w.dmg * falloffMult(w, d * 32)).toFixed(1)).join(' | ')} |\n`; }
md += `\n\\* = drepte i under 98 % av forsøkene innen 8 s. – = under 50 %. TTK måles fra første avtrekk til målet dør (inkl. kulefart og lading). ${trials} forsøk per celle.\n`;
fs.writeFileSync(new URL('./ttk.json', import.meta.url), JSON.stringify(out, null, 1));
fs.writeFileSync(new URL('./ttk.md', import.meta.url), md);
console.log(md);
