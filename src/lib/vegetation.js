/** Vegetación y rocas: hierba al viento, flores, árboles, rocas, setas. */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { edgeR } from './island.js';
import { clamp01, fbm, mulberry, vnoise } from './math.js';
import { blobShadow, leafTex, rockTex } from './textures.js';
import { shade, uTime } from './three-utils.js';

export function makeGrass(count, avoid, o = {}) {
  const H = o.H, pathD = o.pathD, skip = o.skip || (() => false);
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.035, 0, 0, 0.035, 0, 0, -0.025, 0.5, 0, 0.025, 0.5, 0, 0, 1, 0]), 3));
  bg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 1.15, 1.15, 1.15]), 3));
  bg.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <project_vertex>', `
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
      float bend = position.y * position.y;
      vec3 wp = instanceMatrix[3].xyz;
      float w = sin(uTime * 1.7 + wp.x * 0.9 + wp.z * 0.6) * 0.6 + sin(uTime * 2.9 + wp.z * 1.7 + wp.x * 0.4) * 0.3;
      mvPosition.x += w * 0.16 * bend; mvPosition.z += w * 0.09 * bend;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  const mesh = new THREE.InstancedMesh(bg, m, count);
  const rnd = mulberry(11), d = new THREE.Object3D(), cols = (o.cols || [0x4f9a35, 0x69b43f, 0x86c94f, 0x3f8a30, 0x9ad25a]).map(h => new THREE.Color(h));
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 4.65, x = Math.cos(a) * r, z = Math.sin(a) * r, h = H(x, z);
    if (h < -0.09 || r > edgeR(a) - 0.25 || pathD(x, z) < 0.22 || skip(x, z) || avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    d.position.set(x, h - 0.02, z); d.rotation.set(0, rnd() * 6.283, (rnd() - 0.5) * 0.25);
    d.scale.set(0.8 + rnd() * 0.7, 0.13 + rnd() * 0.17 + fbm(x * 0.8, z * 0.8) * 0.12, 1); d.updateMatrix();
    mesh.setMatrixAt(n, d.matrix); mesh.setColorAt(n, cols[Math.floor(rnd() * cols.length)]); n++;
  }
  mesh.count = n; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return mesh;
}

export function makeFlowers(count, avoid, o = {}) {
  const H = o.H, pathD = o.pathD, skip = o.skip || (() => false);
  const rnd = mulberry(23), d = new THREE.Object3D();
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.01, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x4f9a35 }), count);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
  const pal = (o.pal || [0xffffff, 0xffe066, 0xff8fb1, 0xb69cff, 0xff7a59]).map(h => new THREE.Color(h));
  let n = 0;
  for (let tries = 0; n < count && tries < count * 6; tries++) {
    const cl = Math.floor(rnd() * 7), ca = cl * 0.9 + 0.5, cr = 1 + (cl % 4) * 0.9, cx = Math.cos(ca) * cr + (rnd() - 0.5) * 1.4, cz = Math.sin(ca) * cr + (rnd() - 0.5) * 1.4;
    const h = H(cx, cz);
    if (h < -0.08 || Math.hypot(cx, cz) > 4.4 || pathD(cx, cz) < 0.3 || skip(cx, cz) || avoid.some(([ax, az, ar]) => Math.hypot(cx - ax, cz - az) < ar)) continue;
    const sh = 0.16 + rnd() * 0.16;
    d.position.set(cx, h - 0.01, cz); d.rotation.set(0, 0, 0); d.scale.set(1, sh, 1); d.updateMatrix(); stems.setMatrixAt(n, d.matrix);
    d.position.set(cx, h + sh, cz); d.scale.setScalar(0.7 + rnd() * 0.6); d.updateMatrix(); heads.setMatrixAt(n, d.matrix);
    heads.setColorAt(n, pal[cl % pal.length]); n++;
  }
  stems.count = heads.count = n; heads.castShadow = false;
  const g = new THREE.Group(); g.add(stems, heads); return g;
}

const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, bumpMap: leafTex, bumpScale: 1.2, roughness: 0.82 });

const trunkMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: rockTex, bumpMap: rockTex, bumpScale: 2, roughness: 1 });

const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: rockTex, bumpMap: rockTex, bumpScale: 3, roughness: 0.92 });

export function makeBlob(radius, cDark, cLight, seed, lump = 0.18, squash = 1) {
  let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2), v = new THREE.Vector3(), c = new THREE.Color();
  const d1 = new THREE.Color(cDark), d2 = new THREE.Color(cLight);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 2 + v.z * 1.3 + seed, v.y * 2.4 + v.z * 0.7 - seed), s = 1 + lump * (n - 0.5) * 2;
    p.setXYZ(i, v.x * radius * s, v.y * radius * s * squash, v.z * radius * s);
    const t = clamp01(v.y * 0.5 + 0.5), j = 0.78 + 0.45 * vnoise(v.x * 6 + seed, v.y * 6 + v.z * 5);
    c.copy(d1).lerp(d2, Math.pow(t, 1.25)).multiplyScalar(j * 1.1); col.set([c.r, c.g, c.b], i * 3);
    uv.set([Math.atan2(v.z, v.x) / 6.283 * 3, v.y * 1.5], i * 2);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals();
  return shade(new THREE.Mesh(g, foliageMat));
}

function makeTrunk(h, rb, rt, seed, bend) {
  const g = new THREE.CylinderGeometry(rt, rb, h, 14, 12, true); g.translate(0, h / 2, 0);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i); const y = p.getY(i); let z = p.getZ(i); const a = Math.atan2(z, x), y01 = y / h;
    const k = (1 + 1.1 * Math.exp(-y * 6)) * (1 + 0.1 * (vnoise(a * 4 + seed, y * 5) - 0.5) * 2);
    x = x * k + bend * Math.sin(y01 * 2.6 + seed) * y01; z = z * k + bend * 0.6 * Math.cos(y01 * 2.1 + seed) * y01;
    p.setXYZ(i, x, y, z);
    c.setHex(0x7a5636).multiplyScalar(0.7 + 0.5 * vnoise(a * 5 + seed, y * 1.4)); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return shade(new THREE.Mesh(g, trunkMat));
}

function makeBranch(len, r, rz, ry, y) {
  const g = new THREE.CylinderGeometry(r * 0.5, r, len, 7); g.translate(0, len / 2, 0);
  const col = new Float32Array(g.attributes.position.count * 3).fill(0.5); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = shade(new THREE.Mesh(g, trunkMat)); m.position.y = y; m.rotation.set(0, ry, rz, 'YZX'); return m;
}

function makePineTier(r, h, y, seed, i) {
  const g = new THREE.ConeGeometry(r, h, 28, 5); const p = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const dk = new THREE.Color(0x1d5f36), lt = new THREE.Color(0x58ad62);
  for (let k = 0; k < p.count; k++) {
    let x = p.getX(k), yy = p.getY(k), z = p.getZ(k); const rad = Math.hypot(x, z), frac = rad / r, a = Math.atan2(z, x);
    if (frac > 0.01) { const s = 1 + (0.11 * Math.sin(a * 7 + i * 2.1 + seed) + 0.07 * (vnoise(a * 3 + seed, i) - 0.5)) * frac; x *= s; z *= s; yy -= 0.14 * frac * frac; }
    p.setXYZ(k, x, yy, z);
    c.copy(dk).lerp(lt, clamp01((yy + h / 2) / h) ** 0.8).multiplyScalar(0.85 + 0.4 * vnoise(a * 4 + seed, yy * 5)); col.set([c.r, c.g, c.b], k * 3);
    uv.setXY(k, uv.getX(k) * 4, uv.getY(k) * 2);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = shade(new THREE.Mesh(g, foliageMat)); m.position.y = y; m.rotation.y = i * 0.9 + seed; return m;
}

export function makeTreeHD(type, seed = 1) {
  const g = new THREE.Group(), rnd = mulberry(seed * 977 + type), s = seed * 3.1;
  if (type === 0) {                       // pino
    g.add(makeTrunk(1.3, 0.14, 0.07, s, 0.04));
    for (let i = 0; i < 5; i++) g.add(makePineTier(1.05 - i * 0.17, 1.0 - i * 0.06, 0.75 + i * 0.5, s, i));
  } else if (type === 1) {                // roble
    g.add(makeTrunk(1.25, 0.17, 0.09, s, 0.12));
    g.add(makeBranch(0.7, 0.07, 0.7, 0.4, 0.95), makeBranch(0.6, 0.06, -0.8, 2.6, 1.05), makeBranch(0.55, 0.05, 0.6, 4.4, 0.85));
    [[0, 1.95, 0, 0.82], [0.55, 1.65, 0.2, 0.55], [-0.5, 1.7, -0.2, 0.55], [0, 2.45, 0.05, 0.5], [0.2, 1.6, -0.55, 0.5], [-0.25, 1.55, 0.5, 0.5], [0.4, 2.2, -0.3, 0.4]].forEach(([x, y, z, r], k) => {
      const b = makeBlob(r, 0x2b6e30, 0x9bd053, s + k, 0.2, 0.9); b.position.set(x + (rnd() - 0.5) * 0.1, y, z + (rnd() - 0.5) * 0.1); g.add(b);
    });
  } else {                                // cerezo
    g.add(makeTrunk(1.2, 0.15, 0.07, s, 0.3));
    g.add(makeBranch(0.8, 0.06, 0.9, 1.0, 0.85), makeBranch(0.7, 0.05, -0.9, 3.7, 0.95));
    [[0, 1.9, 0, 0.75], [0.6, 1.7, 0.15, 0.5], [-0.55, 1.75, -0.1, 0.5], [0.1, 2.3, 0.1, 0.45], [0.3, 1.55, -0.5, 0.42], [-0.3, 1.5, 0.45, 0.42]].forEach(([x, y, z, r], k) => {
      const b = makeBlob(r, 0xf08fb4, 0xffe9f1, s + k, 0.22, 0.88); b.position.set(x, y, z); g.add(b);
    });
  }
  g.add(blobShadow(type === 0 ? 1.1 : 1.0, 0.45));
  return g;
}

export function makeRock(r, seed, moss = true) {
  let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2), v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.2 - seed), s = 0.75 + 0.5 * n;
    p.setXYZ(i, v.x * r * s * 1.15, Math.max(v.y, -0.25) * r * s * 0.78, v.z * r * s);
    c.setHex(0x8e939c).multiplyScalar(0.75 + 0.5 * vnoise(v.x * 5 + seed, v.y * 5));
    if (moss) c.lerp(new THREE.Color(0x5f9a3c), clamp01((v.y - 0.25) * 1.6) * 0.8 * fbm(v.x * 3 + seed, v.z * 3));
    col.set([c.r, c.g, c.b], i * 3); uv.set([v.x * 1.5 + 0.5, v.z * 1.5 + 0.5], i * 2);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals();
  return shade(new THREE.Mesh(g, rockMat));
}

export function makeMushroom(s, hue = 0xd6403a) {
  const g = new THREE.Group();
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.14 * s, 8).translate(0, 0.07 * s, 0), new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.8 }))));
  const cap = shade(new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 14, 8, 0, 6.283, 0, 1.5), new THREE.MeshStandardMaterial({ color: hue, roughness: 0.55 }))); cap.position.y = 0.13 * s; cap.scale.y = 0.75; g.add(cap);
  for (let i = 0; i < 5; i++) { const a = i * 1.26, d = new THREE.Mesh(new THREE.SphereGeometry(0.014 * s, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff })); d.position.set(Math.cos(a) * 0.055 * s, 0.17 * s + (i % 2) * 0.012 * s, Math.sin(a) * 0.055 * s); g.add(d); }
  return g;
}
