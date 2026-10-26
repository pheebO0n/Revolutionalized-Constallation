// Pure geometry helpers kept isolated so no accidental mangling of arithmetic.
const S = require('./spherical.js');

function pairCompact(members, dist) {
 const m = members.length;
 if (m < 2) return 0;
 let sum = 0;
 for (let a = 0; a < m; a++) {
 for (let b = a + 1; b < m; b++) sum += dist[members[a]][members[b]];
 }
 return sum / (m * (m - 1) / 2);
}

function centroid(members, vecs) {
 let x = 0, y = 0, z = 0;
 for (const i of members) { x += vecs[i][0]; y += vecs[i][1]; z += vecs[i][2]; }
 return S.norm([x, y, z]);
}

function pcaRatio(members, vecs) {
 const m = members.length;
 if (m < 2) return 1;
 const cen = centroid(members, vecs);
 const [ex, ey] = S.tangentBasis(cen);
 const pts = members.map(i => S.tangentProj(vecs[i], cen, ex, ey));
 let mx = 0, my = 0;
 for (const p of pts) { mx += p[0]; my += p[1]; }
 mx /= m; my /= m;
 let cxx = 0, cxy = 0, cyy = 0;
 for (const p of pts) {
 const dx = p[0] - mx;
 const dy = p[1] - my;
 cxx += dx * dx;
 cxy += dx * dy;
 cyy += dy * dy;
 }
 const tr = cxx + cyy;
 const det = cxx * cyy - cxy * cxy;
 const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
 const l1 = tr / 2 + disc;
 const l2 = tr / 2 - disc;
 const s = l1 + l2;
 if (s <= 1e-9) return 1;
 return l1 / s;
}

module.exports = { pairCompact, centroid, pcaRatio };
