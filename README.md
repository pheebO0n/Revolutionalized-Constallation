# Zames

A machine-devised constellation system on the celestial sphere.
The pipeline never touches the IAU 88, the zodiac, or the ecliptic: its only
frame of reference is Galactic (l, b), and its only structural prior is the
Milky Way itself.

> Metaphor: the Milky Way is a river; constellations are the river towns
> (chains along the band) or the isles (compact blobs away from it).

Name from Hebrew זָמַם (zamam) - "to plan, devise, plot".

---

## Quick start

bash
npm install
npm run build # -> public/zames.json + data/stars.json
npm run verify # checks every MVP success criterion
npm run serve # http://localhost:8080


Or a different seed:

bash
npm run build:seed -- 7


---

## Pipeline

| stage | file | what it does |
|---|---|---|
| 1. preprocessing | ml/stars.js | HYG v3 CSV -> mag <= 3.0, name dedupe, A component only, RA/Dec J2000 -> Galactic (l,b) + unit vectors |
| 2. graph | ml/graph.js | spherical k-NN (k=6, sigma=2 deg), weight exp(-theta/sigma) |
| 3. initial partition | ml/louvain.js | Louvain on the weighted kNN graph - a seed, not the answer |
| 4. optimization | ml/anneal.js | simulated annealing on cluster assignment |
| 5. lines | ml/lines.js | kNN-biased Prim tree per cluster, greedy de-crossing (never orphaning a star), repair, re-check |
| 6. naming | ml/build.js | River-NN if |b_centroid| < 20, else Isle-NN; numbering by Galactic longitude |
| 7. export | ml/build.js | public/zames.json (~22 KB), data/stars.json |

Supporting modules: ml/spherical.js (great-circle math, arc intersection),
ml/geom.js (PCA ratio, centroid, pairwise compactness), ml/rng.js (seeded PRNG).

### Stage 4 objective


score = -w_c * compactness # mean pairwise angular distance
 - w_l * |linearity - target_ratio| # eigenvalue ratio in the tangent plane
 - w_s * |n - target_size| # 7 in the band, 5 outside
 + w_m * (1 - linearity) if |b| < 20 # reward chains along the Milky Way
 - 12 if n < 2 # no singletons


Moves: move a star into a neighbour cluster, or (with probability pNew) open a
fresh cluster. That second move is what keeps the annealer from being trapped
inside the ~8 giant Louvain communities.

---

## Design decisions (answers to the open questions)

Q1 - Leiden vs Louvain. Louvain only produces the seed. At 176 nodes the
runtime is ~2 ms and the annealer reshapes the partition anyway, so Leiden's
extra overhead buys nothing. ml/louvain.js is the single place to swap it out.

Q2 - GNN rescore. Dropped. 88 training figures is a guaranteed overfit, and
the spec already flags hand-crafted geometry as the better route. ml/lines.js
builds a kNN-biased Prim tree per cluster, then greedily de-crosses it without ever orphaning a star, repairs orphans, and re-checks crossings.

Q3 - Milky Way density prior. Option B: the density enters the objective,
not the graph. A cluster whose centroid sits in the band is pushed toward
linearity ~ 0.82 and receives an explicit spread reward. The edge weights
stay purely geometric, so the graph never bakes in a bias it cannot undo.

Q4 - Seeds. Yes, --seed is exposed and the whole run is deterministic for
a given seed (xorshift32, no Math.random). Verified across seeds 1, 3, 7, 42:
every one yields 28 clusters, 11-13 rivers / 15-17 isles, zero singletons, largest cluster <= 9.

Q5 - Benchmarking. ml/iau.js builds a 18-figure stick-model comparison
layer from the same mag <= 3 catalog (benchmark only - it never feeds back
into the pipeline). public/iau88.json is loaded by the viewer and toggled
with [4]. The honest metric here is structural (coverage, size distribution,
crossings, rivers-in-band), not silhouette - IAU was not optimized for any
clustering objective.

Q6 - Deployment. Static. build.js runs offline, public/ is the entire
site. No backend, no database.

---

## Viewer

public/index.html + public/main.js, Three.js r160 via import map from unpkg.

- BackSide unit sphere with an equirectangular Galactic Milky Way texture
 (ml/make-mw.js derives it from the ESO/S. Brunier panorama).
- Stars as a Points shader, size 9.5 - mag * 2.35, colour from B-V.
- Lines: cyan #5ec8f2 for rivers, amber #f2b45e for isles.
- Canvas-sprite labels at cluster centroids.
- Galactic plane laid flat via celestial.rotation.x = -PI/2.

Keys: [1] lines, [2] sky, [3] labels, [4] IAU 88 comparison, [R] reset view.

---

## Success criteria status

| criterion | result |
|---|---|
| build.js under 5 s | ~0.4-0.7 s |
| 20-40 constellations, no singletons | 28, sizes 5-9 |
| no crossing edges | 0 crossings (great-circle test) |
| every mag <= 3 star used | 176/176 |
| viewer under 2 s | single 22 KB JSON + 267 KB texture |
| real Milky Way texture | ESO panorama, Galactic equirectangular |
| river/isle split sane | 13 rivers, all with |b| < 20 |
| reproducible by seed | yes, xorshift32 |
| [4] IAU comparison | 18 figures, 83 edges |

---

## Data sources

- Stars: HYG Database v3 (astronexus/HYG-Database, hyg_v37.csv.gz).
- Milky Way: ESO 0932a panorama (Serge Brunier), reprojected by
 ml/make-mw.js. The source image stays in data/mw.jpg and is not shipped.

## Non-goals

Not a catalog, not a replacement for the IAU 88, not a scientific claim of
correctness. It is an alternative map, generated end to end without ever looking
at the old one.

##### ความเห็นเรา อัลกอรึธึ่มยังไม่ค่อยฉลาดในการวาดกลุ่มดาวเท่าไหร่?

มันวาดเป็นเส้นๆ เราต้องเข้าใจโค้ดทีหลัง
npm run serve


# architect 

[1] โหลด HYG → filter mag ≤ 3 → ~170 จุด (RA/Dec J2000)
        ↓
[2] แปลงเป็น Galactic (l, b) + เวกเตอร์ 3D บน unit sphere
        ↓
[3] สร้าง spherical k-NN graph (k = 6) น้ำหนัก = exp(-θ/σ)
        ↓
[4] Leiden community detection → partition เริ่มต้น (~25 กลุ่ม)
        ↓
[5] Simulated annealing ปรับ partition ด้วย objective:
       - compactness  (ผลรวมระยะเชิงมุมภายในกลุ่ม)
       - no crossing  (เส้นเชื่อมต้องไม่ตัดกันบนทรงกลม)
       - size balance (3–9 ดวงต่อกลุ่ม)
       - MW-aware    (ถ้าอยู่ใน |b|<15° → เน้น chain ไม่ใช่ blob)
        ↓
[6] สร้างเส้นเชื่อมต่อกลุ่ม: MST ภายใน cluster + prune ด้วยมุม
        ↓
[7] (optional) GNN rescore ขอบ → เก็บ/ทิ้ง
        ↓
[8] ส่งออกเป็น spherical polygons + edge list (JSON)
        ↓
[9] Three.js แสดง: เปลือก + MW texture + ดาว + เส้นใหม่

# วิธีรัน

เปิด CMD npm install, npm run build, npm run serve
