// TESTVARIANT av Kessa Yard (?yard=lavt). Bare lav dekning i spillområdet; høy dekning kun langs ytterveggen
// (B1–B5, vestbygning og container 19,27.5 – alle overlapper muren). Midtobjektene har samme fotavtrykk som i
// yard.js (så ruter, flanker, spawnpassasjer og ammokasser er uendret), men er omgjort til lave typer.
// Spawnpunkter, ammokasser, walkableSouth og bølgedata er identiske med yard.js.
import { YARD } from './yard.js';

const HIGH = new Set(['wall', 'building', 'container', 'stack', 'cratestack']);
const LOW_OF = { container: 'barrier', stack: 'crates', cratestack: 'crates' };
const T = 32, W = YARD.cols, H = YARD.rows;
// Høyt objekt "ved kanten": overlapper ytterveggen (rute 0/39 i x, 0/29 i y)
const atEdge = ([, x, y, w, h]) => x <= 1 || y <= 1 || x + w >= W - 1 || y + h >= H - 1;

export const YARD_LAVT = {
  ...YARD,
  variant: 'lavt',
  name: 'Kessa Yard (Low Cover Test)',
  objects: YARD.objects.map((o) => {
    if (!HIGH.has(o[0]) || atEdge(o)) return o;
    const opts = { ...(o[5] || {}) }; delete opts.color; delete opts.color2;
    return [LOW_OF[o[0]] || 'barrier', o[1], o[2], o[3], o[4], opts];
  }),
};
void T;
