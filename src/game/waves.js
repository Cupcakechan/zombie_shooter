// game/waves.js — the wave manager. Owns wave progression (cleared-based:
// intermission → staggered spawns → all dead → next), and the waves-session
// stats (kills, elapsed time) previously squatting in main.js. Render-free:
// the spawn function is INJECTED, so this module stays pure logic and the
// suite can import it safely.

import { WAVES } from '../data/waveTable.js';

// ————— Pure composition math (suite-tested) —————

// What wave n consists of. Table waves verbatim; beyond the table, the
// EXTEND formula continues forever with the speed cap engaged.
export function waveSpec(n) {
  const { TABLE, EXTEND } = WAVES;
  if (n <= TABLE.length) {
    return { count: TABLE[n - 1].count, speedMult: TABLE[n - 1].speedMult };
  }
  const last = TABLE[TABLE.length - 1];
  const extra = n - TABLE.length;
  return {
    count: last.count + EXTEND.COUNT_STEP * extra,
    speedMult: Math.min(EXTEND.SPEED_CAP, last.speedMult + EXTEND.SPEED_STEP * extra),
  };
}

// ————— Stateful wave management —————

let spawnFn = null;      // (typeId, pos, { speedMult }) => void — injected
let onWaveStartCb = null; // (n) => void — fired at intermission start (banner)

let phase = 'idle'; // 'idle' | 'intermission' | 'active'
let waveNumber = 0;
let kills = 0;
let elapsedMs = 0;
let aliveCount = 0;
let pendingSpawns = [];
let spawnGapT = 0;
let intermissionT = 0;

export function initWaves({ spawn, onWaveStart } = {}) {
  spawnFn = spawn || null;
  onWaveStartCb = onWaveStart || null;
}

export function startWaves() {
  phase = 'idle';
  waveNumber = 0;
  kills = 0;
  elapsedMs = 0;
  aliveCount = 0;
  pendingSpawns = [];
  spawnGapT = 0;
  // The first intermission begins on the first PLAYING frame (updateWaves):
  // announcing "WAVE 1" during the 3-2-1 would collide with the countdown
  // numeral in the same screen spot.
}

// Intermission ANNOUNCES the coming wave (banner shows during the breather).
function enterIntermission() {
  phase = 'intermission';
  waveNumber += 1;
  intermissionT = WAVES.INTERMISSION_MS;
  if (onWaveStartCb) onWaveStartCb(waveNumber);
}

function beginSpawning() {
  phase = 'active';
  const spec = waveSpec(waveNumber);
  pendingSpawns = [];
  // Cycle spawn points from a random offset so waves don't always open from
  // the same door.
  const offset = Math.floor(Math.random() * WAVES.SPAWN_POINTS.length);
  for (let i = 0; i < spec.count; i++) {
    const pos = WAVES.SPAWN_POINTS[(offset + i) % WAVES.SPAWN_POINTS.length];
    pendingSpawns.push({ typeId: 'proto_zombie', pos, speedMult: spec.speedMult });
  }
  spawnGapT = 0; // first spawn is immediate
}

export function updateWaves(dtMs) {
  elapsedMs += dtMs;

  if (phase === 'idle') {
    enterIntermission();
    return;
  }

  if (phase === 'intermission') {
    intermissionT -= dtMs;
    if (intermissionT <= 0) beginSpawning();
    return;
  }

  if (phase === 'active') {
    if (pendingSpawns.length > 0) {
      spawnGapT -= dtMs;
      if (spawnGapT <= 0) {
        const s = pendingSpawns.shift();
        if (spawnFn) spawnFn(s.typeId, s.pos, { speedMult: s.speedMult });
        aliveCount += 1;
        spawnGapT = WAVES.SPAWN_GAP_MS;
      }
    } else if (aliveCount <= 0) {
      // Wave cleared (corpses may still be fading — kills fire at the start
      // of the death animation, which is when the fight is decided).
      enterIntermission();
    }
  }
}

export function notifyKill() {
  kills += 1;
  aliveCount = Math.max(0, aliveCount - 1);
}

export function getWave() {
  return waveNumber;
}

export function getKills() {
  return kills;
}

export function getElapsedMs() {
  return elapsedMs;
}
