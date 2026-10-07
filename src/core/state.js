/** Estado global y guardado (localStorage). */


/* ═════════════════════ Estado y guardado ═════════════════════ */
export const SAVE_KEY = 'pomodoro-grove-v1';

export const FREE_WORLDS = new URLSearchParams(location.search).has('free');   // solo para pruebas: ?free abre todos los mundos

export const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })();

const legacy = save.done || 0;

export const S = {
  coins: save.coins ?? legacy * 10,
  counts: Object.assign({ forest: 0, farm: 0, sea: 0, space: 0 }, save.counts || (legacy ? { forest: legacy } : {})),
  all: save.all ?? legacy,
  lastDay: save.lastDay || '',
  unlocked: save.unlocked || ['forest'],
  world: save.world || 'forest',
  mode: 'focus', running: false, len: 25 * 60, remaining: 25 * 60, speed: 1,
};

export const snapshot = () => ({ coins: S.coins, counts: S.counts, all: S.all, unlocked: S.unlocked, world: S.world, lastDay: S.lastDay, focus: +$('inFocus').value || 25, brk: +$('inBreak').value || 5 });

export const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch {} };

export const level = (id = S.world) => 1 + Math.floor(S.counts[id] / 4);

export const $ = id => document.getElementById(id);

export const el = { clock: $('clock'), mode: $('mode'), bar: $('bar').firstElementChild, stage: $('stage'),
  lvl: $('lvl'), done: $('done'), rew: $('rew'), rewLabel: $('rewLabel'), coins: $('coins'), wname: $('worldName'),
  xp: $('xpbar').firstElementChild, next: $('next'), main: $('btnMain'), toast: $('toast') };
