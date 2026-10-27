// Skriver cutscene-replikkene som JSON (kilde: src/story/cutscenes.js). Brukes av gen.py.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const src = fileURLToPath(new URL('../../../story/cutscenes.js', import.meta.url));
const tmp = '/tmp/breach-cutscenes-export.mjs';
writeFileSync(tmp, readFileSync(src, 'utf8'));
const { CUTSCENES } = await import(tmp);
const out = [];
for (const [id, cs] of Object.entries(CUTSCENES)) cs.panels.forEach((p, pi) => p.lines.forEach((l, li) => out.push({ scene: id, panel: pi, line: li, speaker: l.speaker, delay: li === 0 ? (p.textDelay || 0) : 0, who: l.who || null, text: l.text })));
process.stdout.write(JSON.stringify(out, null, 1));
