// Breach testrigg – språksjekk: flagger norsk tekst i spillet (regel fra Breach 2026-10-23: all spilltekst på engelsk).
// (a) scanStatic(root): strengliteraler i src/**/*.js og index.html (kommentarer, console.*, Error(...) og import-stier ignoreres)
// (b) RUNTIME_HOOK: addInitScript som samler tekst tegnet med fillText/strokeText og DOM-tekst.
import fs from 'node:fs';
import path from 'node:path';

// Entydig norske ord (ikke engelske ord). Små, vanlige ord krever at strengen har flere ord.
const STRONG = new Set(`og ikke klikk klikker starte startet bølge bølgen bølger fiende fienden fiender fiendene dekning dekningen liv livet
ammunisjon fortsett fortsette nivå nivået nivåer du jeg vi dere de deg meg oss er var blir ble har hadde skal skulle kan kunne vil ville må måtte
med til på av fra etter mot ved hos uten eller men som det den denne dette disse ett hvis når hvor hva hvem hvorfor
spill spillet spiller spilleren trykk trykker velg tilbake avslutt avslutte innstillinger lyd lyden musikk seier tap tapt døde død drept drepte
våpen granat granater lad lade ladet omlading helse poeng runde runden hopp hoppe rull rulling rulle sikt sikte skyt skyte skudd mål oppgradering oppgraderinger
kjør kjøre ferdig neste forrige nytt gammel klar venter laster hvile igjen alle ingen noen mange flere mer mest første siste andre tredje
gjennomført fullført beseiret overlev overlevd overlevde hold holdt rydd ryddet porten gården kolonnen gå løp ned opp inn ut her der nå aldri alltid
også bare enda allerede kanskje sammen inne ute foran bak venstre høyre midten slå trykk bruk bruke hent hente forsvar forsvare beskytt angrep angriper
kamp kampen sone sonen tid tiden sekunder minutter rustning skjold kuler kule effekter steg mus vanlig sjelden taktikk`.split(/\s+/).filter(Boolean));
// Ord som også er engelske (eller teknisk vanlige) – teller bare sammen med andre norske ord
const AMBIG = new Set('for to pause under over start hold i et en se sett land fast like rett bare stop ok du alle'.split(' '));
const WEAK_SINGLE = new Set('og er til på av du med de vi'.split(' ')); // for korte alene (id-er, forkortelser) – teller ikke alene

export function looksNorwegian(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim(); if (s.length < 2) return null;
  // ser ut som kode/id/sti/farge/CSS → ignorer
  if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|[\w.-]+\.(js|png|jpg|wav|mp3|ogg|json|html|css)$|\.?\.?\/)/i.test(s)) return null;
  if (/^[\w$-]+$/.test(s) && /[A-Z_$-]/.test(s.slice(1)) && !/[æøå]/i.test(s)) return null; // camelCase / SNAKE / kebab-id
  const words = s.toLowerCase().normalize('NFC').match(/[a-zæøåéü]+/g) || [];
  if (!words.length) return null;
  const reasons = [];
  if (/[æøåÆØÅ]/.test(s)) reasons.push('æøå');
  const strong = words.filter((w) => STRONG.has(w) && !AMBIG.has(w));
  const ambig = words.filter((w) => AMBIG.has(w));
  if (words.length === 1) {
    const w = words[0];
    if (STRONG.has(w) && !WEAK_SINGLE.has(w) && !AMBIG.has(w) && w.length >= 3) reasons.push(`ord: ${w}`);
  } else if (strong.length >= 2 || (strong.length >= 1 && (ambig.length >= 1 || words.length <= 3) && !WEAK_SINGLE.has(strong[0])) || (strong.length === 1 && !WEAK_SINGLE.has(strong[0]))) {
    reasons.push(`ord: ${[...new Set([...strong, ...(strong.length ? ambig : [])])].slice(0, 6).join(', ')}`);
  }
  // engelsk-tunge strenger med ett tilfeldig treff (f.eks. "Hold the yard") skal ikke flagges
  const EN = /\b(the|and|of|you|your|is|are|with|wave|enemy|enemies|cover|press|click|to start|clear|reload|grenade|level|board)\b/i;
  if (!reasons.includes('æøå') && reasons.length && EN.test(s) && strong.length < 2) return null;
  return reasons.length ? reasons.join(' + ') : null;
}

// --- enkel JS-tokenizer: finner strengliteraler utenfor kommentarer, med linjenummer ---
function jsStrings(src) {
  const out = []; let i = 0, line = 1; const n = src.length;
  let prevSig = ''; // forrige ikke-blanke tegn (for regex-deteksjon)
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$|return$/.test(prevSig)) { // regex-literal
      i++; let cls = false;
      while (i < n && src[i] !== '\n') { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
      i++; prevSig = 'x'; continue;
    }
    if (c === '"' || c === "'") {
      const start = i, l0 = line; i++; let v = '';
      while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { v += src[i + 1]; i += 2; continue; } v += src[i++]; }
      i++; out.push({ value: v, line: l0, start }); prevSig = 'x'; continue;
    }
    if (c === '`') {
      const start = i, l0 = line; i++; let v = ''; let depth = 0;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { v += src[i + 1]; i += 2; continue; }
        if (ch === '\n') line++;
        if (depth === 0 && ch === '`') break;
        if (ch === '$' && src[i + 1] === '{') { depth++; v += ' {} '; i += 2; continue; }
        if (depth > 0) { if (ch === '{') depth++; else if (ch === '}') depth--; i++; continue; }
        v += ch; i++;
      }
      i++; out.push({ value: v, line: l0, start }); prevSig = 'x'; continue;
    }
    if (!/\s/.test(c)) {
      if (/[A-Za-z0-9_$]/.test(c)) { let w = ''; while (i < n && /[A-Za-z0-9_$]/.test(src[i])) w += src[i++]; prevSig = w === 'return' || w === 'typeof' ? 'return' : 'x'; continue; }
      prevSig = c;
    }
    i++;
  }
  return out;
}

function lineAt(src, pos) { const a = src.lastIndexOf('\n', pos - 1) + 1; return src.slice(a, pos); }

function isToolFile(rel) { return /(^|\/)(tools?|_tools|_stubs)\//.test(rel) || /(^|\/)test\.js$/.test(rel) || /\.(cjs|mjs)$/.test(rel); }

export function scanStatic(root) {
  const findings = [], files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (/\.(js|mjs|cjs)$/.test(e.name)) files.push(p); } };
  if (fs.existsSync(path.join(root, 'src'))) walk(path.join(root, 'src'));
  for (const f of files) {
    const rel = path.relative(root, f); const src = fs.readFileSync(f, 'utf8');
    for (const s of jsStrings(src)) {
      const before = lineAt(src, s.start);
      // interne id-er/nøkler: role: 'forsvar', x === 'angrep', trigger: '…' (dokumentasjonsfelt)
      if (/["']?\b(id|role|rarity|type|kind|key|state|trigger|cat|category|name_no|doc|note|notes|comment|_comment|desc|description|about)["']?\s*:\s*$/.test(before) || /[!=]==?\s*$/.test(before) || /\bcase\s*$/.test(before)) continue;
      if (/\b(errs|errors|warnings|problems)\.push\s*\([^)]*$/.test(before)) continue;
      if (/console\.\w+\s*\([^)]*$/.test(before) || /new\s+\w*Error\s*\([^)]*$/.test(before) || /\b(import|from|require)\s*\(?\s*$/.test(before)) continue;
      const why = looksNorwegian(s.value); if (!why) continue;
      findings.push({ file: rel, line: s.line, text: s.value.length > 140 ? s.value.slice(0, 137) + '…' : s.value, why, devOnly: isToolFile(rel) });
    }
  }
  const idx = path.join(root, 'index.html');
  if (fs.existsSync(idx)) {
    const html = fs.readFileSync(idx, 'utf8');
    const lineOf = (pos) => html.slice(0, pos).split('\n').length;
    // tekstnoder og synlige attributter (utenfor <script>/<style>)
    const stripped = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, ' '));
    for (const m of stripped.matchAll(/>([^<>]+)</g)) { const why = looksNorwegian(m[1]); if (why) findings.push({ file: 'index.html', line: lineOf(m.index), text: m[1].trim(), why, devOnly: false }); }
    for (const m of stripped.matchAll(/\b(title|alt|placeholder|aria-label|lang)="([^"]*)"/g)) {
      if (m[1] === 'lang') { if (/^(nb|nn|no)\b/i.test(m[2])) findings.push({ file: 'index.html', line: lineOf(m.index), text: `lang="${m[2]}"`, why: 'html lang er norsk', devOnly: false }); continue; }
      const why = looksNorwegian(m[2]); if (why) findings.push({ file: 'index.html', line: lineOf(m.index), text: m[2], why, devOnly: false });
    }
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      const off = m.index + m[0].indexOf(m[1]);
      for (const s of jsStrings(m[1])) { const why = looksNorwegian(s.value); if (why) findings.push({ file: 'index.html', line: lineOf(off) + s.line - 1, text: s.value, why, devOnly: false }); }
    }
  }
  return { filesScanned: files.length + (fs.existsSync(idx) ? 1 : 0), findings };
}

// Kjøres i siden før alt annet: samler tekst fra canvas og DOM.
export const RUNTIME_HOOK = () => {
  const seen = new Map(); window.__breachText = seen;
  const add = (src, t) => { if (typeof t !== 'string' && typeof t !== 'number') return; t = String(t).trim(); if (!t || t.length > 300) return; const k = src + '\u0001' + t; seen.set(k, (seen.get(k) || 0) + 1); if (seen.size > 5000) seen.delete(seen.keys().next().value); };
  for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
    if (!C) continue;
    for (const fn of ['fillText', 'strokeText']) {
      const orig = C.prototype[fn]; if (!orig) continue;
      C.prototype[fn] = function (text, ...rest) { try { add('canvas', text); } catch {} return orig.call(this, text, ...rest); };
    }
  }
  const grabDom = () => { try { const b = document.body; if (!b) return; const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const p = n.parentElement; if (p && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue; add('dom', n.nodeValue); } for (const el of b.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) for (const a of ['title', 'placeholder', 'aria-label', 'alt']) if (el.getAttribute(a)) add('dom', el.getAttribute(a)); } catch {} };
  window.__breachGrabDom = grabDom;
  const start = () => { grabDom(); new MutationObserver(() => grabDom()).observe(document.documentElement, { subtree: true, childList: true, characterData: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  setInterval(grabDom, 500);
};

// Analyse av innsamlet runtime-tekst: fjern prefikser (tekst som skrives tegn for tegn) og flagg norsk.
export function analyzeRuntime(entries) {
  const texts = entries.map(([k, count]) => { const [src, text] = k.split('\u0001'); return { src, text, count }; });
  // Slå sammen dynamisk tekst (tall endres hver ramme, f.eks. «steg 2101», «steg 2102») til ett mønster
  const groups = new Map();
  for (const t of texts) {
    const pattern = t.text.replace(/[-+]?\d+([.,:]\d+)*/g, '#');
    const k = t.src + '\u0001' + pattern; const g = groups.get(k);
    if (g) { g.count += t.count; g.variants++; } else groups.set(k, { src: t.src, text: t.text, pattern, count: t.count, variants: 1 });
  }
  const flagged = [];
  for (const t of groups.values()) { const why = looksNorwegian(t.text); if (why) flagged.push({ ...t, why }); }
  const full = flagged.filter((a) => !flagged.some((b) => b !== a && b.src === a.src && b.text.length > a.text.length && b.text.startsWith(a.text)));
  return { uniqueTexts: groups.size, flagged: full.sort((a, b) => b.count - a.count).slice(0, 200) };
}
