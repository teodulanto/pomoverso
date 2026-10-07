/** Isla flotante de terreno (malla polar con relieve y colores por vértice). */
import * as THREE from 'three';
import { fbm, sstep } from './math.js';
import { groundTex } from './textures.js';

const F_R = 5;

export const edgeR = th => F_R * (1 + 0.05 * (fbm(Math.cos(th) * 1.6 + 4, Math.sin(th) * 1.6 + 9) - 0.5) * 2);

export function buildIsland(H, colorTop, cl = {}) {
  const SEG = 160, RT = 48, RC = 22, rings = RT + 1 + RC + 1, V = SEG + 1;
  const pos = new Float32Array(rings * V * 3), col = new Float32Array(rings * V * 3), uv = new Float32Array(rings * V * 2);
  const c = new THREE.Color(), c2 = new THREE.Color();
  let ring = 0;
  const put = (j, x, y, z, color, u, v) => { const k = ring * V + j; pos.set([x, y, z], k * 3); col.set([color.r, color.g, color.b], k * 3); uv.set([u, v], k * 2); };
  for (let i = 0; i <= RT; i++, ring++) for (let j = 0; j <= SEG; j++) {
    const th = (j % SEG) / SEG * Math.PI * 2, rad = edgeR(th) * i / RT, x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    const h = H(x, z), y = h - 0.2 * sstep(0.88, 1, i / RT);
    colorTop(x, z, h, rad, c, c2);
    c.lerp(c2.setHex(0x8b6a43), sstep(4.3, 4.95, rad));
    put(j, x, y, z, c, x * 0.35, z * 0.35);
  }
  const topEdge = ring - 1;
  for (let k = 1; k <= RC + 1; k++, ring++) for (let j = 0; j <= SEG; j++) {
    const th = (j % SEG) / SEG * Math.PI * 2, t = k / (RC + 1), ei = (topEdge * V + j) * 3;
    const er = edgeR(th), rr = Math.pow(1 - t, 0.72) * (1 + 0.3 * (fbm(Math.cos(th) * 2.2 + t * 3, Math.sin(th) * 2.2 + 13) - 0.5) * 2 * Math.min(1, t * 3));
    const rad = er * rr * (1 + 0.05 * Math.sin(Math.PI * t));
    const y = pos[ei + 1] - 4.6 * Math.pow(t, 0.85) + 0.6 * (fbm(Math.cos(th) * 3 + 2, Math.sin(th) * 3 + t * 2) - 0.5) * Math.sin(Math.PI * t);
    const strata = 0.82 + 0.28 * Math.sin(y * 7 + fbm(Math.cos(th) * 2, Math.sin(th) * 2) * 4);
    c.setHex(cl.a ?? 0x8b6a43).lerp(c2.setHex(cl.b ?? 0x66626b), sstep(0.1, 0.4, t)).multiplyScalar(strata);
    c.lerp(c2.setHex(cl.top ?? 0x4c8a35), (1 - sstep(0, 0.06, t)) * 0.7);
    put(j, Math.cos(th) * rad, y, Math.sin(th) * rad, c, j / SEG * 8, y * 0.35);
  }
  const idx = [];
  for (let r = 0; r < rings - 1; r++) for (let j = 0; j < SEG; j++) {
    const a = r * V + j, b = (r + 1) * V + j, cc = a + 1, d = b + 1;
    idx.push(a, cc, b, cc, d, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const nrm = geo.attributes.normal, v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  for (let r = 0; r < rings; r++) {
    v3.fromBufferAttribute(nrm, r * V); v4.fromBufferAttribute(nrm, r * V + SEG); v3.add(v4).normalize();
    nrm.setXYZ(r * V, v3.x, v3.y, v3.z); nrm.setXYZ(r * V + SEG, v3.x, v3.y, v3.z);
  }
  for (let j = 0; j < V; j++) { nrm.setXYZ(j, 0, 1, 0); nrm.setXYZ((rings - 1) * V + j, 0, -1, 0); }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, bumpMap: groundTex, bumpScale: 2.2, roughness: 0.96 }));
  m.receiveShadow = m.castShadow = true;
  return m;
}
