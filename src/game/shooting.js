// game/shooting.js — the shot itself: subscribes to input's fire hook,
// enforces the trigger cooldown, raycasts from the exact screen centre, and
// reports ONE SHOT with however many pellets landed. It knows nothing about
// scores or pops — callers wire those in.
//
// THE PASS-17 SPLIT, and it is the reason this file changed at all:
//
//   a SHOT is one trigger pull  — one kick, one casing, one round, one
//                                 accuracy sample;
//   a PELLET is one ray         — one damage instance, one blood spray.
//
// Before 17 those were the same thing and the API could conflate them for
// free. They are not the same thing for a shotgun, and the old `onHit`-per-ray
// shape would have quietly charged eight rounds for one shell, kicked the gun
// eight times, and — in Range — logged eight accuracy samples for one pull,
// seven of them misses when all eight pellets hit the same sphere.
//
// So `onShot` fires exactly ONCE per trigger pull and hands over the pellet
// results as data. The per-shot bookkeeping in main.js is correct BY
// CONSTRUCTION rather than by main remembering to guard a loop: there is no
// loop up there to get wrong.

import * as THREE from '../../lib/three.module.js';
import { onFire } from '../input.js';

const raycaster = new THREE.Raycaster();
// Screen centre in normalized device coordinates — where the crosshair is.
const CENTER = new THREE.Vector2(0, 0);

// Scratch — the pellet loop runs up to PELLETS times per trigger pull and must
// not allocate on the way.
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _baseDir = new THREE.Vector3();

// What initShooting was handed — kept for the per-frame auto path.
let _refs = {};

// The trigger's clock, not the gun's. ONE timer shared across every weapon on
// purpose: if each weapon carried its own, you could fire the shotgun, swap,
// fire the pistol instantly, swap back, and out-rate both cooldowns by hand.
// The cooldown belongs to the player's finger.
let lastShotAt = -Infinity;

// ————— Pure math (suite-tested) —————

// Where one pellet lands on the spread disc, in units of the camera's right/up
// axes at unit depth. `u1`/`u2` are the two randoms, injected so the suite can
// drive this deterministically instead of hoping.
//
// sqrt(u2) is not decoration: sampling the radius linearly would bunch pellets
// at the centre of the disc and leave the rim empty, which reads as a tight
// slug rather than a scatter. The sqrt makes the disc uniform by area.
//
// At spreadRad 0 this returns EXACTLY {x:0, y:0} — Math.tan(0) is 0, and
// anything times 0 is 0 — so a single-pellet zero-spread weapon takes the
// unperturbed pass-4 ray and the pistol's aim is bit-identical to before this
// pass. Suite §24 pins that; it is the guarantee that the registry landed
// without retuning the gun you already know.
export function spreadOffset(spreadRad, u1, u2) {
  if (!(spreadRad > 0)) return { x: 0, y: 0 }; // guard: negative/NaN spread
  const a = u1 * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, u2)) * Math.tan(spreadRad);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

// ————— The shot —————

// Fire one shot: raycast `weapon.PELLETS` rays through the crosshair, scattered
// inside `weapon.SPREAD_DEG`, and return what each one found. Exported so the
// suite can drive a real camera at a real mesh — the pellet loop is the part
// with something to get wrong, so it is the part that must be reachable.
//
// Returns an array of { mesh, point, rayDir }, nearest-first per pellet, and
// EMPTY when the whole pattern missed. One call in, one shot out.
export function fireShot(camera, weapon, hittables) {
  const out = [];
  const pellets = Math.max(1, weapon.PELLETS ?? 1);
  const spreadRad = degToRad(weapon.SPREAD_DEG ?? 0);

  // Range cap (optional per weapon — no field means no limit, like a pistol).
  // Written on EVERY shot and never once at init: the raycaster is module
  // scope and reused by every weapon, and setFromCamera does not touch .far.
  // Set it in a branch and the shotgun would quietly hand its 13 m leash to
  // the next pistol shot, forever, with nothing in the game saying so. §24
  // fires the shotgun and then the pistol at 30 m for exactly this reason.
  raycaster.far = weapon.MAX_RANGE ?? Infinity;

  for (let i = 0; i < pellets; i++) {
    // setFromCamera gives the origin AND the crosshair direction; perturbing
    // the ray in place afterwards keeps the zero-spread path untouched.
    raycaster.setFromCamera(CENTER, camera);
    if (spreadRad > 0) {
      _baseDir.copy(raycaster.ray.direction);
      camera.matrixWorld.extractBasis(_right, _up, _fwd);
      const off = spreadOffset(spreadRad, Math.random(), Math.random());
      raycaster.ray.direction
        .copy(_baseDir)
        .addScaledVector(_right, off.x)
        .addScaledVector(_up, off.y)
        .normalize();
    }
    // Hittables are the meshes themselves, so no recursive descent.
    const hits = raycaster.intersectObjects(hittables, false);
    if (hits.length > 0) {
      out.push({
        mesh: hits[0].object,
        point: hits[0].point,
        rayDir: raycaster.ray.direction.clone(), // per-pellet: the caller keeps these
      });
    }
  }
  return out;
}

export function initShooting({ camera, getHittables, getWeapon, onShot, canFire, isHeld } = {}) {
  // Everything the trigger needs, kept for the per-frame auto path below.
  // `isHeld` is INJECTED like canFire rather than imported from input.js, and
  // for the same reason: main wires the real DOM-backed read, and the suite
  // wires a flag it controls — the auto path is pure logic + raycasts, both of
  // which run headless, so there is no reason to let one DOM import make it
  // browser-only.
  _refs = { camera, getHittables, getWeapon, onShot, canFire, isHeld };
  onFire(fireOnce);
}

// One trigger pull's worth of work — shared verbatim by the click path above
// and the auto path below, so "what a shot is" exists exactly once and the two
// paths cannot drift.
function fireOnce() {
  const { camera, getHittables, getWeapon, onShot, canFire } = _refs;
  // State gate first: a click during COUNTDOWN/RESULTS must not fire and
  // must not consume the cooldown — main injects the predicate so this
  // module stays ignorant of the state machine. The AUTO path inherits the
  // whole gate for free: mid-bash (17a-fix), empty mag, and non-PLAYING
  // states all stop a held trigger exactly as they stop a click, with no
  // second copy of the rules to keep in step.
  if (canFire && !canFire()) return;

  const weapon = getWeapon();
  if (!weapon) return; // no weapon in hand: nothing to fire, never throw

  const now = performance.now();
  // Inside the cooldown a click is IGNORED entirely (DESIGN.md §5): it is
  // not a shot and not a miss — punishing spam is the streak reset's job.
  // The window is the ACTIVE weapon's, which is the whole of "a pump action
  // is slower than a pistol".
  if (now - lastShotAt < weapon.COOLDOWN_MS) return;
  lastShotAt = now;

  const hits = fireShot(camera, weapon, getHittables());
  // Exactly one call per trigger pull, hit or miss. The empty array IS the
  // miss — there is no separate onMiss any more, because with eight pellets
  // "hit" and "miss" stopped being opposites.
  if (onShot) onShot(hits, weapon);
}

// The auto trigger (18): polled once per frame by main. A held button fires
// weapons whose REGISTRY entry says AUTO — the roster decides, so a fourth
// gun opts in with a field and no code (§24's data-only scan is what keeps it
// that way). Semi-auto guns ignore the held state entirely: hold-to-fire on
// the pistol would erase the click-per-shot discipline that makes it the aim
// gun, and on the shotgun 86 RPM makes it meaningless anyway.
//
// No dtMs and no clock of its own ON PURPOSE: fireOnce's cooldown IS the fire
// rate. Polling faster than COOLDOWN_MS just gets refused — so the rate is
// 800 RPM at any frame rate, and the first held frame after a click is
// correctly swallowed by the same window (no double-fire on the initial
// mousedown, which already fired via the event path).
export function updateShooting() {
  const { getWeapon, isHeld } = _refs;
  if (!isHeld || !isHeld()) return;
  const weapon = getWeapon && getWeapon();
  if (!weapon || !(weapon.AUTO ?? false)) return;
  fireOnce();
}

// A fresh round must not inherit the last one's trigger timing.
export function resetShooting() {
  lastShotAt = -Infinity;
}
