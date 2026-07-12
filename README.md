# Zombie Shooter (working title)

A browser first-person shooter built with **Three.js** — two modes:

- **Range** — a 60-second score attack: pop-and-respawn targets, streak
  multipliers, accuracy stats, and a persistent personal best.
- **Waves** — an endless last-stand: escalating waves of code-built zombies
  with telegraphed attacks. Shoot to cancel their swipes, sidestep to dodge,
  kite the mob, survive as long as you can.

Every creature is **designed in code** — procedural bodies and animation, no
downloaded models. See `DESIGN.md` for the full plan.

## Status

🚧 In development — both modes fully playable (movement, combat, waves,
game over). Remaining: designed creature visuals (SDF blend-shell technique)
and an atmosphere pass. Full roadmap in `DESIGN.md` §2.

## Running locally (dev)

Plain ES modules — no install, no build step. But modules won't load over
`file://`, so serve over http:

1. Clone the repo and open the folder in VS Code.
2. Right-click `index.html` → **Open with Live Server** (Live Server extension).

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Left click | Fire |
| ESC | Pause |

## Tech

- Three.js **r185**, vendored — no CDN, no bundler, no dependencies
- Plain HTML / CSS / JavaScript (ES modules)
- Committed Node test suite (`node test_suite.mjs`) — module health, exact
  game math, config/registry contracts

---

Created by **Cocolito Collective**.
