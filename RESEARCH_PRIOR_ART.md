# RESEARCH_PRIOR_ART — three.js zombie shooters, mapped to our roadmap

Written 2026-07-12 (session 3). Method: cloned the public repos and read the
code directly; recovered the lost project's forum post by web search; fetched
the CodePen source in full. Findings are TECHNIQUES mapped to roadmap items
(4.3 nav, audio, dismemberment, scoring, enemy types, environments) — no code
was copied. Everything below is filtered through our hard rule: **code-built
everything, no downloaded assets** (all four prior-art projects use GLTF
models for something; the techniques transfer, the pipelines don't).

**Addendum 2026-07-15 (session 8): Source 6 added** — Zombie Slayer, posted
to r/threejs mid-14c. It is the FIRST source that shares our asset rule
rather than merely being adjacent to it, which makes it the only true
like-for-like comparison in this document. The paragraph above no longer
holds universally; see Source 6.

## TL;DR

1. **Nobody in the prior art solves horde navigation the way we plan to —
   and our plan is better for hordes.** Three of four projects use pure
   beeline + pairwise avoidance (what we have TODAY, pre-4.3). The fourth
   (zombieRobot) uses a Yuka navmesh with per-agent A* and path replanning —
   correct but O(paths × zombies × player movement). Our 4.3 flow field
   computes ONE BFS per player cell-change and serves every zombie for free.
   The research confirms 4.3 as designed; nothing to adopt, one thing to
   steal around its edges (see §zombieRobot).
2. **The single richest transferable design is YAZH's enemy state machine**:
   distance-banded idle → walk → scream → run → attack, with a one-time
   SCREAM telegraph when a zombie first notices you, and a leg-hit →
   fall → CRAWL wounded state with its own slower attack. The crawler is
   dismemberment-lite — a second enemy behavior with zero new models — and
   our per-part hitbox tags (7b) are the exact substrate it needs.
3. **The lost project validates our architecture wholesale**: 15 enemy
   types built geometrically in three.js (our registry approach), a
   CSV-driven mall layout (our ASCII `maps.js`, convergent evolution),
   environment rotation per wave band (a Stage-5-scale idea worth banking),
   and procedural mazes for cave/hospital (a generator that EMITS our tile
   grammar would slot in with zero downstream changes).
4. **(2026-07-15) Zombie Slayer is the control experiment we never had.**
   Same genre, same engine, same no-assets rule, opposite method: 44,771
   lines in ONE `index.html`, no modules, no tests, three.js r128. It is
   further along on CONTENT than us and structurally unable to keep it. The
   transferable finding is not a technique — it is EVIDENCE: breadth is what
   makes this genre read to a stranger, which is a point for Phase 3 and
   against letting it slip. See Source 6.

---

## Source 1 — rohanvashisht1234/threejs-zombieshooter-game ("Zeta Forces")

One 1,255-line `main.ts`, Vite, GLB map/zombie/gun, 50 zombies at once.
Manager-class architecture with a central CONFIG object (kindred spirit).

**Techniques worth having:**

- **Positional audio with the bare Web Audio API — no assets required by
  the technique.** A looping AudioBuffer is routed through a `PannerNode`
  (`panningModel: 'HRTF'`, linear distance model, maxDistance 100); the
  listener's position/orientation is set from the camera each frame; the
  panner's position is moved to the nearest live zombie. The buffer comes
  from a fetched .ogg in their case — in ours it can be a **synthesized
  buffer** (noise-shaped groan, filtered click for shots), which is the
  missing piece that un-banks pass 8 audio without violating no-assets.
  They also have a simple rAF-driven `fadeAudio` volume ramp for
  music/ambience ducking during speech.
- **Procedural death animation — no death clip.** A dying zombie rotates
  on its world right-axis by a random 70–90° at ~120°/s, then flips to
  dead. Comically simple keel-over, reads fine at horde scale. Our slam/
  flinch springs could do a springier version of the same idea (a
  "fall spring" instead of a canned animation) when we want cheap deaths
  for new enemy types.
- **Objective checkpoints as Box3 triggers**: an animated marker with a
  Box3; entering it triggers the next mission beat and respawns a fresh
  zombie batch. A trivially portable structure if Waves ever gets
  objectives ("restore the generator") between waves.
- **Light-budget culling**: every frame, sort scene point lights by
  distance to the player and keep only the nearest 4 visible. Directly
  relevant the day the village gets night-time interior lights.
- **InstancedMesh rain with typed-array pools** (500 drops + splash rings,
  Float32Array positions/velocities/timers, matrices rebuilt per frame) —
  the same pooled fixed-size pattern we already use, applied to weather.

**Their zombie AI is beeline + pairwise avoidance + bounds clamp + DPS when
in range** — i.e., where we are pre-4.3, minus our wall collision. Nothing
to learn there. Camera shake on shoot is a decaying random offset (we have
camera kick). Reload is R + auto-on-empty with a fixed timer — convergent
with our pass 9.

## Source 2 — UstymUkhman/YetAnotherZombieHorror (YAZH)

The heavyweight: TypeScript + Svelte + Vite, switchable Ammo.js /
three-mesh-bvh physics, GLB characters with Mixamo clips, Electron builds.
Almost all of its infrastructure is out of scope for us; its DESIGN is not.

**Techniques worth having:**

- **Distance-banded enemy state machine with a scream telegraph.**
  Config-driven walk/run/lose distances. A zombie idles until the player
  is inside its walk band, walks closer, and the FIRST time the player
  enters the run band it stops, SCREAMS (one-time flag + sound + timed
  animation), then runs. Attacks are hard/soft variants chosen by
  remaining health + coin flip, each with its own windup delay, damage,
  and recovery, and the post-attack decision re-checks distance (attack
  again / idle / resume run). This is a full personality kit expressible
  in OUR enemy registry as a handful of numeric fields per type — band
  radii, scream duration, attack variants — and it's how the roadmap's
  "more enemy types" gets cheap variety: same body, different bands.
- **Leg-hit → fall → crawl.** Enough leg damage puts the zombie in a
  falling animation, then a crawl state with a slower, closer-range
  crawl attack. Behavioral dismemberment: the threat transforms instead
  of dying. Our per-part hitbox tags (HEAD/TORSO/LIMB) already route
  leg hits distinctly; the crawler is the natural first cash-out of the
  banked dismemberment substrate — and visually our registry body can
  drop to a prone pose + arm-drag gait long before we sever any meshes.
- **Hit-direction indicator math**: atan2 from enemy to player compared
  against player yaw, bucketed Front/Left/Right — feeds a directional
  damage vignette so being hit from behind is legible. Small, pure,
  testable; pairs well with our existing red vignette.
- **Spawn portals as visible gates**: shader-material half-discs at map
  edges where enemies enter, fog-tinted so arrivals materialize out of
  the murk. The concept (a VISIBLE, telegraphed entry point) is exactly
  what 4.3's window-entry rework wants — a zombie hauling over a sill is
  our diegetic version of their portal.
- **Volumetric animated fog by patching `ShaderChunk.fog_*`.** They
  override three.js's global fog shader chunks once, injecting a
  noise-texture-scrolled FBM term with a `fogTime` uniform pushed to
  every material's shader. All standard materials pick it up for free.
  The noise texture is loaded from a PNG in their case; ours can be a
  generated canvas texture. This is the single biggest atmosphere
  upgrade available to us per line of code — and it is exactly the kind
  of render-path change that is SUITE-INVISIBLE (browser-first testing,
  per the black-screen lesson).
- **Decal bullet holes** (`DecalGeometry` against the hit face normal,
  random roll, polygonOffset material, fade-out and dispose after 5 s).
  Our wall hits currently just eat the bullet; a hole + our existing
  blood/stain pooling would close that feedback gap. DecalGeometry is a
  self-contained addon importing only 'three' — vendorable under
  no-bundler by rewriting one import to a relative path. The hole
  texture is a 15-line canvas radial gradient.
- **Muzzle fire/smoke as a GPU Points system** with spline-driven
  alpha/size over particle life and a weapon-mounted PointLight whose
  power ramps with fire. We have a muzzle light already; the spline-
  driven particle envelope is the refinement worth remembering.

**Their enemy movement is STILL a beeline** — `lookAt(player)` + run.
All the sophistication is in the state machine, none in navigation.

## Source 3 — Data-Bee38 CodePen "Zombie Hunter (Practice Arena Demo)"

Old-school single-file three.js r124, one zombie, GLB props, mobile +
gamepad support. Small, but three genuinely clever code-only tricks:

- **Ballistic burst particles computed ENTIRELY in the vertex shader.**
  Each spawned burst is a Points cloud whose positions never update on
  the CPU: the vertex shader evaluates `p + v·t + ½g·t²` from a single
  `u_time` uniform; the fragment shader fades by life. One uniform write
  per burst per frame, zero per-particle CPU work. Our blood bursts are
  CPU-pooled (fine at current counts); this is the documented escape
  hatch if effect counts ever climb — same visual contract, near-zero
  update cost.
- **Lightning as random light-power spikes**: ~4% of frames, teleport a
  blue PointLight and spike its power 50–550, let it decay. Three lines
  of storm. Pairs with rohan's rain for a weather pass someday.
- **Heightmap terrain from a canvas**: draw an image (or, for us,
  generated noise) to a canvas, read ImageData, displace a
  PlaneGeometry's vertices, recompute normals. Code-built outdoor
  terrain for a forest/hill environment without a single asset.

Also present and noted: minimap via a second orthographic camera +
tiny second renderer using layer masks (we already own the layer
machinery from 4.2b); aim-down-sights as a zoom lerp between two
constants; kill "praise" popups ("Sharp Shooter!") as a CSS pop —
almost embarrassingly cheap juice for the undecided kill-scoring item;
wall-peek camera tilt when colliding while aiming.

## Source 4 — the lost project (recovered forum post, June 2025)

Site (play.zombie.sh) and repo are gone; the three.js Discourse post
(thread 84259, mirrored on html5gamedevs) is the surviving artifact and
matches the verbatim copy in our handoff. No technical replies exist in
the thread — the description is everything we get. What it tells us:

- **15 geometrically-built enemy types is a proven scale** for exactly
  our approach (code-built bodies, no imported models). Wolves in their
  roster = a quadruped variant; our SDF/capsule technique from
  ExperimentProject can produce a quadruped when the roadmap wants one.
- **Environment rotation per wave band** (forest → city → cave →
  hospital → mall as waves progress) is their signature structural idea
  and the strongest candidate for our "more environments" roadmap item.
  Our `maps.js` registry + `ACTIVE_MAP_ID` already holds multiple valid
  maps; rotation is "wave table names a map id per band" + a transition
  moment. Worth banking as Stage 5, not building now.
- **Their generation mix maps 1:1 onto our data-driven maps**: CSV mall
  layout ≡ our ASCII layouts (convergent design — strong validation);
  procedural cave/hospital mazes ≡ a generator function that EMITS our
  tile grammar (`#`/`.`/`D`/`W`), so parse/colliders/flood/nav all work
  unchanged on generated maps; random object placement (forest/city) ≡
  a scatter pass over walkable cells.
- Blood/muzzle particle system + physical projectiles: we already have
  equivalents (pooled bursts; hitscan by design choice).

## Source 5 (bonus) — alexflexcodex/zombieRobot

Found via the "and others" sweep (three.js Discourse showcase). COD-
zombies-style waves using **Yuka**: each zombie is a Yuka `Vehicle` with
a `Think` brain (utility evaluators choosing goals), and navigation is a
**navmesh + per-agent A\* path + FollowPathBehavior**, replanning when
the player moves between regions.

This is the only prior-art project with real pathfinding, and it's the
wrong shape for hordes: every zombie plans and replans its own path.
Our flow field inverts the cost — one BFS per player cell-change, every
zombie reads a direction for free, and doorway congestion emerges
naturally. **The one idea worth stealing from Yuka's playbook**: their
`OnPathBehavior` blends path-following with local steering — in our
terms, 4.3 should blend flow-field descent with the pairwise separation
we already have, not replace it (descend the field, THEN separate, then
walls — the resolve order we already run).

Second bonus lead, petergyang/zombie-survival ("levels, weapons,
bosses"), was removed or made private — clone fails; nothing readable.

## Source 6 — idontknowwhatiamdoingthough/Zombie-Slayer---Game
(read 2026-07-15, session 8; posted to r/threejs. Live at
`idontknowwhatiamdoingthough.github.io/Zombie-Slayer---Game/`. Version
string `PRE-PRE-ALPHA V.001.260707`, i.e. ~1 week old and moving.)

**Why this one is different from Sources 1–5:** it is the only prior art that
plays by OUR rule. Zero `GLTFLoader` / `FBXLoader` / `OBJLoader` — one
`TextureLoader` in the whole file. Geometry is 362 `BoxGeometry`, 259
`CylinderGeometry`, 62 `SphereGeometry`, 26 `TorusGeometry`, plus lathe /
extrude / polyhedra. Audio is bare Web Audio: ~37 oscillators, ~47 gain
nodes, 11 buffer sources. That is our exact constraint set, chosen
independently. Everything else about it is our opposite.

**Shape:** the repo is literally one file. `index.html`, 2.2 MB, **44,771
lines**, longest line 82,210 chars. No modules, no bundler (same as us), no
tests, no docs. three.js **r128** from cdnjs — a 2021 release, ~57 behind our
r185 — plus simplex-noise 2.4.0. 12 classes, 321 functions, zero top-level
bindings.

**What it has that we don't:** RPG, minigun, antidote gun (converts organic
enemies for 5–10 s), anti-gravity grab-and-slam, tactical nuke — each with 3
upgrade tiers. Jetpack, double jump, jump pads, slow-motion (to 16.7%),
frozen time. Mechs, drones, exploding cars. A "Black Market" economy: coins
from kills, purchased items spawn in front of you then respawn on the map.
A settings panel spanning god rays, bloom, chromatic aberration, film grain,
fisheye, dynamic resolution, grass density.

**The one technique worth having:** `AssetManager.getGeometry(key, factory)`
— a keyed geometry cache with a lazy factory, so `SphereGeometry(1,32,32)` is
built once and shared by every effect that asks for the same key. We already
get this from pooling (each pooled module builds its geometry once at init),
but the KEYED form is the better shape the day two modules want the same
primitive. Bank it; don't build it without a second asker.

**The anti-pattern, and it's the exact one 14c was built to prevent.** Their
shockwave scale is a hand-written ladder keyed on shop level — three
literals, three tiers, and the code's own comments call them "visual scale".
The damage radius is a SEPARATE function with its own literals. Two ladders
of hand-typed numbers that must agree by hand, with nothing checking. Ours
reads `EXPLODE.RADIUS` from the registry and §23 pins the rendered
`mesh.scale` against `blastDamage()` itself, so a drifted constant fails in
Node instead of in a play session. This is a live, shipped example of the
failure mode — worth keeping the citation.

Secondary: their shockwaves `new THREE.MeshBasicMaterial()` + `scene.add()`
**per explosion** and push to a lazily-created array (98 material
constructions across the file, several in hot paths). They're disciplined
about vectors (`_tempVec3`, `_globalVec1` temporaries) and geometry (the
cache above) but not materials. Our pooling covers this; noted only because
it shows how partial allocation discipline is the normal outcome without a
gate that measures it.

**The honest verdict, for the record:** it is ahead of us on content and
presentation and that is not an illusion — breadth is why it reads well in a
screenshot and why it got posted. It is also 44k lines in one file, on a 2021
engine, with no test able to tell the author whether a change broke anything,
and no path off r128 that doesn't involve touching all of it. Those are not
independent facts: it can add a nuke gun on a Tuesday BECAUSE nothing can
break, and nothing can break because nothing is verified. Two projects
optimising different things. The evidence transfers; the method does not.

## What we should NOT adopt (and why)

Physics engines (Ammo/BVH — our grid-derived AABBs are exact and
already probed); per-agent navmesh A* (see above); post-processing
stacks (Composer/bloom — a second full-screen pipeline for marginal
gain, and our two-pass gun render already occupies that complexity
budget); any GLTF/Mixamo asset pipeline (rule); Firebase/Firestore
(localStorage PB is our scale); Electron/Svelte/Vite (no-bundler rule).

## Roadmap mapping (the answer key)

| Roadmap item | Prior-art finding | Adoption shape |
|---|---|---|
| **4.3 navigation** | 3/4 projects: none. zombieRobot: navmesh per-agent A* | Build as scoped — flow field validated; blend field descent with existing separation (steal the blend idea, not the navmesh) |
| **More enemy types** | YAZH distance-band state machine + scream telegraph; lost project's 15 geometric types | Registry fields: band radii, scream, attack variants — variety by numbers, not models |
| **Dismemberment** | YAZH leg-hit → crawl wounded state | Crawler as the first cash-out of the 7b hitbox substrate; prone pose + drag gait before any mesh severing |
| **Scoring** | CodePen praise popups; rohan kill-progress bar | Kill scoring + headshot bonus + CSS praise pop — one small pass, resolves the undecided item |
| **Audio (banked)** | rohan Web Audio PannerNode positional loops + fade ramps | Un-banks IF paired with synthesized AudioBuffers (code-generated groans/shots) — no assets needed |
| **More environments** | Lost project: rotation per wave band; CSV≡ASCII; procedural mazes emit tile grammar; CodePen canvas heightmap terrain | Bank as Stage 5: map-per-wave-band via existing registry; maze generator emits our grammar |
| **Atmosphere (pass 8 ext.)** | YAZH ShaderChunk volumetric fog (generated noise), decal wall holes; CodePen lightning, GPU-shader bursts; rohan instanced rain, light culling | À-la-carte polish passes; all code-only; fog/decals are render-path = browser-first testing |
| **Phase 3 — weapon variety** (17→18) | Zombie Slayer: 5 weapons × 3 tiers is the whole reason it reads as a game to a stranger | Confirms the phase and its priority. Registry-first (`weaponTypes.js`) is what lets our roster grow without their 44k-line tax |
| **Pass 19 — wall-buys + wallet** | Zombie Slayer's "Black Market": coins from kills → buy → item spawns in front of you → respawns on map once collected | Genre-load-bearing, not a nice-to-have. Their spawn-in-front-then-respawn loop is a neat dodge around fixed wall positions — bank it as an alternative to wall-mounted buys |
| **Pass 20 — upgrade station** | Zombie Slayer fuses buy + upgrade into one Black Market with 3-tier ladders per item | Evidence that 19 and 20 can be ONE surface. Do not fuse them in the build — 19 must ship with its own consumer first |
| **FX ↔ damage agreement** | Zombie Slayer keeps "visual scale" and damage radius as two hand-typed ladders with nothing reconciling them | Already solved: 14c reads the registry, §23 pins rendered scale against `blastDamage()`. Cite as the live example of the failure mode |

Sources: github.com/rohanvashisht1234/threejs-zombieshooter-game ·
github.com/UstymUkhman/YetAnotherZombieHorror ·
codepen.io/Data-Bee38/pen/gbYaeeO ·
discourse.threejs.org/t/three-js-zombie-wave-shooter-game/84259 ·
github.com/alexflexcodex/zombieRobot ·
github.com/idontknowwhatiamdoingthough/Zombie-Slayer---Game
