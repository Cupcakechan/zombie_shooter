// state.js — minimal state machine for the screen/game flow (DESIGN.md §4).
// All six states are declared now because they're the doc's contract; the
// shell only enters START / PLAYING / PAUSED. COUNTDOWN and RESULTS get wired
// by the round pass.

export const States = Object.freeze({
  BOOT: 'BOOT',
  START: 'START',
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  RESULTS: 'RESULTS',
});

let current = States.BOOT;

// state -> [callback(prevState)] — registered via onEnter().
const enterHandlers = new Map();

export function getState() {
  return current;
}

export function onEnter(state, fn) {
  if (!enterHandlers.has(state)) enterHandlers.set(state, []);
  enterHandlers.get(state).push(fn);
}

export function setState(next) {
  // Re-entering the same state is a no-op so accidental double events
  // (e.g. two pointerlockchange firings) can't double-run enter handlers.
  if (next === current) return;
  const prev = current;
  current = next;
  const handlers = enterHandlers.get(next);
  if (handlers) handlers.forEach((fn) => fn(prev));
}
