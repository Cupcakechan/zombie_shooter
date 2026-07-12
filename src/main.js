// main.js — boot entry + frame loop. The only module allowed to touch the
// real canvas/renderer, and the only one excluded from the Node test suite
// for that reason: keep it thin glue, put logic in the other modules.
// (Module scripts are deferred, so the DOM is ready when this runs — no
// DOMContentLoaded wrapper needed.)

import * as THREE from '../lib/three.module.js';
import { CONFIG } from './config.js';
import { States, getState, setState, onEnter } from './state.js';
import { initInput, requestLock, getLook, getMoveAxes, onFire, onReload } from './input.js';
import {
  resetAmmo, canFire as ammoCanFire, consumeRound, startReload,
  updateAmmo, getMag, isReloading, reloadProgress,
} from './game/ammo.js';
import { createRange } from './render/scene.js';
import { createFogBank } from './render/fogBank.js';
import { buildMap } from './render/mapGen.js';
import { MAPS, ACTIVE_MAP_ID } from './data/maps.js';
import { WAVES } from './data/waveTable.js';
import { ENEMY_TYPES } from './data/enemyTypes.js';
import {
  parseLayout, playerWorldStart, buildColliders, worldToCell, cellToWorld,
  perimeterSpawnCells, windowEntrySpots,
} from './game/mapGrid.js';
import { buildFlowField } from './game/flowField.js';
import { createGun, kick, updateGun, setReloadProgressSource } from './render/gun.js';
import {
  initTargets, resetTargets, clearTargets,
  getHittables as getTargetHittables, hitTarget, updateTargets,
} from './render/targets.js';
import {
  initEnemies, spawnEnemy, resetEnemies, updateEnemies,
  getEnemyHittables, getLivingPositions, damageEnemy, setMapColliders,
  setFlowField, getCongestedWindows,
} from './render/enemies.js';
import {
  initBloodFX, spawnBurst, spawnPool, updateBloodFX, resetBloodFX,
} from './render/bloodFX.js';
import {
  initCasings, spawnCasing, updateCasings, resetCasings,
} from './render/casings.js';
import {
  computeMove, clampToArena, resolveCircleObstacles, resolveCircleAABBs,
} from './game/movement.js';
import { initShooting } from './game/shooting.js';
import {
  registerHit, registerMiss, resetScoring,
  getScore, getMultiplier, getAccuracy, getBestStreak,
} from './game/scoring.js';
import { initRound, beginCountdown, updateRound, getRemainingS } from './game/round.js';
import { saveBestIfBeaten } from './game/best.js';
import { resetPlayer, damagePlayer, getHits, isDead } from './game/player.js';
import {
  initWaves, startWaves, updateWaves, notifyKill,
  getWave, getKills, getElapsedMs,
} from './game/waves.js';
import {
  initHud, showForState, flashLockHint,
  setScore, setMultiplier, setCountdown, setTimer,
  setHearts, setWave, setKills, showWaveBanner,
  flashDamage, flashBloodSplatter, showGameOver, showResults, setAmmo,
} from './ui/hud.js';

const canvas = document.getElementById('game-canvas');
if (!canvas) throw new Error('main.js: #game-canvas not found in index.html');

// — Mode: which ruleset the current session uses. Single writer (the two
// START buttons); everything else reads it. 'range' = 60s score attack;
// 'waves' = untimed last-stand.
let mode = 'range';

// Camera damage-kick state (a brief pitch jolt layered over the look).
let shakeT = 0;

// Arena bounds for the player, derived once from the wall geometry.
const ARENA_BOUNDS = {
  minX: -CONFIG.RANGE.WIDTH / 2 + CONFIG.PLAYER.WALL_MARGIN,
  maxX: CONFIG.RANGE.WIDTH / 2 - CONFIG.PLAYER.WALL_MARGIN,
  minZ: CONFIG.RANGE.BACK_Z + CONFIG.PLAYER.WALL_MARGIN,
  maxZ: CONFIG.RANGE.FRONT_Z - CONFIG.PLAYER.WALL_MARGIN,
};

// — Renderer —
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Cap pixel ratio at 2: above that, high-DPI screens pay a big fill-rate
// cost for no visible gain.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// — Scene + camera —
const scene = createRange();
const camera = new THREE.PerspectiveCamera(
  CONFIG.FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  120,
);
// YXZ order = yaw applied before pitch, the standard FPS camera rig.
camera.rotation.order = 'YXZ';
camera.position.set(0, CONFIG.EYE_HEIGHT, 0);
// Camera lives in the scene graph so camera-space children render normally.
scene.add(camera);

// — Gun viewmodel: parented to the camera so it rides every look movement —
// The viewmodel lives on RENDER LAYER 1 (4.2b): the world renders first,
// the depth buffer is cleared, then the gun renders on top — so it can
// never clip into a wall the player stands against. The muzzle light stays
// on BOTH layers so it still lights the world.
const gunModel = createGun();
gunModel.traverse((o) => {
  o.layers.set(1);
  if (o.isLight) o.layers.enable(0);
});
camera.add(gunModel);
// The scene's lights must also light layer 1, or the gun renders black.
scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
renderer.autoClear = false;

// — Fog bank: Waves-only atmosphere, built once and toggled per round (see
// the COUNTDOWN handler). Zombies spawn inside it and fade in as they
// emerge — the fade itself lives in enemies.js.
// — The house (Stage 4, pass 4.1): generated from the map registry, shown
// in Waves. VISUAL ONLY this pass — walls don't collide (4.2) and zombies
// beeline through them (4.3); both are the named next passes.
const activeMap = MAPS[ACTIVE_MAP_ID];
const houseMap = buildMap(activeMap);
// Map meshes double as raycast occluders (4.2): a wall eats the bullet.
const mapWallMeshes = [];
// Where this map says the player starts (4.1b: the map owns the start).
const activeGrid = parseLayout(activeMap);
const mapStart = playerWorldStart(activeMap, activeGrid);
// Wall colliders (4.2): derived from the same cells as the geometry, so
// the visual walls and the solid walls cannot disagree. Waves-only via the
// per-mode setter below; the player-side resolve gates on the same array.
const mapColliders = buildColliders(activeMap, activeGrid);
// Spawn geometry (4.3c): ALL derived from the grid — perimeter candidates
// on the map's edge ring, window entry spots via the exterior flood, and
// every walkable cell as the last-resort fallback. Retires the
// hand-authored SPAWN_POINTS (two sat inside wall cells — LESSONS).
const spawnPerimeter = perimeterSpawnCells(activeGrid, ['north', 'east', 'west']);
const spawnWindows = windowEntrySpots(activeGrid);
const spawnAnywhere = [];
for (let r = 0; r < activeGrid.rows; r++) {
  for (let c = 0; c < activeGrid.cols; c++) {
    if (activeGrid.walkable(c, r)) spawnAnywhere.push({ c, r });
  }
}
let activeColliders = [];
// The player cell the flow field was last built FROM (4.3). null forces a
// rebuild on the next PLAYING frame — mode switches reset it. The
// congestion signature (4.3b.1) forces the same rebuild when window queues
// fill or drain, so full windows drop out of everyone else's route.
let navLastCell = null;
let navLastCongSig = '';
houseMap.visible = false;
scene.add(houseMap);
houseMap.traverse((c) => { if (c.isMesh) mapWallMeshes.push(c); });

const fogBank = createFogBank();
fogBank.visible = false;
scene.add(fogBank);

// — Player damage: hearts, vignette, camera kick, and — at zero — game over.
function handlePlayerHit(damage) {
  if (getState() !== States.PLAYING || mode !== 'waves') return;
  damagePlayer(damage);
  setHearts(getHits(), CONFIG.PLAYER.MAX_HITS);
  flashDamage();
  flashBloodSplatter();
  shakeT = CONFIG.PLAYER.DAMAGE_SHAKE_MS;
  if (isDead()) setState(States.GAMEOVER);
}

// — Targets + enemies: modules initialised empty-handed; what actually
// spawns is decided per-mode in the COUNTDOWN enter handler below.
initTargets(scene);
initBloodFX(scene);
initCasings(scene);

// — Reload wiring (pass 9): one entry point so R and the empty click behave
// identically; startReload() itself refuses full-mag and mid-reload calls.
function beginReload() {
  if (startReload()) setAmmo(getMag(), CONFIG.AMMO.MAG_SIZE, true);
}
onReload(() => {
  if (getState() === States.PLAYING) beginReload();
});
// Clicking on an empty mag never reaches shooting's callbacks (canFire gates
// it first), so the auto-reload listens to the raw fire hook instead.
onFire(() => {
  if (getState() === States.PLAYING && getMag() === 0 && !isReloading()) beginReload();
});
// The gun-dip telegraph reads reload progress straight from ammo.
setReloadProgressSource(reloadProgress);

// Ejection: the port sits just above/forward of the gun in camera space;
// localToWorld turns it into the world point the casing spawns at. Scratch
// vector reused per shot — no allocation in the fire path.
const EJECT_PORT = new THREE.Vector3();
function ejectCasing() {
  EJECT_PORT.set(
    CONFIG.GUN.OFFSET_X,
    CONFIG.GUN.OFFSET_Y + CONFIG.CASINGS.PORT_UP,
    CONFIG.GUN.OFFSET_Z + CONFIG.CASINGS.PORT_FWD,
  );
  camera.localToWorld(EJECT_PORT);
  spawnCasing(EJECT_PORT, getLook().yaw);
}

initEnemies(scene, {
  onPlayerHit: handlePlayerHit,
  onEnemyKilled: (typeId, pos) => {
    notifyKill();
    setKills(getKills());
    // The kill payoff: a floor stain under the body + an upward eruption
    // (no ray direction on purpose — a fountain reads as the finisher).
    if (pos) {
      spawnPool(pos.x, pos.z);
      spawnBurst({ x: pos.x, y: 1.1, z: pos.z }, null, CONFIG.BLOOD.KILL_PARTICLES);
    }
  },
});

// — Wave manager: spawn + entry picker injected so waves.js stays
// render-free. waves decides the KIND mix per wave (4.3c); this picker
// turns a kind into a place. Fallback chain never returns null: far
// perimeter → any perimeter → any far walkable → any walkable → origin.
function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickEntry(kind) {
  const px = camera.position.x;
  const pz = camera.position.z;
  const minD = WAVES.SPAWN.MIN_PLAYER_DIST;
  const farEnough = (cells) => cells.filter((cl) => {
    const w = cellToWorld(activeMap, activeGrid, cl.c, cl.r);
    return Math.hypot(w.x - px, w.z - pz) >= minD;
  });
  if (kind === 'window' && spawnWindows.length > 0) {
    const spot = randomOf(spawnWindows);
    // Spawn AT the facing standoff (CELL/2 + reach + reach radius + a
    // hair), not the cell centre — the centre sits INSIDE the reach
    // resolver's standoff, and the frame-one settling scoot reads as
    // jank at the glass. Probe-caught. proto_zombie is the only spawned
    // type today; when 7c adds types, pickEntry gains the typeId.
    const zt = ENEMY_TYPES.proto_zombie;
    const standoff = activeMap.CELL / 2
      + (zt.WALL ? zt.WALL.REACH + zt.WALL.RADIUS : 0) + 0.05;
    const wPos = cellToWorld(activeMap, activeGrid, spot.wc, spot.wr);
    const ax = spot.outC - spot.wc; // unit axis toward the street
    const az = spot.outR - spot.wr;
    const L = WAVES.SPAWN.WINDOW_LOITER_MS;
    return {
      pos: { x: wPos.x + ax * standoff, z: wPos.z + az * standoff },
      opts: {
        holdMs: L.MIN + Math.random() * (L.MAX - L.MIN), // the dread beat
        yaw: Math.atan2(-ax, -az), // face the glass
      },
    };
  }
  const pools = [farEnough(spawnPerimeter), spawnPerimeter,
    farEnough(spawnAnywhere), spawnAnywhere];
  for (const pool of pools) {
    if (pool.length > 0) {
      const cl = randomOf(pool);
      return { pos: cellToWorld(activeMap, activeGrid, cl.c, cl.r), opts: {} };
    }
  }
  return { pos: { x: 0, z: 0 }, opts: {} }; // unreachable on any real map
}
initWaves({
  spawn: (typeId, pos, opts) => spawnEnemy(typeId, pos, opts),
  onWaveStart: (n) => {
    setWave(n);
    showWaveBanner(n);
  },
  pickEntry,
});

// — Scoring → HUD —
function refreshHud() {
  setScore(getScore());
  setMultiplier(getMultiplier());
}

// — Shooting: unified hit pipeline. Targets and enemy body parts are
// raycast together; the nearest wins and the tag routes it. Range scoring
// only runs in Range mode; enemy hits touch no range scoring. Every real
// shot kicks the gun.
initShooting({
  camera,
  getHittables: () => (mode === 'waves'
    ? [...getTargetHittables(), ...getEnemyHittables(), ...mapWallMeshes]
    : [...getTargetHittables(), ...getEnemyHittables()]),
  canFire: () => getState() === States.PLAYING && ammoCanFire(),
  onHit: (mesh, point, rayDir) => {
    kick();
    ejectCasing();
    consumeRound();
    setAmmo(getMag(), CONFIG.AMMO.MAG_SIZE, false);
    if (mesh.userData.kind === 'enemy') {
      // Damage first so the burst can size itself: a headshot sprays double
      // (the reward has to READ). The kill eruption + pool fire inside via
      // the onEnemyKilled callback, same frame.
      const res = damageEnemy(mesh);
      if (point) {
        const n = res && res.part === 'head'
          ? CONFIG.BLOOD.HIT_PARTICLES * 2
          : CONFIG.BLOOD.HIT_PARTICLES;
        spawnBurst(point, rayDir, n);
      }
      return;
    }
    if (mesh.userData.kind === 'wall') {
      // The wall ate the bullet (4.2): the shot was real (kick, casing,
      // round consumed above) — it just hit architecture. Waves is
      // scoring-neutral, so nothing else to do.
      return;
    }
    // hitTarget() can only refuse an already-popping sphere; hittables are
    // filtered at raycast time, so a refusal means a race — count it as a
    // miss rather than paying for a target that didn't pop.
    if (hitTarget(mesh)) registerHit();
    else registerMiss();
    refreshHud();
  },
  onMiss: () => {
    kick();
    ejectCasing();
    consumeRound();
    setAmmo(getMag(), CONFIG.AMMO.MAG_SIZE, false);
    if (mode !== 'range') return; // Waves owns no range scoring
    registerMiss();
    refreshHud();
  },
});

// — Round clock —
initRound({
  onCountdownTick: (n) => setCountdown(n),
  onCountdownDone: () => setState(States.PLAYING),
  onRoundEnd: () => setState(States.RESULTS), // timed (Range) only
});

// — UI + input wiring — mode buttons set the mode THEN request the lock; the
// state the lock lands in is decided by where we came FROM (see COUNTDOWN).
initHud({
  onRangeClick: () => { mode = 'range'; requestLock(canvas); },
  onWavesClick: () => { mode = 'waves'; requestLock(canvas); },
  onResumeClick: () => requestLock(canvas),
  onPlayAgainClick: () => requestLock(canvas),
  onRetryClick: () => requestLock(canvas),
  onQuitClick: () => {
    // PAUSED/GAMEOVER already have the pointer free; just clean the arena
    // and go home. Fresh setup happens on the next mode entry anyway.
    resetEnemies();
    setState(States.START);
  },
});

initInput({
  onLockChange: (locked) => {
    if (locked) {
      // Gaining the lock always means "run the 3-2-1" — whether it's a fresh
      // round or a resume is decided inside the COUNTDOWN enter handler.
      setState(States.COUNTDOWN);
    } else if (getState() === States.PLAYING || getState() === States.COUNTDOWN) {
      // ESC / alt-tab while playing OR mid-countdown = pause. Lock loss in
      // RESULTS/GAMEOVER is our own exitPointerLock() and must NOT pause.
      setState(States.PAUSED);
    }
  },
  onLockError: () => flashLockHint(),
});

// Every state change drives the overlay layer (mode-aware).
Object.values(States).forEach((s) => onEnter(s, () => showForState(s, mode)));

// COUNTDOWN carries the fresh-vs-resume decision: arriving from PAUSED keeps
// score and clock; arriving from anywhere else (START, RESULTS, GAMEOVER) is
// a new round, set up per mode.
onEnter(States.COUNTDOWN, (prev) => {
  const fresh = prev !== States.PAUSED;
  if (fresh) {
    resetScoring();
    resetEnemies();
    resetBloodFX(); // stains and droplets belong to the round that made them
    resetCasings();
    resetAmmo();
    setAmmo(getMag(), CONFIG.AMMO.MAG_SIZE, false);
    // Fresh rounds start from the spot the arena was designed around.
    camera.position.set(0, CONFIG.EYE_HEIGHT, 0);
    if (mode === 'range') {
      fogBank.visible = false; // Range stays a crisp, clean shooting range
      houseMap.visible = false;
      activeColliders = [];
      setMapColliders([]);
      setFlowField(null); // Range: no map, no field — enemies (targets) N/A
      navLastCell = null;
      navLastCongSig = '';
      scene.fog.near = CONFIG.FOG.NEAR;
      scene.fog.far = CONFIG.FOG.FAR;
      resetTargets();
      refreshHud();
      setTimer(CONFIG.ROUND_LENGTH_S);
      beginCountdown({ fresh: true, timed: true });
    } else {
      fogBank.visible = true; // Waves: the murk the zombies walk out of
      houseMap.visible = true;
      activeColliders = mapColliders;
      setMapColliders(mapColliders);
      navLastCell = null; // field rebuilds on the first PLAYING frame (4.3)
      navLastCongSig = '';
      // Whole-arena murk (pass 8.2): distance fog pulled in for Waves only.
      // Camera-relative is RIGHT here — "everything past ~26 m is haze"
      // should follow the player; the perimeter banks stay the thickest part.
      scene.fog.near = CONFIG.FOG.WAVES.NEAR;
      scene.fog.far = CONFIG.FOG.WAVES.FAR;
      clearTargets(); // Waves: no practice targets in the arena
      resetPlayer();
      // The map owns the start position (Range keeps the origin).
      camera.position.set(mapStart.x, CONFIG.EYE_HEIGHT, mapStart.z);
      setHearts(getHits(), CONFIG.PLAYER.MAX_HITS);
      setKills(0);
      startWaves(); // wave 1 announces on the first PLAYING frame
      beginCountdown({ fresh: true, timed: false });
    }
    return;
  }
  beginCountdown({ fresh: false });
});

// RESULTS (Range only — untimed Waves never ends a round): release the mouse
// so Play Again is clickable, then show the stats.
onEnter(States.RESULTS, () => {
  if (document.pointerLockElement) document.exitPointerLock();
  const { best, isNew } = saveBestIfBeaten(getScore(), getAccuracy());
  showResults({
    score: getScore(),
    accuracy: getAccuracy(),
    bestStreak: getBestStreak(),
    best,
    isNew,
  });
});

// GAMEOVER (Waves only): release the mouse for Try Again / Quit, show stats.
onEnter(States.GAMEOVER, () => {
  if (document.pointerLockElement) document.exitPointerLock();
  showGameOver({
    kills: getKills(),
    wave: getWave(),
    seconds: Math.floor(getElapsedMs() / 1000),
  });
});

setState(States.START);
refreshHud(); // HUD shows a true zero state before the first shot

// — Resize —
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// — Frame loop —
let lastT = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  // Clamp so a stray long frame can't skip whole seconds of countdown/pops.
  const dtMs = Math.min(now - lastT, 100);
  lastT = now;

  const { yaw, pitch } = getLook();
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Damage kick: a decaying pitch wobble layered over the look for a beat.
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - dtMs);
    const k = shakeT / CONFIG.PLAYER.DAMAGE_SHAKE_MS;
    camera.rotation.x = pitch + Math.sin(shakeT * 0.09) * CONFIG.PLAYER.DAMAGE_SHAKE_AMP * k;
  }

  const st = getState();

  // — Player movement (PLAYING only, matching canFire): camera-relative
  // WASD, clamped to the arena, then pushed out of living zombie bodies —
  // walking THROUGH the mob would make being surrounded meaningless.
  if (st === States.PLAYING) {
    // Reload ticks ONLY while playing — a pause freezes it mid-motion, same
    // rule as the round clock. The completion tick refreshes the counter.
    if (updateAmmo(dtMs)) setAmmo(getMag(), CONFIG.AMMO.MAG_SIZE, false);

    const axes = getMoveAxes();
    if (axes.x !== 0 || axes.z !== 0) {
      const { dx, dz } = computeMove(
        axes.x, axes.z, yaw, CONFIG.PLAYER.MOVE_SPEED, dtMs,
      );
      const clamped = clampToArena(
        camera.position.x + dx, camera.position.z + dz, ARENA_BOUNDS,
      );
      const resolved = resolveCircleObstacles(
        clamped.x, clamped.z, getLivingPositions(), CONFIG.PLAYER.BODY_RADIUS,
      );
      // Walls resolve LAST (4.2): neither the step nor a zombie shove can
      // put the player inside a building wall.
      const walled = resolveCircleAABBs(
        resolved.x, resolved.z, activeColliders, CONFIG.PLAYER.BODY_RADIUS,
      );
      camera.position.x = walled.x;
      camera.position.z = walled.z;
    }
  }

  // The round clock ticks through countdown AND play; PAUSED starves it,
  // which is exactly what freezes the timer.
  if (st === States.COUNTDOWN || st === States.PLAYING) {
    updateRound(dtMs);
    updateTargets(dtMs); // pops may finish during a resume countdown
    updateGun(dtMs);     // recoil/flash settle even if the round just ended
  }
  if (st === States.PLAYING) {
    // The WORLD only simulates while playing (7a.5 fix): during a resume
    // countdown the player can't move or shoot, so zombies advancing through
    // the 3-2-1 was a free hit — everything freezes with the player now.
    // Flow field (4.3): rebuilt only when the player CHANGES CELL — one
    // ~500-cell BFS per change, serving every zombie. A non-walkable cell
    // (float edge against the fence clamp) keeps the LAST field rather
    // than seeding a bad one; zombies beeline-fallback per-cell anyway.
    if (mode === 'waves') {
      const cell = worldToCell(
        activeMap, activeGrid, camera.position.x, camera.position.z,
      );
      // Congested windows (4.3b.1) are priced out of the shared field —
      // committed climber/waiter pairs are state-driven and unaffected;
      // everyone else reroutes. The signature makes queue changes rebuild
      // the field just like a player cell-change does.
      const congested = getCongestedWindows();
      const congSig = congested.join(';');
      const cellChanged =
        !navLastCell || cell.c !== navLastCell.c || cell.r !== navLastCell.r;
      if (cellChanged || congSig !== navLastCongSig) {
        if (activeGrid.walkable(cell.c, cell.r)) {
          setFlowField({
            field: buildFlowField(activeGrid, cell, {
              windowCost: CONFIG.NAV.WINDOW_COST, // 4.3b: windows priced in
              blockedWindows: new Set(congested),
            }),
            map: activeMap,
            grid: activeGrid,
          });
          navLastCell = cell;
          navLastCongSig = congSig;
        }
      }
    }
    updateEnemies(dtMs, camera.position);
    updateBloodFX(dtMs);
    updateCasings(dtMs);
    if (mode === 'range') setTimer(getRemainingS());
    else updateWaves(dtMs); // spawning + intermissions only run while playing
  }

  // Two-pass render (4.2b): world (layer 0), clear depth, gun (layer 1).
  // The gun pass renders with the background NULLED — every render() call
  // repaints scene.background first, so leaving it on wiped the entire
  // world pass with sky colour (the 4.2b black-screen bug).
  renderer.clear();
  camera.layers.set(0);
  renderer.render(scene, camera);
  renderer.clearDepth();
  camera.layers.set(1);
  const worldBackground = scene.background;
  scene.background = null;
  renderer.render(scene, camera);
  scene.background = worldBackground;
  camera.layers.set(0);
});
