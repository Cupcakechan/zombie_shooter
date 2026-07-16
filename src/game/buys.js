// game/buys.js — wall-buy rules (pass 19): stand near a panel, E to buy.
//
// WHAT THIS PASS IS. Every pass since 17a built PRESSURE — scarcity (17b), a
// floor when broke (17a), a roster worth wanting (17-18) — and this is the
// release valve that converts pressure into decisions. The pistol-start is
// the half that makes it load-bearing: with all three guns free, a wallet is
// a spectator number; with two of them on walls, waves 1-4 are the pistol
// era, the first ~1200 points are a SAVING GOAL, and the village's rooms
// acquire economic geography ("the house with the SMG").
//
// Pure logic, DOM-free, dependencies INJECTED (the shooting.js/melee.js
// pattern, and for the same reason): the suite drives these rules with a
// controllable wallet and inventory, so every refusal below is provable in
// Node. main.js wires the real reads and owns the purchase's side effects.
//
// One spot sells ONE weapon and answers TWO questions with it, in a fixed
// order that is a design statement, not a convenience:
//   not owned  -> sell the GUN  (PRICE — the registry's number)
//   owned      -> sell AMMO     (AMMO_PRICE — reserve fills to its cap)
// The same panel being both is COD's own scheme, and it is what makes a
// wall a PLACE you keep coming back to instead of a one-shot unlock.

import { CONFIG } from '../config.js';
import { WEAPON_TYPES } from '../data/weaponTypes.js';

let spots = [];   // { weapon, x, z } — world-space floor points, from main
let deps = null;  // injected reads/acts — see initBuys

// `spots` arrive as world positions: buys.js knows nothing about maps, cells,
// or walls — WHERE panels hang is settled by maps.js data and mapGrid math
// before this module ever hears about it. It judges distances and prices.
export function initBuys(spotList, { isOwned, reserveFull, getBalance, spend, onBuyGun, onBuyAmmo } = {}) {
  spots = spotList || [];
  deps = { isOwned, reserveFull, getBalance, spend, onBuyGun, onBuyAmmo };
}

// The offer at the player's position, or null when out of range of every
// panel. Nearest spot wins if two overlap (they shouldn't; the suite pins the
// shipped map's spots far apart, but the rule costs one comparison).
//
// The offer is COMPUTED FRESH every call and carries everything the prompt
// needs: what, which transaction, the price, and whether the player can pay.
// `affordable` rides the offer rather than being the caller's problem because
// the prompt must grey out — a buy prompt that looks live and refuses on E
// reads as a broken key, the exact EMPTY-pill lesson from 17b.
export function offerAt(px, pz) {
  if (!deps) return null;
  let best = null;
  let bestD = Infinity;
  for (const s of spots) {
    const d = Math.hypot(px - s.x, pz - s.z);
    if (d <= CONFIG.BUYS.RADIUS && d < bestD) { best = s; bestD = d; }
  }
  if (!best) return null;

  const w = WEAPON_TYPES[best.weapon];
  if (!w) return null; // a spot for a gun that doesn't exist offers nothing

  if (!deps.isOwned(best.weapon)) {
    // A non-STARTER without a PRICE is a registry bug §24 refuses to ship;
    // the `?? Infinity` here is the runtime's version of the same refusal —
    // an unpriced gun is unaffordable, never free.
    const price = w.PRICE ?? Infinity;
    return {
      weapon: best.weapon, kind: 'gun', price,
      label: w.NAME, affordable: deps.getBalance() >= price,
    };
  }
  // Owned: the panel sells ammo — unless the pile is already full, in which
  // case the offer says so INSTEAD of vanishing. A blank wall where a prompt
  // just was reads as a bug; "AMMO FULL" reads as the answer.
  if (deps.reserveFull(best.weapon)) {
    return { weapon: best.weapon, kind: 'full', price: 0, label: w.NAME, affordable: false };
  }
  const price = w.AMMO_PRICE ?? Infinity;
  return {
    weapon: best.weapon, kind: 'ammo', price,
    label: w.NAME, affordable: deps.getBalance() >= price,
  };
}

// E, pressed. Recomputes the offer at the CURRENT position rather than
// trusting a cached prompt — the player may have stepped away between the
// paint and the press, and charging for a panel you left is theft by latency.
// Charge-before-grant, and only a whole transaction: spend() refuses
// insufficient balances atomically, and the 'full' offer refuses here too
// (its affordable flag is false by construction, but the guard is explicit
// because "E on a full wall charges you" is the bug this line forbids).
export function tryBuy(px, pz) {
  const offer = offerAt(px, pz);
  if (!offer || offer.kind === 'full' || !offer.affordable) return null;
  if (!deps.spend(offer.price)) return null;
  if (offer.kind === 'gun') deps.onBuyGun(offer.weapon);
  else deps.onBuyAmmo(offer.weapon);
  return offer; // the receipt — main repaints HUD off it
}

export function resetBuys() {
  // Spots persist (they are map furniture); nothing else is stateful here.
  // The wallet and inventory reset in their own modules — this exists so the
  // reset choreography in main can treat every module uniformly.
}
