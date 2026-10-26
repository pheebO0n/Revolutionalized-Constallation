// Stage 4 (v3): SA with hard size cap, kNN-neighbour moves and a new-cluster move.
const S = require('./spherical.js');
const G = require('./geom.js');
const { makeRng } = require('./rng.js');

const MW_B = 20;
const MAXC = 90;
const W = { c: 2.0, l: 1.2, s: 6.0, m: 0.6 };

function precompute(stars) {
 const n = stars.length;
 const dist = Array.from({ length: n }, () => new Float32Array(n));
 const vecs = stars.map(s => s.v);
 for (let i = 0; i < n; i++) {
 for (let j = i + 1; j < n; j++) {
 const d = S.angle(vecs[i], vecs[j]);
 dist[i][j] = d; dist[j][i] = d;
 }
 }
 return { n, dist, vecs };
}

function stat(members, pc, maxSize) {
 const n = members.length;
 if (n === 0) return { n: 0, score: 0 };
 const cen = G.centroid(members, pc.vecs);
 const lb = S.vec2lb(cen);
 const mw = Math.abs(lb[1]) < MW_B;
 const ratio = G.pcaRatio(members, pc.vecs);
 const compact = G.pairCompact(members, pc.dist);
 const targetSize = mw ? 7 : 5;
 const targetRatio = mw ? 0.82 : 0.58;
 const sizePen = Math.abs(n - targetSize);
 const spread = mw ? (1 - ratio) : 0;
 let sc = -W.c * compact - W.l * Math.abs(ratio - targetRatio) - W.s * sizePen + W.m * spread;
 if (n < 2) sc -= 12.0;
 if (n > maxSize) sc -= 8.0 * (n - maxSize);
 return { n, score: sc };
}

function runAnneal(stars, graph, initAssign, seed, opts) {
 opts = opts || {};
 const rng = makeRng(seed);
 const T0 = opts.T0 != null ? opts.T0 : 0.8;
 const T1 = opts.T1 != null ? opts.T1 : 0.001;
 const iters = opts.iters != null ? opts.iters : 60000;
 const pNew = opts.pNew != null ? opts.pNew : 0.12;
 const maxSize = opts.maxSize != null ? opts.maxSize : 9;
 const n = stars.length;
 const pc = precompute(stars);
 const assign = initAssign.slice();
 const nC0 = Math.max.apply(null, assign) + 1;
 const members = Array.from({ length: MAXC }, () => []);
 for (let i = 0; i < n; i++) members[assign[i]].push(i);
 const stats = members.map(m => stat(m, pc, maxSize));
 let total = stats.reduce((a, s) => a + s.score, 0);
 let bestAssign = assign.slice();
 let bestScore = total;
 let nextFree = nC0;
 const alpha = Math.pow(T1 / T0, 1 / iters);
 let T = T0;
 const adj = graph.adj;
 for (let it = 0; it < iters; it++) {
 T *= alpha;
 const i = rng.int(n);
 const from = assign[i];
 let to;
 if (rng() < pNew && nextFree < MAXC) {
 to = nextFree;
 } else {
 const nb = adj[i];
 if (!nb.length) continue;
 to = assign[nb[rng.int(nb.length)]];
 }
 if (to === from) continue;
 if (members[to].length >= maxSize) continue;
 const idx = members[from].indexOf(i);
 members[from].splice(idx, 1);
 members[to].push(i);
 const nf = stat(members[from], pc, maxSize);
 const nt = stat(members[to], pc, maxSize);
 const ds = (nf.score + nt.score) - (stats[from].score + stats[to].score);
 if (ds >= 0 || rng() < Math.exp(ds / T)) {
 assign[i] = to;
 stats[from] = nf;
 stats[to] = nt;
 total += ds;
 if (to >= nextFree) nextFree = to + 1;
 if (total > bestScore) { bestScore = total; bestAssign = assign.slice(); }
 } else {
 members[to].pop();
 members[from].splice(idx, 0, i);
 }
 }
 return { assign: bestAssign, score: bestScore };
}

module.exports = { runAnneal, W, MW_B, precompute };
