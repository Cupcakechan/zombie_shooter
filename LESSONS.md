# LESSONS.md — error record (feeds the dev-method)

A queue, not an archive: when something breaks or surprises us, it gets a short
entry here. Dev-method skill sessions harvest routed entries into skill/GI
updates and mark them `HARVESTED — <date>` (or delete them).

## 2026-07-11 — Browser import maps are invisible to the Node test suite

- What broke / what happened: the planned import map (`"three"` →
  `./lib/three.module.js`) would have left every `src` module unimportable by
  the committed Node suite — bare `'three'` doesn't resolve in Node. Caught at
  shell-pass build time, before delivery.
- Root cause: import maps are a browser-only resolution mechanism; the
  module-health suite runs in Node.
- Verification gap it exposed: none shipped — designing the suite first is what
  surfaced it.
- Plug shipped: relative imports everywhere (`../lib/three.module.js`);
  DESIGN.md v1.1 records the decision; the suite exercises the real import
  chain on every run.
- Route: skill reference (html-game.md) candidate — "vendored ES-module libs:
  prefer relative imports over import maps when a committed Node import suite
  exists."
