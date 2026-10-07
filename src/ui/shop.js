/** Tienda de mundos, cambio de mundo y gestión del progreso. */
import { $, FREE_WORLDS, S, SAVE_KEY, level, persist, snapshot } from '../core/state.js';
import { setMode, toast, updateUI } from './timer.js';
import { DEF, W, WORLDS } from '../worlds/index.js';

/* ═════════════════════ Tienda de mundos ═════════════════════ */
export function selectWorld(id) {
  W[S.world].group.visible = false;
  S.world = id; W[id].group.visible = true;
  W[id].unlock(level(id), false);
  persist(); setMode('focus', false);
}

function renderShop() {
  const box = $('cards'); box.innerHTML = '';
  WORLDS.forEach(d => {
    const owned = FREE_WORLDS || S.unlocked.includes(d.id), active = S.world === d.id, c = document.createElement('div');
    c.className = 'card' + (active ? ' active' : '');
    const missing = d.cost - S.coins;
    c.innerHTML = `<div class="em">${d.emoji}</div><b>${d.name}</b><span class="d">${d.desc}</span><span class="m">${S.counts[d.id]} pomodoros · nivel ${level(d.id)}</span>`;
    const b = document.createElement('button');
    if (active) { b.textContent = 'Estás aquí'; b.disabled = true; }
    else if (owned) { b.textContent = 'Viajar'; b.className = 'primary'; b.onclick = () => { selectWorld(d.id); closeShop(); }; }
    else if (missing <= 0) { b.textContent = `Desbloquear · 🪙 ${d.cost}`; b.className = 'gold'; b.onclick = () => { S.coins -= d.cost; S.unlocked.push(d.id); persist(); selectWorld(d.id); closeShop(); toast(`${d.emoji} ¡${d.name} desbloqueado!`); }; }
    else { b.textContent = `🔒 ${d.cost} 🪙 (faltan ${missing})`; b.disabled = true; }
    c.appendChild(b); box.appendChild(c);
  });
}

function openShop() { renderShop(); $('shop').classList.add('open'); }

export function closeShop() { $('shop').classList.remove('open'); updateUI(); }

$('btnWorlds').onclick = openShop;

$('shopClose').onclick = closeShop;

$('btnExport').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
  a.download = 'pomodoro-progreso.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

$('btnImport').onclick = () => $('fileImport').click();

$('fileImport').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (typeof d.coins !== 'number' || !d.counts) throw new Error('formato');
    if (!confirm('¿Reemplazar tu progreso actual por el del archivo?')) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(d)); location.reload();
  } catch { alert('Ese archivo no parece un progreso válido.'); }
};

$('btnResetWorld').onclick = () => {
  if (!confirm(`¿Reiniciar ${DEF[S.world].name}? Se borran sus ${S.counts[S.world]} pomodoros; conservas tus monedas y mundos.`)) return;
  S.counts[S.world] = 0; persist(); location.reload();
};

$('btnResetAll').onclick = () => {
  if (!confirm('¿Borrar TODO el progreso (monedas, mundos desbloqueados y pomodoros)?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload();
};

$('shop').addEventListener('pointerdown', e => { if (e.target.id === 'shop') closeShop(); });
