// Stage 2: spherical k-NN graph.
const S = require('./spherical.js');

function buildKnn(stars, k = 6, sigma = 0.3) {
 const n = stars.length;
 const seen = new Set();
 const edges = [];
 const adj = Array.from({ length: n }, () => new Set());
 for (let i = 0; i < n; i++) {
 const ds = [];
 for (let j = 0; j < n; j++) {
 if (i === j) continue;
 ds.push([j, S.angle(stars[i].v, stars[j].v)]);
 }
 ds.sort((a, b) => a[1] - b[1]);
 for (let q = 0; q < Math.min(k, n - 1); q++) {
 const j = ds[q][0];
 const a = Math.min(i, j), b = Math.max(i, j);
 const key = a + ':' + b;
 if (seen.has(key)) continue;
 seen.add(key);
 const theta = ds[q][1];
 edges.push({ a, b, w: Math.exp(-theta / sigma), theta });
 adj[a].add(b); adj[b].add(a);
 }
 }
 return { n, edges, adj: adj.map(s => [...s]) };
}

module.exports = { buildKnn };
