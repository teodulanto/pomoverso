/** Texturas procedurales dibujadas en canvas (sin imágenes externas). */
import * as THREE from 'three';

export function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const noiseTex = (shadeMin, shadeMax, n, rMin, rMax) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = `rgb(${(shadeMin + shadeMax) / 2},${(shadeMin + shadeMax) / 2},${(shadeMin + shadeMax) / 2})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const s = shadeMin + Math.random() * (shadeMax - shadeMin), x = Math.random() * w, y = Math.random() * h;
    g.fillStyle = `rgba(${s},${s},${s},.55)`;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); g.ellipse(x + ox, y + oy, rMin + Math.random() * (rMax - rMin), rMin + Math.random() * (rMax - rMin), Math.random() * 3, 0, 6.3); g.fill(); }
  }
});

export const groundTex = noiseTex(185, 255, 700, 2, 9);

export const leafTex = noiseTex(170, 255, 900, 2, 7);

export const rockTex = noiseTex(140, 255, 500, 3, 14);

export const plankTex = canvasTex(256, 256, (g, w, h) => {
  const n = 8, pw = w / n;
  for (let i = 0; i < n; i++) {
    const s = 150 + Math.random() * 50; g.fillStyle = `rgb(${s + 30},${s - 10},${s - 60})`; g.fillRect(i * pw, 0, pw, h);
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(60,35,15,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1; const x = i * pw + Math.random() * pw; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 4, h); g.stroke(); }
    g.fillStyle = 'rgba(40,22,10,.55)'; g.fillRect(i * pw, 0, 2, h);
  }
});

export const shingleTex = canvasTex(256, 256, (g, w, h) => {
  const rows = 8, rh = h / rows, cols = 8, cw = w / cols;
  for (let r = 0; r < rows; r++) for (let c = -1; c < cols; c++) {
    const x = c * cw + (r % 2 ? cw / 2 : 0), s = 0.8 + Math.random() * 0.35;
    g.fillStyle = `rgb(${170 * s},${72 * s},${55 * s})`; g.beginPath(); g.roundRect(x + 1, r * rh, cw - 2, rh + 4, [0, 0, 7, 7]); g.fill();
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 1, r * rh + rh - 2, cw - 2, 3);
  }
});

export const waterNormal = canvasTex(128, 128, (g, w, h) => {
  const H = (x, y) => { const u = x / w * 6.283, v = y / h * 6.283; return 0.5 + 0.25 * Math.sin(u * 3 + Math.sin(v * 2) * 1.6) + 0.25 * Math.sin(v * 4 + Math.sin(u * 3) * 1.4); };
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = H((x + 1) % w, y) - H((x - 1 + w) % w, y), dy = H(x, (y + 1) % h) - H(x, (y - 1 + h) % h), i = (y * w + x) * 4;
    img.data[i] = 128 - dx * 380; img.data[i + 1] = 128 - dy * 380; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, { repeat: [3, 3], srgb: false });

export const radialTex = (stops, size = 128) => canvasTex(size, size, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

export const dotTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);

const shadowTex = radialTex([[0, 'rgba(0,0,0,.9)'], [0.55, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]);

export const blobShadow = (r, op = 0.4) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1; return m;
};
