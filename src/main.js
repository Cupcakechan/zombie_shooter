// main.js — boot entry + frame loop. The only module allowed to touch the
// real canvas/renderer, and the only one excluded from the Node test suite
// for that reason: keep it thin glue, put logic in the other modules.
// (Module scripts are deferred, so the DOM is ready when this runs — no
// DOMContentLoaded wrapper needed.)

import * as THREE from '../lib/three.module.js';
import { CONFIG } from './config.js';
import { States, getState, setState, onEnter } from './state.js';
import { initInput, requestLock, getLook, getMoveAxes } from './input.js';
import { createRange } from './render/scene.js';
import { createFogBank } from './render/fogBank.js';
import { createGun, kick, updateGun } from './render/gun.js';
import {
  initTargets, resetTargets, clearTargets,
  getHittables as getTargetHittables, hitTarget, updateTargets,
} from './render/targets.js';
import {
  initEnemies, spawnEnemy, resetEnemies, updateEnemies,
  getEnemyHittables, getLivingPositions, damageEnemy,
} from './render/enemies.js';
import { computeMove, clampToArena, resolveCircleObstacles } from './game/movement.js';
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
  flashDamage, showGameOver, showResults,
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
camera.add(createGun());

// — Fog bank: Waves-only atmosphere, built once and toggled per round (see
// the COUNTDOWN handler). Zombies spawn inside it and fade in as they
// emerge — the fade itself lives in enemies.js.
const fogBank = createFogBank();
fogBank.visible = false;
scene.add(fogBank);

// — Player damage: hearts, vignette, camera kick, and — at zero — game over.
function handlePlayerHit(damage) {
  if (getState() !== States.PLAYING || mode !== 'waves') return;
  damagePlayer(damage);
  setHearts(getHits(), CONFIG.PLAYER.MAX_HITS);
  flashDamage();
  shakeT = CONFIG.PLAYER.DAMAGE_SHAKE_MS;
  if (isDead()) setState(States.GAMEOVER);
}

// — Targets + enemies: modules initialised empty-handed; what actually
// spawns is decided per-mode in the COUNTDOWN enter handler below.
initTargets(scene);
initEnemies(scene, {
  onPlayerHit: handlePlayerHit,
  onEnemyKilled: () => {
    notifyKill();
    setKills(getKills());
  },
});

// — Wave manager: spawn function injected so waves.js stays render-free.
initWaves({
  spawn: (typeId, pos, opts) => spawnEnemy(typeId, pos, opts),
  onWaveStart: (n) => {
    setWave(n);
    showWaveBanner(n);
  },
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
  getHittables: () => [...getTargetHittables(), ...getEnemyHittables()],
  canFire: () => getState() === States.PLAYING,
  onHit: (mesh) => {
    kick();
    if (mesh.userData.kind === 'enemy') {
      damageEnemy(mesh);
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
    // Fresh rounds start from the spot the arena was designed around.
    camera.position.set(0, CONFIG.EYE_HEIGHT, 0);
    if (mode === 'range') {
      fogBank.visible = false; // Range stays a crisp, clean shooting range
      resetTargets();
      refreshHud();
      setTimer(CONFIG.ROUND_LENGTH_S);
      beginCountdown({ fresh: true, timed: true });
    } else {
      fogBank.visible = true; // Waves: the murk the zombies walk out of
      clearTargets(); // Waves: no practice targets in the arena
      resetPlayer();
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
      camera.position.x = resolved.x;
      camera.position.z = resolved.z;
    }
  }

  // The round clock ticks through countdown AND play; PAUSED starves it,
  // which is exactly what freezes the timer (and the zombies).
  if (st === States.COUNTDOWN || st === States.PLAYING) {
    updateRound(dtMs);
    updateTargets(dtMs); // pops may finish during a resume countdown
    updateGun(dtMs);     // recoil/flash settle even if the round just ended
    updateEnemies(dtMs, camera.position);
  }
  if (st === States.PLAYING) {
    if (mode === 'range') setTimer(getRemainingS());
    else updateWaves(dtMs); // spawning + intermissions only run while playing
  }

  renderer.render(scene, camera);
});
