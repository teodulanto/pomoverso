/** Bucle de render, cámara orbital y entrada del ratón. */
import * as THREE from 'three';
import { bloom, camera, composer, hemi, renderer, scene, sunLight } from './engine.js';
import { cloudMat, clouds, hsl, moon, skyColor, skyCols, skyU, stars, sun, sunGlow } from './sky.js';
import { S } from './state.js';
import { clamp01, easeOutBack } from '../lib/math.js';
import { pops, uTime } from '../lib/three-utils.js';
import { selectWorld } from '../ui/shop.js';
import { complete, progress, setMode } from '../ui/timer.js';
import { DEF, W } from '../worlds/index.js';

/* Cámara orbital con arrastre */
let yaw = 0.6, dragging = false, px = 0, py = 0, zoom = 1, pitch = 0;

const cv = renderer.domElement;

cv.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); });

cv.addEventListener('pointermove', e => { if (dragging) { yaw -= (e.clientX - px) * 0.008; pitch = Math.min(0.45, Math.max(-0.4, pitch + (e.clientY - py) * 0.004)); px = e.clientX; py = e.clientY; } });

cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.min(1.5, Math.max(0.5, zoom * (1 + e.deltaY * 0.0012))); }, { passive: false });

cv.addEventListener('pointerup', () => dragging = false);

function resize() { renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }

addEventListener('resize', resize); resize();

/* Debug / pruebas desde consola */
if (new URLSearchParams(location.search).has('debug')) window.__pw = { S, W, setMode, selectWorld, complete, cam: (z, pt, y) => { if (z) zoom = z; if (pt !== undefined) pitch = pt; if (y !== undefined) yaw = y; } };

/* ═════════════════════ Bucle de render ═════════════════════ */
const clock = new THREE.Clock();

let night = S.mode === 'break' ? 1 : 0;

const cWhite = new THREE.Color(0xffffff), cNightCloud = new THREE.Color(0x3a4470), warm = new THREE.Color(0xffc48a), cold = new THREE.Color(0x9fb4ff), lc = new THREE.Color();

let camY = 0, qFrames = 0, qTime = 0, qDone = new URLSearchParams(location.search).has('hq');

function lowerQuality() {   // equipos lentos: sin resplandor, sombras más ligeras y menos píxeles
  bloom.enabled = false; sunLight.shadow.mapSize.set(2048, 2048); sunLight.shadow.map?.dispose(); sunLight.shadow.map = null;
  renderer.setPixelRatio(1); resize();
}

export function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  const p = progress(), d = DEF[S.world], w = W[S.world];

  night += ((S.mode === 'break' ? 1 : 0) - night) * Math.min(1, dt * 1.5);
  const nightEff = Math.max(night, d.minNight || 0);
  const hor = skyColor(S.mode === 'focus' ? p : 1, nightEff, skyCols[S.world]);
  skyU.hor.value.copy(hor); hor.getHSL(hsl); skyU.top.value.setHSL(hsl.h, Math.min(1, hsl.s * 1.1 + 0.05), hsl.l * 0.6);
  scene.fog.color.copy(hor);
  uTime.value = t;

  const ang = Math.PI * (0.06 + 0.88 * (S.mode === 'focus' ? p : 0.5));
  sun.position.set(Math.cos(Math.PI - ang) * 30, Math.sin(ang) * 18 + 2, -20);
  sun.scale.setScalar(Math.max(0.001, 1 - nightEff));
  sunGlow.position.copy(sun.position); sunGlow.scale.setScalar(26); sunGlow.material.opacity = 0.9 * (1 - nightEff);
  moon.position.set(-18, 16, -28); moon.scale.setScalar(Math.max(0.001, nightEff));
  stars.material.opacity = clamp01(nightEff * 1.1 - 0.1);
  sunLight.position.copy(nightEff > 0.5 ? moon.position : sun.position).multiplyScalar(0.55);
  sunLight.intensity = 2.1 * (1 - nightEff) + 0.4 * nightEff;
  const warmK = S.mode === 'focus' ? Math.max(0, p - 0.7) * 3 + Math.max(0, 0.3 - p) * 1.5 : 0;
  sunLight.color.set(0xffffff).lerp(warm, clamp01(warmK)).lerp(cold, nightEff);
  hemi.intensity = 0.9 * (1 - nightEff) + 0.16 * nightEff;
  scene.environmentIntensity = 0.38 * (1 - nightEff) + 0.07 * nightEff;

  try { w.update({ p, mode: S.mode, night: nightEff, t, dt }); } catch (err) { if (!frame.err) { frame.err = true; window.showErr?.('Error en el mundo ' + S.world + ': ' + err.message); } }

  for (let i = pops.length - 1; i >= 0; i--) {
    const q = pops[i]; q.t = Math.min(1, q.t + dt / 1.1);
    q.obj.scale.setScalar(Math.max(0.001, q.base * easeOutBack(q.t)));
    if (q.t >= 1) pops.splice(i, 1);
  }

  cloudMat.color.copy(cWhite).lerp(cNightCloud, nightEff); cloudMat.opacity = 0.9 - nightEff * 0.3;
  clouds.forEach(c => { const u = c.userData; u.a += u.sp * dt * 0.012; c.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r); c.visible = d.clouds; });

  const narrow = camera.aspect < 1.2 ? 1 + (1.2 - camera.aspect) * 0.9 : 1;   // más lejos en pantallas estrechas
  camY += (d.cam.look - camY) * Math.min(1, dt * 3);
  w.group.position.y = Math.sin(t * 0.8) * 0.12;
  if (!dragging) yaw += dt * 0.05;
  const dist = Math.hypot(d.cam.R, d.cam.h) * narrow * zoom, el = Math.atan2(d.cam.h, d.cam.R) + pitch;
  camera.position.set(Math.cos(yaw) * Math.cos(el) * dist, Math.sin(el) * dist, Math.sin(yaw) * Math.cos(el) * dist);
  camera.lookAt(0, camY + (narrow > 1 ? 1.2 : 0), 0);

  composer.render();
  if (!qDone && ++qFrames > 20) { qTime += dt; if (qFrames > 100) { qDone = true; if (qTime / 80 > 0.05) lowerQuality(); } }
}
