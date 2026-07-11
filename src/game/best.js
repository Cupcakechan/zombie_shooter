// game/best.js — personal-best persistence. Every localStorage touch is
// guarded: it doesn't exist in Node (where the suite imports this), and in
// the browser it can THROW (private mode, quota) — a failed save must cost
// the player nothing but the persistence.

import { CONFIG } from '../config.js';

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (err) {
    return false; // some embeddings throw on the mere access
  }
}

// Returns { score, accuracy } or null. Anything malformed reads as null so
// old/corrupt values can never NaN the results screen.
export function loadBest() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.score !== 'number') return null;
    return {
      score: parsed.score,
      accuracy: typeof parsed.accuracy === 'number' ? parsed.accuracy : null,
    };
  } catch (err) {
    return null;
  }
}

// Records a new best when this round's score strictly beats the stored one.
// Pinned rules (DESIGN.md changelog v2.1): a best requires score > 0 (an AFK
// zero-round records nothing), and the first recorded best counts as new.
// Returns { best, isNew } where best is what the results screen should show.
export function saveBestIfBeaten(score, accuracy) {
  const stored = loadBest();
  const isNew = stored === null ? score > 0 : score > stored.score;

  if (!isNew) return { best: stored, isNew: false };

  const best = { score, accuracy };
  if (storageAvailable()) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(best));
    } catch (err) {
      // Quota/private-mode failure: the round still counts on screen; only
      // persistence is lost.
    }
  }
  return { best, isNew: true };
}
