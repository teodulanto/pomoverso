/** Motor 3D: renderizador, escena, cámara, luces y efectos de post-procesado. */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ═════════════════════ Escena base ═════════════════════ */
export const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

renderer.shadowMap.enabled = true;

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.toneMapping = THREE.NeutralToneMapping;

renderer.toneMappingExposure = 1.0;

document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();

scene.fog = new THREE.Fog(0x8ed1fc, 32, 95);

export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);

scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

scene.environmentIntensity = 0.35;

export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));

composer.addPass(new RenderPass(scene, camera));

export const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.4, 0.7, 0.88);

composer.addPass(bloom);

composer.addPass(new OutputPass());

export const hemi = new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 0.9);

export const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);

sunLight.castShadow = true;

sunLight.shadow.mapSize.set(4096, 4096);

sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03; sunLight.shadow.radius = 3;

Object.assign(sunLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });

scene.add(hemi, sunLight, sunLight.target);
