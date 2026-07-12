// game/waves.js — the wave manager. Owns wave progression (cleared-based:
// intermission → staggered spawns → all dead → next), and the waves-session
// stats (kills, elapsed time) previously squatting in main.js. Render-free:
// the spawn function is INJECTED, so this module stays pure logic and the
// suite can import it safely.

import { WAVES } from '../data/waveTable.js';

// ————— Pure composition math (suite-tested) —————

// What wave n consists of. Table waves verbatim; beyond the table, the
// EXTEND formula continues forever — speed capped, and the window-entry
// share creeping up by WINDOW_STEP per wave to its own cap (4.3c).
export function waveSpec(n) {
  const { TABLE, EXTEND } = WAVES;
  if (n <= TABLE.length) {
    const row = TABLE[n - 1];
    return { count: row.count, speedMult: row.speedMult, entry: row.entry };
  }
  const last = TABLE[TABLE.length - 1];
  const extra = n - TABLE.length;
  const windowShare = Math.min(
    EXTEND.WINDOW_CAP,
    (last.entry?.window ?? 0) + EXTEND.WINDOW_STEP * extra,
  );
  return {
    count: last.count + EXTEND.COUNT_STEP * extra,
    speedMult: Math.min(EXTEND.SPEED_CAP, last.speedMult + EXTEND.SPEED_STEP * extra),
    entry: { perimeter: 1 - windowShare, window: windowShare },
  };
}

// The entry kind of each zombie in a wave (4.3c), pure with an injected
// rand so the suite can pin it: window count = round(count × window
// share), then a Fisher–Yates shuffle so window entries land anywhere in
// the spawn stagger, not always last.
export function entryKinds(count, entry, rand) {
  const p = Math.max(0, entry?.perimeter ?? 1);
  const w = Math.max(0, entry?.window ?? 0);
  const total = p + w;
  const windowCount = total > 0 ? Math.round((count * w) / total) : 0;
  const kinds = [];
  for (let i = 0; i < count; i++) kinds.push(i < windowCount ? 'window' : 'perimeter');
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = kinds[i];
    kinds[i] = kinds[j];
    kinds[j] = t;
  }
  return kinds;
}

// ————— Stateful wave management —————

let spawnFn = null;      // (typeId, pos, { speedMult, holdMs, yaw }) => void — injected
let onWaveStartCb = null; // (n) => void — fired at intermission start (banner)
let pickEntryFn = null;  // (kind: 'perimeter'|'window') => { pos, opts } — injected
                         // (4.3c: main owns the map + player, so main
                         // resolves WHERE a kind enters; this module only
                         // decides the mix — stays render-free and pure)

let phase = 'idle'; // 'idle' | 'intermission' | 'active'
let waveNumber = 0;
let kills = 0;
let elapsedMs = 0;
let aliveCount = 0;
let pendingSpawns = [];
let spawnGapT = 0;
let intermissionT = 0;

export function initWaves({ spawn, onWaveStart, pickEntry } = {}) {
  spawnFn = spawn || null;
  onWaveStartCb = onWaveStart || null;
  pickEntryFn = pickEntry || null;
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
  const kinds = entryKinds(spec.count, spec.entry, Math.random);
  pendingSpawns = kinds.map((kind) => ({
    typeId: 'proto_zombie', kind, speedMult: spec.speedMult,
  }));
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
        if (spawnFn) {
          // The picker turns a KIND into a place + entry opts (loiter,
          // facing). Absent picker (suite, legacy callers) degrades to the
          // arena origin — never a throw in the wave loop.
          const e = (pickEntryFn && pickEntryFn(s.kind)) || { pos: { x: 0, z: 0 }, opts: {} };
          spawnFn(s.typeId, e.pos, { speedMult: s.speedMult, ...e.opts });
        }
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
