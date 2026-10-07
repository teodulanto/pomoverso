import './styles.css';
import { initWorlds } from './worlds/index.js';
import './ui/shop.js';
import { frame } from './core/loop.js';
import { $, save } from './core/state.js';
import { setMode, syncChips } from './ui/timer.js';

initWorlds();

if (save.focus) $('inFocus').value = save.focus;

if (save.brk) $('inBreak').value = save.brk;

syncChips();

setMode('focus', false);

frame();
