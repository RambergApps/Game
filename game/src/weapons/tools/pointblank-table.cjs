// Slår sammen pointblank-{before,after}-*.json → pointblank.json + tabell (stdout, markdown)
const fs = require('fs'), path = require('path'), D = __dirname;
const key = (c) => [c.weapon, c.pose, c.type, c.gap, c.deg].join('|');
const ok = (c) => !(c.pose === 'cover' || c.pose === 'blind') || c.coverState === 'cover';   // celler der E ikke ga dekning forkastes
const load = (pre) => [...new Map(fs.readdirSync(D).filter((f) => f.startsWith(pre) && f.endsWith('.json')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(D, f))).cells).filter(ok).map((c) => [key(c), c])).values()];
const A = new Map(load('pointblank-after-').map((c) => [key(c), c])), rows = [];
for (const b of load('pointblank-before-')) { const a = A.get(key(b)); if (a) rows.push({ k: key(b), b, a }); }
fs.writeFileSync(path.join(D, 'pointblank.json'), JSON.stringify(rows.map(({ b, a }) => ({ weapon: b.weapon, pose: b.pose, type: b.type, gap: b.gap, deg: b.deg, before: b, after: a })), null, 1));
const f = (x) => x == null ? '–' : (+x).toFixed(x < 2 ? 2 : 0), z = (c) => `${c.zPass == null ? '–' : c.zPass}/${c.hz}`;
console.log('| våpen | pose | type | gap | ° | FØR any | FØR pel | FØR z pass/treff | ETTER any | ETTER pel | ETTER z pass/treff |\n|---|---|---|---|---|---|---|---|---|---|---|');
for (const { b, a } of rows) console.log(`| ${b.weapon} | ${b.pose} | ${b.type} | ${b.gap} | ${b.deg} | ${f(b.any)} | ${f(b.frac)} | ${z(b)} | ${f(a.any)} | ${f(a.frac)} | ${z(a)} |`);
