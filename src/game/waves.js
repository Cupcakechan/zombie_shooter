// game/waves.js — the wave manager. Owns wave progression (cleared-based:
// intermission → staggered spawns → all dead → next), and the waves-session
// stats (kills, elapsed time) previously squatting in main.js. Render-free:
// the spawn function is INJECTED, so this module stays pure logic and the
// suite can import it safely.

import { WAVES } from '../data/waveTable.js';
import { CONFIG } from '../config.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';

// ————— Pure composition math (suite-tested) —————

// Wave HP multiplier (pass 12), pure with an injectable config so the
// suite can pin the guard: flat 1.0 through RAMP_START (the one-shot
// era is a CHOSEN number, not an accident), then STEP per wave to CAP.
// A table without an HP block scales nothing — old saves of the file
// keep today's behavior.
export function hpMultAt(n, hpCfg = WAVES.HP) {
  if (!hpCfg) return 1;
  return Math.min(
    hpCfg.CAP ?? 1,
    1 + (hpCfg.STEP ?? 0) * Math.max(0, n - (hpCfg.RAMP_START ?? Infinity)),
  );
}

// What wave n consists of. Table waves verbatim; beyond the table, the
// EXTEND formula continues forever — speed capped, and the window-entry
// share creeping up by WINDOW_STEP per wave to its own cap (4.3c).
export function waveSpec(n) {
  const { TABLE, EXTEND } = WAVES;
  if (n <= TABLE.length) {
    const row = TABLE[n - 1];
    return {
      count: row.count, speedMult: row.speedMult, entry: row.entry,
      // Guarded: a hand-edited row without types stays all-Shambler.
      types: row.types ?? { proto_zombie: 1 },
      hpMult: hpMultAt(n),
    };
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
    types: last.types ?? { proto_zombie: 1 }, // the last mix carries forever
    hpMult: hpMultAt(n),
  };
}

// The type of each zombie in a wave (7d), pure with an injected rand.
// Largest-remainder rounding: floors first, then the highest remainders
// absorb the leftover — assignments always sum to COUNT exactly, which
// simple per-share rounding can't promise once there are 3+ types.
// Fisher–Yates after, same reason as entryKinds (mix lands anywhere in
// the spawn stagger).
export function typeAssignments(count, types, rand) {
  const entries = Object.entries(types ?? {}).filter(([, w]) => w > 0);
  if (entries.length === 0 || count <= 0) {
    return Array(Math.max(0, count)).fill('proto_zombie');
  }
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const raw = entries.map(([id, w]) => {
    const exact = (count * w) / total;
    return { id, exact, base: Math.floor(exact) };
  });
  let used = raw.reduce((sum, r) => sum + r.base, 0);
  raw.sort((a, b) => (b.exact - b.base) - (a.exact - a.base));
  for (let i = 0; used < count; i += 1, used += 1) {
    raw[i % raw.length].base += 1;
  }
  const ids = [];
  for (const r of raw) for (let k = 0; k < r.base; k += 1) ids.push(r.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = ids[i];
    ids[i] = ids[j];
    ids[j] = t;
  }
  return ids;
}

// Pair entry kinds with type assignments (7d): 'window' slots must hold
// climb-capable types — a prone-spawning type at the glass would just
// stand outside forever (it can't vault). Swap-repair preserves BOTH
// multisets (suite-pinned); if windows outnumber climbers, the leftover
// window slots DEMOTE to perimeter rather than strand a spawn.
export function pairSpawns(kinds, typeIds, canWindow) {
  const outKinds = kinds.slice();
  const outTypes = typeIds.slice();
  for (let i = 0; i < outKinds.length; i += 1) {
    if (outKinds[i] !== 'window' || canWindow(outTypes[i])) continue;
    let swapped = false;
    for (let j = 0; j < outKinds.length; j += 1) {
      if (outKinds[j] === 'perimeter' && canWindow(outTypes[j])) {
        const t = outTypes[i];
        outTypes[i] = outTypes[j];
        outTypes[j] = t;
        swapped = true;
        break;
      }
    }
    if (!swapped) outKinds[i] = 'perimeter'; // no climber left — demote
  }
  return { kinds: outKinds, typeIds: outTypes };
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
let score = 0;
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
  score = 0;
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
  const rawKinds = entryKinds(spec.count, spec.entry, Math.random);
  const rawTypes = typeAssignments(spec.count, spec.types, Math.random);
  // Climb capability derives from the registry — prone spawns can't take
  // window entries. Guarded lookup: an unknown id demotes gracefully.
  const canWindow = (id) => !(ENEMY_TYPES[id]?.SPAWN?.PRONE);
  const { kinds, typeIds } = pairSpawns(rawKinds, rawTypes, canWindow);
  pendingSpawns = kinds.map((kind, i) => ({
    typeId: typeIds[i], kind, speedMult: spec.speedMult, hpMult: spec.hpMult,
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
          const e = (pickEntryFn && pickEntryFn(s.kind, s.typeId)) || { pos: { x: 0, z: 0 }, opts: {} };
          spawnFn(s.typeId, e.pos, { speedMult: s.speedMult, hpMult: s.hpMult, ...e.opts });
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

// Score a kill (pass 10): the registry bounty times the headshot
// multiplier. Returns the points awarded so the caller can print them
// (the praise popup). Pass 11 turns this accumulator into the spendable
// currency — keep this the SINGLE write site.
export function scoreKill({ value, part } = {}) {
  const mult = part === 'head' ? CONFIG.WAVES_SCORE.HEADSHOT_MULT : 1;
  const pts = Math.round((value ?? 0) * mult);
  score += pts;
  return pts;
}

export function getWavesScore() {
  return score;
}

export function getElapsedMs() {
  return elapsedMs;
}
