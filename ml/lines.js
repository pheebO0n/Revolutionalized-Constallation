// Stage 5: line generation for one constellation.
// 1. kNN-biased Prim tree over the cluster
// 2. greedy de-crossing: drop the shorter edge of each crossing pair,
//    never orphaning a star
// 3. repair: attach orphans to their shortest free neighbour, then re
//    de-cross the result
// 4. connect any remaining components with the shortest non-crossing edge
const S = require('./spherical.js');

const len = (e, v) => S.angle(v[e[0]], v[e[1]]);
const cross = (v, e, f) => S.arcsCrossExcludeShared(v[e[0]], v[e[1]], v[f[0]], v[f[1]]);

function buildLines(members, stars, adj) {
  const v = stars.map(s => s.v);
  const n = members.length;
  if (n < 2) return [];

  const deg = new Map();
  for (const m of members) deg.set(m, 0);

  // all candidate edges, shortest first
  const cand = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = members[i], b = members[j];
      cand.push({ e: [a, b], l: len([a, b], v) });
    }
  }
  cand.sort((p, q) => p.l - q.l);

  const out = [];
  const add = (e) => {
    for (const f of out) if (cross(v, e, f)) return false;
    out.push(e);
    deg.set(e[0], deg.get(e[0]) + 1);
    deg.set(e[1], deg.get(e[1]) + 1);
    return true;
  };

  // 1. Prim tree, kNN-biased
  {
    const inT = new Map();
    for (const m of members) inT.set(m, false);
    const best = new Map();
    for (const m of members) best.set(m, { l: Infinity, from: -1 });
    best.set(members[0], { l: 0, from: -1 });
    for (let it = 0; it < n; it++) {
      let u = -1, bu = Infinity;
      for (const m of members) if (!inT.get(m) && best.get(m).l < bu) { bu = best.get(m).l; u = m; }
      if (u < 0) break;
      inT.set(u, true);
      const b = best.get(u);
      if (b.from >= 0) add([b.from, u]);
      const knnSet = new Set(adj[u] || []);
      for (const w of members) {
        if (inT.get(w)) continue;
        const l = len([u, w], v) * (knnSet.has(w) ? 0.9 : 1.0);
        if (l < best.get(w).l) best.set(w, { l, from: u });
      }
    }
  }

  // 2. de-cross
  decross(out, deg, v, cand);

  // 3. repair - attach orphans then re-de-cross
  for (const m of members) {
    if (deg.get(m) > 0) continue;
    for (const c of cand) {
      if (c.e[0] !== m && c.e[1] !== m) continue;
      if (add(c.e)) break;
    }
  }
  decross(out, deg, v, cand);

  // 4. connect remaining components
  const parent = new Map();
  for (const m of members) parent.set(m, m);
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const e of out) parent.set(find(e[0]), find(e[1]));
  for (const c of cand) {
    const ra = find(c.e[0]), rb = find(c.e[1]);
    if (ra === rb) continue;
    if (add(c.e)) parent.set(ra, rb);
  }

  return out;
}

// In-place greedy de-crossing. Never deletes an edge that would
// orphan a star (degree < 2 on either end).
function decross(out, deg, v, cand) {
  for (let guard = 0; guard < 500; guard++) {
    let victim = -1, bestL = Infinity;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (!cross(v, out[i], out[j])) continue;
        const li = len(out[i], v), lj = len(out[j], v);
        const chosen = li <= lj ? i : j;
        const l = Math.min(li, lj);
        if (l < bestL) {
          const e = out[chosen];
          if (deg.get(e[0]) < 2 || deg.get(e[1]) < 2) continue;
          bestL = l; victim = chosen;
        }
      }
    }
    if (victim < 0) break;
    const e = out.splice(victim, 1)[0];
    deg.set(e[0], deg.get(e[0]) - 1);
    deg.set(e[1], deg.get(e[1]) - 1);
  }
  return out;
}

module.exports = { buildLines, decross };
