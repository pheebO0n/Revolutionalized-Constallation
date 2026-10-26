// Produce an equirectangular Galactic Milky Way texture + a small density map.
// Source: ESO 0932a (Serge Brunier panorama), 6000x3000, galactic equator horizontally centered.
const sharp = require('sharp');
const fs = require('fs');

const W = 2048;
const H = 1024;

(async () => {
// Rotate: ESO image has galactic center at the center; we want l=0 in the middle too.
const base = sharp('data/mw.jpg').resize(W, H, { fit: 'fill' });

// Mild contrast/brightness so stars read against it.
const tex = await base
.modulate({ brightness: 0.85 })
.linear(1.15, -12)
.jpeg({ quality: 78 })
.toBuffer();
fs.writeFileSync('public/milkyway.jpg', tex);
console.log('texture bytes', tex.length);

// Density map for the clustering prior: 72 x 36 bins (5deg each)
const DW = 72;
const DH = 36;
const { data } = await sharp('data/mw.jpg')
.resize(DW, DH, { fit: 'fill' })
.greyscale()
.raw()
.toBuffer({ resolveWithObject: true });

const dens = [];
for (let y = 0; y < DH; y++) {
for (let x = 0; x < DW; x++) {
const idx = y * DW + x;
// accumulate luminance as density proxy (3 channels stripped by greyscale)
dens.push(data[idx]);
}
}
// normalize 0..1 using 99th percentile
const sorted = [...dens].sort((a, b) => a - b);
const p99 = sorted[Math.floor(sorted.length * 0.99)] || 255;
const norm = dens.map((v) => Math.min(1, v / p99));
fs.writeFileSync('data/mw-density.json', JSON.stringify({ w: DW, h: DH, data: norm.map((v) => Math.round(v * 100) / 100) }));
console.log('density bins', DW * DH);
})();
