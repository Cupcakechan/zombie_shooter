// main.js — boot entry + frame loop. The only module allowed to touch the
// real canvas/renderer, and the only one excluded from the Node test suite
// for that reason: keep it thin glue, put logic in the other modules.
// (Module scripts are deferred, so the DOM is ready when this runs — no
// DOMContentLoaded wrapper needed.)

import * as THREE from '../lib/three.module.js';
import { CONFIG } from './config.js';
import { States, getState, setState, onEnter } from './state.js';
import { initInput, requestLock, getLook } from './input.js';
import { createRange } from './render/scene.js';
import { createGun, kick, updateGun } from './render/gun.js';
import {
  initTargets, resetTargets, clearTargets,
  getHittables as getTargetHittables, hitTarget, updateTargets,
} from './render/targets.js';
import {
  initEnemies, spawnEnemy, resetEnemies, updateEnemies,
  getEnemyHittables, damageEnemy,
} from './render/enemies.js';
import { initShooting } from './game/shooting.js';
import {
  registerHit, registerMiss, resetScoring,
  getScore, getMultiplier, getAccuracy, getBestStreak,
} from './game/scoring.js';
import { initRound, beginCountdown, updateRound, getRemainingS } from './game/round.js';
import { saveBestIfBeaten } from './game/best.js';
import {
  initHud, showForState, flashLockHint,
  setScore, setMultiplier, setCountdown, setTimer, showResults,
} from './ui/hud.js';

const canvas = document.getElementById('game-canvas');
if (!canvas) throw new Error('main.js: #game-canvas not found in index.html');

// — Mode: which ruleset the current session uses. Single writer (the two
// START buttons); everything else reads it. 'range' = 60s score attack;
// 'waves' = untimed last-stand (threat systems arrive in 5b).
let mode = 'range';

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

// — Targets + enemies: modules initialised empty-handed; what actually
// spawns is decided per-mode in the COUNTDOWN enter handler below.
initTargets(scene);
initEnemies(scene);

// — Scoring → HUD —
function refreshHud() {
  setScore(getScore());
  setMultiplier(getMultiplier());
}

// — Shooting: unified hit pipeline. Targets and enemy body parts are
// raycast together; the nearest wins and the tag routes it. Range scoring
// only runs in Range mode; enemy hits touch no scoring anywhere (wave-mode
// kill scoring is defined in 5b/6). Every real shot kicks the gun.
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
  onQuitClick: () => {
    // Pause already released the pointer lock; just clean the arena and go
    // home. Fresh setup happens on the next mode entry anyway.
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
      // RESULTS is our own exitPointerLock() and must NOT pause.
      setState(States.PAUSED);
    }
  },
  onLockError: () => flashLockHint(),
});

// Every state change drives the overlay layer (mode-aware).
Object.values(States).forEach((s) => onEnter(s, () => showForState(s, mode)));

// COUNTDOWN carries the fresh-vs-resume decision: arriving from PAUSED keeps
// score and clock; arriving from anywhere else (START, RESULTS) is a new
// round, set up per mode.
onEnter(States.COUNTDOWN, (prev) => {
  const fresh = prev !== States.PAUSED;
  if (fresh) {
    resetScoring();
    resetEnemies();
    if (mode === 'range') {
      resetTargets();
      refreshHud();
      setTimer(CONFIG.ROUND_LENGTH_S);
      beginCountdown({ fresh: true, timed: true });
    } else {
      clearTargets(); // Waves: no practice targets in the arena
      spawnEnemy('proto_zombie');
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

  const st = getState();
  // The round clock ticks through countdown AND play; PAUSED starves it,
  // which is exactly what freezes the timer (and the zombie).
  if (st === States.COUNTDOWN || st === States.PLAYING) {
    updateRound(dtMs);
    updateTargets(dtMs); // pops may finish during a resume countdown
    updateGun(dtMs);     // recoil/flash settle even if the round just ended
    updateEnemies(dtMs, camera.position);
  }
  if (st === States.PLAYING && mode === 'range') {
    setTimer(getRemainingS());
  }

  renderer.render(scene, camera);
});
