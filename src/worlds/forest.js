/** Mundo 1 — Bosque: un árbol crece mientras pasa el tiempo. */
import * as THREE from 'three';
import { buildIsland, edgeR } from '../lib/island.js';
import { clamp01, fbm, mulberry, sstep } from '../lib/math.js';
import { makeActor, walkTo } from '../lib/people.js';
import { makeConfetti, makeWaterDrops } from '../lib/effects.js';
import { makeBarrel, makeCampHD } from '../lib/props.js';
import { blobShadow, dotTex, groundTex, plankTex, rockTex, shingleTex, waterNormal } from '../lib/textures.js';
import { makeUnlocker, pop, shade } from '../lib/three-utils.js';
import { makeBlob, makeFlowers, makeGrass, makeMushroom, makeRock, makeTreeHD } from '../lib/vegetation.js';

/** Datos del mundo: nombre, costo en monedas, cielo, cámara y textos de cada etapa. */
export const meta = { id: 'forest', name: 'Bosque', emoji: '🌲', cost: 0, rewardLabel: 'Árboles', doneMsg: '🌳 ¡Árbol plantado!',
    desc: 'Un árbol crece mientras avanza el tiempo y se queda plantado en tu isla.', milestones: ['Cabaña', 'Estanque'],
    sky: { dawn: 0xf7b58f, day: 0x8ed1fc, dusk: 0xf2b36a, night: 0x0d1330 }, clouds: true, cam: { R: 12.5, h: 6.6, look: -0.2 },
    focus: ['Semilla bajo tierra 🌱', 'Brota un tallo 🌿', 'Crece el arbolito 🌲', 'Casi un árbol adulto 🌳', '¡Último empujón! ☀️'],
    rest: ['Cae la noche… 🌙', 'Calienta tus manos en la fogata 🔥', 'Mira las estrellas ✨'] };

/* ── terreno ── */
const F_CABIN = [-2.9, 2.3], F_POND = [2.8, -1.8], F_PATH = [[-2.15, 1.65], [-1.5, 1.05], [-0.85, 0.55], [-0.2, 0.1]];

function distToPath(x, z) {
  let best = 9;
  for (let i = 0; i < F_PATH.length - 1; i++) {
    const [ax, az] = F_PATH[i], [bx, bz] = F_PATH[i + 1], dx = bx - ax, dz = bz - az;
    const t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

function terrainH(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.32 + 7.3, z * 0.32 + 3.1) - 0.5) * 0.7 + (fbm(x * 1.1, z * 1.1) - 0.5) * 0.12;
  const flat = (cx, cz, r0, r1, v) => { const k = 1 - sstep(r0, r1, Math.hypot(x - cx, z - cz)); h = h * (1 - k) + v * k; };
  flat(0, 0, 0.9, 2.0, 0.04); flat(F_CABIN[0], F_CABIN[1], 1.1, 2.1, 0.06); flat(F_POND[0], F_POND[1], 0.4, 1.4, 0.0);
  { const dp = Math.hypot(x - F_POND[0], z - F_POND[1]); h -= 0.5 * Math.exp(-(dp * dp) / 1.1); }
  h -= 0.28 * sstep(3.9, 5, r);
  return h;
}

/* ── cabaña ── */
function makeCabinHD(glowMats) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x9c9fa6, map: rockTex, bumpMap: rockTex, bumpScale: 3, roughness: 0.95 });
  const roofM = new THREE.MeshStandardMaterial({ map: shingleTex, roughness: 0.85 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa84a, emissiveIntensity: 0.15, roughness: 0.3 }); glowMats.push(glow);
  const box = (w, h, d, m, x, y, z) => { const b = shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); b.position.set(x, y, z); g.add(b); return b; };
  box(2.1, 0.24, 1.7, stone, 0, 0.1, 0);
  box(1.8, 1.0, 1.4, wood, 0, 0.74, 0);
  [[-0.92, 0.7], [0.92, 0.7], [-0.92, -0.7], [0.92, -0.7]].forEach(([x, z]) => box(0.1, 1.04, 0.1, dark, x, 0.74, z));
  // tejado a dos aguas
  const ang = 0.6, half = 1.0, rise = Math.tan(ang) * 0.75;
  [[1, 1], [-1, -1]].forEach(([s]) => {
    const slab = box(2.3, 0.09, 1.0, roofM, 0, 1.55 + 0.02, s * 0.46); slab.rotation.x = s * ang;
  });
  box(2.34, 0.1, 0.12, dark, 0, 1.2 + rise + 0.07, 0);
  [1, -1].forEach(s => { const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0, rise + 0.02); const t = shade(new THREE.Mesh(new THREE.ShapeGeometry(sh), wood)); t.position.set(0, 1.24, s * 0.7); if (s < 0) t.rotation.y = Math.PI; g.add(t); });
  // chimenea
  box(0.32, 0.95, 0.32, stone, 0.55, 1.85, -0.25); box(0.4, 0.08, 0.4, dark, 0.55, 2.35, -0.25);
  // puerta + escalón
  box(0.5, 0.78, 0.07, dark, -0.3, 0.64, 0.72); box(0.4, 0.68, 0.05, new THREE.MeshStandardMaterial({ color: 0xa87444, roughness: 0.8 }), -0.3, 0.63, 0.75);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 0.8, roughness: 0.3 })); knob.position.set(-0.16, 0.62, 0.79); g.add(knob);
  box(0.7, 0.1, 0.35, stone, -0.3, 0.17, 0.95);
  // ventanas
  const win = (x, y, z, ry) => {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = ry;
    const f = shade(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.06), dark)), p = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.33, 0.05), glow); p.position.z = 0.015;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.025, 0.06), dark), b2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.33, 0.06), dark); b1.position.z = b2.position.z = 0.03;
    w.add(f, p, b1, b2); g.add(w); return w;
  };
  const w1 = win(0.45, 0.86, 0.72, 0); win(0.93, 0.86, 0.1, Math.PI / 2);
  const fbx = box(0.5, 0.1, 0.14, dark, 0.45, 0.58, 0.78);
  [0xff8fb1, 0xffe066, 0xffffff, 0xff7a59, 0xb69cff].forEach((h, i) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: h })); f.position.set(0.25 + i * 0.1, 0.66, 0.78); g.add(f); });
  // farol y leña
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow); lamp.position.set(-0.7, 1.0, 0.8); g.add(lamp);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), dark); hook.position.set(-0.7, 1.1, 0.8); g.add(hook);
  const lampLight = new THREE.PointLight(0xffb85c, 0, 5.5); lampLight.position.set(-0.4, 1.0, 1.1); g.add(lampLight);
  const winLight = new THREE.PointLight(0xffa84a, 0, 3.5); winLight.position.set(0.5, 0.9, 1.3); g.add(winLight);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { const l = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.9 }))); l.rotation.x = Math.PI / 2; l.rotation.z = 0.1; l.position.set(-1.25 - r * 0.0, 0.1 + r * 0.16, -0.2 + k * 0.19 + r * 0.095); l.rotation.set(0, 0, 0); l.rotation.x = Math.PI / 2; l.position.x = -1.2; g.add(l); }
  g.add(blobShadow(1.9, 0.5));
  return { group: g, lampLight, winLight, chimneyTop: new THREE.Vector3(0.55, 2.42, -0.25) };
}

const FOREST_GREENS = [0x5fa83e, 0x7bc24a, 0x4a8f35].map(h => new THREE.Color(h));
/** Color del suelo del bosque: pasto con manchas, sendero de tierra, orilla de arena y barro junto al estanque. */
function forestColor(x, z, h, rad, c, c2) {
  const G = FOREST_GREENS;
    const n = fbm(x * 1.4 + 20, z * 1.4);
    c.copy(G[0]).lerp(G[1], sstep(0.35, 0.7, n)).lerp(G[2], sstep(0.55, 0.3, n) * 0.6);
    c.lerp(c2.setHex(0xb99a6b), (1 - sstep(0.14, 0.36, distToPath(x, z))) * 0.9);
    const pd = Math.hypot(x - F_POND[0], z - F_POND[1]);
    c.lerp(c2.setHex(0xc9b27c), (1 - sstep(1.2, 1.7, pd)) * sstep(-0.35, 0.02, h) * 0.8);
    c.lerp(c2.setHex(0x4e3b29), (1 - sstep(-0.35, -0.12, h)) * (1 - sstep(0, 1.6, pd)));
}

/* ── mundo ── */
export function buildForest() {
  const g = new THREE.Group();
  const island = buildIsland(terrainH, forestColor); g.add(island);
  const avoid = [[F_CABIN[0], F_CABIN[1], 1.25], [F_POND[0], F_POND[1], 1.3]];
  g.add(makeGrass(9000, avoid, { H: terrainH, pathD: distToPath })); g.add(makeFlowers(130, avoid, { H: terrainH, pathD: distToPath }));
  const hT = (x, z) => terrainH(x, z);
  const place = (o, x, z, dy = 0) => { o.position.set(x, hT(x, z) + dy, z); g.add(o); return o; };

  // rocas del borde, arbustos y setas
  for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283 + 0.2, rr = edgeR(a) - 0.28 - (i % 3) * 0.15; const r = makeRock(0.22 + (i % 4) * 0.09, i * 3.3); r.rotation.y = i; place(r, Math.cos(a) * rr, Math.sin(a) * rr, 0.0); }
  const bushSpots = [[-1.2, -3.2], [3.4, 1.3], [-3.6, -0.4], [0.9, 3.5], [-0.4, -2.2], [3.9, -0.1], [1.9, 2.6]];
  bushSpots.forEach(([x, z], i) => { const b = new THREE.Group(); [[0, 0.22, 0, 0.32], [0.26, 0.17, 0.1, 0.24], [-0.22, 0.17, -0.08, 0.26]].forEach(([bx, by, bz, r], k) => { const m = makeBlob(r, 0x2d6e33, 0x7bbf4a, i * 5 + k, 0.2, 0.85); m.position.set(bx, by, bz); b.add(m); }); b.add(blobShadow(0.55, 0.4)); place(b, x, z, -0.02); });
  [[-1.0, -1.2, 0xd6403a], [1.6, 0.9, 0xe8a23a], [-2.5, -2.4, 0xd6403a], [2.2, 3.0, 0xc9a0ff], [0.6, -3.0, 0xd6403a], [-3.2, 0.9, 0xe8a23a]].forEach(([x, z, c], i) => { for (let k = 0; k < 3; k++) { const m = makeMushroom(0.8 + k * 0.35, c); place(m, x + k * 0.12 - 0.1, z + (k % 2) * 0.1, -0.01); m.rotation.y = i + k; } });

  // camino de piedras
  const stepping = new THREE.Group();
  F_PATH.forEach(([x, z], i) => { if (i) { const r = makeRock(0.13, 40 + i, false); r.scale.y = 0.35; place(r, x + 0.25, z - 0.2, -0.01); } });

  // árbol en crecimiento + montículo
  const growing = new THREE.Group(); place(growing, 0, 0, -0.02);
  const mound = shade(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8), new THREE.MeshStandardMaterial({ color: 0x5b3f28, roughness: 1, map: groundTex }))); mound.scale.y = 0.22; mound.position.y = -0.02; growing.add(mound);
  let gt = null;
  const camp = makeCampHD(); place(camp.group, 0, 0, 0.05);

  // cabaña
  const glowMats = [];
  const cab = makeCabinHD(glowMats), cabin = cab.group; place(cabin, F_CABIN[0], F_CABIN[1], 0.0); cabin.rotation.y = 2.24;
  const SM = 16, smg = new THREE.BufferGeometry(), smp = new Float32Array(SM * 3), smd = [];
  for (let i = 0; i < SM; i++) smd.push({ life: i / SM, ox: Math.random() * 6.283 });
  smg.setAttribute('position', new THREE.BufferAttribute(smp, 3));
  const smoke = new THREE.Points(smg, new THREE.PointsMaterial({ map: dotTex, color: 0xd8d8d8, size: 0.32, transparent: true, opacity: 0.35, depthWrite: false })); smoke.frustumCulled = false; cabin.add(smoke);

  // estanque
  const pond = new THREE.Group(); pond.position.set(F_POND[0], 0, F_POND[1]);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.75, 48), new THREE.MeshStandardMaterial({ color: 0x2f86b0, roughness: 0.05, metalness: 0.05, transparent: true, opacity: 0.82, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 2.2 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.08; water.receiveShadow = true; pond.add(water);
  const pads = [];
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.4, rr = 0.3 + (i % 3) * 0.35; const lp = new THREE.Mesh(new THREE.CircleGeometry(0.2 + (i % 2) * 0.06, 18, 0, 5.6), new THREE.MeshStandardMaterial({ color: 0x3f9a4a, roughness: 0.6, side: THREE.DoubleSide })); lp.rotation.x = -Math.PI / 2; lp.rotation.z = a; lp.position.set(Math.cos(a) * rr, -0.065, Math.sin(a) * rr); pond.add(lp); pads.push(lp);
    if (i % 3 === 0) { const lot = new THREE.Group(); for (let k = 0; k < 6; k++) { const pt = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), new THREE.MeshStandardMaterial({ color: 0xff9ec2, roughness: 0.5 })); pt.position.set(Math.cos(k * 1.05) * 0.06, 0.07, Math.sin(k * 1.05) * 0.06); pt.rotation.set(Math.sin(k * 1.05) * 0.7, 0, -Math.cos(k * 1.05) * 0.7); lot.add(pt); } lot.position.copy(lp.position); lot.position.y += 0.02; pond.add(lot); } }
  const reeds = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + 0.3, rr = 1.55 + (i % 3) * 0.12, gR = new THREE.Group(); const hh = 0.8 + (i % 4) * 0.15;
    for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, hh, 5).translate(0, hh / 2, 0), new THREE.MeshStandardMaterial({ color: 0x4f8f3a })); st.rotation.z = (k - 1) * 0.15; st.rotation.x = (k - 1) * 0.1; gR.add(st); if (k === 1 && i % 2 === 0) { const ct = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.17, 7), new THREE.MeshStandardMaterial({ color: 0x6b4423 })); ct.position.y = hh * 0.92; gR.add(ct); } }
    gR.position.set(Math.cos(a) * rr, hT(F_POND[0] + Math.cos(a) * rr, F_POND[1] + Math.sin(a) * rr) - 0.02, Math.sin(a) * rr); pond.add(gR); reeds.push(gR); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.5, rr = 1.7 + (i % 2) * 0.15, r = makeRock(0.2 + (i % 3) * 0.08, 70 + i); r.position.set(Math.cos(a) * rr, hT(F_POND[0] + Math.cos(a) * rr, F_POND[1] + Math.sin(a) * rr) + 0.0, Math.sin(a) * rr); r.rotation.y = i; pond.add(r); }
  const ripples = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.22, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(Math.cos(i * 2.2) * 0.6, -0.06, Math.sin(i * 2.2) * 0.6); pond.add(m); return m; });
  g.add(pond);
  const unlock = makeUnlocker([[cabin, 2], [pond, 3]]);

  // partículas: luciérnagas, hojas, mariposas
  const FF = 40, ffg = new THREE.BufferGeometry(), ffp = new Float32Array(FF * 3), ffb = [], rnd = mulberry(5);
  for (let i = 0; i < FF; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 4.2, x = Math.cos(a) * r, z = Math.sin(a) * r; ffb.push({ x, z, y: hT(x, z) + 0.4 + rnd() * 1.6, ph: rnd() * 6.283, sp: 0.4 + rnd() }); }
  ffg.setAttribute('position', new THREE.BufferAttribute(ffp, 3));
  const ffm = new THREE.PointsMaterial({ map: dotTex, color: 0xfff0a0, size: 0.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const fireflies = new THREE.Points(ffg, ffm); fireflies.frustumCulled = false; g.add(fireflies);
  const LF = 55, lg = new THREE.BufferGeometry(), lp3 = new Float32Array(LF * 3), lcol = new Float32Array(LF * 3), lv = [], lcs = [0x9bd053, 0xe8c04a, 0x7bbf4a, 0xffb3cb].map(h => new THREE.Color(h));
  for (let i = 0; i < LF; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 4.6; lv.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: rnd() * 6, v: 0.2 + rnd() * 0.25, ph: rnd() * 6.283 }); const c = lcs[i % 4]; lcol.set([c.r, c.g, c.b], i * 3); }
  lg.setAttribute('position', new THREE.BufferAttribute(lp3, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
  const lm = new THREE.PointsMaterial({ map: dotTex, vertexColors: true, size: 0.13, transparent: true, depthWrite: false, opacity: 0.9 });
  const leaves = new THREE.Points(lg, lm); leaves.frustumCulled = false; g.add(leaves);
  const flies = [];
  [0xffa64a, 0x6fb5ff, 0xff7aa8, 0xffe066].forEach((c, i) => {
    const b = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
    const wl = new THREE.Group(), wr = new THREE.Group();
    wl.add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.13).rotateX(-Math.PI / 2).translate(0.08, 0, 0), m));
    wr.add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.13).rotateX(-Math.PI / 2).translate(-0.08, 0, 0), m));
    b.add(wl, wr); b.userData = { wl, wr, cx: -1 + i * 1.3, cz: -1.5 + (i % 2) * 2.5, r: 0.9 + i * 0.3, sp: 0.5 + i * 0.12, ph: i * 1.7, h: 0.7 + i * 0.25 }; g.add(b); flies.push(b);
  });

  // ── historia: la guardabosques planta el arbolito, lo riega y lo celebra con una amiga ──
  const rainBarrel = makeBarrel(); rainBarrel.scale.setScalar(1.3); rainBarrel.rotation.y = 0.4; place(rainBarrel, -1.15, 1.55); avoid.push([-1.15, 1.55, 0.5]);
  const ranger = makeActor({ shirt: 0x3f7a3a, pants: 0x5a4632, hat: 'cap', capColor: 0x6b4a2e, scale: 0.68 });
  const friend = makeActor({ shirt: 0xf0c23a, pants: 0x3a5a8a, hair: 0x8a4a2a, scale: 0.52 });
  g.add(ranger.root, friend.root);
  const sapling = new THREE.Group();   // arbolito en maceta que lleva en brazos
  sapling.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 10).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ color: 0xb5603a, roughness: 0.9 }))));
  sapling.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.16, 5).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: 0x6b4a2e }))));
  [0, 2.1, 4.2].forEach(a => { const lf = shade(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x58b84a, roughness: 0.7 }))); lf.scale.y = 0.6; lf.position.set(Math.cos(a) * 0.05, 0.3, Math.sin(a) * 0.05); sapling.add(lf); });
  ranger.held.add(sapling);
  const conf = makeConfetti(g, 100, 0.1), drops = makeWaterDrops(g), dropO = new THREE.Vector3();
  const SPAWN = [-2.3, 1.85], STAND = [-0.62, 0.5], BARREL_AT = [-0.95, 1.25], WATERINGS = [[0.27, 0.4], [0.52, 0.64], [0.76, 0.88]];
  let storyPrev = 'focus', friendIn = false;
  const resetStory = () => { ranger.root.position.set(SPAWN[0], hT(SPAWN[0], SPAWN[1]) + 0.02, SPAWN[1]); ranger.root.rotation.y = 0.9; friend.root.visible = false; friendIn = false; };
  resetStory();
  const story = (p, focus, t, dt) => {
    const opts = { speed: 0.5, ground: hT }; let rt = STAND, rp = {}, pour = false;
    ranger.held.visible = false;
    if (!focus) { rt = [0.85, 0.25]; rp = { sit: 1 }; if (Math.sin(t * 0.7) > 0.8) rp.wave = 1; }
    else if (p < 0.07) { rp = { carry: 1 }; ranger.held.visible = true; }
    else if (p < 0.11) rp = { bend: 1 };
    else {
      const w = WATERINGS.find(([a, b]) => p >= a && p < b);
      if (w) {
        const u = (p - w[0]) / (w[1] - w[0]);
        if (u < 0.3) rt = BARREL_AT; else if (u < 0.42) { rt = BARREL_AT; rp = { bend: 1 }; } else if (u < 0.65) rp = { water: 0.15 }; else { rp = { water: 1 }; pour = true; }
      } else if (p >= 0.95) { rt = [-0.6, 0.4]; rp = { cheer: 1 }; }
      else if (p >= 0.88) { rt = [-0.75, 0.7]; rp = { wave: 1 }; }
      else rt = [-1.0, 0.95];
    }
    walkTo(ranger, rt[0], rt[1], dt, t, rp, [0, 0], opts);
    // la amiga llega al final y se une a la celebración; en el descanso se sientan juntas junto al fuego
    const showFriend = !focus || p >= 0.85;
    if (showFriend && !friendIn) { friendIn = true; friend.root.visible = true; if (focus) friend.root.position.set(SPAWN[0], hT(SPAWN[0], SPAWN[1]) + 0.02, SPAWN[1]); else friend.root.position.set(-0.6, hT(-0.6, -0.55) + 0.02, -0.55); }
    if (friend.root.visible) {
      let ft = [-0.95, 0.3], fp = {};
      if (!focus) { ft = [-0.6, -0.55]; fp = { sit: 1 }; } else if (p >= 0.95) fp = { cheer: 1 }; else fp = { wave: 1 };
      walkTo(friend, ft[0], ft[1], dt, t, fp, [0, 0], opts);
    }
    // agua y confeti
    const fx = Math.sin(ranger.root.rotation.y), fz = Math.cos(ranger.root.rotation.y);
    dropO.set(ranger.root.position.x + fx * 0.28, ranger.root.position.y + 0.42, ranger.root.position.z + fz * 0.28);
    drops.update(dt, pour, dropO, fx, fz, hT(dropO.x, dropO.z));
    if (storyPrev === 'focus' && !focus) { conf.burst(0, 1.5, 0); storyPrev = 'break'; }
    if (focus && p < 0.5) storyPrev = 'focus';
    conf.update(dt, t);
  };

  const slots = []; {
    for (let i = 0; slots.length < 90 && i < 700; i++) {
      const a = i * 2.39996, r = 1.7 + 0.42 * Math.sqrt(i); if (r > 4.15) continue;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + 0.4) || distToPath(x, z) < 0.5 || terrainH(x, z) < -0.05) continue;
      slots.push({ x, z });
    }
  }
  const trees = [];
  const smoothClamp = clamp01;
  return { group: g, unlock,
    startFocus(n) { if (gt) growing.remove(gt); gt = makeTreeHD(n % 3, n + 1); growing.add(gt); resetStory(); },
    reward(i, animate) {
      const t = makeTreeHD(i % 3, i + 1), p = slots[i % slots.length], k = 0.8 + ((i * 37) % 10) / 45;
      t.position.set(p.x, hT(p.x, p.z) - 0.03, p.z); t.rotation.y = i * 1.7; g.add(t); trees.push(t);
      animate ? pop(t, k) : t.scale.setScalar(k);
    },
    update({ p, mode, night, t, dt }) {
      const focus = mode === 'focus', day = 1 - night;
      growing.visible = focus;
      if (focus) { const s = 0.05 + 1.15 * THREE.MathUtils.smoothstep(p, 0, 1); gt.scale.setScalar(s); gt.rotation.z = Math.sin(t * 1.3) * 0.015 * s; mound.visible = p < 0.9; }
      camp.update(t, dt, night, focus ? 0 : 1);
      story(p, focus, t, dt);
      trees.forEach(tr => tr.rotation.z = Math.sin(t * 1.1 + tr.position.x) * 0.01);
      glowMats.forEach(m => m.emissiveIntensity = 0.12 + night * 2.4);
      cab.lampLight.intensity = night * 5; cab.winLight.intensity = night * 3.2;
      ffm.opacity = clamp01(night * 1.3); fireflies.visible = night > 0.05;
      ffb.forEach((f, i) => { ffp[i * 3] = f.x + Math.sin(t * f.sp + f.ph) * 0.45; ffp[i * 3 + 1] = f.y + Math.sin(t * f.sp * 0.7 + f.ph * 2) * 0.3; ffp[i * 3 + 2] = f.z + Math.cos(t * f.sp * 0.8 + f.ph) * 0.45; });
      ffg.attributes.position.needsUpdate = true;
      lm.opacity = 0.9 * day; leaves.visible = day > 0.05;
      lv.forEach((l, i) => { l.y -= l.v * dt; if (l.y < 0.1) { l.y = 5.5 + Math.random() * 2; } lp3[i * 3] = l.x + Math.sin(t * 0.8 + l.ph) * 0.6; lp3[i * 3 + 1] = l.y; lp3[i * 3 + 2] = l.z + Math.cos(t * 0.6 + l.ph) * 0.6; });
      lg.attributes.position.needsUpdate = true;
      flies.forEach(b => { const u = b.userData, a = u.ph + t * u.sp; b.visible = day > 0.4 && focus; b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 2.2 + u.ph) * 0.12, u.cz + Math.sin(a) * u.r); b.rotation.y = -a + Math.PI; const f = 0.15 + 0.9 * Math.abs(Math.sin(t * 13 + u.ph)); u.wl.rotation.z = f; u.wr.rotation.z = -f; });
      if (cabin.visible) { smd.forEach((s, i) => { s.life += dt * 0.18; if (s.life > 1) s.life = 0; const u = s.life; smp[i * 3] = cab.chimneyTop.x + Math.sin(s.ox + u * 3) * 0.1 + u * 0.35; smp[i * 3 + 1] = cab.chimneyTop.y + u * 1.3; smp[i * 3 + 2] = cab.chimneyTop.z + Math.cos(s.ox + u * 2) * 0.08; }); smg.attributes.position.needsUpdate = true; smoke.material.opacity = 0.32 * day + 0.12; }
      if (pond.visible) {
        waterNormal.offset.set(t * 0.012, t * 0.008); water.material.opacity = 0.8;
        pads.forEach((l, i) => l.position.y = -0.065 + Math.sin(t * 1.3 + i) * 0.006);
        reeds.forEach((r, i) => { r.rotation.z = Math.sin(t * 1.4 + i) * 0.05; r.rotation.x = Math.cos(t * 1.1 + i) * 0.04; });
        ripples.forEach((r, i) => { const u = (t * 0.35 + i / 3) % 1; r.scale.setScalar(1 + u * 5); r.material.opacity = (1 - u) * 0.35; });
      }
    } };
}
