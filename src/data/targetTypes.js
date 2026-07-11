// data/targetTypes.js — the target registry. Content lives in tables, not
// subclasses: a new entry here (a Stage 3 zombie, a bonus orb) flows through
// spawn + hit + pop with no extra wiring. Named targetTypes.js, NOT targets.js,
// to stay visually distinct from render/targets.js.

import { CONFIG } from '../config.js';

export const TARGET_TYPES = {
  range_orb: {
    id: 'range_orb',
    // Radius stays sourced from CONFIG while there's a single type (it's a
    // headline tunable). When a second type lands, per-type radii move fully
    // into these entries and the CONFIG constant retires.
    radius: CONFIG.TARGET_RADIUS,
    // Hot orange-red, NOT the UI's acid green — the crosshair must stay
    // readable while sitting directly on a target.
    color: 0xff4b2e,
    emissive: 0xff4b2e,
    emissiveIntensity: 0.85,
    standColor: 0x232b28,
  },
};
