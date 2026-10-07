/** Personajes sencillos con poses (caminar, cargar, saludar, celebrar). */
import * as THREE from 'three';
import { clamp01 } from './math.js';
import { makeCrate } from './props.js';
import { shade } from './three-utils.js';

/* ── personas (estibadores, tripulación, vecinos del puerto) ── */
export function makePerson(o = {}) {
  const root = new THREE.Group(), hips = new THREE.Group(); root.add(hips); hips.position.y = 0.5;
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const skin = M(o.skin ?? 0xf1c9a0), shirt = M(o.shirt ?? 0xc0392b), pants = M(o.pants ?? 0x2f4a7a), boot = M(0x4a2f1c), hatM = M(o.capColor ?? 0xe3c26a);
  const part = (geo, m, x, y, z) => { const mm = shade(new THREE.Mesh(geo, m)); mm.position.set(x, y, z); return mm; };
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(part(new THREE.CapsuleGeometry(0.15, 0.24, 4, 10), shirt, 0, 0.28, 0), part(new THREE.CapsuleGeometry(0.152, 0.1, 4, 10), pants, 0, 0.12, 0));
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  head.add(part(new THREE.SphereGeometry(0.14, 16, 12), skin, 0, 0, 0));
  [-0.05, 0.05].forEach(x => head.add(part(new THREE.SphereGeometry(0.018, 6, 5), new THREE.MeshBasicMaterial({ color: 0x222222 }), x, 0.02, 0.125)));
  head.add(part(new THREE.SphereGeometry(0.022, 6, 5), M(0xe8a98a), 0, -0.015, 0.14));
  const hat = o.hat || 'hair';
  if (hat === 'cap') { head.add(part(new THREE.SphereGeometry(0.15, 14, 8, 0, 6.283, 0, 1.5), hatM, 0, 0.01, 0), part(new THREE.BoxGeometry(0.17, 0.02, 0.1), hatM, 0, 0.04, 0.15)); }
  else if (hat === 'captain') { const w = M(0xf4f4f4), dk = M(0x1a2438); head.add(part(new THREE.CylinderGeometry(0.16, 0.17, 0.1, 16), w, 0, 0.14, 0), part(new THREE.CylinderGeometry(0.162, 0.162, 0.03, 16), dk, 0, 0.1, 0), part(new THREE.BoxGeometry(0.2, 0.015, 0.12), dk, 0, 0.1, 0.13), part(new THREE.SphereGeometry(0.02, 6, 5), M(0xe8b934), 0, 0.15, 0.17)); }
  else if (hat === 'bandana') { const r = M(0xd8372a); head.add(part(new THREE.SphereGeometry(0.145, 14, 8, 0, 6.283, 0, 1.2), r, 0, 0.0, 0), part(new THREE.SphereGeometry(0.03, 6, 5), r, -0.13, 0.04, -0.07)); }
  else if (hat === 'helmet') {
    const glass = new THREE.MeshStandardMaterial({ color: 0x2a3f6a, metalness: 0.7, roughness: 0.15 });
    head.add(part(new THREE.SphereGeometry(0.2, 18, 12), M(0xf4f4f6), 0, 0, 0), part(new THREE.SphereGeometry(0.205, 14, 10, 0.72, 1.7, 0.45, 1.0), glass, 0, 0, 0));
  }
  else if (hat === 'straw') { head.add(part(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 20), hatM, 0, 0.1, 0), part(new THREE.CylinderGeometry(0.15, 0.17, 0.13, 16), hatM, 0, 0.17, 0)); }
  else { head.add(part(new THREE.SphereGeometry(0.145, 14, 8, 0, 6.283, 0, 1.5), M(o.hair ?? 0x3a2a1a), 0, 0.02, -0.012)); }
  const arm = x => { const a = new THREE.Group(); a.position.set(x, 0.42, 0); a.add(part(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), shirt, 0, -0.13, 0), part(new THREE.SphereGeometry(0.052, 8, 6), skin, 0, -0.3, 0)); torso.add(a); return a; };
  const armL = arm(-0.2), armR = arm(0.2);
  const leg = x => { const l = new THREE.Group(); l.position.set(x, 0, 0); l.add(part(new THREE.CapsuleGeometry(0.065, 0.26, 4, 8), pants, 0, -0.2, 0), part(new THREE.BoxGeometry(0.12, 0.08, 0.2), boot, 0, -0.42, 0.04)); hips.add(l); return l; };
  const legL = leg(-0.08), legR = leg(0.08);
  const crate = makeCrate(1.3); crate.position.set(0, 0.2, 0.3); crate.visible = false; torso.add(crate);
  const held = new THREE.Group(); held.position.set(0, 0.2, 0.3); held.visible = false; torso.add(held);   // para llevar cualquier objeto en los brazos
  const metal = M(0x6f8fa8), can = new THREE.Group(); can.position.set(0, -0.32, 0.02); can.visible = false; armR.add(can);
  const spout = part(new THREE.CylinderGeometry(0.012, 0.025, 0.2, 6), metal, 0, 0.04, 0.22); spout.rotation.x = 1.0;
  can.add(part(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 12), metal, 0, 0, 0.1), spout);
  if (o.backpack) torso.add(part(new THREE.BoxGeometry(0.22, 0.3, 0.1), M(o.backpack), 0, 0.3, -0.18));
  let phase = Math.random() * 6;
  return { root, crate, held, update(dt, t, { walk = 0, carry = 0, cheer = 0, wave = 0, steer = 0, sit = 0, bend = 0, water = 0, lookUp = 0, ph = 0 }) {
    phase += dt * (3 + walk * 7); const w = clamp01(walk);
    legL.rotation.x = Math.sin(phase) * 0.7 * w - 1.35 * sit; legR.rotation.x = -Math.sin(phase) * 0.7 * w - 1.35 * sit;
    hips.position.y = 0.5 - sit * 0.3 + Math.abs(Math.sin(phase)) * 0.035 * w + cheer * Math.abs(Math.sin(t * 7 + ph)) * 0.16;
    torso.rotation.x = -carry * 0.1 + Math.sin(t * 1.2 + ph) * 0.015;
    head.rotation.y = Math.sin(t * 0.7 + ph) * 0.15 * (1 - w);
    armL.rotation.set(-Math.sin(phase) * 0.6 * w, 0, 0); armR.rotation.set(Math.sin(phase) * 0.6 * w, 0, 0);
    if (carry) { armL.rotation.x = armR.rotation.x = -1.3 * carry; armL.rotation.z = 0.15 * carry; armR.rotation.z = -0.15 * carry; }
    if (steer) { armL.rotation.x = armR.rotation.x = -1.0; armL.rotation.z = -0.1; armR.rotation.z = 0.1; }
    if (wave) { armR.rotation.x = -2.7; armR.rotation.z = -(0.3 + Math.sin(t * 9 + ph) * 0.45); }
    head.rotation.x = -lookUp * 0.8; if (lookUp) torso.rotation.x -= lookUp * 0.15;
    if (bend) { torso.rotation.x = bend * 0.95; head.rotation.x = -bend * 0.5; const k = Math.sin(t * 7) * 0.3 * bend; armL.rotation.x = -0.9 * bend + k; armR.rotation.x = -0.9 * bend - k; }
    can.visible = water > 0.05; if (water) { armR.rotation.x = -1.15 * water; can.rotation.x = water * 0.55 + Math.sin(t * 2) * 0.05 * water; }
    if (cheer) { const s = Math.sin(t * 12 + ph) * 0.35; armL.rotation.x = -2.9 + s; armR.rotation.x = -2.9 - s; armL.rotation.z = -0.35; armR.rotation.z = 0.35; }
  } };
}

/** Persona lista para colocar: tamaño reducido (el mundo es pequeño). `o.scale` cambia el tamaño. */
export function makeActor(o = {}) { const pr = makePerson(o); pr.root.scale.setScalar(o.scale ?? 0.5); return pr; }

const _pv = new THREE.Vector3(), _tv = new THREE.Vector3();
/** Gira suavemente al personaje hacia la dirección (dx, dz). */
export function faceTo(pr, dx, dz, k) { let d = Math.atan2(dx, dz) - pr.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); pr.root.rotation.y += d * k; }

/** Sigue un objetivo (x, y, z) con suavizado; los pasos salen de la velocidad del movimiento. */
export function drive(pr, x, y, z, dt, t, pose, lx, lz) {
  _pv.copy(pr.root.position); pr.root.position.lerp(_tv.set(x, y, z), 1 - Math.exp(-dt * 5));
  const dx = pr.root.position.x - _pv.x, dz = pr.root.position.z - _pv.z, sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
  if (sp > 0.05) faceTo(pr, dx, dz, Math.min(1, dt * 8)); else faceTo(pr, lx - pr.root.position.x, lz - pr.root.position.z, Math.min(1, dt * 4));
  pr.update(dt, t, { ...pose, walk: clamp01(sp * 2.2), ph: pr.root.id });
}

/**
 * Camina hacia (tx, tz) a velocidad constante (`speed`, unidades/s) y se queda mirando a `look` = [x, z].
 * `ground(x, z)` da la altura del suelo. Devuelve true si ya llegó.
 */
export function walkTo(pr, tx, tz, dt, t, pose, look, { speed = 0.55, ground = () => 0 } = {}) {
  const p = pr.root.position, dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz), step = Math.min(dist, speed * dt), moving = dist > 0.04;
  if (moving) { p.x += dx / dist * step; p.z += dz / dist * step; faceTo(pr, dx, dz, Math.min(1, dt * 9)); }
  else faceTo(pr, look[0] - p.x, look[1] - p.z, Math.min(1, dt * 4));
  p.y = ground(p.x, p.z) + 0.02;
  pr.update(dt, t, { ...pose, walk: moving ? 1 : 0, ph: pr.root.id });
  return !moving;
}

/** Perrito: camina, se sienta y mueve la cola. Mira hacia +z como las personas. */
export function makeDog(o = {}) {
  const root = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const fur = M(o.fur ?? 0xc98a4b), dark = M(0x3a2a1a), cream = M(0xf2e6d2);
  const part = (geo, m, x, y, z) => { const mm = shade(new THREE.Mesh(geo, m)); mm.position.set(x, y, z); return mm; };
  const body = new THREE.Group(); root.add(body); body.position.y = 0.26;
  body.add(part(new THREE.CapsuleGeometry(0.1, 0.28, 4, 10).rotateX(Math.PI / 2), fur, 0, 0, 0), part(new THREE.SphereGeometry(0.085, 10, 8), cream, 0, -0.03, 0.12));
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.27); body.add(head);
  head.add(part(new THREE.SphereGeometry(0.095, 12, 10), fur, 0, 0, 0), part(new THREE.SphereGeometry(0.055, 10, 8), cream, 0, -0.03, 0.08), part(new THREE.SphereGeometry(0.02, 6, 5), dark, 0, -0.01, 0.13));
  [-0.05, 0.05].forEach(x => {
    head.add(part(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 }), x, 0.03, 0.08));
    const ear = part(new THREE.ConeGeometry(0.04, 0.1, 6), dark, x * 1.7, 0.08, -0.02); ear.rotation.z = -x * 6; head.add(ear);
  });
  const legs = [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]].map(([x, z]) => {
    const l = new THREE.Group(); l.position.set(x, -0.04, z); l.add(part(new THREE.CapsuleGeometry(0.03, 0.1, 3, 6), fur, 0, -0.08, 0)); body.add(l); return l;
  });
  const tail = new THREE.Group(); tail.position.set(0, 0.04, -0.28); body.add(tail); tail.add(part(new THREE.CapsuleGeometry(0.022, 0.12, 3, 6), fur, 0, 0.07, -0.02));
  root.scale.setScalar(o.scale ?? 0.9);
  let phase = 0;
  return { root, update(dt, t, { walk = 0, sit = 0 }) {
    phase += dt * (6 + walk * 8); const w = clamp01(walk);
    legs.forEach((l, i) => { l.rotation.x = Math.sin(phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.5 : 0)) * 0.7 * w - (i > 1 ? sit * 1.2 : 0); });
    body.rotation.x = -sit * 0.55; body.position.y = 0.26 - sit * 0.07 + Math.abs(Math.sin(phase)) * 0.015 * w;
    head.rotation.x = sit * 0.4 + Math.sin(t * 1.3) * 0.05; tail.rotation.y = Math.sin(t * (w ? 14 : 9)) * (0.35 + 0.35 * (1 - sit));
  } };
}
