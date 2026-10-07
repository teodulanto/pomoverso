/** Mundo 3 — Mar abierto: un velero zarpa de un puerto a otro. */
import * as THREE from 'three';
import { clamp01, fbm, lerp, mulberry, sstep, vnoise } from '../lib/math.js';
import { makePerson } from '../lib/people.js';
import { makeBarrel, makeCrate } from '../lib/props.js';
import { blobShadow, dotTex, plankTex, waterNormal } from '../lib/textures.js';
import { makeUnlocker, paint, pop, shade, uTime, vcMat } from '../lib/three-utils.js';
import { makeRock } from '../lib/vegetation.js';

/** Datos del mundo: nombre, costo en monedas, cielo, cámara y textos de cada etapa. */
export const meta = { id: 'sea', name: 'Mar abierto', emoji: '⛵', cost: 70, rewardLabel: 'Islas', doneMsg: '🏝️ ¡Nueva isla descubierta!',
    desc: 'Un velero navega de puerto en puerto. Cada travesía descubre una isla nueva en tu mapa.', milestones: ['Faro', 'Ballena'],
    sky: { dawn: 0xffb9a0, day: 0x7fd0ff, dusk: 0xf6a27a, night: 0x0a1230 }, clouds: true, cam: { R: 15, h: 8.2, look: -0.5 },
    focus: ['Zarpando del puerto ⚓', 'Viento a favor 🌬️', 'Mar abierto 🌊', 'Se divisa tierra 🏝️', '¡Llegando al destino! ⛵'],
    rest: ['Fondeando para pasar la noche 🌙', 'Luces en cubierta 🏮', 'Se oyen las olas…'] };

function makeMound(r, seed, hump, colorFn) {
  const SEG = 48, RN = 12, SK = 3, rings = RN + 1 + SK, V = SEG + 1;
  const pos = new Float32Array(rings * V * 3), col = new Float32Array(rings * V * 3), c = new THREE.Color();
  let ring = 0;
  const put = (j, x, y, z, d) => { colorFn(d, y, x, z, c); const k = (ring * V + j) * 3; pos.set([x, y, z], k); col.set([c.r, c.g, c.b], k); };
  const wob = th => 1 + 0.12 * (vnoise(Math.cos(th) * 1.3 + seed, Math.sin(th) * 1.3) - 0.5);
  for (let i = 0; i <= RN; i++, ring++) for (let j = 0; j <= SEG; j++) {
    const th = (j % SEG) / SEG * 6.283, d = i / RN, rad = r * d * wob(th), x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    put(j, x, hump * Math.pow(Math.max(0, 1 - d * d), 1.1) + 0.05 * (fbm(x * 3 + seed, z * 3) - 0.5) - 0.06, z, d);
  }
  for (let k = 1; k <= SK; k++, ring++) for (let j = 0; j <= SEG; j++) { const th = (j % SEG) / SEG * 6.283, rad = r * (1 + k * 0.09) * wob(th); put(j, Math.cos(th) * rad, -0.06 - k * 0.32, Math.sin(th) * rad, 1 + k * 0.1); }
  const idx = [];
  for (let rr = 0; rr < rings - 1; rr++) for (let j = 0; j < SEG; j++) { const a = rr * V + j, b = (rr + 1) * V + j, cc = a + 1, d = b + 1; idx.push(a, cc, b, cc, d, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return shade(new THREE.Mesh(geo, vcMat({ roughness: 0.95 })));
}

const sandColor = (d, y, x, z, c) => {
  c.setHex(0xe9d59b).multiplyScalar(0.92 + 0.12 * vnoise(x * 5, z * 5));
  c.lerp(new THREE.Color(0xb59a64), 1 - sstep(0.0, 0.1, y));
  c.lerp(new THREE.Color(0x6db24c), (1 - sstep(0.35, 0.62, d)) * 0.95 * (0.7 + 0.3 * vnoise(x * 3, z * 3)));
};

const palmLeafGeo = (() => {
  const SX = 3, SY = 10, pos = [], idx = [], col = [], c = new THREE.Color();
  for (let j = 0; j <= SY; j++) { const s = j / SY, half = (Math.sin(Math.min(1, s * 1.15) * Math.PI) * 0.13 + 0.015) * (1 - 0.25 * s);
    for (let i = 0; i <= SX; i++) { const w = (i / SX - 0.5) * 2 * half; pos.push(s * 1.0, -s * s * 0.5 + s * 0.12 - Math.abs(w) * 0.5, w); c.setHex(0x2f7d32).lerp(new THREE.Color(0x86c94f), s * 0.8 + 0.2 * (1 - Math.abs(i / SX - 0.5) * 2)); col.push(c.r, c.g, c.b); } }
  for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) { const a = j * (SX + 1) + i, b = a + 1, cc = a + SX + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
})();

const palmLeafMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });

function makePalmHD(h = 1.6, seed = 1) {
  const g = new THREE.Group(), bend = 0.35 * h;
  const tg = new THREE.CylinderGeometry(0.045, 0.085, h, 8, 12, true).translate(0, h / 2, 0), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), k = y / h, ridge = 1 + 0.1 * Math.sin(y * 38); tp.setX(i, tp.getX(i) * ridge + bend * k * k); tp.setZ(i, tp.getZ(i) * ridge); }
  paint(tg, (x, y, z, c) => c.setHex(0x8a6038).lerp(new THREE.Color(0xb0875a), y / h).multiplyScalar(0.8 + 0.4 * (0.5 + 0.5 * Math.sin(y * 38))));
  tg.computeVertexNormals(); g.add(shade(new THREE.Mesh(tg, vcMat({ roughness: 1 }))));
  const crown = new THREE.Group(); crown.position.set(bend, h, 0); g.add(crown);
  const rnd = mulberry(seed * 13 + 1);
  for (let i = 0; i < 9; i++) { const l = shade(new THREE.Mesh(palmLeafGeo, palmLeafMat)); l.rotation.set(0, i / 9 * 6.283 + rnd() * 0.3, 0.15 + rnd() * 0.45); l.scale.setScalar(0.85 + rnd() * 0.45); crown.add(l); }
  for (let i = 0; i < 3; i++) { const nut = shade(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.7 }))); nut.position.set(Math.cos(i * 2.1) * 0.08, -0.06, Math.sin(i * 2.1) * 0.08); crown.add(nut); }
  g.userData.crown = crown;
  return g;
}

function makeIslet(r, seed, palms = 1) {
  const g = new THREE.Group(); g.add(makeMound(r, seed, 0.34, sandColor));
  const rnd = mulberry(seed * 7 + 3), crowns = [];
  for (let i = 0; i < palms; i++) { const a = rnd() * 6.283, d = r * (0.1 + rnd() * 0.25); const p = makePalmHD(1.3 + rnd() * 0.5, seed + i); p.position.set(Math.cos(a) * d, 0.28, Math.sin(a) * d); p.rotation.y = rnd() * 6.283; g.add(p); crowns.push(p.userData.crown); }
  for (let i = 0; i < 4; i++) { const a = rnd() * 6.283, d = r * (0.55 + rnd() * 0.3), rk = makeRock(0.1 + rnd() * 0.08, seed + i * 5, true); rk.position.set(Math.cos(a) * d, 0.04, Math.sin(a) * d); g.add(rk); }
  g.add(blobShadow(r * 1.15, 0.3)); g.userData.crowns = crowns;
  return g;
}

function makePier(len = 1.5) {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ map: plankTex, color: 0xc9a074, roughness: 0.9 }), dk = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
  for (let i = 0; i < Math.round(len / 0.14); i++) { const b = shade(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.5), wood)); b.position.set(i * 0.14, 0.2, 0); g.add(b); }
  for (let i = 0; i <= 3; i++) [-0.23, 0.23].forEach(z => { const p = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 7), dk)); p.position.set(i * len / 3, 0.0, z); g.add(p); });
  return g;
}

function makeLighthouseHD(glow) {
  const g = new THREE.Group();
  const pts = [[0.5, 0], [0.5, 0.15], [0.4, 0.15], [0.36, 2.0], [0.3, 2.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const tg = new THREE.LatheGeometry(pts.slice(0, 4), 24); paint(tg, (x, y, z, c) => { c.setHex(Math.floor(y * 2.2) % 2 ? 0xd23b3b : 0xf4f1ea); if (y < 0.15) c.setHex(0x8a8f9a); });
  g.add(shade(new THREE.Mesh(tg, vcMat({ roughness: 0.7 }))));
  const metal = new THREE.MeshStandardMaterial({ color: 0x2e3a52, metalness: 0.5, roughness: 0.4 });
  const gal = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.08, 20), metal)); gal.position.y = 2.04; g.add(gal);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, p = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), metal)); p.position.set(Math.cos(a) * 0.48, 2.17, Math.sin(a) * 0.48); g.add(p); }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 16), glow); lamp.position.y = 2.28; g.add(lamp);
  const roof = shade(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.34, 16), new THREE.MeshStandardMaterial({ color: 0xc03a3a, roughness: 0.6 }))); roof.position.y = 2.62; g.add(roof);
  const door = shade(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }))); door.position.set(0, 0.32, 0.47); g.add(door);
  [0.9, 1.5].forEach((y, i) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.05), glow); w.position.set(0, y, 0.43 - i * 0.02); g.add(w); });
  const beam = new THREE.Group(); beam.position.y = 2.28;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 16, 1, true).rotateZ(Math.PI / 2).translate(2.5, 0, 0), beamMat); beam.add(cone); g.add(beam);
  const light = new THREE.PointLight(0xffe9a8, 0, 6); light.position.y = 2.3; g.add(light);
  return { group: g, beam, beamMat, light };
}

function makeShipHD(glowMats) {
  const g = new THREE.Group(), roll = new THREE.Group(); g.add(roll);
  const L = 0.95;
  const taper = (x, y, z) => { const k = x / L, bow = k > 0 ? 1 - 0.78 * k * k : 1 - 0.35 * k * k; return [x, y + 0.14 * k * k, z * bow]; };
  const hg = new THREE.SphereGeometry(1, 30, 14, 0, 6.283, Math.PI / 2, Math.PI / 2), hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const [x, y, z] = taper(hp.getX(i) * L, hp.getY(i) * 0.4, hp.getZ(i) * 0.36); hp.setXYZ(i, x, y, z); }
  paint(hg, (x, y, z, c) => { if (y > -0.05 + 0.14 * (x / L) ** 2) c.setHex(0xf2e8d0); else if (y < -0.2) c.setHex(0x7a2e2e); else c.setHex(0x7b4a2a); c.multiplyScalar(0.9 + 0.2 * vnoise(x * 12, y * 12)); });
  hg.computeVertexNormals(); roll.add(shade(new THREE.Mesh(hg, vcMat({ roughness: 0.75 }))));
  const dgeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), dp = dgeo.attributes.position;
  for (let i = 0; i < dp.count; i++) { const [x, y, z] = taper(dp.getX(i) * L * 0.97, 0.005, dp.getZ(i) * 0.36 * 0.96); dp.setXYZ(i, x, y, z); }
  dgeo.computeVertexNormals(); const dk = new THREE.Mesh(dgeo, new THREE.MeshStandardMaterial({ map: plankTex, color: 0xc9a074, roughness: 0.9 })); dk.receiveShadow = true; roll.add(dk);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 }), cream = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.8 });
  const part = (geo, m, x, y, z) => { const o = shade(new THREE.Mesh(geo, m)); o.position.set(x, y, z); roll.add(o); return o; };
  const cab = part(new THREE.BoxGeometry(0.42, 0.2, 0.32), cream, -0.55, 0.1, 0); part(new THREE.BoxGeometry(0.46, 0.04, 0.36), wood, -0.55, 0.22, 0);
  const win = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa84a, emissiveIntensity: 0.15 }); glowMats.push(win);
  [-0.8, -0.3].forEach(x => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.07), win); w.position.set(-0.55, 0.12, x === -0.8 ? 0.165 : -0.165); w.scale.set(8, 1, 1); roll.add(w); });
  const wheel = part(new THREE.TorusGeometry(0.07, 0.01, 5, 14).rotateY(Math.PI / 2), wood, -0.84, 0.1, 0);
  [-1, 1].forEach(s => { const rail = part(new THREE.BoxGeometry(1.6, 0.025, 0.02), wood, 0, 0.12, s * 0.325); rail.scale.x = 1; });
  part(new THREE.CylinderGeometry(0.03, 0.045, 1.9, 8), wood, 0.1, 1.0, 0);
  const boom = part(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6).rotateZ(Math.PI / 2), wood, -0.35, 0.38, 0);
  const nest = part(new THREE.CylinderGeometry(0.1, 0.08, 0.1, 10), wood, 0.1, 1.55, 0);
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5).rotateZ(1.2), wood, 1.0, 0.2, 0);   // bauprés
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf8f1e2, side: THREE.DoubleSide, roughness: 0.9 });
  const sailG = new THREE.PlaneGeometry(0.9, 1.15, 10, 10), sp = sailG.attributes.position;
  for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / 0.9 + 0.5, v = sp.getY(i) / 1.15 + 0.5; sp.setZ(i, Math.sin(u * Math.PI) * 0.14 * (1 - v * 0.4)); }
  sailG.computeVertexNormals(); part(sailG, cloth, -0.35, 0.98, 0);
  const jibS = new THREE.Shape(); jibS.moveTo(0, 0); jibS.lineTo(0.8, 0); jibS.lineTo(0, 1.3);
  part(new THREE.ShapeGeometry(jibS, 8), cloth, 0.2, 0.18, 0);
  const flagG = new THREE.PlaneGeometry(0.34, 0.16, 8, 1), flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ color: 0xd8372a, side: THREE.DoubleSide })); flag.position.set(0.28, 1.95, 0); roll.add(flag);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), win); lamp.position.set(0.86, 0.2, 0); roll.add(lamp);
  const lampLight = new THREE.PointLight(0xffc27a, 0, 7); lampLight.position.set(0, 0.8, 0); roll.add(lampLight);
  const wake = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); wake.scale.set(3.2, 1, 1.15); wake.position.y = -0.1; g.add(wake);
  return { group: g, roll, flag, flagG, lampLight, sailG, wake };
}

function makeGull() {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.8, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), white); body.scale.set(2.2, 0.8, 0.9); g.add(body);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 4).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf0b030 })); beak.position.x = 0.15; g.add(beak);
  const wing = (s) => { const w = new THREE.Group(); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.09).rotateX(-Math.PI / 2).translate(0, 0, s * 0.17).rotateY(0), white); m.geometry.translate(0, 0, 0); w.add(m); return w; };
  const wl = wing(1), wr = wing(-1); wl.children[0].geometry = new THREE.PlaneGeometry(0.09, 0.34).rotateX(-Math.PI / 2).translate(0, 0, 0.17); wr.children[0].geometry = new THREE.PlaneGeometry(0.09, 0.34).rotateX(-Math.PI / 2).translate(0, 0, -0.17);
  g.add(wl, wr); g.userData = { wl, wr }; return g;
}

function makeDolphin() {
  const g = new THREE.Group(), bg = new THREE.SphereGeometry(1, 16, 10); bg.scale(0.55, 0.15, 0.15);
  paint(bg, (x, y, z, c) => c.setHex(y < -0.02 ? 0xe8eef2 : 0x6d7f93));
  g.add(shade(new THREE.Mesh(bg, vcMat({ roughness: 0.4 }))));
  const m = new THREE.MeshStandardMaterial({ color: 0x6d7f93, roughness: 0.4 });
  const beak = shade(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8).rotateZ(-Math.PI / 2), m)); beak.position.x = 0.56; g.add(beak);
  const fin = shade(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), m)); fin.position.set(0.05, 0.16, 0); fin.rotation.z = 0.5; g.add(fin);
  [1, -1].forEach(s => { const f = shade(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.04, 4).rotateZ(Math.PI / 2), m)); f.scale.set(1, 0.2, 1); f.position.set(-0.52, 0, s * 0.07); g.add(f); const fl = shade(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), m)); fl.position.set(0.25, -0.1, s * 0.1); fl.rotation.x = s * 1.1; g.add(fl); });
  return g;
}

function makeWhaleHD() {
  const g = new THREE.Group(), bg = new THREE.SphereGeometry(1, 24, 14); bg.scale(1.9, 0.62, 0.7);
  paint(bg, (x, y, z, c) => c.setHex(y < -0.15 ? 0xdfe6ee : 0x4f6a86).multiplyScalar(0.9 + 0.2 * vnoise(x * 4, z * 4)));
  bg.computeVertexNormals(); g.add(shade(new THREE.Mesh(bg, vcMat({ roughness: 0.55 }))));
  const m = new THREE.MeshStandardMaterial({ color: 0x4b6480, roughness: 0.55 });
  const stem = shade(new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.2, 10).rotateZ(Math.PI / 2), m)); stem.position.x = -2.1; g.add(stem);
  const tail = new THREE.Group(); tail.position.x = -2.65; g.add(tail);
  [1, -1].forEach(s => { const f = shade(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.12, 4).rotateX(Math.PI / 2).rotateY(0), m)); f.scale.set(0.8, 1, 1); f.position.set(-0.05, 0.02, s * 0.35); f.rotation.y = s * 0.7; tail.add(f); });
  [1, -1].forEach(s => { const f = shade(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 6), m)); f.position.set(0.4, -0.35, s * 0.6); f.rotation.set(s * 1.1, 0, 0.4); g.add(f); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 })); eye.position.set(1.25, 0.1, s * 0.5); g.add(eye); });
  g.userData.tail = tail; return g;
}

const seaWave = (x, y, t) => Math.sin(x * 1.1 + t * 1.2) * 0.04 + Math.sin(y * 1.7 - t * 1.5 + x * 0.4) * 0.03 + Math.sin((x + y) * 2.6 + t * 2.1) * 0.014;   // igual que el shader del agua

export function buildSea() {
  const g = new THREE.Group(), rnd = mulberry(77);
  // agua ondulante + paredes de "vaso" + fondo
  const seaNormal = waterNormal.clone(); seaNormal.needsUpdate = true; seaNormal.repeat.set(7, 7);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a9ad0, roughness: 0.1, metalness: 0.05, normalMap: seaNormal, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.8 });
  waterMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uTime;
      float wave(vec2 p){ return sin(p.x*1.1+uTime*1.2)*0.04 + sin(p.y*1.7-uTime*1.5+p.x*0.4)*0.03 + sin((p.x+p.y)*2.6+uTime*2.1)*0.014; }`)
      .replace('#include <beginnormal_vertex>', `float e = 0.06; float h0 = wave(position.xy), hx = wave(position.xy + vec2(e, 0.0)), hy = wave(position.xy + vec2(0.0, e));
      vec3 objectNormal = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.0));`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.xy, position.z + wave(position.xy));');
  };
  const water = new THREE.Mesh(new THREE.RingGeometry(0.001, 9.8, 128, 44), waterMat); water.rotation.x = -Math.PI / 2; water.receiveShadow = true; g.add(water);
  const wallG = new THREE.CylinderGeometry(9.8, 9.8, 3.4, 72, 8, true).translate(0, -1.7, 0);
  paint(wallG, (x, y, z, c) => c.setHex(0x2a9ad0).lerp(new THREE.Color(0x0a3a6a), clamp01(-y / 3.2)));
  g.add(new THREE.Mesh(wallG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, transparent: true, opacity: 0.93 })));
  const deep = shade(new THREE.Mesh(new THREE.ConeGeometry(9.8, 3.6, 48), new THREE.MeshStandardMaterial({ color: 0x0c3560, roughness: 0.6 }))); deep.rotation.x = Math.PI; deep.position.y = -5.2; g.add(deep);

  // islotes, muelles
  const A0 = Math.PI * 0.9, A1 = A0 + Math.PI * 1.45, RS = 4.5, RI = 6.4;
  const dock = makeIslet(1.3, 3, 2), dest = makeIslet(1.4, 9, 1);
  dock.position.set(Math.cos(A0) * RI, 0, Math.sin(A0) * RI); dest.position.set(Math.cos(A1) * RI, 0, Math.sin(A1) * RI); g.add(dock, dest);
  [[dock, A0], [dest, A1]].forEach(([isl, a]) => { const pier = makePier(1.25), dx = -Math.cos(a), dz = -Math.sin(a); pier.position.set(dx * 0.95, 0, dz * 0.95); pier.rotation.y = -Math.atan2(dz, dx); isl.add(pier); });
  const barrel = makeBarrel(); barrel.position.set(0.95, 0.2, -0.05); dock.add(barrel);
  const chest = new THREE.Group(); {
    const cm = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.8 }), gold = new THREE.MeshStandardMaterial({ color: 0xe8b934, metalness: 0.8, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    const bx = shade(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.2), cm)); bx.position.y = 0.08;
    const lid = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 14).rotateZ(Math.PI / 2), cm)); lid.position.y = 0.16; lid.scale.set(1, 0.8, 1);
    const lk = shade(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.02), gold)); lk.position.set(0, 0.14, 0.1);
    chest.add(bx, lid, lk);
  }
  chest.position.set(-0.35, 0.3, -0.45); dest.add(chest);
  const flagPole = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }))); flagPole.position.set(0.55, 0.9, -0.2); dest.add(flagPole);
  const portFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2, 8, 1), new THREE.MeshStandardMaterial({ color: 0xe23d3d, side: THREE.DoubleSide })); portFlag.position.set(0.74, 1.4, -0.2); dest.add(portFlag);
  const boat = new THREE.Group(); { const bh = new THREE.SphereGeometry(1, 14, 8, 0, 6.283, Math.PI / 2, Math.PI / 2); bh.scale(0.3, 0.1, 0.12); boat.add(shade(new THREE.Mesh(bh, new THREE.MeshStandardMaterial({ color: 0x9a5a2e, roughness: 0.8 })))); }
  boat.position.set(Math.cos(A0) * (RI - 1.3) + 0.3, 0.04, Math.sin(A0) * (RI - 1.3) + 0.5); g.add(boat);
  const foam = [dock, dest].map(isl => { const f = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.75, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.35, depthWrite: false })); f.position.set(isl.position.x, 0.11, isl.position.z); g.add(f); return f; });

  // faro (nivel 2) y ballena (nivel 3)
  const glowMats = [], lampGlow = new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd24a, emissiveIntensity: 0.4 }); glowMats.push(lampGlow);
  const lh = makeLighthouseHD(lampGlow); lh.group.position.set(-0.35, 0.3, -0.25); dock.add(lh.group);
  const whale = makeWhaleHD(); g.add(whale);
  const spout = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3)), new THREE.PointsMaterial({ map: dotTex, color: 0xdff6ff, size: 0.16, transparent: true, depthWrite: false, opacity: 0.8 })); spout.frustumCulled = false; g.add(spout);
  const unlock = makeUnlocker([[lh.group, 2], [whale, 3]]);

  // barco
  const shipO = makeShipHD(glowMats), ship = shipO.group; g.add(ship);
  // ── personajes: estibadores, tripulación y vecinos del puerto de destino ──
  const DOCK_R = 3.65, NCR = 6, CYC = 4;
  const V2 = (x, z) => new THREE.Vector2(x, z);
  const routeOf = (a, off) => { const Dp = V2(Math.cos(a) * RI, Math.sin(a) * RI), d = V2(-Math.cos(a), -Math.sin(a)); return { Dp, d, perp: V2(-d.y, d.x), pile: Dp.clone().add(off), ps: Dp.clone().addScaledVector(d, 0.95), pe: Dp.clone().addScaledVector(d, 2.0), deck: V2(Math.cos(a) * (DOCK_R + 0.04), Math.sin(a) * (DOCK_R + 0.04)) }; };
  const OFF_D = V2(0.5, 0.32), OFF_T = V2(-0.7, 0.05);
  const rD = routeOf(A0, OFF_D), rT = routeOf(A1, OFF_T);
  const along = (rt, s, deckY, out) => {
    const P = [[rt.pile, 0.27], [rt.ps, 0.25], [rt.pe, 0.26], [rt.deck, deckY]], L = [0, 0, 0]; let tot = 0;
    for (let i = 0; i < 3; i++) { L[i] = P[i][0].distanceTo(P[i + 1][0]); tot += L[i]; }
    let d = clamp01(s) * tot, i = 0; while (i < 2 && d > L[i]) { d -= L[i]; i++; }
    const u = clamp01(d / L[i]), a = P[i], b = P[i + 1];
    return out.set(lerp(a[0].x, b[0].x, u), lerp(a[1], b[1], u), lerp(a[0].y, b[0].y, u));
  };
  const cycle = ph => {   // 0 = en la pila, 1 = en la cubierta
    if (ph < 0.12) return { s: 0, carry: ph > 0.08 ? 1 : 0 };
    if (ph < 0.55) return { s: (ph - 0.12) / 0.43, carry: 1 };
    if (ph < 0.66) return { s: 1, carry: ph < 0.6 ? 1 : 0 };
    return { s: 1 - (ph - 0.66) / 0.34, carry: 0 };
  };
  const mkP = o => { const pr = makePerson(o); pr.root.scale.setScalar(0.5); return pr; };
  const workers = [0xe28a2e, 0x3d8ee2, 0x58b84a].map(c => mkP({ shirt: c, hat: 'cap', capColor: 0xf0d24a })); workers.forEach(w => g.add(w.root));
  const villagers = [[0xe23d6a, 'hair', 0x3a2a1a], [0xf0c23a, 'straw', 0], [0x9a6ae2, 'hair', 0x1a1a1a]].map(([c, h, hr]) => mkP({ shirt: c, hat: h, hair: hr })); villagers.forEach(v => g.add(v.root));
  workers.forEach((w, k) => w.root.position.set(rD.Dp.x, 0.25, rD.Dp.y)); villagers.forEach(v => v.root.position.set(rT.Dp.x, 0.25, rT.Dp.y));
  const captain = mkP({ shirt: 0x24324f, hat: 'captain', skin: 0xd9a77a }), sailor = mkP({ shirt: 0xf2f2f2, hat: 'bandana', pants: 0x3a3f4a });
  shipO.roll.add(captain.root, sailor.root);
  captain.root.position.set(-0.62, 0.02, 0); captain.root.rotation.y = Math.PI / 2; sailor.root.position.set(0.28, 0.02, 0.2); sailor.root.rotation.y = Math.PI / 2;
  const slotPos = off => Array.from({ length: NCR }, (_, i) => [off.x + ((i % 3) - 1) * 0.19, 0.27, off.y + ((i / 3 | 0) - 0.5) * 0.19]);
  const mkStack = (parent, list) => list.map(([x, y, z], i) => { const c = makeCrate(0.9); c.position.set(x, y, z); c.rotation.y = i * 0.5; c.visible = false; parent.add(c); return c; });
  const dockStack = mkStack(dock, slotPos(OFF_D)), destStack = mkStack(dest, slotPos(OFF_T));
  const deckStack = mkStack(shipO.roll, [[0.5, 0, -0.14], [0.5, 0, 0], [0.5, 0, 0.14], [0.72, 0, -0.1], [0.72, 0, 0.04], [0.72, 0, 0.18]]);
  const mkPlank = a => { const m = shade(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.18), new THREE.MeshStandardMaterial({ map: plankTex, color: 0xc9a074 }))); m.position.set(Math.cos(a) * 3.95, 0.21, Math.sin(a) * 3.95); m.rotation.y = -a; m.visible = false; g.add(m); return m; };
  const plankD = mkPlank(A0), plankT = mkPlank(A1);
  // confeti
  const CF = 100, cfg = new THREE.BufferGeometry(), cfp = new Float32Array(CF * 3), cfc = new Float32Array(CF * 3), cfv = Array.from({ length: CF }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0 })); let cfLife = 0;
  cfg.setAttribute('position', new THREE.BufferAttribute(cfp, 3)); cfg.setAttribute('color', new THREE.BufferAttribute(cfc, 3));
  const cfm = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false });
  const confetti = new THREE.Points(cfg, cfm); confetti.frustumCulled = false; confetti.visible = false; g.add(confetti);
  const palette = [0xff4a6a, 0xffd24a, 0x4ad0ff, 0x6aff8a, 0xb06aff, 0xffffff].map(h => new THREE.Color(h));
  const burst = (x, y, z) => { cfLife = 5; confetti.visible = true; cfv.forEach((q, i) => { q.x = x + (Math.random() - 0.5) * 1.2; q.y = y + Math.random() * 0.6; q.z = z + (Math.random() - 0.5) * 1.2; q.vx = (Math.random() - 0.5) * 2.6; q.vy = 2.2 + Math.random() * 2.6; q.vz = (Math.random() - 0.5) * 2.6; const c = palette[i % palette.length]; cfc.set([c.r, c.g, c.b], i * 3); }); cfg.attributes.color.needsUpdate = true; };
  const wp = new THREE.Vector3(), tv = new THREE.Vector3(), pv = new THREE.Vector3();
  const faceTo = (pr, dx, dz, k) => { let d = Math.atan2(dx, dz) - pr.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); pr.root.rotation.y += d * k; };
  const drive = (pr, x, y, z, dt, t, pose, lx, lz) => {
    pv.copy(pr.root.position); pr.root.position.lerp(tv.set(x, y, z), 1 - Math.exp(-dt * 5));
    const dx = pr.root.position.x - pv.x, dz = pr.root.position.z - pv.z, sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    if (sp > 0.05) faceTo(pr, dx, dz, Math.min(1, dt * 8)); else faceTo(pr, lx - pr.root.position.x, lz - pr.root.position.z, Math.min(1, dt * 4));
    pr.update(dt, t, { ...pose, walk: clamp01(sp * 2.2), ph: pr.root.id });
  };
  let prevMode = 'focus';
  const people = { update({ p, mode, t, dt }) {
    const focus = mode === 'focus', q = focus ? 0 : p, deckY = ship.position.y + 0.03;
    if (focus ? p < 0.5 : false) prevMode = 'focus';
    // pilas de cajas
    let nDeck, nDock, nDest;
    if (focus) { nDeck = Math.floor(clamp01(p / 0.065) * NCR + 0.001); nDock = NCR - nDeck; nDest = 0; }
    else { nDest = Math.floor(clamp01((q - 0.04) / 0.30) * NCR + 0.001); nDeck = NCR - nDest; nDock = 0; }
    deckStack.forEach((c, i) => c.visible = i < nDeck); dockStack.forEach((c, i) => c.visible = i < nDock); destStack.forEach((c, i) => c.visible = i < nDest);
    plankD.visible = focus && p < 0.085; plankT.visible = (focus && p > 0.9) || (!focus && q < 0.36);
    // estibadores del puerto de salida
    workers.forEach((w, k) => {
      const pose = {}; let x, y, z;
      if (focus && p < 0.07) { const c = cycle(((p / 0.07) * CYC + k / 3) % 1); along(rD, c.s, deckY, wp); x = wp.x; y = wp.y; z = wp.z; pose.carry = c.carry; w.crate.visible = c.carry > 0; }
      else if (focus && p < 0.14) { x = rD.pe.x + rD.perp.x * (k - 1) * 0.2; z = rD.pe.y + rD.perp.y * (k - 1) * 0.2; y = 0.26; if (k === 1) pose.cheer = 1; else pose.wave = 1; w.crate.visible = false; }
      else { x = rD.Dp.x + rD.d.x * 0.75 + rD.perp.x * (k - 1) * 0.4; z = rD.Dp.y + rD.d.y * 0.75 + rD.perp.y * (k - 1) * 0.4; y = 0.22; w.crate.visible = false; }
      drive(w, x, y, z, dt, t, pose, ship.position.x, ship.position.z);
    });
    // vecinos del puerto de destino
    villagers.forEach((v, k) => {
      const pose = {}; let x, y, z; v.crate.visible = false;
      if (focus && p < 0.8) { x = rT.Dp.x + rT.d.x * 0.7 + rT.perp.x * (k - 1) * 0.45; z = rT.Dp.y + rT.d.y * 0.7 + rT.perp.y * (k - 1) * 0.45; y = 0.22; }
      else if (focus || q < 0.04) { x = rT.pe.x + rT.perp.x * (k - 1) * 0.2; z = rT.pe.y + rT.perp.y * (k - 1) * 0.2; y = 0.26; if (focus && p < 0.93) pose.wave = 1; else pose.cheer = 1; }
      else if (q < 0.34) { const c = cycle((((q - 0.04) / 0.30) * CYC + k / 3) % 1); along(rT, 1 - c.s, deckY, wp); x = wp.x; y = wp.y; z = wp.z; pose.carry = c.carry; v.crate.visible = c.carry > 0; }
      else { const a = k * 2.1 + 0.6; x = rT.Dp.x + Math.cos(a) * 0.5 - rT.d.x * 0.1; z = rT.Dp.y + Math.sin(a) * 0.5 - rT.d.y * 0.1; y = 0.27; if (Math.sin(t * 0.9 + k * 2.2) > 0.35) pose.cheer = 1; }
      drive(v, x, y, z, dt, t, pose, ship.position.x, ship.position.z);
    });
    // tripulación
    const cheerCrew = (focus && p > 0.9) || (!focus && q < 0.22);
    const cp = {}, sp2 = {};
    if (focus && p < 0.07) { cp.wave = 1; } else if (cheerCrew) { cp.cheer = 1; sp2.cheer = 1; } else if (focus) { cp.steer = 1; if (Math.sin(t * 0.45) > 0.75) sp2.wave = 1; }
    if (focus && p < 0.07) { sp2.carry = 0; }
    captain.update(dt, t, { ...cp, ph: 1 }); sailor.update(dt, t, { ...sp2, ph: 3 });
    // confeti al llegar
    if (prevMode === 'focus' && !focus) { burst(ship.position.x, ship.position.y + 1.0, ship.position.z); burst(rT.pe.x, 1.0, rT.pe.y); prevMode = 'break'; }
    if (cfLife > 0) {
      cfLife -= dt; cfm.opacity = clamp01(cfLife / 1.2);
      cfv.forEach((c, i) => { c.vy -= 4 * dt; c.vx *= 0.99; c.vz *= 0.99; c.x += c.vx * dt; c.y += c.vy * dt + Math.sin(t * 6 + i) * 0.004; c.z += c.vz * dt; cfp[i * 3] = c.x; cfp[i * 3 + 1] = Math.max(0.12, c.y); cfp[i * 3 + 2] = c.z; });
      cfg.attributes.position.needsUpdate = true; if (cfLife <= 0) confetti.visible = false;
    }
  } };

  const TR = 36, trail = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 3), 3)), new THREE.PointsMaterial({ map: dotTex, color: 0xffffff, size: 0.28, transparent: true, depthWrite: false, opacity: 0.5 })); trail.frustumCulled = false; g.add(trail);
  const trailPts = []; let trailT = 0;

  // vida: gaviotas, delfín, espuma, plancton
  const gulls = [0, 1, 2].map(i => { const b = makeGull(); b.userData.r = 3 + i * 1.4; b.userData.h = 3.2 + i * 0.6; b.userData.sp = 0.5 - i * 0.1; b.userData.ph = i * 2.1; g.add(b); return b; });
  const dolphin = makeDolphin(); dolphin.visible = false; g.add(dolphin); let dolphinT = 4, dolphinA = 0, dolphinR = 3.2;
  const foams = []; for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.045), new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.3, depthWrite: false })); f.userData = { a: rnd() * 6.28, r: 1 + rnd() * 8, s: 0.01 + rnd() * 0.03 }; g.add(f); foams.push(f); }
  const PL = 60, plg = new THREE.BufferGeometry(), plp = new Float32Array(PL * 3), plb = [];
  for (let i = 0; i < PL; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 9; plb.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ph: rnd() * 6.28, sp: 0.4 + rnd() }); }
  plg.setAttribute('position', new THREE.BufferAttribute(plp, 3));
  const plm = new THREE.PointsMaterial({ map: dotTex, color: 0x6fe8ff, size: 0.22, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }); const plankton = new THREE.Points(plg, plm); plankton.frustumCulled = false; g.add(plankton);

  // ranuras de islas descubiertas
  const slots = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + 0.2; slots.push({ x: Math.cos(a) * 8.1, z: Math.sin(a) * 8.1 }); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; slots.push({ x: Math.cos(a) * 2.2, z: Math.sin(a) * 2.2 }); }
  const found = [];
  const waveH = (x, z, t) => 0;
  return { group: g, unlock, startFocus() {},
    reward(i, animate) {
      const s = slots[i % slots.length], k = i % 3, it = new THREE.Group();
      if (k === 0) it.add(makeIslet(0.75, i + 20, 1));
      else if (k === 1) { const m = makeMound(0.6, i + 30, 0.2, (d, y, x, z, c) => c.setHex(0xb4bcc6).multiplyScalar(0.8 + 0.3 * vnoise(x * 6, z * 6))); it.add(m); const r1 = makeRock(0.38, i + 2); r1.position.y = 0.1; it.add(r1); const fp = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0xdddddd }))); fp.position.set(0.1, 0.55, 0); it.add(fp); const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.15), new THREE.MeshStandardMaterial({ color: [0xe23d3d, 0x3d8ee2, 0xe2c23d][i % 3], side: THREE.DoubleSide })); fl.position.set(0.24, 0.88, 0); it.add(fl); }
      else { it.add(makeMound(0.7, i + 40, 0.14, sandColor)); const cc = makeCrate(1.2); cc.position.set(0.1, 0.1, 0); it.add(cc); const bu = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe23d3d, roughness: 0.4 })); bu.position.set(-0.3, 0.1, 0.2); it.add(bu); }
      it.position.set(s.x, 0, s.z); it.rotation.y = i * 1.3; g.add(it); found.push(it);
      animate ? pop(it, 1) : it.scale.setScalar(1);
    },
    update({ p, mode, night, t, dt }) {
      const focus = mode === 'focus', day = 1 - night;
      seaNormal.offset.set(t * 0.012, t * 0.008);
      // barco
      const u = focus ? clamp01((p - 0.07) / 0.86) : 1, e = THREE.MathUtils.smootherstep(u, 0, 1), a = A0 + (A1 - A0) * e, r = DOCK_R + (RS - DOCK_R) * sstep(0, 0.12, u) * (1 - sstep(0.88, 1, u));
      const sx = Math.cos(a) * r, sz = Math.sin(a) * r, wy = seaWave(sx, -sz, t) + 0.16;   // el casco flota sobre la ola
      ship.position.set(sx, wy, sz);
      ship.rotation.y = -Math.atan2(Math.cos(a), -Math.sin(a));
      shipO.roll.rotation.z = Math.sin(t * 1.5) * 0.05; shipO.roll.rotation.x = Math.sin(t * 1.1) * 0.04;
      const fp = shipO.flagG.attributes.position; for (let i = 0; i < fp.count; i++) { const x = fp.getX(i) + 0.17; fp.setZ(i, Math.sin(x * 22 - t * 9) * 0.03 * x * 3); } fp.needsUpdate = true;
      shipO.wake.visible = focus && u > 0.02 && u < 0.98; shipO.wake.material.opacity = 0.25 + Math.sin(t * 3) * 0.05;
      shipO.lampLight.intensity = night * 2.5; glowMats.forEach(m => m.emissiveIntensity = 0.12 + night * 1.4);
      // estela
      trailT += dt; if (focus && u > 0.02 && u < 0.98 && trailT > 0.07) { trailT = 0; const th = a, back = 0.95; trailPts.unshift([Math.cos(th) * r + Math.sin(th) * back, 0.1, Math.sin(th) * r - Math.cos(th) * back]); if (trailPts.length > TR) trailPts.pop(); }
      const tp = trail.geometry.attributes.position; for (let i = 0; i < TR; i++) { const q = trailPts[i] || [0, -5, 0]; tp.setXYZ(i, q[0], q[1], q[2]); } tp.needsUpdate = true; trail.material.opacity = focus ? 0.5 : 0.0;
      people.update({ p, mode, t, dt });
      // faro
      lh.beam.rotation.y = t * 1.2; lh.beamMat.opacity = night * 0.3; lh.light.intensity = night * 5; lampGlow.emissiveIntensity = 0.3 + night * 2.2;
      // ballena (sube a respirar)
      const wa = t * 0.28, dive = Math.sin(t * 0.7); whale.position.set(Math.cos(wa) * 2.7, -0.28 + Math.max(0, dive) * 0.4, Math.sin(wa) * 2.7); whale.rotation.y = -Math.atan2(Math.cos(wa), -Math.sin(wa)); whale.userData.tail.rotation.z = Math.sin(t * 2.2) * 0.18;
      const sp = spout.geometry.attributes.position; const up = dive > 0.85 ? 1 : 0; for (let i = 0; i < 14; i++) { const u = ((t * 1.2 + i / 14) % 1); sp.setXYZ(i, whale.position.x + Math.cos(wa) * 0.2 + Math.sin(i * 2.4) * 0.06 * u + Math.sin(wa) * 0, 0.2 + (up ? u * 0.9 - u * u * 0.7 : -5), whale.position.z + Math.sin(wa) * 0.2 + Math.cos(i * 2.4) * 0.06 * u); } sp.needsUpdate = true;
      // gaviotas y delfín
      gulls.forEach(b => { const u = b.userData, ang = t * u.sp + u.ph; b.visible = day > 0.35; b.position.set(Math.cos(ang) * u.r, u.h + Math.sin(t * 1.3 + u.ph) * 0.2, Math.sin(ang) * u.r); b.rotation.y = -ang + Math.PI; b.rotation.x = 0.2; const f = Math.sin(t * 7 + u.ph) * 0.6; u.wl.rotation.x = f; u.wr.rotation.x = -f; });
      dolphinT -= dt;
      if (dolphinT < -1.7) { dolphinT = 6 + Math.random() * 5; dolphinA = Math.random() * 6.28; dolphinR = 2.6 + Math.random() * 3; }
      if (dolphinT < 0) { const u = clamp01(-dolphinT / 1.6), yy = Math.sin(u * Math.PI) * 0.75 - 0.15, dy = Math.cos(u * Math.PI) * 0.75 * Math.PI / 1.6;
        dolphin.visible = u < 1; dolphin.position.set(Math.cos(dolphinA) * dolphinR - Math.sin(dolphinA) * (u - 0.5) * 1.8, yy, Math.sin(dolphinA) * dolphinR + Math.cos(dolphinA) * (u - 0.5) * 1.8);
        dolphin.rotation.y = -Math.atan2(Math.cos(dolphinA), -Math.sin(dolphinA)); dolphin.rotation.z = Math.atan2(dy, 1.8 / 1.6 * 1.0) ; } else dolphin.visible = false;
      foams.forEach(f => { const u = f.userData; u.a += u.s * 0.02; f.position.set(Math.cos(u.a) * u.r, 0.1 + Math.sin(t * 2 + u.r) * 0.01, Math.sin(u.a) * u.r); f.rotation.y = -u.a; f.material.opacity = 0.28 * day + 0.06; });
      foam.forEach((f, i) => { const s = 1 + Math.sin(t * 1.2 + i) * 0.04; f.scale.set(s, 1, s); f.material.opacity = 0.3 + Math.sin(t * 1.6 + i * 2) * 0.08; });
      dock.userData.crowns.concat(dest.userData.crowns).forEach((c, i) => { c.rotation.z = Math.sin(t * 1.2 + i) * 0.04; c.rotation.x = Math.cos(t * 0.9 + i) * 0.04; });
      const pf = portFlag.geometry.attributes.position; for (let i = 0; i < pf.count; i++) { const x = pf.getX(i) + 0.18; pf.setZ(i, Math.sin(x * 20 - t * 8) * 0.03 * x * 3); } pf.needsUpdate = true;
      boat.position.y = seaWave(boat.position.x, -boat.position.z, t) + 0.09; boat.rotation.z = Math.sin(t * 1.2) * 0.04;
      found.forEach((f, i) => f.position.y = 0.08 + Math.sin(t * 1.2 + i) * 0.01);
      plm.opacity = clamp01(night * 1.2) * 0.8; plankton.visible = night > 0.05;
      plb.forEach((q, i) => { plp[i * 3] = q.x + Math.sin(t * 0.3 * q.sp + q.ph) * 0.3; plp[i * 3 + 1] = 0.13 + Math.sin(t * q.sp + q.ph) * 0.02; plp[i * 3 + 2] = q.z + Math.cos(t * 0.25 * q.sp + q.ph) * 0.3; }); plg.attributes.position.needsUpdate = true;
    } };
}
