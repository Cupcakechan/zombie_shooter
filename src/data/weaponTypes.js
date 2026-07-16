// data/weaponTypes.js — the weapon registry (pass 17). Everything that makes
// one gun different from another is a field here: how fast it fires, how many
// rays leave the barrel, how wide they scatter, how hard it kicks, and what
// it LOOKS like. Pass 18's roster is meant to be new entries in this file and
// nothing else — if a future weapon needs code, this registry is wrong.
//
// Same contract as enemyTypes.js: plain data, no imports, no behaviour. The
// modules that consume it (gun.js draws PARTS, shooting.js reads PELLETS and
// SPREAD_DEG, ammo.js reads MAG_SIZE and RELOAD_MS) each own one slice and
// none of them know what a "shotgun" is.
//
// DAMAGE IS NOT HERE, deliberately. It lives on the ENEMY (`HITBOX.HEAD` etc.,
// read by damageEnemy), so a weapon's power is expressed as PELLETS — a
// shotgun hurts because eight rays land, not because it carries a bigger
// number. That falls out beautifully: SPREAD_DEG means fewer pellets connect
// with distance, so the scatter IS the damage falloff, with no falloff code
// anywhere. Pass 20's upgrades will want a multiplier; it does not exist yet
// and must not be added until something spends it.

export const WEAPON_TYPES = {};

// Slot order: index 0 is slot 1, index 1 is slot 2, and Q cycles this list.
// Explicit rather than Object.keys(WEAPON_TYPES) so Pass 18 can reorder the
// hotbar without moving definitions around.
export const WEAPON_ORDER = ['pistol', 'shotgun'];

// — The Pistol: the pass-4 gun, unchanged. Every number below was lifted
//   from config.js (FIRE_COOLDOWN_MS, AMMO.*, RECOIL_*) and every box from
//   gun.js's createGun(), so this entry reproduces the existing weapon
//   exactly — the registry landing must not retune the gun you already know.
WEAPON_TYPES.pistol = {
  id: 'pistol',
  NAME: 'PISTOL',

  // — Ammo —
  MAG_SIZE: 12,         // was AMMO.MAG_SIZE — 4 kills at zombie HP 3
  RELOAD_MS: 1200,      // was AMMO.RELOAD_MS — equals the zombie attack
                        //   cooldown ON PURPOSE: reloading in melee risks a hit
  LOW_AT: 3,            // was AMMO.LOW_AT. Per-weapon now, because "3 left" is
                        //   a quarter of a pistol mag and half a shotgun's —
                        //   one global number meant two different warnings.

  // — Reserve (17b). OPTIONAL, same contract as MAX_RANGE: no field, no
  //   limit. Both are on the REGISTRY and not in config because a pile size is
  //   a fact about a GUN, and deriving it from MAG_SIZE would hand pass 18's
  //   SMG (mag 30) a 210-round pile automatically. The cap is where a weapon
  //   says "I am generous" or "I am precious"; that is a design statement, not
  //   a multiple.
  RESERVE_START: 48,    // 4 mags. Deliberately BELOW the cap so the very first
                        //   drop you step on visibly moves the number — start
                        //   at the cap and waves 1-3 teach that drops are
                        //   worthless, at exactly the moment the pass needs
                        //   them to teach the opposite.
  RESERVE_MAX: 84,      // 7 mags (96 rounds with one loaded). MEASURED against
                        //   the wave table: a wave-10 clear costs ~22 rounds
                        //   headshotting (HITBOX.HEAD 3 vs proto HP 3 x
                        //   hpMult 1.30) and ~47 body-shotting (TORSO 1), so
                        //   the cap is ~2-4 waves of buffer. Enough to feel
                        //   safe, never enough to stop counting.

  // — Fire —
  COOLDOWN_MS: 150,     // was FIRE_COOLDOWN_MS. Semi-auto: clicks inside this
                        //   window are ignored entirely (not shots, not misses).
  PELLETS: 1,           // one ray, dead centre
  SPREAD_DEG: 0,        // no scatter — spreadOffset returns exactly {0,0} at
                        //   zero, so the pistol's ray is bit-identical to the
                        //   pre-17 path. Suite §24 pins that.

  // — Feel —
  RECOIL_MS: 60,        // was RECOIL_MS (which config.js declared TWICE — see
                        //   the §5 duplicate-key scan added this pass)
  RECOIL_DEG: 1,        // was RECOIL_KICK_DEG (also declared twice)
  RECOIL_BACK: 0.06,    // was RECOIL_KICK_BACK — metres toward the camera

  // — Design. Boxes in gun-local space, -Z is downrange. Optional per-part
  //   color/rough/metal fall back to the weapon defaults below.
  COLOR: 0x1c2124,      // dark metal
  ROUGH: 0.55,
  METAL: 0.35,
  PARTS: [
    { size: [0.10, 0.14, 0.34], pos: [0, 0, 0] },                        // receiver
    { size: [0.05, 0.05, 0.30], pos: [0, 0.03, -0.28] },                 // barrel
    { size: [0.07, 0.16, 0.09], pos: [0, -0.13, 0.09], rot: [0.28, 0, 0] }, // grip
  ],
  MUZZLE: [0, 0.03, -0.45], // flash + light sit here; just past the barrel tip
};

// — The Shotgun: the registry's proof. It was chosen over an SMG because an
//   SMG only proves the registry can hold a different NUMBER — a shotgun
//   proves it drives BEHAVIOUR. PELLETS forces shooting.js to loop rays and
//   SPREAD_DEG forces a cone, and those are the two things Pass 18's roster
//   needs working before it can be data-only.
//
//   The trade, in numbers: 8 pellets × HITBOX.HEAD 3 = 24 at point blank
//   (deletes anything), against a 4.7× slower trigger, half the magazine, and
//   an almost-2× reload. Tuning levers, in the order worth reaching for:
//   PELLETS (raw power), SPREAD_DEG (the falloff curve), COOLDOWN_MS (rate).
WEAPON_TYPES.shotgun = {
  id: 'shotgun',
  NAME: 'SHOTGUN',

  MAG_SIZE: 6,          // a tube, not a box — half the pistol's answers
  RELOAD_MS: 2200,      // ~1.8× the zombie attack cooldown: reloading this in
                        //   melee is not a risk, it is a decision to take a hit.
                        //   Swapping to the pistol (which CANCELS the reload,
                        //   see ammo.js) is the intended out.
  LOW_AT: 2,            // a third of the tube

  // — Reserve (17b). The shotgun's pile is SMALL in rounds and LARGE in
  //   kills, and that asymmetry is the weapon's question asked with the
  //   economy instead of with damage. At <=3 m one shell is one kill (8
  //   pellets x TORSO 1 = 8 > proto HP 3 x hpMult 2.0 cap = 6), so at
  //   PICKUPS.DROP_CHANCE 0.20 a wave of 10 pays 2 drops x 6 shells = 12 for
  //   ~10 spent: THE SHOTGUN IS AMMO-POSITIVE IF YOU LET THEM CLOSE. Nothing
  //   enforces that — it falls out of the drop granting the ACTIVE weapon a
  //   fraction of ITS mag. "Will you commit?" now has a number attached, and
  //   the answer pays for itself.
  RESERVE_START: 18,    // 3 tubes — below the cap, same reasoning as the pistol
  RESERVE_MAX: 36,      // 6 tubes. Half the pistol's mags because a shell is
                        //   worth ~3x a round up close; parity in ROUNDS would
                        //   be a 2x advantage in kills and the pistol would
                        //   have no job left to do.

  COOLDOWN_MS: 700,     // pump action — 4.7× the pistol's. This is what pays
                        //   for 8 pellets; drop it and the pistol has no job.
  PELLETS: 8,
  MAX_RANGE: 13,        // m. OPTIONAL field, same contract as CRAWL/EXPLODE/
                        //   RANGED: no field, no limit (shooting.js reads it as
                        //   `?? Infinity`), which is why the pistol has none — a
                        //   single precise ray at 40 m is what a pistol is FOR.
                        //
                        //   13 is FOG.WAVES.FAR, and that is the whole trick: past
                        //   13 m the BODY is invisible, so the cliff is hidden
                        //   behind the fog that already hides the target. The gun
                        //   reaches exactly as far as you can see something to
                        //   shoot at. Without the cap you could snipe the EYES —
                        //   fog:false, visible at any range — across a 36x42 m
                        //   arena, and every enemy's HITBOX.HEAD 3 one-shots its
                        //   HP<=3, so ONE stray pellet at 40 m was a free kill
                        //   (measured: 5% per shell, forever, at zero risk).
                        //
                        //   Spread alone could not fix that. At 12 deg the 40 m
                        //   shot was still 0.5% while the 3 m gun fell to 87% —
                        //   the exploit survives and the weapon dies. A cap makes
                        //   it IMPOSSIBLE rather than rare, which is the only
                        //   thing that stops it reading as absurd.
                        //
                        //   Suite §24 pins the two edges this must sit between:
                        //   above the spitter's post (9 m) so the shotgun is never
                        //   a dead pick against the ranged archetype, and at or
                        //   below FOG.WAVES.FAR so it never outranges your eyes.
  SPREAD_DEG: 9,        // HALF-angle of the cone. MEASURED kill rate against a
                        //   proto_zombie, aimed at the head, 400 shells per range:
                        //     1-2 m  100%   |   8 m  29%
                        //       3 m   98%   |  10 m  19%
                        //       5 m   63%   |  13 m  12%  <- MAX_RANGE, then 0%
                        //   That curve IS the archetype, and it was measured, not
                        //   derived: at the shipped 4.5 this gun still landed 4.93
                        //   of 8 pellets at 5 m and killed 99.5% of the time — a
                        //   rifle wearing a shotgun's silhouette.
                        //
                        //   The 100% zone (<=3 m) sits INSIDE EXPLODE.RADIUS 3.5
                        //   deliberately: deleting an exploder with this means
                        //   standing in its core. Daniel's call — react fast or
                        //   use the pistol. That tension is the weapon's point.

  RECOIL_MS: 110,       // a longer shove than the pistol's snap
  RECOIL_DEG: 3.2,
  RECOIL_BACK: 0.14,

  COLOR: 0x24282b,      // metal, a touch lighter than the pistol's
  ROUGH: 0.6,
  METAL: 0.4,
  PARTS: [
    { size: [0.11, 0.13, 0.38], pos: [0, 0, 0.04] },                       // receiver
    { size: [0.055, 0.055, 0.50], pos: [0, 0.038, -0.42] },                // barrel
    { size: [0.042, 0.042, 0.40], pos: [0, -0.022, -0.37] },               // magazine tube
    // Furniture: wood. Two materials on one gun is what makes a code-built
    // shotgun read AS a shotgun at viewmodel distance — the silhouette alone
    // is just a long pistol.
    { size: [0.085, 0.062, 0.13], pos: [0, -0.022, -0.28],
      color: 0x5a3a22, rough: 0.85, metal: 0.05 },                         // pump
    { size: [0.07, 0.15, 0.09], pos: [0, -0.115, 0.16], rot: [0.30, 0, 0],
      color: 0x5a3a22, rough: 0.85, metal: 0.05 },                         // grip
    { size: [0.065, 0.105, 0.20], pos: [0, -0.015, 0.30], rot: [-0.08, 0, 0],
      color: 0x5a3a22, rough: 0.85, metal: 0.05 },                         // stock
  ],
  MUZZLE: [0, 0.038, -0.68],
};
