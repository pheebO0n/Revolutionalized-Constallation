// Stage 3: initial partition via Louvain on the kNN graph.
const Graph = require('graphology');
const louvain = require('graphology-communities-louvain');

function louvainPartition(stars, graph, seed) {
 const g = new Graph({ type: 'undirected' });
 stars.forEach((_, i) => g.addNode(String(i)));
 for (const e of graph.edges) {
 g.mergeEdge(String(e.a), String(e.b), { weight: e.w, type: 'undirected' });
 }
 const res = louvain.detailed(g, { resolution: 1.0, randomWalk: false });
 const map = new Map();
 const labels = new Array(stars.length);
 for (let i = 0; i < stars.length; i++) {
 const c = res.communities[String(i)];
 if (!map.has(c)) map.set(c, map.size);
 labels[i] = map.get(c);
 }
 return labels;
}

module.exports = { louvainPartition };
