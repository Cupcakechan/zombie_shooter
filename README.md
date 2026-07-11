# Zombie Shooter (working title)

A browser first-person shooter built with **Three.js** — mouse to aim, click to
shoot. Currently in development: **Stage 1** is a 60-second shooting-range score
attack (pop-and-respawn targets, streak multipliers); later stages add movement
and zombie waves. See `DESIGN.md` for the full plan.

## Status

🚧 In development — project scaffold. No playable build yet.

## Running locally (dev)

Plain ES modules — no install, no build step. But modules won't load over
`file://`, so serve over http:

1. Clone the repo and open the folder in VS Code.
2. Right-click `index.html` → **Open with Live Server** (Live Server extension).

## Controls (Stage 1)

| Input | Action |
|---|---|
| Mouse | Look |
| Left click | Fire |
| ESC | Pause |

## Tech

- Three.js **r185**, vendored — no CDN, no bundler, no dependencies
- Plain HTML / CSS / JavaScript (ES modules)

---

Created by **Cocolito Collective**.
