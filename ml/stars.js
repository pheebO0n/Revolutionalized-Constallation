// Stage 1: load HYG, filter mag <= 3.0, compute Galactic coords, dedupe.
const fs = require('fs');
const S = require('./spherical.js');

const MAG_LIMIT = 3.0;
const EOL = /[\r\n]+/;

function loadStars(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(EOL);
  const header = lines[0].split(',');
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));

  const stars = [];
  const seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const f = line.split(',');
    if (f.length < 17) continue;
    const mag = parseFloat(f[idx.mag]);
    if (!isFinite(mag) || mag > MAG_LIMIT) continue;
    const proper = (f[idx.proper] || '').trim();
    const bayer = (f[idx.bayer] || '').trim();
    const con = (f[idx.con] || '').trim();
    const comp = (f[idx.comp] || '').trim();
    const hip = (f[idx.hip] || '').trim();
    const hd = (f[idx.hd] || '').trim();
    if (comp && comp !== '1' && comp !== 'A') continue;
    if (proper === 'Sol') continue;
    let name = proper;
    if (!name) name = (bayer && con) ? bayer + ' ' + con : 'HD' + hd;
    if (!name) name = 'HIP' + hip;
    if (seen.has(name)) continue;
    seen.add(name);
    const ra = parseFloat(f[idx.ra]);
    const dec = parseFloat(f[idx.dec]);
    if (!isFinite(ra) || !isFinite(dec)) continue;
    let ci = parseFloat(f[idx.ci]);
    if (!isFinite(ci)) ci = 0.6;
    stars.push({ name, ra, dec, mag, ci });
  }
  return stars;
}

function buildCatalog(stars) {
  return stars.map((s, i) => {
    const [l, b] = S.radec2Gal(s.ra * 15, s.dec);
    const v = S.vec(s.ra, s.dec);
 return { id: i, name: s.name, ra: s.ra, dec: s.dec, l: Number(l.toFixed(4)), b: Number(b.toFixed(4)), mag: s.mag, ci: s.ci, v };
 });
}

module.exports = { loadStars, buildCatalog, MAG_LIMIT };