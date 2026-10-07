/** Mundo 2 — Granja: el granjero siembra, riega y cosecha. */
import * as THREE from 'three';
import { buildIsland, edgeR } from '../lib/island.js';
import { clamp01, fbm, lerp, mulberry, sstep, vnoise } from '../lib/math.js';
import { makeCampHD } from '../lib/props.js';
import { blobShadow, dotTex, groundTex, plankTex, rockTex, shingleTex } from '../lib/textures.js';
import { makeUnlocker, pop, shade } from '../lib/three-utils.js';
import { makeBlob, makeFlowers, makeGrass, makeRock, makeTreeHD } from '../lib/vegetation.js';

/** Datos del mundo: nombre, costo en monedas, cielo, cámara y textos de cada etapa. */
export const meta = { id: 'farm', name: 'Granja', emoji: '🌾', cost: 30, rewardLabel: 'Cosechas', doneMsg: '🌾 ¡Cosecha lista!',
    desc: 'Un granjero siembra y riega su campo hasta la cosecha. Cada pomodoro deja un fardo de heno.', milestones: ['Granero', 'Molino de viento'],
    sky: { dawn: 0xf9c08a, day: 0x9ad9ff, dusk: 0xf0a860, night: 0x10152c }, clouds: true, cam: { R: 12.5, h: 6.6, look: -0.3 },
    focus: ['Preparando la tierra 🚜', 'Sembrando semillas 🌱', 'Brotan los cultivos 🌿', 'Hay que regar 💧', '¡Casi listo para cosechar! 🌾'],
    rest: ['Anochece en la granja 🌙', 'Descansa junto al fuego 🔥', 'Cuenta las estrellas ✨'] };

/* ═════════════════════ MUNDO 2: Granja (HD) ═════════════════════ */
const FARM = { barn: [-3.2, -2.3], mill: [3.3, -2.4], camp: [3.0, 2.7] };

const FARM_PATH = [[-2.9, -1.3], [-2.55, 0.0], [-2.1, 1.9], [0, 2.3], [2.2, 2.45]];

const pathDist = (path, x, z) => {
  let best = 9;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1], dx = bx - ax, dz = bz - az, t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
};

const farmPathD = (x, z) => pathDist(FARM_PATH, x, z);

const inField = (x, z, m = 0) => Math.abs(x) < 2.55 + m && Math.abs(z) < 1.7 + m;

function farmH(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.3 + 3.7, z * 0.3 + 8.1) - 0.5) * 0.6 + (fbm(x * 1.2 + 2, z * 1.2) - 0.5) * 0.1;
  const flat = (cx, cz, r0, r1, v) => { const k = 1 - sstep(r0, r1, Math.hypot(x - cx, z - cz)); h = h * (1 - k) + v * k; };
  const bd = Math.max(Math.abs(x) - 2.5, Math.abs(z) - 1.7), kf = 1 - sstep(0, 1.0, bd); h = h * (1 - kf) + 0.05 * kf;
  flat(...FARM.barn, 1.4, 2.4, 0.06); flat(...FARM.mill, 0.9, 1.9, 0.32); flat(...FARM.camp, 0.8, 1.6, 0.05);
  return h - 0.28 * sstep(3.9, 5, r);
}

function farmColor(x, z, h, rad, c, c2) {
  const n = fbm(x * 1.3 + 4, z * 1.3);
  c.setHex(0x86c95a).lerp(c2.setHex(0xaad65f), sstep(0.35, 0.75, n)).lerp(c2.setHex(0x6fb54d), sstep(0.5, 0.25, n) * 0.6);
  const bd = Math.max(Math.abs(x) - 2.3, Math.abs(z) - 1.5);
  const soil = 1 - sstep(-0.1, 0.35, bd);
  c.lerp(c2.setHex(0x5e4029).multiplyScalar(0.85 + 0.3 * vnoise(x * 6, z * 6)), soil);
  c.lerp(c2.setHex(0xc2a574), (1 - sstep(0.14, 0.36, farmPathD(x, z))) * 0.9 * (1 - soil));
  c.lerp(c2.setHex(0x8b6a43), sstep(4.3, 4.95, rad));
}

/* granjero */
function makeFarmer() {
  const root = new THREE.Group(), hips = new THREE.Group(); root.add(hips); hips.position.y = 0.5;
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1c9a0, roughness: 0.7 }), shirt = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.85 }),
    denim = new THREE.MeshStandardMaterial({ color: 0x2f5fb3, roughness: 0.9 }), straw = new THREE.MeshStandardMaterial({ color: 0xe3c26a, roughness: 0.9 }), boot = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.8 });
  const part = (geo, m, x, y, z) => { const o = shade(new THREE.Mesh(geo, m)); o.position.set(x, y, z); return o; };
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(part(new THREE.CapsuleGeometry(0.15, 0.24, 4, 10), shirt, 0, 0.28, 0), part(new THREE.CapsuleGeometry(0.152, 0.1, 4, 10), denim, 0, 0.12, 0));
  [-0.07, 0.07].forEach(x => torso.add(part(new THREE.BoxGeometry(0.035, 0.34, 0.035), denim, x, 0.33, 0.15)));
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  head.add(part(new THREE.SphereGeometry(0.14, 16, 12), skin, 0, 0, 0));
  [-0.05, 0.05].forEach(x => head.add(part(new THREE.SphereGeometry(0.018, 6, 5), new THREE.MeshBasicMaterial({ color: 0x222222 }), x, 0.02, 0.125)));
  head.add(part(new THREE.SphereGeometry(0.022, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe8a98a }), 0, -0.015, 0.14));
  head.add(part(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 20), straw, 0, 0.1, 0), part(new THREE.CylinderGeometry(0.15, 0.17, 0.13, 16), straw, 0, 0.17, 0), part(new THREE.TorusGeometry(0.16, 0.014, 6, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb33a2e }), 0, 0.125, 0));
  const arm = x => { const a = new THREE.Group(); a.position.set(x, 0.42, 0); a.add(part(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), shirt, 0, -0.13, 0), part(new THREE.SphereGeometry(0.052, 8, 6), skin, 0, -0.3, 0)); torso.add(a); return a; };
  const armL = arm(-0.2), armR = arm(0.2);
  const leg = x => { const l = new THREE.Group(); l.position.set(x, 0, 0); l.add(part(new THREE.CapsuleGeometry(0.065, 0.26, 4, 8), denim, 0, -0.2, 0), part(new THREE.BoxGeometry(0.12, 0.08, 0.2), boot, 0, -0.42, 0.04)); hips.add(l); return l; };
  const legL = leg(-0.08), legR = leg(0.08);
  // regadera
  const can = new THREE.Group(); can.position.set(0, -0.32, 0.02); armR.add(can);
  const metal = new THREE.MeshStandardMaterial({ color: 0x6f8fa8, metalness: 0.5, roughness: 0.4 });
  can.add(part(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 12), metal, 0.0, 0, 0.1));
  const spout = part(new THREE.CylinderGeometry(0.012, 0.025, 0.2, 6), metal, 0, 0.04, 0.22); spout.rotation.x = 1.0; can.add(spout);
  can.add(part(new THREE.TorusGeometry(0.05, 0.008, 5, 12), metal, 0, 0.07, 0.03)); can.visible = false;
  const DR = 14, dg = new THREE.BufferGeometry(), dp = new Float32Array(DR * 3);
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dm = new THREE.PointsMaterial({ map: dotTex, color: 0x9fd8ff, size: 0.07, transparent: true, depthWrite: false, opacity: 0 });
  const drops = new THREE.Points(dg, dm); drops.frustumCulled = false; root.add(drops);
  const life = Array.from({ length: DR }, (_, i) => i / DR); let phase = 0;
  return { root, update(dt, t, { walk, bend, water, sit }) {
    phase += dt * (3 + walk * 7);
    const w = clamp01(walk);
    legL.rotation.x = Math.sin(phase) * 0.7 * w * (1 - sit) - 1.35 * sit; legR.rotation.x = -Math.sin(phase) * 0.7 * w * (1 - sit) - 1.35 * sit;
    hips.position.y = 0.5 - sit * 0.3 + Math.abs(Math.sin(phase)) * 0.035 * w;
    torso.rotation.x = bend * 0.95 - sit * 0.1;
    head.rotation.x = -bend * 0.5 + Math.sin(t * 0.8) * 0.04;
    const plant = Math.sin(t * 7) * 0.35 * bend;
    armL.rotation.x = -Math.sin(phase) * 0.6 * w - bend * 0.9 + plant - sit * 0.5 - water * 0.2;
    armR.rotation.x = Math.sin(phase) * 0.6 * w - bend * 0.9 - plant - sit * 0.5 - water * 1.15;
    can.visible = water > 0.05; can.rotation.x = water * 0.55 + Math.sin(t * 2) * 0.05 * water;
    dm.opacity = water > 0.3 ? 0.8 : 0;
    life.forEach((u, i) => { life[i] = (u + dt * 1.3) % 1; const k = life[i]; dp[i * 3] = 0.2 + Math.sin(i * 2.1) * 0.03; dp[i * 3 + 1] = 0.62 - k * k * 0.62 + (1 - k) * 0.05; dp[i * 3 + 2] = 0.52 + k * 0.28; });
    dg.attributes.position.needsUpdate = true;
  } };
}

function makeHen(seed) {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: seed % 2 ? 0xf5efe0 : 0xb8693a, roughness: 0.9 }), red = new THREE.MeshStandardMaterial({ color: 0xd8372a }), beak = new THREE.MeshStandardMaterial({ color: 0xf0b030 });
  const body = shade(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), white)); body.scale.set(1, 0.85, 1.25); body.position.y = 0.16; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.27, 0.12); g.add(head);
  const hb = shade(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), white));
  const bk = shade(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 5), beak)); bk.position.set(0, -0.005, 0.06); bk.rotation.x = Math.PI / 2;
  const comb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), red); comb.position.set(0, 0.05, 0.01);
  head.add(hb, bk, comb);
  const tail = shade(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), white)); tail.position.set(0, 0.22, -0.14); tail.rotation.x = -0.9; g.add(tail);
  [-0.035, 0.035].forEach(x => { const l = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 4), beak)); l.position.set(x, 0.045, 0.01); g.add(l); });
  g.add(blobShadow(0.16, 0.4));
  return { g, head, body };
}

/* granero + silo, molino, espantapájaros */
function makeBarnHD(glowMats) {
  const g = new THREE.Group();
  const redWood = new THREE.MeshStandardMaterial({ map: plankTex, color: 0xd8604f, roughness: 0.9 }), white = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.8 }),
    roofM = new THREE.MeshStandardMaterial({ map: shingleTex, color: 0x9aa0ad, roughness: 0.8 }), stone = new THREE.MeshStandardMaterial({ color: 0x9c9fa6, map: rockTex, bumpMap: rockTex, bumpScale: 3, roughness: 0.95 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa84a, emissiveIntensity: 0.15 }); glowMats.push(glow);
  const box = (w, h, d, m, x, y, z) => { const b = shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); b.position.set(x, y, z); g.add(b); return b; };
  box(2.3, 0.2, 1.9, stone, 0, 0.08, 0); box(2.0, 1.2, 1.6, redWood, 0, 0.78, 0);
  [[-1.02, 0.82], [1.02, 0.82], [-1.02, -0.82], [1.02, -0.82]].forEach(([x, z]) => box(0.09, 1.22, 0.09, white, x, 0.78, z));
  const ang = 0.55, rise = Math.tan(ang) * 0.85;
  [1, -1].forEach(s => { const sl = box(2.4, 0.09, 1.15, roofM, 0, 1.38 + rise / 2 + 0.03, s * 0.52); sl.rotation.x = s * ang; });
  box(2.44, 0.1, 0.14, white, 0, 1.38 + rise + 0.08, 0);
  [1, -1].forEach(s => { const sh = new THREE.Shape(); sh.moveTo(-1, 0); sh.lineTo(1, 0); sh.lineTo(0, rise + 0.02); const t = shade(new THREE.Mesh(new THREE.ShapeGeometry(sh), redWood)); t.position.set(0, 1.38, s * 0.8); if (s < 0) t.rotation.y = Math.PI; g.add(t); });
  // puertón con cruces blancas
  [-0.28, 0.28].forEach(x => { box(0.52, 0.85, 0.05, new THREE.MeshStandardMaterial({ color: 0xb23a2e, roughness: 0.8 }), x, 0.58, 0.83); [0.5, -0.5].forEach(a => { const d = box(0.04, 1.0, 0.03, white, x, 0.58, 0.86); d.rotation.z = a; }); box(0.56, 0.04, 0.04, white, x, 1.01, 0.86); box(0.56, 0.04, 0.04, white, x, 0.15, 0.86); });
  const loft = box(0.5, 0.4, 0.05, glow, 0, 1.4, 0.83); box(0.56, 0.05, 0.06, white, 0, 1.62, 0.84); box(0.56, 0.05, 0.06, white, 0, 1.18, 0.84);
  for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), new THREE.MeshStandardMaterial({ color: 0xe3b94d })); h.position.set(-0.2 + i * 0.08, 1.18, 0.9); h.rotation.set(0.9, 0, (i - 3) * 0.2); g.add(h); }
  // veleta
  const vane = new THREE.Group(); vane.position.set(0, 1.38 + rise + 0.12, 0); g.add(vane);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 5), white); pole.position.y = 0.2; vane.add(pole);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x333a44 })); arrow.rotation.z = -Math.PI / 2; arrow.position.set(0.12, 0.38, 0); vane.add(arrow);
  // silo
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.55, roughness: 0.45 });
  const silo = new THREE.Group(); silo.position.set(1.55, 0, -0.3); g.add(silo);
  silo.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.1, 20).translate(0, 1.05, 0), metal)), shade(new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, 6.283, 0, 1.57).translate(0, 2.1, 0), metal)));
  [0.5, 1.0, 1.5].forEach(y => { const b = new THREE.Mesh(new THREE.TorusGeometry(0.465, 0.012, 5, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x59606b })); b.position.y = y; silo.add(b); });
  const lamp = new THREE.PointLight(0xffb85c, 0, 6); lamp.position.set(0, 1.0, 1.6); g.add(lamp);
  g.add(blobShadow(2.2, 0.5));
  return { group: g, vane, lamp };
}

function makeMillHD() {
  const g = new THREE.Group();
  const plaster = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, map: groundTex, bumpMap: groundTex, bumpScale: 1.5, roughness: 0.95 }), wood = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }),
    stone = new THREE.MeshStandardMaterial({ color: 0x9c9fa6, map: rockTex, bumpMap: rockTex, bumpScale: 3, roughness: 0.95 }), darkw = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.8, 0.28, 18).translate(0, 0.1, 0), stone)));
  g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.62, 2.0, 18).translate(0, 1.25, 0), plaster)));
  g.add(shade(new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.8, 18).translate(0, 2.65, 0), new THREE.MeshStandardMaterial({ map: shingleTex, color: 0xb7835a, roughness: 0.85 }))));
  const door = shade(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.45, 0.06), darkw)); door.position.set(0, 0.5, 0.62); g.add(door);
  const arch = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI), darkw)); arch.position.set(0, 0.72, 0.62); g.add(arch);
  [[0, 1.4, 0.5], [0.3, 1.85, 0.3]].forEach(([x, y, z], i) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa84a, emissiveIntensity: 0.1 })); w.position.set(i ? x : 0, y, i ? 0.4 : 0.5); w.rotation.y = i ? 0.6 : 0; g.add(w); });
  const hub = new THREE.Group(); hub.position.set(0, 2.15, 0.62); g.add(hub);
  hub.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 10).rotateX(Math.PI / 2), darkw)));
  const sails = new THREE.Group(); sails.position.z = 0.1; hub.add(sails);
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf6f0e0, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Group(); a.rotation.z = i * Math.PI / 2; sails.add(a);
    const spar = shade(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.7, 0.04), darkw)); spar.position.y = 0.85; a.add(spar);
    const sail = shade(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.2), cloth)); sail.position.set(0.19, 0.95, 0.01); a.add(sail);
    for (let k = 0; k < 6; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.03), darkw); bar.position.set(0.19, 0.4 + k * 0.2, 0.02); a.add(bar); }
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.03), darkw); edge.position.set(0.37, 0.95, 0.02); a.add(edge);
  }
  g.add(blobShadow(1.3, 0.5));
  return { group: g, sails };
}

function makeScarecrow() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1 }), burlap = new THREE.MeshStandardMaterial({ color: 0xcdb27a, roughness: 1 });
  const post = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.3, 6).translate(0, 0.65, 0), wood)); g.add(post);
  const bar = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6).rotateZ(Math.PI / 2).translate(0, 0.95, 0), wood)); g.add(bar);
  const shirt = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.26, 4, 8), new THREE.MeshStandardMaterial({ color: 0x3c6fb4, roughness: 1 }))); shirt.position.y = 0.88; g.add(shirt);
  const head = shade(new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), burlap)); head.position.y = 1.2; g.add(head);
  [-0.04, 0.04].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0x222222 })); e.position.set(x, 1.22, 0.1); g.add(e); });
  const hat = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 1 }))); hat.position.y = 1.3; g.add(hat);
  const crown = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 1 }))); crown.position.y = 1.38; g.add(crown);
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 3), new THREE.MeshStandardMaterial({ color: 0xe3b94d })); s.position.set((i < 4 ? -1 : 1) * 0.47, 0.93 - (i % 4) * 0.015, (i % 4 - 1.5) * 0.015); s.rotation.z = Math.PI / 2; g.add(s); }
  g.add(blobShadow(0.4, 0.4));
  return g;
}

const hayMat = () => new THREE.MeshStandardMaterial({ color: 0xe3b94d, map: groundTex, bumpMap: groundTex, bumpScale: 2, roughness: 0.95 });

function makeFarmReward(i) {
  const g = new THREE.Group(), k = i % 3;
  if (k === 0) {                          // paca redonda
    const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 20).rotateZ(Math.PI / 2).translate(0, 0.3, 0), hayMat())); g.add(b);
    [-0.12, 0.12].forEach(x => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.302, 0.012, 5, 24).rotateY(Math.PI / 2).translate(x, 0.3, 0), new THREE.MeshStandardMaterial({ color: 0x6a5a3a })); g.add(r); });
  } else if (k === 1) {                   // pajar
    g.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.45, 14).translate(0, 0.22, 0), hayMat())), shade(new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.4, 14).translate(0, 0.65, 0), hayMat())));
  } else {                                // calabazas
    const pm = new THREE.MeshStandardMaterial({ color: 0xf08a24, roughness: 0.6 });
    [[0, 0, 0, 0.17], [0.28, 0, 0.1, 0.12], [-0.2, 0, 0.22, 0.1]].forEach(([x, _, z, r], n) => {
      const geo = new THREE.SphereGeometry(r, 18, 12); const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) { const a = Math.atan2(p.getZ(v), p.getX(v)); const f = 1 + 0.08 * Math.cos(a * 10); p.setX(v, p.getX(v) * f); p.setZ(v, p.getZ(v) * f); }
      geo.computeVertexNormals(); const pu = shade(new THREE.Mesh(geo, pm)); pu.scale.y = 0.78; pu.position.set(x, r * 0.78, z); g.add(pu);
      const st = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.07, 5), new THREE.MeshStandardMaterial({ color: 0x4f7a2a }))); st.position.set(x, r * 1.5, z); g.add(st);
    });
  }
  g.add(blobShadow(0.45, 0.4));
  return g;
}

export function buildFarm() {
  const g = new THREE.Group(), rnd = mulberry(31);
  g.add(buildIsland(farmH, farmColor));
  const avoidC = [[...FARM.barn, 1.9], [...FARM.mill, 1.3], [...FARM.camp, 0.9]];
  const skipField = (x, z) => inField(x, z, 0.05);
  g.add(makeGrass(8000, avoidC, { H: farmH, pathD: farmPathD, skip: skipField, cols: [0x7fbd45, 0x95cf52, 0xa8d85f, 0x6aa83c, 0xc4dc6a] }));
  g.add(makeFlowers(110, avoidC, { H: farmH, pathD: farmPathD, skip: skipField, pal: [0xffffff, 0xffe066, 0xffd24a, 0xff9ec2, 0xb69cff] }));
  const place = (o, x, z, dy = 0) => { o.position.set(x, farmH(x, z) + dy, z); g.add(o); return o; };

  // surcos de tierra
  const soilM = new THREE.MeshStandardMaterial({ color: 0x5a3d26, map: groundTex, bumpMap: groundTex, bumpScale: 4, roughness: 1 });
  [-0.9, 0, 0.9].forEach(z => { const r = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 4.3, 12).rotateZ(Math.PI / 2), soilM)); r.scale.y = 0.32; r.position.set(0, 0.06, z); g.add(r); });

  // trigo (instanciado): 3 filas × 8 matas × 8 tallos
  const NC = 24, NS = 8, cl = [];
  for (let row = 0; row < 3; row++) for (let c = 0; c < 8; c++) { const col = row % 2 ? 7 - c : c; cl.push({ cx: -1.75 + col * 0.5, cz: -0.9 + row * 0.9 }); }
  const stalkGeo = new THREE.CylinderGeometry(0.005, 0.012, 1, 4).translate(0, 0.5, 0), headGeo = new THREE.SphereGeometry(0.03, 6, 5);
  const stalks = new THREE.InstancedMesh(stalkGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), NC * NS), heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), NC * NS);
  stalks.castShadow = heads.castShadow = true; stalks.frustumCulled = heads.frustumCulled = false;
  const sp = cl.map(() => Array.from({ length: NS }, () => ({ dx: (rnd() - 0.5) * 0.3, dz: (rnd() - 0.5) * 0.22, lx: (rnd() - 0.5) * 0.35, lz: (rnd() - 0.5) * 0.35, h: 0.5 + rnd() * 0.3, ph: rnd() * 6.28 })));
  const gG = new THREE.Color(0x6fb04a), gY = new THREE.Color(0xe2b84a), hG = new THREE.Color(0x9ac05a), hY = new THREE.Color(0xd9a82e), tc = new THREE.Color();
  const o1 = new THREE.Object3D(), o2 = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  g.add(stalks, heads);

  // valla alrededor del campo
  const woodF = new THREE.MeshStandardMaterial({ map: plankTex, color: 0xc9a074, roughness: 0.95 });
  const perim = []; const hx = 2.62, hz = 1.78;
  for (let x = -hx; x <= hx + 0.01; x += 0.655) { perim.push([x, -hz]); perim.push([x, hz]); }
  for (let z = -hz + 0.6; z < hz - 0.01; z += 0.59) { perim.push([-hx, z]); perim.push([hx, z]); }
  const posts = perim.filter(([x, z]) => farmPathD(x, z) > 0.42);
  posts.forEach(([x, z]) => { const p = shade(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), woodF)); p.position.set(x, farmH(x, z) + 0.2, z); g.add(p); });
  const rail = (x1, z1, x2, z2) => { if (farmPathD((x1 + x2) / 2, (z1 + z2) / 2) < 0.4) return; const len = Math.hypot(x2 - x1, z2 - z1); [0.22, 0.38].forEach(y => { const r = shade(new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.03), woodF)); r.position.set((x1 + x2) / 2, farmH((x1 + x2) / 2, (z1 + z2) / 2) + y, (z1 + z2) / 2); r.rotation.y = -Math.atan2(z2 - z1, x2 - x1); g.add(r); }); };
  for (let x = -hx; x < hx - 0.01; x += 0.655) { rail(x, -hz, Math.min(x + 0.655, hx), -hz); rail(x, hz, Math.min(x + 0.655, hx), hz); }
  for (let z = -hz; z < hz - 0.01; z += 0.59) { rail(-hx, z, -hx, Math.min(z + 0.59, hz)); rail(hx, z, hx, Math.min(z + 0.59, hz)); }

  const scare = place(makeScarecrow(), 2.0, -1.45, 0.05); scare.rotation.y = -0.5;

  // árboles, arbustos, rocas
  [[-3.9, 0.9, 1, 3], [-3.4, 3.0, 2, 4], [0.9, -3.95, 1, 5], [4.0, 0.5, 2, 6]].forEach(([x, z, type, seed]) => { const t = makeTreeHD(type, seed); t.scale.setScalar(0.85); t.rotation.y = seed; place(t, x, z, -0.03);
    if (type === 1 && seed === 3) for (let i = 0; i < 7; i++) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8372a, roughness: 0.4 })); const ang = i * 0.9 + 0.3; a.position.set(Math.cos(ang) * 0.75, 1.75 + Math.sin(i * 1.7) * 0.4, Math.sin(ang) * 0.75); t.add(a); } });
  [[-1.6, 3.5], [1.6, -3.4], [-4.1, -1.0], [3.9, 3.0]].forEach(([x, z], i) => { const b = new THREE.Group(); [[0, 0.22, 0, 0.32], [0.26, 0.17, 0.1, 0.24], [-0.22, 0.17, -0.08, 0.26]].forEach(([bx, by, bz, r], k) => { const m = makeBlob(r, 0x3f7a38, 0x93c85a, i * 5 + k, 0.2, 0.85); m.position.set(bx, by, bz); b.add(m); }); b.add(blobShadow(0.55, 0.4)); place(b, x, z, -0.02); });
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.4, rr = edgeR(a) - 0.3 - (i % 3) * 0.12; const r = makeRock(0.22 + (i % 4) * 0.08, i * 2.7); r.rotation.y = i; place(r, Math.cos(a) * rr, Math.sin(a) * rr); }

  // edificios
  const glowMats = [];
  const barnO = makeBarnHD(glowMats), barn = barnO.group; place(barn, FARM.barn[0], FARM.barn[1], 0.0); barn.rotation.y = 0.95;
  const millO = makeMillHD(), mill = millO.group; place(mill, FARM.mill[0], FARM.mill[1], 0.0); mill.rotation.y = -0.43;
  const camp = makeCampHD(); place(camp.group, FARM.camp[0], FARM.camp[1], 0.05);
    const unlock = makeUnlocker([[barn, 2], [mill, 3]]);

  // granjero + gallinas
  const farmer = makeFarmer(); farmer.root.position.set(-1.75, 0.05, -0.28); g.add(farmer.root);
  const hens = [0, 1, 2].map(i => { const h = makeHen(i); h.g.position.set(-1.6 + i * 0.4, 0, -3.0); h.t = new THREE.Vector3(-1.6 + i * 0.4, 0, -3.0); h.wait = rnd() * 2; h.pk = 0; g.add(h.g); return h; });
  const butter = [0xffa64a, 0xffffff].map((c, i) => { const b = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }), wl = new THREE.Group(), wr = new THREE.Group();
    wl.add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.13).rotateX(-Math.PI / 2).translate(0.08, 0, 0), m)); wr.add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.13).rotateX(-Math.PI / 2).translate(-0.08, 0, 0), m)); b.add(wl, wr); b.userData = { wl, wr, ph: i * 2.3 }; g.add(b); return b; });
  // luciérnagas
  const FF = 36, ffg = new THREE.BufferGeometry(), ffp = new Float32Array(FF * 3), ffb = [];
  for (let i = 0; i < FF; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 4.3, x = Math.cos(a) * r, z = Math.sin(a) * r; ffb.push({ x, z, y: farmH(x, z) + 0.4 + rnd() * 1.5, ph: rnd() * 6.283, sp: 0.4 + rnd() }); }
  ffg.setAttribute('position', new THREE.BufferAttribute(ffp, 3));
  const ffm = new THREE.PointsMaterial({ map: dotTex, color: 0xfff0a0, size: 0.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const fireflies = new THREE.Points(ffg, ffm); fireflies.frustumCulled = false; g.add(fireflies);

  // ranuras para recompensas
  const slots = [];
  for (let i = 0; slots.length < 90 && i < 700; i++) {
    const a = i * 2.39996, r = 1.5 + 0.42 * Math.sqrt(i); if (r > 4.15) continue;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inField(x, z, 0.45) || avoidC.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + 0.3) || farmPathD(x, z) < 0.45 || Math.hypot(x - 2.0, z + 1.45) < 0.5) continue;
    if (Math.hypot(x + 1.4, z + 3.0) < 1.1) continue;
    slots.push({ x, z });
  }
  const rewards = [];
  let faceYaw = Math.PI, curSit = 0, curBend = 0, curWater = 0;
  const tgt = new THREE.Vector3(), prev = new THREE.Vector3();
  return { group: g, unlock, startFocus() {},
    reward(i, animate) {
      const o = makeFarmReward(i), p = slots[i % slots.length];
      o.position.set(p.x, farmH(p.x, p.z), p.z); o.rotation.y = i * 1.3; g.add(o); rewards.push(o);
      animate ? pop(o, 1) : o.scale.setScalar(1);
    },
    update({ p, mode, night, t, dt }) {
      const focus = mode === 'focus', day = 1 - night;
      // trigo
      stalks.visible = heads.visible = focus;
      if (focus) {
        for (let r = 0; r < NC; r++) {
          const gr = clamp01((p - r / NC * 0.6) / 0.32), c = cl[r];
          for (let s = 0; s < NS; s++) {
            const q = sp[r][s], hgt = Math.max(0.001, q.h * gr), sway = Math.sin(t * 1.8 + q.ph + c.cx) * 0.07 * gr;
            o1.position.set(c.cx + q.dx, 0.1, c.cz + q.dz); o1.rotation.set(q.lx * gr, 0, q.lz * gr + sway); o1.scale.set(1, hgt, 1); o1.updateMatrix();
            const i = r * NS + s; stalks.setMatrixAt(i, o1.matrix);
            o2.position.set(0, hgt, 0).applyQuaternion(o1.quaternion).add(o1.position); o2.rotation.copy(o1.rotation); o2.scale.set(1, gr > 0.55 ? 2.4 * clamp01((gr - 0.55) * 3) : 0.001, 1); o2.updateMatrix(); heads.setMatrixAt(i, o2.matrix);
            stalks.setColorAt(i, tc.copy(gG).lerp(gY, gr * gr)); heads.setColorAt(i, tc.copy(hG).lerp(hY, gr * gr));
          }
        }
        stalks.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = stalks.instanceColor.needsUpdate = heads.instanceColor.needsUpdate = true;
      }
      // granjero
      let walkTarget = true, bend = 0, water = 0, sit = 0;
      if (!focus) { tgt.set(2.2, 0.05, 2.05); sit = 1; }
      else if (p < 0.62) { const r = Math.min(NC - 1, Math.floor(p / 0.62 * NC)); tgt.set(cl[r].cx, 0.05, cl[r].cz + 0.6); bend = 1; }
      else { const u = (p - 0.62) / 0.38; tgt.set(lerp(-1.9, 1.9, u), 0.05, 1.5); water = 1; }
      prev.copy(farmer.root.position);
      farmer.root.position.lerp(tgt, 1 - Math.exp(-dt * 2.2));
      const dist = farmer.root.position.distanceTo(tgt), speed = prev.distanceTo(farmer.root.position) / Math.max(dt, 1e-3);
      const moving = speed > 0.12;
      if (moving) faceYaw = Math.atan2(farmer.root.position.x - prev.x, farmer.root.position.z - prev.z);
      else if (sit) faceYaw = Math.atan2(FARM.camp[0] - farmer.root.position.x, FARM.camp[1] - farmer.root.position.z);
      else faceYaw = Math.PI;
      let dy = faceYaw - farmer.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); farmer.root.rotation.y += dy * Math.min(1, dt * 7);
      curBend += ((bend && dist < 0.12 ? 1 : 0) - curBend) * Math.min(1, dt * 6); curSit += (sit - curSit) * Math.min(1, dt * 3); curWater += (water - curWater) * Math.min(1, dt * 4);
      farmer.update(dt, t, { walk: moving ? Math.min(1, speed * 1.4) : 0, bend: curBend, water: curWater, sit: curSit });
      farmer.root.position.y = 0.05;
      camp.update(t, dt, night, focus ? 0 : 1);
      // gallinas
      hens.forEach((h, i) => {
        h.wait -= dt;
        if (h.wait < 0) { if (h.pk <= 0 && Math.random() < 0.5) { h.pk = 1.2 + Math.random(); h.wait = h.pk; } else { h.t.set(-1.4 + (Math.random() - 0.5) * 2.2, 0, -3.0 + (Math.random() - 0.5) * 1.4); h.wait = 2 + Math.random() * 3; h.pk = 0; } }
        else if (h.pk > 0) h.pk -= dt;
        const d = h.t.clone().sub(h.g.position); d.y = 0; const dl = d.length();
        if (dl > 0.05) { h.g.position.addScaledVector(d.normalize(), Math.min(dl, dt * 0.35)); h.g.rotation.y += (Math.atan2(d.x, d.z) - h.g.rotation.y) * Math.min(1, dt * 5); h.body.position.y = 0.16 + Math.abs(Math.sin(t * 12 + i)) * 0.01; h.head.rotation.x = Math.sin(t * 12 + i) * 0.12; }
        else { h.head.rotation.x = h.pk > 0 ? 0.9 + Math.sin(t * 14 + i) * 0.35 : Math.sin(t * 2 + i) * 0.1; }
        h.g.position.y = farmH(h.g.position.x, h.g.position.z);
      });
      butter.forEach((b, i) => { const u = b.userData, a = t * (0.5 + i * 0.15) + u.ph; b.visible = day > 0.4 && focus; b.position.set(Math.cos(a) * (1.4 + i), 0.9 + Math.sin(t * 2.1 + u.ph) * 0.15, Math.sin(a * 1.2) * (1.2 + i * 0.8)); b.rotation.y = -a + Math.PI; const f = 0.15 + 0.9 * Math.abs(Math.sin(t * 13 + u.ph)); u.wl.rotation.z = f; u.wr.rotation.z = -f; });
      // luz y ambiente
      glowMats.forEach(m => m.emissiveIntensity = 0.12 + night * 2.3);
      barnO.lamp.intensity = night * 4; barnO.vane.rotation.y = Math.sin(t * 0.4) * 0.8;
      millO.sails.rotation.z -= dt * (0.55 + Math.sin(t * 0.3) * 0.15);
      scare.rotation.z = Math.sin(t * 1.3) * 0.03;
      ffm.opacity = clamp01(night * 1.3); fireflies.visible = night > 0.05;
      ffb.forEach((f, i) => { ffp[i * 3] = f.x + Math.sin(t * f.sp + f.ph) * 0.45; ffp[i * 3 + 1] = f.y + Math.sin(t * f.sp * 0.7 + f.ph * 2) * 0.3; ffp[i * 3 + 2] = f.z + Math.cos(t * f.sp * 0.8 + f.ph) * 0.45; });
      ffg.attributes.position.needsUpdate = true;
    } };
}
