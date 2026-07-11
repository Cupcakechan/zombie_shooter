// game/shooting.js — the shot itself: subscribes to input's fire hook,
// enforces the semi-auto cooldown, raycasts from the exact screen centre,
// and reports hit/miss. It knows nothing about scores or pops — callers
// wire those in, which is how the scoring pass will attach without touching
// this file.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';
import { onFire } from '../input.js';

const raycaster = new THREE.Raycaster();
// Screen centre in normalized device coordinates — where the crosshair is.
const CENTER = new THREE.Vector2(0, 0);

let lastShotAt = -Infinity;

export function initShooting({ camera, getHittables, onHit, onMiss } = {}) {
  onFire(() => {
    const now = performance.now();
    // Inside the cooldown a click is IGNORED entirely (DESIGN.md §5): it is
    // not a shot and not a miss — punishing spam is the streak reset's job.
    if (now - lastShotAt < CONFIG.FIRE_COOLDOWN_MS) return;
    lastShotAt = now;

    raycaster.setFromCamera(CENTER, camera);
    // Hittables are the sphere meshes themselves, so no recursive descent.
    const hits = raycaster.intersectObjects(getHittables(), false);

    if (hits.length > 0) {
      if (onHit) onHit(hits[0].object);
    } else if (onMiss) {
      // Unused this pass — the scoring pass subscribes here for streak resets.
      onMiss();
    }
  });
}
