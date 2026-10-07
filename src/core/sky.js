/** Cielo: sol, luna, estrellas, nubes, degradado y halo. */
import * as THREE from 'three';
import { scene } from './engine.js';
import { canvasTex, radialTex } from '../lib/textures.js';
import { DEF } from '../worlds/index.js';

/* Cielo: sol, luna, estrellas, nubes */
export const sun = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 12), new THREE.MeshBasicMaterial({ color: 0xfff1b0, fog: false }));

export const moon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 12), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }));

scene.add(sun, moon);

const starGeo = new THREE.BufferGeometry(), sp = new Float32Array(700 * 3);

for (let i = 0; i < 700; i++) { const th = Math.random() * 6.283, ph = Math.acos(Math.random() * 1.2 - 0.2), r = 120; sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 5, r * Math.sin(ph) * Math.sin(th)], i * 3); }

starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));

export const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));

scene.add(stars);

// Nubes: sprites suaves (siempre de cara a la cámara, nunca parecen rocas)
const cloudTex = canvasTex(256, 128, g => {
  [[70, 75, 48], [118, 58, 58], [170, 70, 50], [110, 84, 44], [150, 88, 40], [200, 86, 32]].forEach(([x, y, r]) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  });
});

export const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.9, fog: false, depthWrite: false });

export const clouds = [];

for (let i = 0; i < 12; i++) {
  const c = new THREE.Sprite(cloudMat), s = 1 + Math.random() * 0.9;
  c.scale.set(34 * s, 17 * s, 1);
  c.userData = { a: (i / 12) * 6.283 + Math.random() * 0.4, r: 60 + Math.random() * 25, y: 14 + Math.random() * 16, sp: 0.4 + Math.random() * 0.5 };
  scene.add(c); clouds.push(c);
}

// Cielo con degradado y halo del sol
export const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } };

const skyDome = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.55)), 1.0); }',
}));

skyDome.renderOrder = -10; scene.add(skyDome);

export const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,240,190,1)'], [0.25, 'rgba(255,214,140,.45)'], [1, 'rgba(255,200,120,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));

scene.add(sunGlow);

export const hsl = {};

/* Cielo por mundo */
export const skyCols = {}; for (const id in DEF) skyCols[id] = Object.fromEntries(Object.entries(DEF[id].sky).map(([k, v]) => [k, new THREE.Color(v)]));

const tmp = new THREE.Color();

export function skyColor(p, night, sk) {
  if (p < 0.35) tmp.copy(sk.dawn).lerp(sk.day, p / 0.35);
  else if (p < 0.7) tmp.copy(sk.day);
  else tmp.copy(sk.day).lerp(sk.dusk, (p - 0.7) / 0.3);
  return tmp.lerp(sk.night, night);
}
