// Sanity checks against the MVP success criteria.
const fs = require('fs');
const S = require('./spherical.js');

const z = JSON.parse(fs.readFileSync('public/zames.json', 'utf8'));
const byId = new Map(z.stars.map(s => [s.id, s]));
const vec = (s) => S.vec(s.ra, s.dec);

let errors = 0;
const err = (m) => { console.log('FAIL', m); errors++; };

// 1. all stars used
the_used: {
 const used = new Set();
 for (const c of z.constellations) for (const id of c.starIds) used.add(id);
 if (used.size !== z.stars.length) err('coverage ' + used.size + '/' + z.stars.length);
 else console.log('OK coverage ' + used.size + '/' + z.stars.length);
}

// 2. cluster count and no singletons
{
 const n = z.constellations.length;
 const sing = z.constellations.filter(c => c.starIds.length < 3).length;
 console.log('OK clusters ' + n + ' singletons ' + sing);
 if (n < 20 || n > 40) err('cluster count ' + n);
 if (sing) err('singletons ' + sing);
}

// 3. no edges cross (tangent plane check) + edges stay inside cluster
{
 let cross = 0, bad = 0;
 for (const c of z.constellations) {
 const set = new Set(c.starIds);
 for (let i = 0; i < c.edges.length; i++) {
 const e = c.edges[i];
 if (!set.has(e[0]) || !set.has(e[1])) bad++;
 }
 for (let i = 0; i < c.edges.length; i++) {
 for (let j = i + 1; j < c.edges.length; j++) {
 const a = vec(byId.get(c.edges[i][0])), b = vec(byId.get(c.edges[i][1]));
 const p = vec(byId.get(c.edges[j][0])), q = vec(byId.get(c.edges[j][1]));
 if (S.arcsCrossExcludeShared(a, b, p, q)) cross++;
 }
 }
 }
 console.log('OK crossings ' + cross + ' outside-cluster edges ' + bad);
 if (cross) err('crossings');
 if (bad) err('outside-cluster edges');
}

// 4. river/isle split sanity
{
 const rivers = z.constellations.filter(c => c.style === 'river');
 const badRiver = rivers.filter(c => Math.abs(c.centroid.b) >= 20).length;
 console.log('OK rivers ' + rivers.length + ' off-band ' + badRiver);
 if (badRiver) err('river outside MW band');
}

console.log('size ' + fs.statSync('public/zames.json').size + ' bytes');
process.exit(errors ? 1 : 0);
