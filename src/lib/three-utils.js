/** Utilidades de Three.js compartidas por todos los mundos. */
import * as THREE from 'three';

/* Helpers */
export const pops = [];

export function pop(obj, base = 1) { obj.scale.setScalar(0.001); pops.push({ obj, base, t: 0 }); }

export function makeUnlocker(list) {            // [[objeto, nivel]]
  list.forEach(([o]) => o.visible = false);
  return (L, animate) => list.forEach(([o, lv, base = 1]) => {
    if (L >= lv && !o.visible) { o.visible = true; animate ? pop(o, base) : o.scale.setScalar(base); }
    if (L < lv) o.visible = false;
  });
}

/* ── vegetación ── */
export const uTime = { value: 0 };

export const shade = (m) => { m.castShadow = m.receiveShadow = true; return m; };

/* ═════════════════════ MUNDO 3: Mar abierto (HD) ═════════════════════ */
export const vcMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });

export function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), c, i); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
