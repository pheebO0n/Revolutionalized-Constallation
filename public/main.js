import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const RGB = (hex) => new THREE.Color(hex);
const COL_RIVER = RGB('#5ec8f2');
const COL_ISLE = RGB('#f2b45e');
const DEG = Math.PI / 180;
const IAU = await fetch('./iau88.json').then(r => r.json());

// Galactic (l,b) deg -> unit vector. Galactic frame: x -> l=0, z -> NGP.
function lb2vec(l, b, r = 1) {
 const a = l * DEG, d = b * DEG;
 return new THREE.Vector3(
 Math.cos(d) * Math.cos(a) * r,
 Math.cos(d) * Math.sin(a) * r,
 Math.sin(d) * r
 );
}

// IAU 88 boundary-free stick figures, in RA/Dec degrees.
// Minimal set (subset of the classic figures) for benchmarking only.
function radec2vec(raDeg, decDeg, r = 1) {
 const a = raDeg * DEG, d = decDeg * DEG;
 return new THREE.Vector3(
 Math.cos(d) * Math.cos(a) * r,
 Math.cos(d) * Math.sin(a) * r,
 Math.sin(d) * r
 );
}

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 0.9, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 1.2;
controls.maxDistance = 6;
controls.enablePan = false;

// Rotate the whole celestial group so the galactic plane lies flat.
const celestial = new THREE.Group();
scene.add(celestial);

// --- Milky Way shell ---
const loader = new THREE.TextureLoader();
const shellMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, opacity: 0.85 });
const shell = new THREE.Mesh(new THREE.SphereGeometry(0.995, 96, 64), shellMat);
loader.load('./milkyway.jpg', (tex) => {
 tex.colorSpace = THREE.SRGBColorSpace;
 tex.mapping = THREE.EquirectangularReflectionMapping;
 shellMat.map = tex;
 shellMat.needsUpdate = true;
});
celestial.add(shell);

// --- Stars ---
const zames = await fetch('./zames.json').then(r => r.json());

const starPos = new Float32Array(zames.stars.length * 3);
const starCol = new Float32Array(zames.stars.length * 3);
const starSize = new Float32Array(zames.stars.length);
const byId = new Map();

// black-body-ish colour from B-V
function bv2rgb(bv) {
 const t = Math.max(0, Math.min(1, (bv + 0.4) / 2.4));
 const c = new THREE.Color();
 c.setHSL(0.58 - 0.52 * t, 0.55 * (1 - t) + 0.15, 0.62 + 0.18 * t);
 return c;
}

zames.stars.forEach((s, i) => {
 const v = lb2vec(s.l, s.b);
 byId.set(s.id, v);
 starPos[i * 3] = v.x; starPos[i * 3 + 1] = v.y; starPos[i * 3 + 2] = v.z;
 const c = bv2rgb(s.ci);
 starCol[i * 3] = c.r; starCol[i * 3 + 1] = c.g; starCol[i * 3 + 2] = c.b;
 starSize[i] = Math.max(2.6, 9.5 - s.mag * 2.35);
});

const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
starGeo.setAttribute('size', new THREE.BufferAttribute(starSize, 1));

const starMat = new THREE.ShaderMaterial({
 vertexShader: `
 attribute float size;
 attribute vec3 color;
 varying vec3 vColor;
 void main() {
 vColor = color;
 vec4 mv = modelViewMatrix * vec4(position, 1.0);
 gl_PointSize = size * (260.0 / -mv.z);
 gl_Position = projectionMatrix * mv;
 },`,
 fragmentShader: `
 varying vec3 vColor;
 void main() {
 vec2 d = gl_PointCoord - vec2(0.5);
 float r = length(d);
 if (r > 0.5) discard;
 float a = smoothstep(0.5, 0.08, r);
 gl_FragColor = vec4(vColor, a);
 },`,
 transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const starPoints = new THREE.Points(starGeo, starMat);
celestial.add(starPoints);

// --- Constellation lines ---
function buildLineGroup(color) {
 const positions = [];
 for (const c of zames.constellations) {
 for (const [a, b] of c.edges) {
 const va = byId.get(a), vb = byId.get(b);
 if (!va || !vb) continue;
 // subdivide so lines hug the sphere
 const steps = 8;
 for (let s = 0; s < steps; s++) {
 const t0 = s / steps, t1 = (s + 1) / steps;
 const p0 = va.clone().lerp(vb, t0).normalize().multiplyScalar(0.998);
 const p1 = va.clone().lerp(vb, t1).normalize().multiplyScalar(0.998);
 positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
 }
 }
 }
 const g = new THREE.BufferGeometry();
 g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
 const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
 return new THREE.LineSegments(g, m);
}

const lineGroup = new THREE.Group();
lineGroup.add(buildLineGroup(COL_RIVER));
lineGroup.add(buildLineGroup(COL_ISLE));
celestial.add(lineGroup);

function fontSpec(px) {
 return '600 ' + px + 'px ui-sans-serif, system-ui, sans-serif';
}
// --- Labels ---
function makeLabel(text, color) {
 const pad = 18, fs = 44;
 const cv = document.createElement('canvas');
 const ctx = cv.getContext('2d');
 ctx.font = fontSpec(fs);
 const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
 cv.width = w; cv.height = fs + pad * 2;
 const c2 = cv.getContext('2d');
 c2.font = fontSpec(fs);
 c2.fillStyle = color;
 c2.textAlign = 'center'; c2.textBaseline = 'middle';
 c2.fillText(text, w / 2, cv.height / 2);
 const tex = new THREE.CanvasTexture(cv);
 tex.colorSpace = THREE.SRGBColorSpace;
 const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
 const sp = new THREE.Sprite(mat);
 const scale = 0.0016 * fs;
 sp.scale.set((w / cv.height) * scale * 1.4, scale * 1.4, 1);
 return sp;
}

const labelGroup = new THREE.Group();
for (const c of zames.constellations) {
 const v = lb2vec(c.centroid.l, c.centroid.b, 1.012);
 const col = c.style === 'river' ? '#5ec8f2' : '#f2b45e';
 const sp = makeLabel(c.id, col);
 sp.position.copy(v);
 labelGroup.add(sp);
}
celestial.add(labelGroup);

// --- Star Labels ---
const starLabelGroup = new THREE.Group();
for (const s of zames.stars) {
  if (!s.name) continue; // ข้ามดาวที่ไม่มีชื่อ
  
  const v = byId.get(s.id);
  if (!v) continue;
  
  // ดันตำแหน่งออกมานิดนึงไม่ให้ทับจุดดาว
  const pos = v.clone().multiplyScalar(1.012); 
  
  // ใช้ makeLabel เดิม แต่เปลี่ยนสีเป็นฟ้าอมขาว
  const sp = makeLabel(s.name, '#a0d8ef'); 
  
  // ย่อขนาดลงครึ่งนึง (เพราะชื่อดาวมี 170 ดวง ถ้าเต็มจะรกมาก)
  sp.scale.multiplyScalar(0.55);
  
  sp.position.copy(pos);
  starLabelGroup.add(sp);
}
celestial.add(starLabelGroup);

// --- IAU 88 reference (minimal stick figures, benchmarking only) ---
const iauGroup = new THREE.Group();
iauGroup.visible = false;
{
 const pos = [];
 for (const f of IAU.figures) for (const [a, b] of f.edges) {
 const va = byId.get(a), vb = byId.get(b);
 if (!va || !vb) continue;
 for (let s = 0; s < 8; s++) {
 const t0 = s / 8, t1 = (s + 1) / 8;
 const p0 = va.clone().lerp(vb, t0).normalize().multiplyScalar(0.994);
 const p1 = va.clone().lerp(vb, t1).normalize().multiplyScalar(0.994);
 pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
 }
 }
 const gg = new THREE.BufferGeometry();
 gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
 const mm = new THREE.LineBasicMaterial({ color: 0x9fb6c9, transparent: true, opacity: 0.55 });
 iauGroup.add(new THREE.LineSegments(gg, mm));
}
celestial.add(iauGroup);

// --- HUD ---
const rivers = zames.constellations.filter(c => c.style === 'river').length;
const isles = zames.constellations.filter(c => c.style === 'isle').length;
const hud = document.getElementById('hud');
hud.textContent = [
 zames.stars.length + ' stars',
 zames.constellations.length + ' constellations',
 rivers + ' rivers / ' + isles + ' isles',
 'seed ' + zames.seed + ' - ' + zames.system,
].join(' - ');

// --- Orientation: bring the galactic plane into the horizontal ---
celestial.rotation.x = -Math.PI / 2;

// --- Toggles ---
const state = { lines: true, sky: true, labels: true, iau: false };
function applyState() {
 lineGroup.visible = state.lines;
 shell.visible = state.sky;
 labelGroup.visible = state.labels;
 iauGroup.visible = state.iau;
 starLabelGroup.visible = state.starLabels;
}
addEventListener('keydown', (e) => {
 if (e.key === '1') state.lines = !state.lines;
 if (e.key === '2') state.sky = !state.sky;
 if (e.key === '3') state.labels = !state.labels;
 if (e.key === '4') state.iau = !state.iau;
 if (e.key === '5') state.starLabels = !state.starLabels;
 if (e.key === 'r' || e.key === 'R') { camera.position.set(0, 0.9, 2.6); controls.target.set(0, 0, 0); }
 applyState();
});

// --- Resize + loop ---
addEventListener('resize', () => {
 camera.aspect = innerWidth / innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth, innerHeight);
});

applyState();
const loading = document.getElementById('loading');
loading.style.opacity = '0';
setTimeout(() => loading.remove(), 700);

// --- Search System ---
// 1. เตรียม Datalist ให้มีชื่อดาวทั้งหมด
const datalist = document.getElementById('star-list');
const starLookup = new Map();
zames.stars.forEach(s => {
  if (s.name) {
    starLookup.set(s.name.toLowerCase(), s.id);
    const opt = document.createElement('option');
    opt.value = s.name;
    datalist.appendChild(opt);
  }
});

// 2. ตัวแปรสำหรับการบินของกล้อง (Camera Animation)
let camTargetPos = null;
let camTargetLookAt = null;
let isAnimating = false;

// 3. สร้างวงแหวนไฮไลต์ดาว
const highlightGeo = new THREE.RingGeometry(0.02, 0.03, 32);
const highlightMat = new THREE.MeshBasicMaterial({ 
  color: 0x5ec8f2, side: THREE.DoubleSide, transparent: true, opacity: 0 
});
const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
celestial.add(highlightMesh);

// 4. ฟังก์ชันค้นหา
document.getElementById('search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim().toLowerCase();
    const targetId = starLookup.get(query);
    
    if (targetId !== undefined) {
      // ดึงตำแหน่ง 3D ของดาวดวงนั้น
      const localPos = byId.get(targetId).clone(); 
      
      // แปลงพิกัดให้ตรงกับมุมกล้องโลก (เพราะ celestial ถูกหมุนอยู่)
      celestial.updateMatrixWorld(); 
      const worldPos = localPos.clone().applyMatrix4(celestial.matrixWorld);
      
      // กำหนดจุดหมาย: บินไปอยู่ห่างจากดาวดวงนั้นนิดหน่อย (2.5 เท่าของรัศมี)
      camTargetLookAt = worldPos.clone();
      camTargetPos = worldPos.clone().multiplyScalar(2.5);
      isAnimating = true;
      
      // โชว์วงแหวนไฮไลต์
      highlightMesh.position.copy(localPos);
      highlightMesh.material.opacity = 1.0;
      
      // ล้างช่องค้นหา
      e.target.value = '';
      e.target.blur();
    } else {
      // ถ้าหาไม่เจอ ให้กะพริบสีแดง
      e.target.style.borderColor = '#ff4d4d';
      setTimeout(() => e.target.style.borderColor = '#5ec8f2', 500);
    }
  }
});

renderer.setAnimationLoop(() => {
  // จัดการการบินของกล้อง
  if (isAnimating && camTargetPos && camTargetLookAt) {
    // ค่อยๆ ขยับตำแหน่งกล้อง (Lerp)
    camera.position.lerp(camTargetPos, 0.05);
    controls.target.lerp(camTargetLookAt, 0.05);
    
    // เช็กว่าถึงจุดหมายหรือยัง
    if (camera.position.distanceTo(camTargetPos) < 0.05) {
      isAnimating = false;
    }
  }

  // ค่อยๆ ทำให้วงแหวนจางลง
  if (highlightMesh.material.opacity > 0) {
    highlightMesh.material.opacity -= 0.005;
  }

  controls.update();
  renderer.render(scene, camera);
});