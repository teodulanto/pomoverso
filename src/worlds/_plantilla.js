/**
 * PLANTILLA para crear un mundo nuevo (este ejemplo es un pequeño desierto con cactus).
 *
 * Cómo usarla:
 *   1. Copia este archivo a `src/worlds/<tu-mundo>.js` y renombra `plantilla` por el id de tu mundo.
 *   2. Cambia `meta` (nombre, textos, colores del cielo, cámara...).
 *   3. Dibuja tu mundo en `build...()` y anima lo que pasa durante el pomodoro en `update()`.
 *   4. Regístralo en `src/worlds/index.js` (importa `meta` y la función `build` y añádelos a `WORLDS`).
 *   5. Añade el id a `counts` en `src/core/state.js` para que tenga su propio progreso.
 *
 * Contrato de `build...()`: devuelve un objeto con
 *   - group:      THREE.Group con todo el mundo (se muestra u oculta al cambiar de mundo)
 *   - startFocus(n):     se llama al empezar cada enfoque; `n` = pomodoros ya completados en este mundo
 *   - reward(i, animate): coloca la recompensa número `i` (se llama al completar un pomodoro, y al cargar el juego con animate=false)
 *   - unlock(nivel, animate): muestra los extras que se desbloquean por nivel (ver `makeUnlocker`)
 *   - update({ p, mode, night, t, dt }): se llama en cada fotograma.
 *        p     = progreso 0..1 del enfoque (o del descanso si mode === 'break')
 *        mode  = 'focus' | 'break'
 *        night = 0 (día) .. 1 (noche)
 *        t     = segundos totales, dt = segundos desde el fotograma anterior
 *
 * Regla de oro del proyecto: sin imágenes ni modelos externos; todo se dibuja con código.
 */
import * as THREE from 'three';
import { buildIsland } from '../lib/island.js';
import { makeRock } from '../lib/vegetation.js';
import { makeUnlocker, pop, shade } from '../lib/three-utils.js';
import { fbm, sstep } from '../lib/math.js';
import { blobShadow } from '../lib/textures.js';

export const meta = {
  id: 'plantilla', name: 'Desierto', emoji: '🌵', cost: 0, rewardLabel: 'Cactus', doneMsg: '🌵 ¡Cactus crecido!',
  desc: 'Un cactus crece bajo el sol del desierto y se queda en tu oasis.', milestones: ['Pozo', 'Pirámide'],
  sky: { dawn: 0xf7b58f, day: 0x9fd8ff, dusk: 0xf2a56a, night: 0x0d1330 }, clouds: true, cam: { R: 12.5, h: 6.6, look: -0.2 },
  focus: ['Una semilla en la arena 🌱', 'Asoma un brote 🌿', 'Crece el tallo 🌵', 'Salen los brazos 💪', '¡Casi florece! 🌸'],
  rest: ['Cae la noche… 🌙', 'El desierto se enfría ❄️', 'Mira las estrellas ✨'],
};

/** Altura del terreno en (x, z): dunas suaves. */
const height = (x, z) => (fbm(x * 0.3 + 2, z * 0.3 + 5) - 0.5) * 0.7 - 0.3 * sstep(3.9, 5, Math.hypot(x, z));
/** Color del suelo (arena con vetas). `c` es el color a rellenar; `c2` es un auxiliar. */
const sand = (x, z, h, rad, c, c2) => c.setHex(0xe6c98a).lerp(c2.setHex(0xc9a35f), fbm(x * 1.5, z * 1.5)).lerp(c2.setHex(0x8b6a43), sstep(4.3, 4.95, rad));

function makeCactus(scale = 1) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x4f9a4a, roughness: 0.8 });
  const body = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.8, 6, 12), m)); body.position.y = 0.55; g.add(body);
  for (const s of [-1, 1]) {
    const arm = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 6, 10), m)); arm.position.set(s * 0.26, 0.7, 0); g.add(arm);
    const up = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 6, 10), m)); up.position.set(s * 0.26, 0.95, 0); g.add(up);
  }
  g.add(blobShadow(0.5, 0.4));
  g.scale.setScalar(scale);
  return g;
}

export function buildPlantilla() {
  const g = new THREE.Group();
  g.add(buildIsland(height, sand, { a: 0xa57c4a, b: 0x7a5f3a, top: 0xc9a35f }));
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, r = makeRock(0.2 + (i % 3) * 0.08, i * 2.3, false); r.position.set(Math.cos(a) * 4.5, height(Math.cos(a) * 4.5, Math.sin(a) * 4.5), Math.sin(a) * 4.5); g.add(r); }

  const growing = new THREE.Group(); growing.position.y = height(0, 0); g.add(growing);
  growing.add(makeCactus());

  const well = new THREE.Group();   // extra del nivel 2: un pozo
  well.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x9a9fa8, roughness: 0.9 }))));
  well.position.set(-2.5, height(-2.5, 1.5) + 0.2, 1.5); g.add(well);
  const unlock = makeUnlocker([[well, 2]]);

  return {
    group: g, unlock,
    startFocus() {},
    reward(i, animate) {
      const a = i * 2.4, r = 1.6 + 0.35 * Math.sqrt(i), x = Math.cos(a) * r, z = Math.sin(a) * r;
      const c = makeCactus(0.6 + (i % 4) * 0.1); c.position.set(x, height(x, z), z); c.rotation.y = i; g.add(c);
      animate ? pop(c, c.scale.x) : c.scale.setScalar(c.scale.x);
    },
    update({ p, mode, t }) {
      growing.visible = mode === 'focus';
      if (mode === 'focus') { growing.scale.setScalar(0.1 + 1.1 * p); growing.rotation.z = Math.sin(t) * 0.02 * p; }
    },
  };
}
