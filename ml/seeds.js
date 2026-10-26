// Build + verify several seeds to prove reproducibility and stability.
const { execFileSync } = require('child_process');
const fs = require('fs');
const { NL } = require('./nl.js');
const Q = String.fromCharCode(39);

const seeds = [1, 3, 7, 42, 99, 2024];
for (const s of seeds) {
 execFileSync('node', ['ml/build.js', '--seed', String(s)]);
 execFileSync('node', ['ml/verify.js']);
 const z = JSON.parse(fs.readFileSync('public/zames.json', 'utf8'));
 const sizes = z.constellations.map(c => c.edges.length);
 const line = [
 'seed ' + String(z.seed).padEnd(5),
 'clusters ' + z.constellations.length,
 'rivers ' + z.constellations.filter(c => c.style === 'river').length,
 'isles ' + z.constellations.filter(c => c.style === 'isle').length,
 'edges ' + sizes.reduce((a, b) => a + b, 0),
 'lines/cluster ' + Math.min(...sizes) + '-' + Math.max(...sizes),
 'bytes ' + fs.statSync('public/zames.json').size,
 ].join(' ');
 console.log(line);
}
// leave the repo on the canonical seed
execFileSync('node', ['ml/build.js', '--seed', '1']);
execFileSync('node', ['ml/verify.js']);
