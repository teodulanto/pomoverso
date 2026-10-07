/** Mundo 4 — Cosmos: un cohete despega rumbo a un planeta. */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildIsland, edgeR } from '../lib/island.js';
import { clamp01, fbm, mulberry, sstep, vnoise } from '../lib/math.js';
import { makeConfetti } from '../lib/effects.js';
import { makeActor, walkTo } from '../lib/people.js';
import { blobShadow, canvasTex, dotTex, radialTex, rockTex } from '../lib/textures.js';
import { makeUnlocker, paint, pop, shade, vcMat } from '../lib/three-utils.js';
import { makeRock } from '../lib/vegetation.js';

/** Datos del mundo: nombre, costo en monedas, cielo, cámara y textos de cada etapa. */
export const meta = { id: 'space', name: 'Cosmos', emoji: '🚀', cost: 120, rewardLabel: 'Satélites', doneMsg: '🛰️ ¡Satélite en órbita!',
    desc: 'Un cohete despega rumbo a un planeta anillado. Cada viaje deja un satélite orbitando.', milestones: ['Base lunar', 'OVNI visitante'],
    sky: { dawn: 0x3a2a70, day: 0x24348a, dusk: 0x5a2a70, night: 0x05061a }, clouds: false, minNight: 0.8, cam: { R: 18, h: 8.5, look: 3.6 },
    focus: ['Cuenta atrás… 🔥', '¡Despegue! 🚀', 'Saliendo de la atmósfera ☄️', 'Rumbo al planeta 🪐', 'Acercándose a la órbita ✨'],
    rest: ['Orbitando en silencio 🛰️', 'Comunicaciones en pausa…', 'Vista de las estrellas ✨'] };

/* ═════════════════════ MUNDO 4: Cosmos (HD) ═════════════════════ */
const CRATERS = [[2.5, -1.6, 0.85], [-2.7, 1.3, 0.65], [-1.3, -3.1, 0.5], [1.5, 3.0, 0.5], [-3.3, -1.0, 0.4]];

function spaceH(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.4 + 1, z * 0.4 + 9) - 0.5) * 0.5 + (fbm(x * 1.5, z * 1.5) - 0.5) * 0.15;
  const pad = 1 - sstep(1.0, 1.9, r); h = h * (1 - pad) + 0.1 * pad;
  const base = 1 - sstep(0.8, 1.6, Math.hypot(x - 2.9, z - 1.9)); h = h * (1 - base) + 0.1 * base;
  CRATERS.forEach(([cx, cz, rr]) => { const d = Math.hypot(x - cx, z - cz); h -= 0.34 * Math.exp(-(d * d) / (rr * rr * 0.55)); h += 0.11 * Math.exp(-((d - rr) * (d - rr)) / 0.05); });
  return h - 0.3 * sstep(3.9, 5, r);
}

function spaceColor(x, z, h, rad, c, c2) {
  const n = fbm(x * 1.6 + 7, z * 1.6);
  c.setHex(0x7d7398).lerp(c2.setHex(0xa59cc2), sstep(0.35, 0.75, n)).lerp(c2.setHex(0x5d5478), sstep(0.5, 0.25, n) * 0.6);
  c.multiplyScalar(0.85 + 0.3 * vnoise(x * 9, z * 9));
  CRATERS.forEach(([cx, cz, rr]) => { const d = Math.hypot(x - cx, z - cz); c.lerp(c2.setHex(0x3f385a), (1 - sstep(rr * 0.4, rr * 1.0, d)) * 0.75); c.lerp(c2.setHex(0xc4bcdc), Math.exp(-((d - rr) * (d - rr)) / 0.04) * 0.35); });
  const r = Math.hypot(x, z); c.lerp(c2.setHex(0x8e93a1), 1 - sstep(0.95, 1.2, r)); if (r > 0.62 && r < 0.68) c.lerp(c2.setHex(0xe9c53a), 0.8);
  c.lerp(c2.setHex(0x5a5470), sstep(4.3, 4.95, rad));
}

function makeCrystal(h, color, emissive) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.3, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
  [[0, 0, 0, 1, 0], [0.14, 0.06, 0.1, 0.65, 0.35], [-0.12, -0.04, 0.08, 0.55, -0.4], [0.05, -0.12, -0.12, 0.45, 0.2]].forEach(([x, z, o, k, tilt]) => {
    const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.07 * k, h * k, 6, 1).translate(0, h * k / 2, 0), m)); c.position.set(x, 0, z); c.rotation.z = tilt; c.rotation.x = o; g.add(c);
    const t = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * k, 0.07 * k, h * k * 0.5, 6, 1).translate(0, h * k * 0.25, 0), m)); t.position.set(x, 0, z); t.rotation.z = tilt; t.rotation.x = o; g.add(t);
  }); return g;
}

function makeRocketHD(glowMats) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const pts = [[0.001, 0], [0.3, 0.02], [0.33, 0.2], [0.33, 1.25]];
  for (let i = 1; i <= 12; i++) { const t = i / 12; pts.push([Math.max(0.001, 0.33 * Math.pow(1 - t * t, 0.62)), 1.25 + t * 0.75]); }
  const lg = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  paint(lg, (x, y, z, c) => { c.setHex(0xf4f4f8); if (y > 0.92 && y < 1.0) c.setHex(0x20242e); if (y > 1.7) c.setHex(0xe04a4a); if (y < 0.12) c.setHex(0x8a8f9c); c.multiplyScalar(0.95 + 0.1 * vnoise(x * 10, y * 10)); });
  lg.computeVertexNormals(); body.add(shade(new THREE.Mesh(lg, vcMat({ roughness: 0.35, metalness: 0.25 }))));
  [0.35, 0.65, 1.1].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.332, 0.008, 5, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9aa0ac, metalness: 0.6 })); r.position.y = y; body.add(r); });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, metalness: 0.7, roughness: 0.4 });
  [[0, 0], [0.14, 0.1], [-0.14, 0.1]].forEach(([x, z]) => { const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 0.22, 12, 1, true), metal)); b.position.set(x * 0.9, -0.08, z * 0.9); body.add(b); });
  const win = new THREE.MeshStandardMaterial({ color: 0x7fc8ff, emissive: 0x2a8fe0, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.15 }); glowMats.push(win);
  const wg = shade(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), win)); wg.position.set(0, 1.1, 0.29); wg.scale.z = 0.5; body.add(wg);
  const wr = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.018, 6, 20), metal); wr.position.set(0, 1.1, 0.3); body.add(wr);
  const fs = new THREE.Shape(); fs.moveTo(0, 0.5); fs.lineTo(0.34, -0.02); fs.lineTo(0.34, -0.14); fs.lineTo(0, 0.02);
  for (let i = 0; i < 3; i++) { const f = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.035, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xe04a4a, roughness: 0.5, metalness: 0.2 }))); f.geometry.translate(0.28, 0.12, -0.0175); f.rotation.y = i * 2.094; body.add(f); }
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [[0.22, 1.1, 0xff6a1a, 0.75], [0.15, 0.8, 0xffb23a, 0.85], [0.08, 0.55, 0xfff6c8, 0.95]].map(([r, h, c, o]) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10, 1, true).rotateX(Math.PI).translate(0, -h / 2 - 0.12, 0), fm(c, o)); body.add(m); m.userData.h = h; return m; });
  const light = new THREE.PointLight(0xff9a3c, 0, 8); light.position.y = -0.4; body.add(light);
  return { group: g, body, flames, light };
}

function makeSatHD(i) {
  const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.85, roughness: 0.3 });
  const panelTex = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#1d3f8f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7fa8ff'; c.lineWidth = 2; for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  const pm = new THREE.MeshStandardMaterial({ map: panelTex, metalness: 0.5, roughness: 0.35 });
  g.add(shade(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), gold)));
  [1, -1].forEach(s => { const a = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5).rotateZ(Math.PI / 2), gold)); a.position.x = s * 0.2; g.add(a); const p = shade(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.26), pm)); p.position.x = s * 0.5; g.add(p); });
  const dish = shade(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, 6.283, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 0.4, side: THREE.DoubleSide }))); dish.position.set(0, 0.2, 0); dish.rotation.x = 0.4; g.add(dish);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshBasicMaterial({ color: [0xff4a4a, 0x4aff7a, 0x4ab0ff][i % 3] })); led.position.set(0.1, 0.15, 0.14); g.add(led); g.userData.led = led;
  return g;
}

function makeUFOHD() {
  const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0x9aa4bd, metalness: 0.75, roughness: 0.3 });
  const sg = new THREE.SphereGeometry(0.85, 26, 12); sg.scale(1, 0.26, 1); g.add(shade(new THREE.Mesh(sg, metal)));
  const dome = shade(new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 10, 0, 6.283, 0, 1.57), new THREE.MeshStandardMaterial({ color: 0x7fffd0, emissive: 0x2ad0a0, emissiveIntensity: 0.6, transparent: true, opacity: 0.65, roughness: 0.1 }))); dome.position.y = 0.14; g.add(dome);
  const lights = []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); l.position.set(Math.cos(a) * 0.78, -0.02, Math.sin(a) * 0.78); g.add(l); lights.push(l); }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.4, 20, 1, true).translate(0, -1.2, 0), new THREE.MeshBasicMaterial({ color: 0x9fffd8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = -0.1; g.add(beam);
  const pl = new THREE.PointLight(0x7fffd0, 2.5, 5); pl.position.y = -0.3; g.add(pl);
  g.userData = { lights, beam }; return g;
}

function makeMoonBase(glowMats) {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xe8ecf3, metalness: 0.3, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, metalness: 0.5, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.1 });
  const win = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa84a, emissiveIntensity: 0.2 }); glowMats.push(win);
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.16, 24).translate(0, 0.08, 0), white)), shade(new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 12, 0, 6.283, 0, 1.5707).translate(0, 0.16, 0), glass)));
  const plant = shade(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ color: 0x4fc26a, emissive: 0x1a6a2a, emissiveIntensity: 0.4 }))); g.add(plant);
  const mod = (x, z, ry) => { const m = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 14).rotateZ(Math.PI / 2), white)); m.position.set(x, 0.35, z); m.rotation.y = ry; g.add(m); const w = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), win); w.position.set(x + Math.sin(ry) * 0.0, 0.4, z + 0.285); g.add(w); return m; };
  mod(1.45, 0.35, 0); mod(1.15, -0.85, 0.5);
  const tube = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8).rotateZ(Math.PI / 2), dark)); tube.position.set(1.05, 0.3, 0.1); g.add(tube);
  const ant = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.0, 5), dark)); ant.position.set(-0.6, 0.55, 0.4); g.add(ant);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a4a })); led.position.set(-0.6, 1.08, 0.4); g.add(led);
  const panelM = new THREE.MeshStandardMaterial({ color: 0x1d3f8f, metalness: 0.5, roughness: 0.35 });
  [0, 1].forEach(i => { const p = shade(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.4), panelM)); p.position.set(-0.4 + i * 0.85, 0.28, -1.2); p.rotation.x = -0.5; g.add(p); const st = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 5), dark)); st.position.set(-0.4 + i * 0.85, 0.12, -1.15); g.add(st); });
  const dl = new THREE.PointLight(0x9fe6ff, 0, 5); dl.position.y = 0.6; g.add(dl);
  g.add(blobShadow(1.8, 0.45));
  return { group: g, led, light: dl };
}

function makeGantry() {
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0xc9532e, metalness: 0.4, roughness: 0.55 });
  const H = 2.3, W = 0.3;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const p = shade(new THREE.Mesh(new THREE.BoxGeometry(0.04, H, 0.04), steel)); p.position.set(sx * W / 2, H / 2, sz * W / 2); g.add(p); });
  for (let i = 0; i <= 7; i++) { const y = i * H / 7; [0, 1].forEach(k => { const b = shade(new THREE.Mesh(new THREE.BoxGeometry(k ? 0.03 : W, 0.025, k ? W : 0.03), steel)); b.position.set(0, y, k ? 0 : W / 2); g.add(b); }); if (i < 7) { const d = shade(new THREE.Mesh(new THREE.BoxGeometry(0.02, Math.hypot(H / 7, W), 0.02), steel)); d.position.set(0, y + H / 14, W / 2); d.rotation.x = Math.atan2(W, H / 7) * (i % 2 ? 1 : -1); g.add(d); } }
  const arm = shade(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.08), steel)); arm.position.set(-0.45, 1.5, 0); g.add(arm);
  const clamp = shade(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x4a4f5c, metalness: 0.6 }))); clamp.position.set(-0.9, 1.5, 0); g.add(clamp);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); beacon.position.y = H + 0.05; g.add(beacon); g.userData.beacon = beacon;
  return g;
}

function makeRover() {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xe8ecf3, metalness: 0.3, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.7 });
  g.add(shade(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.26), white)));
  const cab = shade(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a8fd0, metalness: 0.5, roughness: 0.3 }))); cab.position.set(0.05, 0.1, 0); g.add(cab);
  const wheels = []; [[-0.15, -0.16], [0, -0.16], [0.15, -0.16], [-0.15, 0.16], [0, 0.16], [0.15, 0.16]].forEach(([x, z]) => { const w = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12).rotateX(Math.PI / 2), dark)); w.position.set(x, -0.04, z); g.add(w); wheels.push(w); });
  const an = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), dark)); an.position.set(-0.15, 0.25, 0.05); g.add(an);
  g.userData.wheels = wheels; g.position.y = 0.09; return g;
}

export function buildSpace() {
  const g = new THREE.Group(), rnd = mulberry(99);
  g.add(buildIsland(spaceH, spaceColor, { a: 0x6a6180, b: 0x4a4366, top: 0x7d7398 }));
  const place = (o, x, z, dy = 0) => { o.position.set(x, spaceH(x, z) + dy, z); g.add(o); return o; };
  // piedras y cristales
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + 0.2, rr = edgeR(a) - 0.3 - (i % 3) * 0.15, rk = makeRock(0.18 + (i % 4) * 0.08, i * 3.1, false); rk.rotation.y = i; place(rk, Math.cos(a) * rr, Math.sin(a) * rr); }
  const crystalSpots = [[-1.8, -2.3, 0xb48cff, 0x6a3cff, 0.8], [3.4, -0.2, 0x7fe8ff, 0x1aa6d8, 0.7], [-3.6, 2.0, 0xff8cd8, 0xd83aa8, 0.6], [0.2, 3.4, 0xb48cff, 0x6a3cff, 0.55]];
  const crystalLights = [];
  crystalSpots.forEach(([x, z, c, e, h], i) => { const cr = makeCrystal(h, c, e); cr.rotation.y = i; place(cr, x, z, -0.02); if (i < 2) { const l = new THREE.PointLight(e, 2.2, 3.5); l.position.set(0, 0.5, 0); cr.add(l); crystalLights.push(l); } });
  // plataforma de lanzamiento
  const padM = new THREE.MeshStandardMaterial({ color: 0x8e93a1, map: rockTex, bumpMap: rockTex, bumpScale: 2, roughness: 0.8 });
  const padMesh = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.12, 28), padM)); padMesh.position.y = 0.1; g.add(padMesh);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe9c53a : 0x20242e })); m.position.set(Math.cos(a) * 0.78, 0.17, Math.sin(a) * 0.78); m.rotation.y = -a; g.add(m); }
  const gantry = makeGantry(); gantry.position.set(1.3, 0.12, -0.15); g.add(gantry);
  // tanques, antena, paneles
  const tankM = new THREE.MeshStandardMaterial({ color: 0xe8ecf3, metalness: 0.4, roughness: 0.4 });
  [[-2.0, 0.6], [-2.35, -0.1]].forEach(([x, z], i) => { const t = new THREE.Group(); t.add(shade(new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12).translate(0, 0.5, 0), tankM))); for (let k = 0; k < 3; k++) { const l = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), tankM)); l.position.set(Math.cos(k * 2.1) * 0.2, 0.15, Math.sin(k * 2.1) * 0.2); t.add(l); } place(t, x, z); });
  const dishG = new THREE.Group(); dishG.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6).translate(0, 0.25, 0), tankM)));
  const dish = shade(new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 8, 0, 6.283, 0, 1.0), new THREE.MeshStandardMaterial({ color: 0xf1f2f6, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }))); dish.position.y = 0.6; dish.rotation.x = Math.PI + 0.7; dishG.add(dish); place(dishG, -3.0, -0.4); dishG.rotation.y = 0.8;
  const panelM = new THREE.MeshStandardMaterial({ color: 0x1d3f8f, metalness: 0.5, roughness: 0.35 });
  for (let i = 0; i < 3; i++) { const p = shade(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.4), panelM)); p.rotation.x = -0.5; place(p, 0.2 + i * 0.7, -3.0 + i * 0.1, 0.22); }
  const flagM = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.24, 8, 1), new THREE.MeshStandardMaterial({ color: 0xe23d3d, side: THREE.DoubleSide })), fpole = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0xdddddd })));
  const flagG = new THREE.Group(); fpole.position.y = 0.5; flagM.position.set(0.2, 0.88, 0); flagG.add(fpole, flagM); place(flagG, -0.8, 1.9);
  const rover = makeRover(); g.add(rover);

  // cohete, planeta, luna, nebulosas
  const glowMats = [], rk = makeRocketHD(glowMats), rocket = rk.group; rocket.scale.setScalar(0.95); g.add(rocket);
  const PLANET = new THREE.Vector3(-5.5, 8, -5);
  const planetG = new THREE.Group(); planetG.position.copy(PLANET); g.add(planetG);
  let pgeo = new THREE.IcosahedronGeometry(1.7, 5); pgeo.deleteAttribute('normal'); pgeo.deleteAttribute('uv'); pgeo = mergeVertices(pgeo);
  paint(pgeo, (x, y, z, c) => { const b = 0.5 + 0.5 * Math.sin(y * 6.5 + fbm(x * 1.5, z * 1.5) * 3); c.setHex(0xe07a3c).lerp(new THREE.Color(0xf6c27a), b * 0.8).lerp(new THREE.Color(0xa8482a), sstep(0.6, 0.9, vnoise(x * 2 + 3, y * 7))* 0.5); });
  pgeo.computeVertexNormals(); const planet = shade(new THREE.Mesh(pgeo, vcMat({ roughness: 0.85 }))); planet.castShadow = false; planetG.add(planet);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.95, 32, 20), new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.5); gl_FragColor = vec4(1.0, 0.55, 0.25, 1.0) * min(f * 1.4, 1.0); }' }));
  planetG.add(atmo);
  const ringTex = canvasTex(256, 4, c => { const gr = c.createLinearGradient(0, 0, 256, 0); [[0, 'rgba(240,210,150,0)'], [0.12, 'rgba(240,210,150,.85)'], [0.3, 'rgba(200,160,110,.6)'], [0.42, 'rgba(240,215,160,.9)'], [0.55, 'rgba(120,90,60,.15)'], [0.65, 'rgba(235,205,150,.8)'], [0.85, 'rgba(210,175,120,.55)'], [1, 'rgba(240,210,150,0)']].forEach(([o, col]) => gr.addColorStop(o, col)); c.fillStyle = gr; c.fillRect(0, 0, 256, 4); });
  const rg = new THREE.RingGeometry(2.3, 3.7, 96, 1), rp = rg.attributes.position, ruv = rg.attributes.uv; for (let i = 0; i < rp.count; i++) ruv.setXY(i, (Math.hypot(rp.getX(i), rp.getY(i)) - 2.3) / 1.4, 0.5);
  const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false })); ring.rotation.x = Math.PI / 2 - 0.35; ring.receiveShadow = true; planetG.add(ring);
  const moonM = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 3), new THREE.MeshStandardMaterial({ color: 0xcfd3de, roughness: 0.9, map: rockTex, bumpMap: rockTex, bumpScale: 4 }))); planetG.add(moonM);
  const neb = (c, x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, c + '.55)'], [0.4, c + '.22)'], [1, c + '0)']], 256), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })); sp.position.set(x, y, z); sp.scale.setScalar(s); g.add(sp); return sp; };
  neb('rgba(140,80,255,', -45, 28, -80, 90); neb('rgba(60,200,255,', 55, 40, -75, 80); neb('rgba(255,80,190,', 5, 65, -95, 85);
  const shoot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(shoot); let shootT = 3;

  // base lunar (2) y ovni (3)
  const baseO = makeMoonBase(glowMats), base = baseO.group; place(base, 2.9, 1.9, 0.0);
  const ufo = makeUFOHD(); ufo.position.set(-3.2, 2.9, 2.5); g.add(ufo);
  const unlock = makeUnlocker([[base, 2], [ufo, 3]]);

  // humo de despegue + estela del cohete
  const SM = 40, smg = new THREE.BufferGeometry(), smp = new Float32Array(SM * 3), smd = []; for (let i = 0; i < SM; i++) smd.push({ life: i / SM, a: rnd() * 6.283, sp: 0.6 + rnd() * 0.6 });
  smg.setAttribute('position', new THREE.BufferAttribute(smp, 3));
  const smoke = new THREE.Points(smg, new THREE.PointsMaterial({ map: dotTex, color: 0xe8e8ee, size: 0.5, transparent: true, depthWrite: false, opacity: 0 })); smoke.frustumCulled = false; g.add(smoke);
  const TL = 50, tg = new THREE.BufferGeometry(), tp = new Float32Array(TL * 3), tc = new Float32Array(TL * 3), trailP = [];
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ map: dotTex, vertexColors: true, size: 0.34, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; g.add(trail); let trailT = 0;

  // ── historia: cuenta atrás, el astronauta se despide, la tripulación mira el despegue y celebra la llegada ──
  const LAUNCH = 0.06;   // el cohete espera en la plataforma hasta este punto del pomodoro
  const orange = { shirt: 0xf08a24, pants: 0x3a3f4a, hat: 'cap', capColor: 0xf4f4f6 };
  const techs = [makeActor({ ...orange }), makeActor({ ...orange, shirt: 0xe2c02a })];
  const astro = makeActor({ shirt: 0xf4f4f6, pants: 0xe8ecf3, hat: 'helmet', backpack: 0xd0d4de });
  const ctrl = makeActor({ shirt: 0x3a8fd0, pants: 0x2a3548, hair: 0x2a1a10 });
  g.add(...techs.map(a => a.root), astro.root, ctrl.root);
  const desk = new THREE.Group();   // puesto de control de misión
  { const metal = new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.5, roughness: 0.5 });
    const top = shade(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.3), metal)); top.position.y = 0.3; desk.add(top);
    [-0.3, 0.3].forEach(x => { const lg = shade(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.26), metal)); lg.position.set(x, 0.15, 0); desk.add(lg); });
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x66c8ff, emissive: 0x2a9fe0, emissiveIntensity: 0.9, roughness: 0.2 }); glowMats.push(screenMat);
    const scr = shade(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.03), screenMat)); scr.position.set(0, 0.5, -0.1); scr.rotation.x = -0.25; desk.add(scr); }
  desk.position.set(-1.5, spaceH(-1.5, 1.7), 1.7); g.add(desk);
  const conf = makeConfetti(g, 100, 0.12);
  const CTRL_AT = [-1.5, 1.35], BASE_AT = [2.9, 1.9], SIDE = [0.95, 0.15];
  let sPrev = 'focus';
  const placeA = (a, x, z) => a.root.position.set(x, spaceH(x, z) + 0.02, z);
  const resetStory = () => {
    placeA(astro, BASE_AT[0] - 0.9, BASE_AT[1] - 0.2); astro.root.visible = true;
    placeA(techs[0], 0.9, -1.2); placeA(techs[1], -0.9, -1.1); placeA(ctrl, CTRL_AT[0], CTRL_AT[1]);
  };
  resetStory();
  const story = (p, focus, t, dt) => {
    const opts = { speed: 0.5, ground: spaceH }, q = focus ? 0 : p;
    const lift = focus && p >= LAUNCH, rocketAt = [rocket.position.x, rocket.position.z];
    const celebrate = (focus && p > 0.93) || (!focus && q < 0.2), sitDown = !focus && q >= 0.2;
    // técnicos: revisan el cohete dando vueltas; al despegar miran hacia arriba
    techs.forEach((a, k) => {
      const ang = t * 0.35 + k * Math.PI; let pose = {}, tx = Math.cos(ang) * 1.25, tz = Math.sin(ang) * 1.25;
      if (lift || !focus) { tx = [0.9, -0.9][k]; tz = -1.2; pose = { lookUp: 1 }; }
      if (lift && p < 0.12) pose = { lookUp: 1, cheer: 1 };
      if (celebrate) pose = { cheer: 1, lookUp: 0 };
      if (sitDown) { pose = { sit: 1, lookUp: 1 }; tx = [-0.6, 0.6][k]; tz = -1.6; }
      walkTo(a, tx, tz, dt, t, pose, [0, 0], opts);
    });
    // astronauta: camina hasta el cohete, se despide y sube a bordo
    if (focus) {
      astro.root.visible = p < 0.05;
      if (astro.root.visible) { const near = Math.hypot(astro.root.position.x - SIDE[0], astro.root.position.z - SIDE[1]) < 0.3; walkTo(astro, SIDE[0], SIDE[1], dt, t, near ? { wave: 1 } : {}, rocketAt, opts); }
      if (p < 0.02) astro.landed = false;
    } else {   // vuelve de la misión y se une a la celebración
      astro.root.visible = true;
      if (!astro.landed) { astro.landed = true; placeA(astro, 0.4, 1.1); }
      walkTo(astro, sitDown ? 0.2 : 0.4, sitDown ? -1.7 : 1.1, dt, t, sitDown ? { sit: 1, lookUp: 1 } : { cheer: celebrate ? 1 : 0 }, [0, 0], opts);
    }
    // control de misión: trabaja en la consola, hace la cuenta atrás y celebra la llegada
    const cp = focus && p < LAUNCH ? (p > LAUNCH - 0.015 ? { cheer: 1 } : { steer: 1 }) : celebrate ? { cheer: 1 } : sitDown ? { sit: 1, lookUp: 1 } : focus && p < 0.12 ? { cheer: 1 } : { steer: 1 };
    walkTo(ctrl, sitDown ? -1.0 : CTRL_AT[0], sitDown ? -1.5 : CTRL_AT[1], dt, t, cp, sitDown ? [0, 0] : [desk.position.x, desk.position.z], opts);
    if (sPrev === 'focus' && !focus) { conf.burst(0.0, 1.8, 0.4); sPrev = 'break'; }
    if (focus && p < 0.5) sPrev = 'focus';
    conf.update(dt, t);
  };

  const slots = []; for (let i = 0; i < 40; i++) slots.push({ r: 2.3 + (i % 5) * 0.6, y: 1.4 + (i % 7) * 0.75 });
  const sats = [];
  const S0 = new THREE.Vector3(0, 0.22, 0), E0 = PLANET.clone().add(new THREE.Vector3(2.8, -0.3, 2.8));
  const path = (p, out) => { const e = THREE.MathUtils.smootherstep(p, 0, 1), w = Math.sin(Math.PI * p) * 0.6; return out.lerpVectors(S0, E0, e).add(new THREE.Vector3(Math.cos(p * 14) * w, 0, Math.sin(p * 14) * w)); };
  const UP = new THREE.Vector3(0, 1, 0), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), dir = new THREE.Vector3();
  let brk0 = 0, prev = 'focus', roverA = 0;
  return { group: g, unlock, startFocus() { trailP.length = 0; resetStory(); },
    reward(i, animate) {
      const s = makeSatHD(i), u = slots[i % slots.length]; s.userData.o = { r: u.r, y: u.y, ph: i * 1.3, sp: 0.2 + (i % 4) * 0.05, i };
      s.scale.setScalar(0.7); g.add(s); sats.push(s); if (animate) pop(s, 0.7);
    },
    update({ p, mode, night, t, dt }) {
      const focus = mode === 'focus';
      if (!focus && prev === 'focus') brk0 = t; prev = mode;
      planetG.rotation.y += dt * 0.08; moonM.position.set(Math.cos(t * 0.35) * 3.4, Math.sin(t * 0.35) * 0.5, Math.sin(t * 0.35) * 3.4);
      let launching = false;
      if (focus) {
        const pp = clamp01((p - LAUNCH) / (1 - LAUNCH)); path(pp, P1); path(Math.min(1, pp + 0.01), P2); dir.subVectors(P2, P1).normalize().lerp(UP, 1 - THREE.MathUtils.smoothstep(pp, 0, 0.1)).normalize(); rocket.position.copy(P1); launching = p > LAUNCH + 0.002;
      } else {
        const a = Math.PI / 4 + (t - brk0) * 0.5; P1.set(PLANET.x + Math.cos(a) * 3.96, PLANET.y - 0.3, PLANET.z + Math.sin(a) * 3.96); rocket.position.copy(P1); dir.set(-Math.sin(a), 0.1, Math.cos(a)).normalize();
      }
      rocket.quaternion.setFromUnitVectors(UP, dir);
      if (!focus || p < 0.0005) rocket.position.y = Math.max(rocket.position.y, focus ? 0.22 : 0);
      rk.flames.forEach((f, i) => { f.visible = launching; const k = 0.8 + Math.sin(t * 30 + i * 2) * 0.18; f.scale.set(k, k * (1.1 + i * 0.1), k); });
      rk.light.intensity = launching ? 12 + Math.sin(t * 40) * 3 : 0;
      glowMats.forEach(m => m.emissiveIntensity = 0.12 + night * 1.6);
      // estela
      trailT += dt; if (launching && trailT > 0.05) { trailT = 0; trailP.unshift({ x: P1.x - dir.x * 0.5, y: P1.y - dir.y * 0.5, z: P1.z - dir.z * 0.5, age: 0 }); if (trailP.length > TL) trailP.pop(); }
      for (let i = 0; i < TL; i++) { const q = trailP[i]; if (q) { q.age += dt; const k = clamp01(1 - q.age / 2.2); tp.set([q.x + Math.sin(q.age * 5 + i) * 0.05, q.y, q.z], i * 3); const c = new THREE.Color(0xff8a2a).lerp(new THREE.Color(0x553322), 1 - k).multiplyScalar(k); tc.set([c.r, c.g, c.b], i * 3); } else { tp.set([0, -50, 0], i * 3); tc.set([0, 0, 0], i * 3); } }
      tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true;
      // humo en la plataforma durante el despegue
      const pu = focus ? 1 - sstep(0.0, 1.0, clamp01((p - LAUNCH) / 0.07)) : 0; smoke.material.opacity = 0.55 * pu * (p > LAUNCH ? 1 : 0.0);
      smd.forEach((s, i) => { s.life = (s.life + dt * 0.4) % 1; const u = s.life; smp[i * 3] = Math.cos(s.a) * (0.3 + u * 1.3); smp[i * 3 + 1] = 0.2 + u * 0.5; smp[i * 3 + 2] = Math.sin(s.a) * (0.3 + u * 1.3); }); smg.attributes.position.needsUpdate = true;
      // vida del asteroide
      gantry.userData.beacon.visible = Math.sin(t * 4) > 0; baseO.led.visible = Math.sin(t * 3 + 1) > 0; baseO.light.intensity = night * 3 + 1; flagM.geometry.attributes.position.needsUpdate = true;
      const fp = flagM.geometry.attributes.position; for (let i = 0; i < fp.count; i++) { const x = fp.getX(i) + 0.2; fp.setZ(i, Math.sin(x * 14 - t * 5) * 0.03 * x * 2.5); }
      roverA += dt * 0.25; const rr = 2.9; rover.position.set(Math.cos(roverA) * rr, spaceH(Math.cos(roverA) * rr, Math.sin(roverA) * rr) + 0.09, Math.sin(roverA) * rr); rover.rotation.y = -roverA - Math.PI / 2; rover.userData.wheels.forEach(w => w.rotation.z -= dt * 3);
      crystalLights.forEach((l, i) => l.intensity = 2.0 + Math.sin(t * 1.4 + i) * 0.5);
      ufo.position.y = 2.9 + Math.sin(t * 1.4) * 0.18; ufo.rotation.y += dt * 0.8; ufo.userData.lights.forEach((l, i) => l.visible = Math.sin(t * 6 + i * 0.8) > -0.3); ufo.userData.beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.04;
      story(p, focus, t, dt);
      sats.forEach(s => { const u = s.userData.o, a = u.ph + t * u.sp; s.position.set(Math.cos(a) * u.r, u.y + Math.sin(a * 2) * 0.1, Math.sin(a) * u.r); s.rotation.y = -a; s.userData.led.visible = Math.sin(t * 5 + u.i) > 0; });
      shootT -= dt; if (shootT < 0) { shoot.userData.u = 0; shootT = 5 + Math.random() * 6; shoot.userData.y = 10 + Math.random() * 8; shoot.userData.x = -20 - Math.random() * 10; }
      if (shoot.userData.u !== undefined && shoot.userData.u <= 1) { const u = (shoot.userData.u += dt * 1.1); shoot.position.set(shoot.userData.x + u * 30, shoot.userData.y - u * 8, -30); shoot.rotation.z = -0.25; shoot.material.opacity = Math.sin(clamp01(u) * Math.PI) * 0.9 * night; }
    } };
}
