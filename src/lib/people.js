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
  else if (hat === 'straw') { head.add(part(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 20), hatM, 0, 0.1, 0), part(new THREE.CylinderGeometry(0.15, 0.17, 0.13, 16), hatM, 0, 0.17, 0)); }
  else { head.add(part(new THREE.SphereGeometry(0.145, 14, 8, 0, 6.283, 0, 1.5), M(o.hair ?? 0x3a2a1a), 0, 0.02, -0.012)); }
  const arm = x => { const a = new THREE.Group(); a.position.set(x, 0.42, 0); a.add(part(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), shirt, 0, -0.13, 0), part(new THREE.SphereGeometry(0.052, 8, 6), skin, 0, -0.3, 0)); torso.add(a); return a; };
  const armL = arm(-0.2), armR = arm(0.2);
  const leg = x => { const l = new THREE.Group(); l.position.set(x, 0, 0); l.add(part(new THREE.CapsuleGeometry(0.065, 0.26, 4, 8), pants, 0, -0.2, 0), part(new THREE.BoxGeometry(0.12, 0.08, 0.2), boot, 0, -0.42, 0.04)); hips.add(l); return l; };
  const legL = leg(-0.08), legR = leg(0.08);
  const crate = makeCrate(1.3); crate.position.set(0, 0.2, 0.3); crate.visible = false; torso.add(crate);
  let phase = Math.random() * 6;
  return { root, crate, update(dt, t, { walk = 0, carry = 0, cheer = 0, wave = 0, steer = 0, sit = 0, ph = 0 }) {
    phase += dt * (3 + walk * 7); const w = clamp01(walk);
    legL.rotation.x = Math.sin(phase) * 0.7 * w - 1.35 * sit; legR.rotation.x = -Math.sin(phase) * 0.7 * w - 1.35 * sit;
    hips.position.y = 0.5 - sit * 0.3 + Math.abs(Math.sin(phase)) * 0.035 * w + cheer * Math.abs(Math.sin(t * 7 + ph)) * 0.16;
    torso.rotation.x = -carry * 0.1 + Math.sin(t * 1.2 + ph) * 0.015;
    head.rotation.y = Math.sin(t * 0.7 + ph) * 0.15 * (1 - w);
    armL.rotation.set(-Math.sin(phase) * 0.6 * w, 0, 0); armR.rotation.set(Math.sin(phase) * 0.6 * w, 0, 0);
    if (carry) { armL.rotation.x = armR.rotation.x = -1.3 * carry; armL.rotation.z = 0.15 * carry; armR.rotation.z = -0.15 * carry; }
    if (steer) { armL.rotation.x = armR.rotation.x = -1.0; armL.rotation.z = -0.1; armR.rotation.z = 0.1; }
    if (wave) { armR.rotation.x = -2.7; armR.rotation.z = -(0.3 + Math.sin(t * 9 + ph) * 0.45); }
    if (cheer) { const s = Math.sin(t * 12 + ph) * 0.35; armL.rotation.x = -2.9 + s; armR.rotation.x = -2.9 - s; armL.rotation.z = -0.35; armR.rotation.z = 0.35; }
  } };
}
