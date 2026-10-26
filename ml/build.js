#!/usr/bin/env node
// Zames build pipeline: CSV -> zames.json. One command, deterministic per seed.
const fs = require('fs');
const path = require('path');
const st = require('./stars.js');
const g = require('./graph.js');
const lv = require('./louvain.js');
const an = require('./anneal.js');
const ln = require('./lines.js');
const S = require('./spherical.js');
const G = require('./geom.js');

function args() {
 const a = { seed: 1, out: 'public/zames.json', stars: 'data/stars.json', csv: 'data/hyg.csv', iters: 60000 };
 const argv = process.argv.slice(2);
 for (let i = 0; i < argv.length; i++) {
 const k = argv[i];
 if (k === '--seed') a.seed = parseInt(argv[++i], 10);
 else if (k === '--out') a.out = argv[++i];
 else if (k === '--iters') a.iters = parseInt(argv[++i], 10);
 }
 return a;
}

function starsOut(catalog) {
 return catalog.map(s => ({ id: s.id, name: s.name, ra: +s.ra.toFixed(6), dec: +s.dec.toFixed(6), l: +s.l.toFixed(3), b: +s.b.toFixed(3), mag: +s.mag.toFixed(2), ci: +s.ci.toFixed(3) }));
}

function main() {
 const opt = args();
 const t0 = Date.now();
 const raw = st.loadStars(opt.csv);
 const cat = st.buildCatalog(raw);
 const GR = g.buildKnn(cat, 6, 2 * Math.PI / 180);
 const init = lv.louvainPartition(cat, GR, opt.seed);
 const res = an.runAnneal(cat, GR, init, opt.seed, { iters: opt.iters, T0: 1.0, pNew: 0.12, maxSize: 9, maxC: 90 });

 const byCluster = new Map();
 for (let i = 0; i < res.assign.length; i++) {
 const c = res.assign[i];
 if (!byCluster.has(c)) byCluster.set(c, []);
 byCluster.get(c).push(i);
 }
 const clusters = [];
 for (const [c, mem] of byCluster) {
 const vecs = cat.map(s => s.v);
 const cen = G.centroid(mem, vecs);
 const [l, b] = S.vec2lb(cen);
 const inMW = Math.abs(b) < an.MW_B;
 const edges = ln.buildLines(mem, cat, GR.adj);
 clusters.push({ l, b, inMW, mem, edges });
 }
 // sort: rivers first by l, then isles by l
 clusters.sort((p, q) => (p.inMW === q.inMW ? p.l - q.l : (p.inMW ? -1 : 1)));
 const constellations = [];
 let ri = 0, ii = 0;
 for (const c of clusters) {
 const style = c.inMW ? 'river' : 'isle';
 const id = c.inMW ? 'river-' + String(++ri).padStart(2, '0') : 'isle-' + String(++ii).padStart(2, '0');
 constellations.push({
 id, style,
 centroid: { l: +c.l.toFixed(3), b: +c.b.toFixed(3) },
 starIds: c.mem.slice().sort((a, b) => a - b),
 edges: c.edges.map(e => [Math.min(e[0], e[1]), Math.max(e[0], e[1])]),
 });
 }
 const out = {
 generatedAt: new Date().toISOString(),
 system: 'zames-v1.0',
 seed: opt.seed,
 stars: starsOut(cat),
 constellations,
 };
 fs.mkdirSync(path.dirname(opt.out), { recursive: true });
 fs.writeFileSync(opt.out, JSON.stringify(out));
 fs.mkdirSync(path.dirname(opt.stars), { recursive: true });
 fs.writeFileSync(opt.stars, JSON.stringify({ stars: starsOut(cat) }));
 const rivers = constellations.filter(c => c.style === 'river').length;
 const isles = constellations.filter(c => c.style === 'isle').length;
 console.log('Zames built in ' + (Date.now() - t0) + 'ms');
 console.log(' stars ' + cat.length);
 console.log(' clusters ' + constellations.length + ' (rivers ' + rivers + ', isles ' + isles + ')');
 console.log(' edges ' + constellations.reduce((a, c) => a + c.edges.length, 0));
 console.log(' output ' + opt.out + ' (' + fs.statSync(opt.out).size + ' bytes)');
}

main();
