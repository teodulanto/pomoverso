/** Registro de mundos: para añadir uno nuevo, crea src/worlds/<nombre>.js y regístralo aquí. */
import { scene } from '../core/engine.js';
import { S, level } from '../core/state.js';
import { meta as forestMeta, buildForest } from './forest.js';
import { meta as farmMeta, buildFarm } from './farm.js';
import { meta as seaMeta, buildSea } from './sea.js';
import { meta as spaceMeta, buildSpace } from './space.js';

export const WORLDS = [
  { ...forestMeta, build: buildForest },
  { ...farmMeta, build: buildFarm },
  { ...seaMeta, build: buildSea },
  { ...spaceMeta, build: buildSpace },
];
export const DEF = Object.fromEntries(WORLDS.map(w => [w.id, w]));

/** Mundos ya construidos (se rellena en initWorlds). */
export const W = {};

export function initWorlds() {
  if (!DEF[S.world]) S.world = 'forest';
  for (const def of WORLDS) {
    const id = def.id;
    W[id] = def.build();
    scene.add(W[id].group); W[id].group.visible = id === S.world;
    for (let i = 0; i < S.counts[id]; i++) W[id].reward(i, false);
    W[id].unlock(level(id), false);
  }
  W[S.world].startFocus(S.counts[S.world]);
}
