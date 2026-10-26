// Spherical math helpers for Zames. All vectors are unit length on S2.

const DEG2 = Math.PI/180;
const RAD2 = 180/Math.PI;

function vec(raHours, decDeg) {
  const ra = raHours * 15; // hours -> degrees
  const a = ra * DEG2;
  const d = decDeg * DEG2;
  return [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)];
}

// Equatorial J�000 -> Galactic (degrees, l 0..360, b -90..90)
// Rotation matrix derived from NGP: ra=192.85916, dec=27.12825, and GC: ra=266.40500, dec=-28.93617
function radec2Gal(raDeg, decDeg) {
  const a = raDeg * DEG2;
  const d = decDeg * DEG2;
  // Cartesian equatorial
  const x = Math.cos(d)*Math.cos(a);
  const y = Math.cos(d)*Math.sin(a);
  const z = Math.sin(d);
  // Galactic basis (rows are the galactic axes in equatorial coords)
  // GC axis
  const ga = 266.40500 * DEG2, gd = -28.93617 * DEG2;
  const gx = Math.cos(gd)*Math.cos(ga), gy = Math.cos(gd)*Math.sin(ga), gz = Math.sin(gd);
  // NGP axis
  const na = 192.85916 * DEG2, nd = 27.12825 * DEG2;
  const nx = Math.cos(nd)*Math.cos(na), ny = Math.cos(nd)*Math.sin(na), nz = Math.sin(nd);
  // y axis = NGP x GC
  const yx = ny*gz - nz*gy, yy = nz*gx - nx*gz, yz = nx*gy - ny*gx;
  // Galactic vector
  const Xa = gx*x + gy*y + gz*z; // cos(b) cos(l)
  const Ya = yx*x + yy*y + yz*z; // cos(b) sin(l)
  const Za = nx*x + ny*y + nz*z; // sin(b)
  let l = Math.atan2(Ya, Xa) * RAD2;
  if (l < 0) l += 360;
  const b = Math.asin(Math.max(-1, Math.min(1, Za))) * RAD2;
  return [l, b];
}

// l + b -> unit vector (Galactic cartesian)
function lb2vec(l, b) {
  const a = l * DEG2, d = b * DEG2;
  return [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)];
}

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function norm(a) { const n = Math.sqrt(dot(a,a)) || 1; return scale(a, 1/n); }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function angle(a, b) { // radians
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
}

// Tangent plane basis at centroid c
function tangentBasis(c) {
  const ref = Math.abs(c[2]) < 0.9 ? [0,0,1] : [1,0,0];
  const ex = norm(cross(ref, c));
  const ey = norm(cross(c, ex));
  return [ex, ey];
}

// Project a spherical point unto 2d tangent plane (stereographic-like, scaled)
function tangentProj(u, c, ex, ey) {
  const den = dot(u, c);
  if (den <= 0.01) return [0, 0]; // far side - clamp
  const tx = dot(u, ex) / den;
  const ty = dot(u, ey) / den;
  return [tx, ty];
}

// Great-circle arc intersection test (true spheric check, avoids tangent-plane distortions).
// Returns true if arcs a -> b and c -> d cross on the sphere.
// Implemented by converting to a shorter arc test via the cross products and dot products.
function arcsCross(a, b, c, d) {
  // Normals of the two great circles
  const n1 = norm(cross(a, b));
  const n2 = norm(cross(c, d));
  // Parallel great circles never cross
  const cx = norm(cross(n1, n2));
  if (!cx[0] && !cx[1] && !cx[2]) return false;
  // Two intersection points: $x, -x
  const p1 = cx, p2 = scale(cx, -1);
  // Check if p1 or p2 lies inside both arcs (shorter arc)
  const inSeg = (p, s, e) => {
    // shortest arc test: p is within 90 deg of both endpoints
    return dot(p, s) > 0 && dot(p, e) > 0;
  };
  return (inSeg(p1, a, b) && inSeg(p1, c, d)) || (inSeg(p2, a, b) && inSeg(p2, c, d));
}

// Minor arc intersection test (check if two arcs share an endpoint)
function arcsCrossExcludeShared(a, b, c, d) {
  // exclude cases where they share a star
  const eq = (u, v) => Math.abs(u[0]-v[0]) < 1e-6 && Math.abs(u[1]-v[1]) < 1e-6 && Math.abs(u[2]-v[2]) < 1e-6;
  if (eq(a, c) || eq(a, d) || eq(b, c) || eq(b, d)) return false;
  return arcsCross(a, b, c, d);
}

// Galactic unit vector -> [l, b] in degrees
function vec2lb(v) {
 const l = Math.atan2(v[1], v[0]) * RAD2;
 const ll = l < 0 ? l + 360 : l;
 const b = Math.asin(Math.max(-1, Math.min(1, v[2]))) * RAD2;
 return [ll, b];
}

module.exports = {
 vec2lb,
  DEG2, RAD2,
  vec, radec2Gal, lb2vec,
  dot, sub, add, scale, norm, cross, angle,
  tangentBasis, tangentProj,
  arcsCross, arcsCrossExcludeShared,
};
