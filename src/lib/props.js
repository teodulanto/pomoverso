/** Objetos comunes: fogata, cajas, barriles. */
import * as THREE from 'three';
import { dotTex, plankTex } from './textures.js';
import { shade } from './three-utils.js';
import { makeRock } from './vegetation.js';

/* ── fogata bonita ── */
export function makeCampHD() {
  const group = new THREE.Group();
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = makeRock(0.11, i, false); r.position.set(Math.cos(a) * 0.42, 0.04, Math.sin(a) * 0.42); group.add(r); }
  for (let i = 0; i < 4; i++) { const lg = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 8), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 1 }))); lg.rotation.set(Math.PI / 2 - 0.35, 0, 0); lg.rotation.order = 'YXZ'; lg.rotation.y = i * 1.57; lg.position.y = 0.1; group.add(lg); }
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [[0.3, 0.85, 0xff7a1a, 0.8], [0.22, 0.65, 0xffb23a, 0.85], [0.13, 0.45, 0xfff1a8, 0.9]].map(([r, h, c, o], i) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8, 1, true).translate(0, h / 2, 0), fm(c, o)); m.position.y = 0.12; m.userData.h = h; group.add(m); return m; });
  const light = new THREE.PointLight(0xff9a3c, 0, 10); light.position.y = 0.8; group.add(light);
  const SP = 18, sg = new THREE.BufferGeometry(), sp = new Float32Array(SP * 3), sd = [];
  for (let i = 0; i < SP; i++) sd.push({ life: Math.random(), sp: 0.5 + Math.random() * 0.8, ox: Math.random() * 6.283 });
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ map: dotTex, color: 0xffb04a, size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; group.add(sparks);
  return { group, update(t, dt, night, on) {
    group.visible = night > 0.2 && on > 0;
    flames.forEach((f, i) => { const k = 0.85 + Math.sin(t * (13 + i * 5) + i) * 0.1 + Math.sin(t * 27 + i * 2) * 0.06; f.scale.set(k, k * (1.1 + i * 0.1), k); f.rotation.y = t * (1 + i); });
    light.intensity = on * night * (16 + Math.sin(t * 23) * 3 + Math.sin(t * 9) * 2);
    sd.forEach((s, i) => { s.life += dt * s.sp * 0.6; if (s.life > 1) s.life = 0; const u = s.life; sp[i * 3] = Math.sin(s.ox + u * 4) * 0.25 * u; sp[i * 3 + 1] = 0.3 + u * 1.7; sp[i * 3 + 2] = Math.cos(s.ox + u * 3) * 0.25 * u; });
    sg.attributes.position.needsUpdate = true;
  } };
}

export function makeCrate(s = 1) { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ map: plankTex, color: 0xb98a58, roughness: 0.9 }); const b = shade(new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.2 * s, 0.2 * s), m)); b.position.y = 0.1 * s; g.add(b); return g; }

export function makeBarrel() { const g = new THREE.Group(); const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), new THREE.MeshStandardMaterial({ map: plankTex, color: 0x9a6a3e, roughness: 0.85 }))); b.position.y = 0.11; g.add(b); [0.05, 0.17].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 5, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6 })); r.position.y = y; g.add(r); }); return g; }
