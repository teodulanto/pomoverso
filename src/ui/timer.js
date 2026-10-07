/** Reloj, recompensas, controles y actualización de la interfaz. */
import { $, FREE_WORLDS, S, el, level, persist } from '../core/state.js';
import { closeShop } from './shop.js';
import { DEF, W, WORLDS } from '../worlds/index.js';

/* ═════════════════════ Lógica del timer ═════════════════════ */
const mins = id => Math.max(id === 'inFocus' ? 5 : 1, Math.min(+$(id).value || 1, 90));

const fmt = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

export const progress = () => 1 - S.remaining / S.len;

const coinsFor = () => Math.max(1, Math.round(mins('inFocus') / 25 * 10));

export function setMode(mode, autostart) {
  S.mode = mode;
  const m = mode === 'focus' ? mins('inFocus') : (S.all > 0 && S.all % 4 === 0 ? mins('inBreak') * 3 : mins('inBreak'));
  S.len = S.remaining = m * 60; S.running = autostart;
  if (mode === 'focus') W[S.world].startFocus(S.counts[S.world]);
  updateUI();
}

export function toast(html) {
  el.toast.innerHTML = html; el.toast.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.toast.classList.remove('show'), 3400);
}

function chime() {
  try {
    const ac = chime.ac || (chime.ac = new (window.AudioContext || window.webkitAudioContext)());
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f;
      const t = ac.currentTime + i * 0.16;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.75);
    });
  } catch {}
}

function bumpCoins() { el.coins.classList.remove('bump'); void el.coins.offsetWidth; el.coins.classList.add('bump'); }

export function complete() {
  const id = S.world, w = W[id], d = DEF[id];
  if (S.mode === 'focus') {
    const prevL = level();
    w.reward(S.counts[id], true);
    S.counts[id]++; S.all++;
    let gain = coinsFor(); S.coins += gain;
    const today = new Date().toLocaleDateString('en-CA'), daily = S.lastDay !== today;
    if (daily) { S.coins += 10; S.lastDay = today; }
    const up = level() > prevL;
    if (up) { S.coins += 15; w.unlock(level(), true); }
    persist(); chime(); bumpCoins();
    toast(`${d.doneMsg}<small>+${gain} 🪙${daily ? ' · +10 por tu primer pomodoro de hoy' : ''}${up ? ` · +15 por subir al nivel ${level()} · ${d.milestones[level() - 2] ? 'Desbloqueas: ' + d.milestones[level() - 2] : '¡Sigues creciendo!'}` : ' · descansa un poco'}</small>`);
    setMode('break', true);
  } else {
    chime(); toast('☀️ Nuevo día<small>Listo para otro pomodoro</small>'); setMode('focus', false);
  }
}

let last = performance.now();

setInterval(() => {
  const now = performance.now(), dt = (now - last) / 1000; last = now;
  if (!S.running) return;
  S.remaining -= dt * S.speed;
  if (S.remaining <= 0) complete();
  updateUI();
}, 200);

export function updateUI() {
  const p = progress(), d = DEF[S.world];
  document.body.classList.toggle('playing', S.running);
  $('btnSkip').style.display = S.mode === 'break' ? '' : 'none';
  el.clock.textContent = fmt(S.remaining);
  el.bar.style.width = (p * 100).toFixed(1) + '%';
  el.mode.textContent = S.mode === 'focus' ? 'Enfoque' : 'Descanso';
  el.bar.style.background = S.mode === 'focus' ? '#7be08a' : '#8fb4ff';
  el.main.textContent = S.running ? '⏸ Pausar' : (S.remaining < S.len ? '▶ Continuar' : '▶ Iniciar');
  document.title = `${fmt(S.remaining)} · ${S.mode === 'focus' ? 'Enfoque' : 'Descanso'} · Pomoverso`;
  const st = S.mode === 'focus' ? d.focus : d.rest;
  el.stage.textContent = st[Math.min(st.length - 1, Math.floor(p * st.length))];
  const c = S.counts[S.world], L = level(), inL = c % 4;
  el.wname.textContent = `${d.emoji} ${d.name}`;
  el.coins.textContent = `🪙 ${S.coins}`;
  el.lvl.textContent = L; el.done.textContent = c; el.rew.textContent = c; el.rewLabel.textContent = d.rewardLabel;
  el.xp.style.width = (inL / 4 * 100) + '%';
  const nm = d.milestones[L - 1];
  el.next.textContent = `${4 - inL} pomodoro${4 - inL === 1 ? '' : 's'} para el nivel ${L + 1}${nm ? ' · ' + nm : ''}`;
  const nextW = WORLDS.filter(w => !FREE_WORLDS && !S.unlocked.includes(w.id)).sort((a, b) => a.cost - b.cost)[0];
  $('goal').textContent = nextW ? `Próximo mundo: ${nextW.emoji} ${nextW.name} · ${Math.min(S.coins, nextW.cost)}/${nextW.cost} 🪙` : '';
  $('shopCoins').textContent = `🪙 ${S.coins}`;
}

/* Controles */
el.main.onclick = () => { S.running = !S.running; if (chime.ac?.state === 'suspended') chime.ac.resume(); updateUI(); };

$('btnReset').onclick = () => setMode(S.mode, false);

$('btnSkip').onclick = () => { if (S.mode === 'break') { S.remaining = 0; complete(); } };

['inFocus', 'inBreak'].forEach(id => $(id).onchange = () => { syncChips(); persist(); if (!S.running) setMode(S.mode, false); });

export const syncChips = () => document.querySelectorAll('.chip[data-m]').forEach(c => c.classList.toggle('on', +c.dataset.m === mins('inFocus')));

document.querySelectorAll('.chip[data-m]').forEach(c => c.onclick = () => {
  const m = +c.dataset.m; $('inFocus').value = m; $('inBreak').value = Math.max(1, Math.round(m / 5));
  syncChips(); persist(); setMode('focus', false);
});

addEventListener('keydown', e => {
  if (e.code === 'Escape') closeShop();
  if (e.code === 'Space' && !/INPUT|SELECT|BUTTON/.test(document.activeElement.tagName) && !$('shop').classList.contains('open')) { e.preventDefault(); el.main.click(); }
});
