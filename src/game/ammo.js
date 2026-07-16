// game/ammo.js — magazine + RESERVE + reload state, PER WEAPON (pass 9,
// widened by 17, completed by 17b). Pure logic — no DOM, no three.js — so
// every rule here is provable in Node (suite sections 10 and 26).
//
// THE RESERVE EXISTS NOW (17b). A reload no longer conjures a full magazine
// out of nothing: it TAKES from a finite pile, and the pile is refilled by
// walking over what the dead drop (render/pickups.js). That is the whole pass,
// and it is what turns every trigger pull into a decision.
//
// The optional-field contract is MAX_RANGE's, applied exactly: ABSENT MEANS
// UNLIMITED. A weapon that declares no RESERVE_START/RESERVE_MAX behaves
// byte-for-byte like the pass-17 gun — infinite pile, every reload full. That
// is not a leftover; it is the single mechanism two callers need:
//   • pass 18's roster can add a gun and opt into scarcity when it's ready;
//   • RANGE MODE seeds Infinity deliberately (see resetAmmo). Range is a 60 s
//     aim test that burns ~240 rounds with no zombies to drop anything — a
//     finite reserve there would make the personal best a function of ammo.
// So there is no mode branch anywhere in this file, and there must never be
// one: main.js owns the mode and seeds the pile, exactly as it owns melee's
// `canSwing: () => ... && mode === 'waves'` gate. This module owns the RULE.
//
// Infinity is load-bearing rather than cute, and it is correct BY
// CONSTRUCTION rather than by analysis: `Math.min(need, Infinity)` is `need`
// and `Infinity - need` is `Infinity`, so the unlimited case falls out of the
// finite arithmetic with no second code path to keep in step. A large finite
// number would be a lie that happened to work, and §5's registry sweep would
// have to be told to expect it.
//
// The pass-17 change is that every rule below asks WHICH weapon. The magazines
// — and now the reserves — are independent and persist across swaps:
// holstering a pistol with 3 rounds and coming back to it finds 3 rounds. If a
// swap silently refilled, swapping would be a free instant reload and the
// reload timer would be decorative.

import { WEAPON_TYPES, WEAPON_ORDER } from '../data/weaponTypes.js';

const mags = {};              // weapon id -> rounds currently in ITS magazine
const reserves = {};          // weapon id -> rounds in ITS pile (may be Infinity)
const owned = {};             // weapon id -> true once yours (19: pistol-start)
let activeId = WEAPON_ORDER[0];
let reloading = false;
let reloadT = 0;

// Fresh round: every weapon starts loaded with a seeded pile behind it,
// holding slot 1, nothing in progress. Every weapon and not just the active
// one — you should not be able to bank a spent shotgun across a death, and
// after 17b that goes double for the pile.
//
// `unlimited` is the ONLY thing this module will ever know about Range, and it
// doesn't know it's Range: it is told to seed an infinite pile, and main.js is
// the one that knows why. The alternative — a `reserveEnabled` flag branching
// updateAmmo and startReload — would put two mode-shaped forks in the rule
// itself, and every future pass would owe both of them a thought.
// `allOwned` and `unlimited` are SEPARATE flags even though today both mean
// "Range". Fusing them into one would repeat input.js's pass-17 mistake —
// welding a requirement to an accident — and the first mode that wants one
// without the other (a hardcore waves variant, a loadout screen) would have
// to unpick it. main.js states both, derived from the mode it owns.
export function resetAmmo({ unlimited = false, allOwned = false } = {}) {
  for (const id of WEAPON_ORDER) {
    // Ownership: STARTERs are yours at wave 1 (§24 pins exactly one exists);
    // everything else is bought off a wall (ownWeapon below). delete rather
    // than false so Object.keys(owned) IS the inventory.
    if (allOwned || WEAPON_TYPES[id].STARTER) owned[id] = true;
    else delete owned[id];
    mags[id] = WEAPON_TYPES[id].MAG_SIZE;
    // `?? Infinity` is the MAX_RANGE contract: no field, no limit. A gun that
    // never opted into scarcity keeps the pass-17 behaviour instead of
    // silently starting at zero and locking on its first reload. §24's
    // REQUIRED list is what stops that guard from quietly absorbing a
    // misplaced paste (LESSONS #22) — the fallback is for weapons that MEAN
    // it, and the assert proves ours do.
    reserves[id] = unlimited ? Infinity : (WEAPON_TYPES[id].RESERVE_START ?? Infinity);
  }
  // ORDER[0] happens to be the pistol, but "the starter" is the RULE and
  // "first in the roster" is the accident — pass 20 could legitimately
  // reorder the registry for the slot keys. Find the rule.
  activeId = WEAPON_ORDER.find((id) => owned[id]) ?? WEAPON_ORDER[0];
  reloading = false;
  reloadT = 0;
}

export function isOwned(id) {
  return owned[id] === true;
}

// The wall-buy's grant (19): ownership + a full magazine + the seeded pile —
// exactly the state the weapon would have had at a fresh round, which is what
// "buying the gun" should mean. Idempotent-hostile on purpose: buying a gun
// you own is a caller bug (that path is the AMMO purchase), so it returns
// false rather than quietly re-seeding a spent pile at gun price.
export function ownWeapon(id) {
  if (!WEAPON_TYPES[id] || owned[id]) return false;
  owned[id] = true;
  mags[id] = WEAPON_TYPES[id].MAG_SIZE;
  reserves[id] = WEAPON_TYPES[id].RESERVE_START ?? Infinity;
  return true;
}

// The wall's AMMO purchase (19): the reserve fills TO ITS CAP — COD's rule,
// and the pickup contract's opposite on purpose (a drop ADDS a fixed quantum;
// the wall SELLS "full"). Returns rounds actually gained so main can refuse
// to charge for zero — the same leave-it-if-worthless shape as the drop.
export function fillReserve(id) {
  if (!WEAPON_TYPES[id] || !owned[id]) return 0;
  const cur = reserves[id] ?? 0;
  if (!Number.isFinite(cur)) return 0; // Range's pile: nothing to sell
  const cap = WEAPON_TYPES[id].RESERVE_MAX ?? Infinity;
  if (!Number.isFinite(cap)) return 0; // no cap, no meaningful "full"
  const gained = cap - cur;
  reserves[id] = cap;
  return gained;
}

export function getActiveWeaponId() {
  return activeId;
}

export function getActiveWeapon() {
  return WEAPON_TYPES[activeId];
}

// Swap. Returns true only when the weapon actually changed, so the caller
// knows whether to move the viewmodel and repaint the HUD.
//
// A swap CANCELS an in-progress reload, and that is a design decision rather
// than an implementation detail. It makes the swap the real answer to an empty
// shotgun in melee — faster than the 2.2 s reload, at the cost of the progress
// you'd already paid for. Without the cancel you could start the shotgun's
// reload, fight with the pistol, and collect a free full tube: the slow reload
// that pays for eight pellets would cost nothing at all.
// Refuses unowned ids (19) ahead of every other rule: slot keys still route
// raw digits for the whole roster (input.js stays roster-blind), so "2" with
// an unbought shotgun lands here and dies here — the pill never repaints, the
// gun never moves. Owning it is what makes the key work, which is the wall-buy
// teaching its own control scheme.
export function setActiveWeapon(id) {
  if (!owned[id]) return false;
  if (!WEAPON_TYPES[id]) return false; // unknown weapon: refuse, never throw
  if (id === activeId) return false;   // already holding it — not a swap
  activeId = id;
  reloading = false;
  reloadT = 0;
  return true;
}

// Resolve a hotbar slot (1-based) to a weapon id; null for an out-of-range
// slot so a future keybind can't index off the end of the roster.
export function weaponIdForSlot(slot) {
  return WEAPON_ORDER[slot - 1] ?? null;
}

// The next weapon in the roster, wrapping. Q's whole implementation.
// Cycles OWNED weapons only (19): Q with just the pistol is a no-op, Q after
// buying the shotgun toggles the pair. The modulo walk covers the whole
// roster so ownership gaps are skipped, not fenced.
export function nextWeaponId() {
  const i = WEAPON_ORDER.indexOf(activeId);
  // Walk at most one full lap: with one owned gun this lands back on it and
  // the swap handler's no-op refusal makes Q silence, which is correct.
  for (let step = 1; step <= WEAPON_ORDER.length; step++) {
    const id = WEAPON_ORDER[(i + step) % WEAPON_ORDER.length];
    if (owned[id]) return id;
  }
  return activeId; // unreachable while anything is owned; never undefined
}

// The fire gate: no shots while reloading, no shots on empty.
export function canFire() {
  return !reloading && (mags[activeId] ?? 0) > 0;
}

// One round leaves on every REAL shot — ONE, no matter how many pellets that
// shot puts in the air. Cooldown-swallowed clicks never reach this (see
// main.js wiring), and neither does a pellet: shooting.js reports a SHOT, and
// the pellets are an implementation detail underneath it. That distinction is
// the reason this function did not need a pellet-aware rewrite in 17.
export function consumeRound() {
  if ((mags[activeId] ?? 0) > 0) mags[activeId] -= 1;
}

// Returns true only when a reload actually starts: refused while one is
// already running (no restart-cheese resetting the timer), refused on a full
// mag (R at 12/12 must not lock the gun for nothing), and — 17b — refused on
// an EMPTY PILE, for the same reason stated the other way round: a reload that
// can't add a single round would lock the gun for 1200 ms and hand back
// exactly what it took. That is a trap, not a decision. `Infinity <= 0` is
// false, so an unlimited pile sails through untouched.
//
// This is also what makes the HUD's EMPTY state honest: when R does nothing,
// the pill has to say so, or the player reads a dead key as a broken game.
export function startReload() {
  if (reloading) return false;
  if ((mags[activeId] ?? 0) >= WEAPON_TYPES[activeId].MAG_SIZE) return false;
  if ((reserves[activeId] ?? 0) <= 0) return false;
  reloading = true;
  reloadT = 0;
  return true;
}

// Abandon an in-progress reload, keeping whatever is already in the mag.
// Returns whether one was actually running, so a caller (or the suite) can
// tell a real cancel from a no-op.
//
// The SECOND thing that cancels a reload (17a-fix). The first is a swap, above
// — and this deliberately does not refactor that one to call this one, though
// they now write the same two fields. setActiveWeapon clears them
// UNCONDITIONALLY; routing it through a guarded cancel would make it depend on
// "reloadT is always 0 whenever !reloading" being true forever, which is an
// invariant nothing states and nothing pins. Two honest writers beat one
// clever one resting on an unwritten assumption.
//
// Why melee cancels rather than being blocked: you run dry, press R, and a
// zombie closes inside the 1200 ms. If a bash were merely blocked you would
// have no answer for that window — which is the "helpless empty gun" spiral
// melee exists to prevent, and 17b's finite ammo is about to make that window
// the most common moment in the game. So the bash stays available always and
// costs you the reload progress instead. Same trade the swap makes, same
// reason: an escape from melee should cost something you already paid for.
export function cancelReload() {
  const was = reloading;
  reloading = false;
  reloadT = 0;
  return was;
}

// Ticks an in-progress reload; returns true on the tick it completes so the
// caller knows to refresh the HUD. Fills the ACTIVE weapon only — the one
// you're holding is the one your hands are working on.
// THE line 17b existed to delete: `mags[activeId] = MAG_SIZE` conjured a full
// magazine from nothing. It now takes what the pile can give, which may be
// less than a full mag — a partial reload is a real outcome and the HUD shows
// it. `Math.min` against Infinity returns `need` and `Infinity - need` stays
// Infinity, so an unlimited pile refills exactly like pass 17 did, through
// this same arithmetic and not around it.
export function updateAmmo(dtMs) {
  if (!reloading) return false;
  reloadT += dtMs;
  if (reloadT >= WEAPON_TYPES[activeId].RELOAD_MS) {
    reloading = false;
    reloadT = 0;
    const need = WEAPON_TYPES[activeId].MAG_SIZE - (mags[activeId] ?? 0);
    const take = Math.min(need, reserves[activeId] ?? 0);
    // `?? 0` on the mag as well: a completion tick that ran before any
    // resetAmmo would otherwise write `undefined + take` = NaN into the
    // magazine, and a NaN here paints a NaN on the HUD rather than throwing.
    mags[activeId] = (mags[activeId] ?? 0) + take;
    reserves[activeId] -= take;
    return true;
  }
  return false;
}

export function getMag() {
  return mags[activeId] ?? 0;
}

// Rounds in a weapon you are NOT holding. The HUD doesn't want this yet; the
// suite does, because "the pistol kept its 3 rounds" is unprovable without it.
export function getMagOf(id) {
  return mags[id] ?? 0;
}

// The pile behind the gun in your hands. May be Infinity (Range) — the HUD
// tests for that rather than printing it, so Range's readout is byte-identical
// to pass 17's.
export function getReserve() {
  return reserves[activeId] ?? 0;
}

export function getReserveOf(id) {
  return reserves[id] ?? 0;
}

// A pickup, cashed in. RETURNS HOW MANY ROUNDS ACTUALLY LANDED, and that
// return value is the pickup's entire contract rather than a nicety: 0 means
// the pile was already full, and render/pickups.js reads it to leave the drop
// ON THE FLOOR instead of eating it for nothing. A pickup that vanished into a
// capped reserve would be the player's mistake to make, silently, with no way
// to see it coming.
//
// Guarded three ways, and each guard is a real case rather than ceremony:
//   • unknown id — a caller can't invent a gun (same refusal as setActiveWeapon);
//   • non-finite pile — Range. Topping up Infinity is meaningless, and without
//     this the clamp BELOW would quietly REDUCE it to RESERVE_MAX. Nothing can
//     reach here in Range (no zombies, no kills, no drops), which is exactly
//     why the guard is one line: the trap can then never fire at all rather
//     than never firing today.
//   • `?? Infinity` on the cap — the MAX_RANGE contract again: no field, no
//     limit.
export function addReserve(id, n) {
  if (!WEAPON_TYPES[id]) return 0;
  const cur = reserves[id] ?? 0;
  if (!Number.isFinite(cur)) return 0;
  const cap = WEAPON_TYPES[id].RESERVE_MAX ?? Infinity;
  const next = Math.min(cur + n, cap);
  const gained = next - cur;
  reserves[id] = next;
  return gained;
}

// Nothing in the gun and nothing behind it: the moment 17a was built for. The
// HUD paints this state and R refuses it, so the only answers left are the
// other weapon (2 / Q) or the bash (V). Infinity can never satisfy it, so
// Range can never be empty.
export function isEmpty() {
  return (mags[activeId] ?? 0) <= 0 && (reserves[activeId] ?? 0) <= 0;
}

export function isReloading() {
  return reloading;
}

// 0..1 through the reload; 0 when idle. Drives the gun-dip telegraph. Reads
// the ACTIVE weapon's timing, so the shotgun's longer dip is free.
export function reloadProgress() {
  if (!reloading) return 0;
  const ms = WEAPON_TYPES[activeId].RELOAD_MS;
  if (!(ms > 0)) return 0; // guard: /0 on a mistuned registry entry
  return Math.min(1, reloadT / ms);
}
