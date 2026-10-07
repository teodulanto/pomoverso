/** Efectos de partículas reutilizables: confeti de celebración y gotas de agua. */
import * as THREE from 'three';
import { clamp01 } from './math.js';
import { dotTex } from './textures.js';

const PALETTE = [0xff4a6a, 0xffd24a, 0x4ad0ff, 0x6aff8a, 0xb06aff, 0xffffff].map(h => new THREE.Color(h));

/** Confeti: `burst(x, y, z)` lo lanza; `update(dt, t)` va en el update del mundo. */
export function makeConfetti(parent, count = 100, floor = 0.12) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const parts = Array.from({ length: count }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0 }));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.visible = false; parent.add(points);
  let life = 0;
  return {
    burst(x, y, z) {
      life = 5; points.visible = true;
      parts.forEach((q, i) => {
        q.x = x + (Math.random() - 0.5) * 1.2; q.y = y + Math.random() * 0.6; q.z = z + (Math.random() - 0.5) * 1.2;
        q.vx = (Math.random() - 0.5) * 2.6; q.vy = 2.2 + Math.random() * 2.6; q.vz = (Math.random() - 0.5) * 2.6;
        const c = PALETTE[i % PALETTE.length]; col.set([c.r, c.g, c.b], i * 3);
      });
      geo.attributes.color.needsUpdate = true;
    },
    update(dt, t) {
      if (life <= 0) return;
      life -= dt; mat.opacity = clamp01(life / 1.2);
      parts.forEach((c, i) => {
        c.vy -= 4 * dt; c.vx *= 0.99; c.vz *= 0.99; c.x += c.vx * dt; c.y += c.vy * dt + Math.sin(t * 6 + i) * 0.004; c.z += c.vz * dt;
        pos[i * 3] = c.x; pos[i * 3 + 1] = Math.max(floor, c.y); pos[i * 3 + 2] = c.z;
      });
      geo.attributes.position.needsUpdate = true; if (life <= 0) points.visible = false;
    },
  };
}

/** Gotas de agua que salen de una regadera: `update(dt, activo, origen, dx, dz, sueloY)`. */
export function makeWaterDrops(parent, count = 16) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dotTex, color: 0x9fd8ff, size: 0.07, transparent: true, depthWrite: false, opacity: 0 });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; parent.add(points);
  const life = Array.from({ length: count }, (_, i) => i / count);
  return {
    update(dt, active, origin, dx, dz, groundY = 0) {
      mat.opacity += ((active ? 0.85 : 0) - mat.opacity) * Math.min(1, dt * 6);
      const h = origin.y - groundY;
      life.forEach((u, i) => {
        life[i] = (u + dt * 1.3) % 1; const k = life[i];
        pos[i * 3] = origin.x + dx * k * 0.3; pos[i * 3 + 1] = origin.y - k * k * h; pos[i * 3 + 2] = origin.z + dz * k * 0.3;
      });
      geo.attributes.position.needsUpdate = true;
    },
  };
}
