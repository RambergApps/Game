// Enkel grid-A* (32 px ruter) rundt cover. Bygges på nytt automatisk når cover endres.
import { TILE, segmentClear, pointInRect } from './geom.js';
import { walk } from './walk.js';

const AGENT_R = 16; // 26.10: Husk r 18 (var 14)
const SQ2 = Math.SQRT2;

export class NavGrid {
  constructor(world) {
    this.world = world;
    this.sig = '';
    this.ensure();
  }

  signature() {
    const w = this.world;
    const b = w.bounds;
    let s = `${b.x},${b.y},${b.w}x${b.h}`;
    for (const c of w.cover) s += `|${c.x},${c.y},${c.w},${c.h}`;
    return s;
  }

  ensure() {
    const s = this.signature();
    if (s !== this.sig) { this.sig = s; this.build(); }
  }

  build() {
    const B = this.world.bounds;
    this.ox = B.x; this.oy = B.y;
    this.cols = Math.ceil(B.w / TILE);
    this.rows = Math.ceil(B.h / TILE);
    this.blocked = new Uint8Array(this.cols * this.rows);
    const sb = walk(this.world).southBlocker(this.world);   // A1: Arenas usynlige sørsperre
    const solids = sb ? [...this.world.cover, sb] : this.world.cover;
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const x = this.ox + cx * TILE + TILE / 2, y = this.oy + cy * TILE + TILE / 2;
        for (const c of solids) {
          if (pointInRect(x, y, c, AGENT_R + 1)) { this.blocked[cy * this.cols + cx] = 1; break; }
        }
      }
    }
  }

  cellOf(x, y) {
    return [Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.ox) / TILE))), Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.oy) / TILE)))];
  }
  center(cx, cy) { return { x: this.ox + cx * TILE + TILE / 2, y: this.oy + cy * TILE + TILE / 2 }; }
  free(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows && !this.blocked[cy * this.cols + cx]; }

  nearestFree(cx, cy) {
    if (this.free(cx, cy)) return [cx, cy];
    for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.free(cx + dx, cy + dy)) return [cx + dx, cy + dy];
      }
    }
    return null;
  }

  /**
   * Finn sti fra (sx,sy) til (tx,ty). opts.cost(cx,cy) → ekstra kostnad per rute (f.eks. farlig sone).
   * opts.smooth: 'full' (standard) | 'light' (beholder omveier, brukes ved flanking).
   * Returnerer [{x,y}, ...] (uten startpunkt) eller null.
   */
  findPath(sx, sy, tx, ty, opts = {}) {
    this.ensure();
    const s = this.nearestFree(...this.cellOf(sx, sy));
    const g = this.nearestFree(...this.cellOf(tx, ty));
    if (!s || !g) return null;
    const cols = this.cols, N = cols * this.rows;
    const start = s[1] * cols + s[0], goal = g[1] * cols + g[0];
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const h = (i) => {
      const dx = Math.abs((i % cols) - g[0]), dy = Math.abs(((i / cols) | 0) - g[1]);
      return (dx + dy) + (SQ2 - 2) * Math.min(dx, dy);
    };
    gScore[start] = 0;
    heap.push(start, h(start));
    let found = start === goal, expanded = 0;
    const maxNodes = opts.maxNodes || 5000;
    while (!found && heap.size) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) { found = true; break; }
      if (++expanded > maxNodes) break;
      const cx = cur % cols, cy = (cur / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.free(nx, ny)) continue;
        if (dx && dy && (!this.free(cx + dx, cy) || !this.free(cx, cy + dy))) continue;
        const ni = ny * cols + nx;
        if (closed[ni]) continue;
        let step = dx && dy ? SQ2 : 1;
        if (opts.cost) step += opts.cost(nx, ny);
        const ng = gScore[cur] + step;
        if (ng < gScore[ni]) {
          gScore[ni] = ng; came[ni] = cur;
          heap.push(ni, ng + h(ni));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1 && i !== start; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => this.center(i % cols, (i / cols) | 0));
    // Eksakt mål til slutt hvis det er fri bane
    const last = pts.length ? pts[pts.length - 1] : { x: sx, y: sy };
    if (segmentClear(this.world, last.x, last.y, tx, ty, AGENT_R - 3)) pts.push({ x: tx, y: ty });
    return this.smooth(sx, sy, pts, opts.smooth || 'full');
  }

  smooth(sx, sy, pts, mode) {
    if (pts.length < 3) return pts;
    const out = [];
    let ax = sx, ay = sy, i = 0;
    const maxSkip = mode === 'light' ? 3 : 1e9;
    while (i < pts.length) {
      let j = i;
      while (j + 1 < pts.length && j + 1 - i <= maxSkip && segmentClear(this.world, ax, ay, pts[j + 1].x, pts[j + 1].y, AGENT_R)) j++;
      out.push(pts[j]);
      ax = pts[j].x; ay = pts[j].y;
      i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p);
    while (i > 0) { const pa = (i - 1) >> 1; if (P[pa] <= p) break; K[i] = K[pa]; P[i] = P[pa]; i = pa; }
    K[i] = k; P[i] = p;
  }
  pop() {
    const K = this.k, P = this.p; const top = K[0];
    const lk = K.pop(), lp = P.pop();
    if (K.length) {
      let i = 0; const n = K.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= lp) break;
        K[i] = K[c]; P[i] = P[c]; i = c;
      }
      K[i] = lk; P[i] = lp;
    }
    return top;
  }
}
