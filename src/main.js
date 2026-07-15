// main.js — boot entry + frame loop. The only module allowed to touch the
// real canvas/renderer, and the only one excluded from the Node test suite
// for that reason: keep it thin glue, put logic in the other modules.
// (Module scripts are deferred, so the DOM is ready when this runs — no
// DOMContentLoaded wrapper needed.)

import * as THREE from '../lib/three.module.js';
import { CONFIG } from './config.js';
import { States, getState, setState, onEnter } from './state.js';
import {
  initInput, requestLock, getLook, getMoveAxes, onFire, onReload, onSwapWeapon,
} from './input.js';
import {
  resetAmmo, canFire as ammoCanFire, consumeRound, startReload,
  updateAmmo, getMag, isReloading, reloadProgress,
  getActiveWeapon, getActiveWeaponId, setActiveWeapon, weaponIdForSlot, nextWeaponId,
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
import {
  createGuns, setActiveGun, kick, swingGun, updateGun, setReloadProgressSource,
} from './render/gun.js';
import {
  initTargets, resetTargets, clearTargets,
  getHittables as getTargetHittables, hitTarget, updateTargets,
} from './render/targets.js';
import {
  initEnemies, spawnEnemy, resetEnemies, updateEnemies,
  getEnemyHittables, getLivingPositions, damageEnemy, setMapColliders,
  setFlowField, getCongestedWindows, blastDamage,
} from './render/enemies.js';
import {
  initBloodFX, spawnBurst, spawnPool, updateBloodFX, resetBloodFX,
} from './render/bloodFX.js';
import {
  initProjectiles, spawnGlob, updateProjectiles, resetProjectiles,
} from './render/projectiles.js';
import {
  initBlastFX, spawnBlast, updateBlastFX, resetBlastFX,
} from './render/blastFX.js';
import {
  initCasings, spawnCasing, updateCasings, resetCasings,
} from './render/casings.js';
import {
  computeMove, clampToArena, resolveCircleObstacles, resolveCircleAABBs,
} from './game/movement.js';
import { initShooting, resetShooting } from './game/shooting.js';
import { initMelee, resetMelee } from './game/melee.js';
import {
  registerHit, registerMiss, resetScoring,
  getScore, getMultiplier, getAccuracy, getBestStreak,
} from './game/scoring.js';
import { initRound, beginCountdown, updateRound, getRemainingS } from './game/round.js';
import { saveBestIfBeaten } from './game/best.js';
import { resetPlayer, damagePlayer, getHits, isDead } from './game/player.js';
import {
  initWaves, startWaves, updateWaves, notifyKill,
  getWave, getKills, getElapsedMs, scoreKill, getWavesScore,
} from './game/waves.js';
import {
  initHud, showForState, flashLockHint,
  setScore, setMultiplier, setCountdown, setTimer,
  setHearts, setWave, setKills, showWaveBanner,
  flashDamage, flashBloodSplatter, showGameOver, showResults, setAmmo,
  setWavesScore, showPraise,
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
const gunModel = createGuns();
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
// Globs damage the player exactly like a claw does — handlePlayerHit already
// owns the hearts, the vignette, the splatter, the shake, and the game-over
// check, so a spit inherits every bit of that feedback for free.
initProjectiles(scene, { onPlayerHit: handlePlayerHit });
// Pure decoration — no callback, because a blast's damage is already resolved
// by detonate() the same frame it fires. This module only draws.
initBlastFX(scene);

// — Reload wiring (pass 9): one entry point so R and the empty click behave
// identically; startReload() itself refuses full-mag and mid-reload calls.
function beginReload() {
  if (startReload()) setAmmo(getActiveWeapon(), getMag(), true);
}
onReload(() => {
  if (getState() === States.PLAYING) beginReload();
});

// — Weapon swap (pass 17): 1 / 2 pick a slot, Q cycles. input.js sends a slot
// number or null and knows no roster; ammo.js owns the roster and the active
// id; gun.js owns which viewmodel is drawn. main only makes those three agree,
// which is the whole of its job. setActiveWeapon refuses a no-op swap, so
// pressing 1 while already holding the pistol can't cancel a reload by accident.
onSwapWeapon((slot) => {
  if (getState() !== States.PLAYING) return;
  const id = slot === null ? nextWeaponId() : weaponIdForSlot(slot);
  if (!id) return; // a slot with no weapon in it: silence, not a crash
  if (!setActiveWeapon(id)) return;
  setActiveGun(id);
  setAmmo(getActiveWeapon(), getMag(), isReloading());
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

// The Exploder's blast (pass 14). Thin wiring on purpose: the damage model
// is blastDamage() in enemies.js, where the suite can drive it — main.js is
// DOM-coupled and never imported by test_suite.mjs.
//
// Fires on ANY death of a type carrying an EXPLODE block, including a
// leg-crippled one: rec.type survives beginCrawl, so a crawling exploder is
// still an exploder with no extra wiring. Two free interactions fall out of
// startDeath's existing order, both worth knowing before tuning:
//   • the anchor is the pass-12 eruption point (the LIVE waist), so a prone
//     exploder detonates at its corpse rather than at standing chest height;
//   • a climber shot off the sill is teleported back OUTSIDE before this
//     callback runs, so killing an exploder mid-vault detonates it outside
//     the wall. Shooting the free-hit window is already the right answer,
//     and against this type it's also the SAFE one.
//
// Distance is XZ, like every other range in this project (the attack gate,
// separation, the flow field). The anchor's y comes from last frame's
// matrixWorld — fine for a fountain, and irrelevant here because y is not
// in the test.
//
// Player only, deliberately. An AoE that damaged other zombies would bump
// the kill counter through notifyKill() below while scoreKill() stayed back
// in onHit with the part context — kills and score would visibly disagree
// within one wave. That's a scoring decision, and it gets its own round.
function detonate(typeId, pos) {
  const type = ENEMY_TYPES[typeId];
  const E = type?.EXPLODE;
  if (!E) return; // every non-exploder death: inert, one property read
  const at = { x: pos.x, y: pos.y ?? 1.1, z: pos.z };
  // 14c: the same anchor now feeds three things that read as ONE event — an
  // acid gore THROW (radial, no exit side), a flash sized to the core band,
  // and a ground ring that lands on EXPLODE.RADIUS. The dimensions all come
  // from E, so tuning the registry moves the picture too.
  spawnBurst(at, null, E.PARTICLES, {
    color: E.FX_COLOR,
    speed: CONFIG.BLAST.BURST_SPEED,
    radial: true,
  });
  spawnBlast(at, E);
  const dmg = blastDamage(
    type,
    Math.hypot(camera.position.x - pos.x, camera.position.z - pos.z),
  );
  // handlePlayerHit owns the state/mode guard, the HUD, and the game-over
  // check — the blast is just another source of hits.
  if (dmg > 0) handlePlayerHit(dmg);
}

initEnemies(scene, {
  onPlayerHit: handlePlayerHit,
  // The Spitter (pass 15): enemies.js doesn't know what a glob IS — it
  // reports that a RANGED type released something, and from where. main owns
  // the camera, so main owns the aim: the glob is thrown at the player's
  // HEAD, at the position it occupied the instant the strike beat landed.
  // Everything after that is ballistics and your feet.
  onRangedAttack: (typeId, from) => {
    spawnGlob(ENEMY_TYPES[typeId], from, {
      x: camera.position.x, y: camera.position.y, z: camera.position.z,
    });
  },
  onEnemyKilled: (typeId, pos) => {
    notifyKill();
    setKills(getKills());
    // The kill payoff: a floor stain under the body + an upward eruption
    // (no ray direction on purpose — a fountain reads as the finisher).
    if (pos) {
      spawnPool(pos.x, pos.z);
      spawnBurst({ x: pos.x, y: pos.y ?? 1.1, z: pos.z }, null, CONFIG.BLOOD.KILL_PARTICLES);
      detonate(typeId, pos); // inert for every type without an EXPLODE block
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
function pickEntry(kind, typeId) {
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
    // jank at the glass. Probe-caught. The standoff derives from the
    // ACTUAL spawning type's reach (7d) — guarded back to the Shambler
    // for legacy callers without a typeId.
    const zt = ENEMY_TYPES[typeId] || ENEMY_TYPES.proto_zombie;
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
  getWeapon: getActiveWeapon,
  // ONE call per trigger pull (pass 17). `hits` is the PELLET results and is
  // empty when the whole pattern missed — there is no onMiss any more,
  // because with eight pellets in the air 'hit' and 'miss' stopped being
  // opposites. Everything belonging to the SHOT happens once, out here;
  // everything belonging to a PELLET happens in the loop. That division is
  // the entire reason a shotgun costs one round instead of eight, and it is
  // structural rather than remembered: there is no loop out here to get wrong.
  onShot: (hits, weapon) => {
    kick();
    ejectCasing();
    consumeRound();
    setAmmo(getActiveWeapon(), getMag(), false);

    // Per-pellet spray, divided so a shot's TOTAL mess stays roughly constant
    // whatever the pellet count. Undivided, a point-blank shotgun would ask
    // for 8 x HIT_PARTICLES = 80 from a 64-slot pool and starve the kill
    // eruption firing two lines later — spawnBurst degrades by spraying less,
    // so that bug would surface as a missing payoff, never as a crash.
    // At PELLETS 1 this is HIT_PARTICLES exactly: the pistol is untouched.
    const perPellet = Math.max(
      2,
      Math.round(CONFIG.BLOOD.HIT_PARTICLES / Math.max(1, weapon.PELLETS)),
    );

    let popped = false; // did ANY pellet pop a Range target?
    for (const { mesh, point, rayDir } of hits) {
      if (mesh.userData.kind === 'enemy') {
        // Damage first so the burst can size itself: a headshot sprays double
        // (the reward has to READ). The kill eruption + pool fire inside via
        // the onEnemyKilled callback, same frame. Every pellet damages
        // separately — eight pellets in one head IS the shotgun, and the
        // spread thinning with distance IS its falloff.
        const res = damageEnemy(mesh);
        if (point) {
          // Double spray on a headshot AND on the leg-destroying hit (7c) —
          // the collapse is a payoff and the transform has to READ.
          const n = res && (res.part === 'head' || res.legsOut)
            ? perPellet * 2
            : perPellet;
          spawnBurst(point, rayDir, n);
        }
        // Kill scoring (pass 10): enemies exist only in Waves, so no mode
        // guard is needed here. Headshot kills get the praise popup — the
        // +pts it prints is the REAL awarded number from the single write site.
        if (res && res.killed) {
          const pts = scoreKill(res);
          setWavesScore(getWavesScore());
          if (res.part === 'head') showPraise(`HEADSHOT +${pts}`);
        }
        continue;
      }
      // The wall ate the pellet (4.2): the shot was real (kick, casing, round
      // consumed above) — it just hit architecture. Waves is scoring-neutral.
      if (mesh.userData.kind === 'wall') continue;
      // hitTarget() can only refuse an already-popping sphere; hittables are
      // filtered at raycast time, so a refusal means a race — don't pay for a
      // target that didn't pop.
      if (hitTarget(mesh)) popped = true;
    }

    // Range scoring: ONE accuracy sample per SHOT, never per pellet. This is
    // the line the old shape got wrong for free — eight pellets into one
    // sphere would have logged one pop and SEVEN misses, because hitTarget
    // refuses an already-popping target. Accuracy means 'did that trigger
    // pull connect', so one pull is one sample, and a shell that clears three
    // targets is one hit and three pops. Waves owns no range scoring, and in
    // Range the hittables are targets only, so `popped` is the whole story.
    if (mode === 'range') {
      if (popped) registerHit();
      else registerMiss();
      refreshHud();
    }
  },
});

// — Melee: the bash (17a). Thin wiring, like the blast: melee.js owns the
// cooldown and the ray, enemies.js owns what a flat hit MEANS, and this
// handler only spends the results. Compare it to onShot's enemy branch above —
// it is deliberately the same shape, and the differences are all things that
// switch themselves off rather than things this code remembers to skip.
initMelee({
  camera,
  // Enemies only. Not targets (Range has no melee at all — see canSwing), and
  // not walls: a bash that "hit" architecture would swing, spend the cooldown
  // and report a hit on a mesh damageEnemy can't find, which is a null result
  // and a silently swallowed swing. Leaving walls out of the list makes a bash
  // near a wall a clean MISS instead.
  getHittables: () => getEnemyHittables(),
  // Daniel's call: no melee in Range. That is cleaner than letting it swing at
  // targets and then special-casing the accuracy sample — a bash is not a shot,
  // and the pass-17 lesson is that the cheapest way to never miscount a sample
  // is to have no path that could. Range keeps exactly the inputs it had.
  canSwing: () => getState() === States.PLAYING && mode === 'waves',
  onSwing: (hit) => {
    // Every accepted swing moves the gun, hit or miss — the whiff has to read,
    // or a bash into empty air is indistinguishable from a dropped keypress.
    swingGun();
    if (!hit) return;

    const res = damageEnemy(hit.mesh, CONFIG.MELEE.DAMAGE);
    if (!res) return; // already dying, or a mesh with no record: never throw

    // Single spray, always. Not a decision made here — res.part is 'melee' for
    // a bash, so the head/legsOut double-spray test above simply cannot be true.
    // rayDir null lets the burst pick its own directions (the pass-8.3 default).
    if (hit.point) spawnBurst(hit.point, null, CONFIG.BLOOD.HIT_PARTICLES);

    if (res.killed) {
      // scoreKill multiplies on part === 'head'. A bash reports 'melee', so it
      // takes the flat registry bounty BY CONSTRUCTION — no melee bonus, ever.
      // That is not squeamishness about a nice-to-have: the genre report has
      // COD going flat per-kill specifically to kill "farm by shooting legs and
      // meleeing", and once pass 19's wallet lands, a melee bonus would make
      // bashing the dominant INCOME strategy and quietly retire the shotgun.
      // Melee is an ammo decision. It must never become a points decision.
      scoreKill(res);
      setWavesScore(getWavesScore());
      // No praise popup: showPraise is the headshot's payoff (pass 10) and a
      // bash has no head to hit.
    }
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
    resetBlastFX(); // ...and so does a shockwave mid-expansion
    resetCasings();
    resetProjectiles(); // a glob in flight must not outlive its round
    resetAmmo();
    resetShooting(); // a new round must not inherit the last one's trigger timing
    resetMelee();    // ...nor the last one's swing timing
    setActiveGun(getActiveWeaponId());
    setAmmo(getActiveWeapon(), getMag(), false);
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
      setWavesScore(0);
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
    score: getWavesScore(),
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
    if (updateAmmo(dtMs)) setAmmo(getActiveWeapon(), getMag(), false);

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
            // The ground field (7c): windowCost 0 = windows not traversable
            // at all — byte-identical to the plain 4.3a field. Crawlers
            // read THIS one, so a non-climber's route contains no windows
            // BY CONSTRUCTION (it can never strand at glass it can't
            // climb). Congestion doesn't touch it, but rebuilding both on
            // the same trigger is one cheap extra BFS and zero extra state.
            groundField: buildFlowField(activeGrid, cell, { windowCost: 0 }),
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
    updateBlastFX(dtMs);
    updateCasings(dtMs);
    // The camera IS the player column's top — see projectiles.js for why
    // that's the honest reading rather than a PLAYER.HEIGHT constant.
    updateProjectiles(dtMs, camera.position);
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
