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
import { createGun } from './render/gun.js';
import { initTargets, getHittables, hitTarget, updateTargets } from './render/targets.js';
import { initShooting } from './game/shooting.js';
import { initHud, showForState, flashLockHint } from './ui/hud.js';

const canvas = document.getElementById('game-canvas');
if (!canvas) throw new Error('main.js: #game-canvas not found in index.html');

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

// — Targets —
initTargets(scene);

// — Shooting: raycast on fire, pop the target it hits —
initShooting({
  camera,
  getHittables,
  onHit: (sphere) => hitTarget(sphere),
  onMiss: () => {}, // scoring pass subscribes here for streak resets
});

// — UI + input wiring —
initHud({
  onStartClick: () => requestLock(canvas),
  onResumeClick: () => requestLock(canvas),
});

initInput({
  onLockChange: (locked) => {
    if (locked) {
      setState(States.PLAYING);
    } else if (getState() === States.PLAYING) {
      // ESC / alt-tab while playing = pause. A failed lock from START stays
      // on START, which is why this branch checks the current state.
      setState(States.PAUSED);
    }
  },
  onLockError: () => flashLockHint(),
});

// Every state change drives the overlay layer.
Object.values(States).forEach((s) => onEnter(s, () => showForState(s)));
setState(States.START);

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
  const dtMs = now - lastT;
  lastT = now;

  const { yaw, pitch } = getLook();
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Gated on PLAYING so a pause mid-pop freezes the animation with the game.
  if (getState() === States.PLAYING) {
    updateTargets(dtMs);
  }

  renderer.render(scene, camera);
});
