// data/maps.js — the map registry (Stage 4, pass 4.1). A map IS data: an
// ASCII tile layout plus its constants — geometry, colliders, the nav grid,
// and spawn windows all DERIVE from this one artifact (mapGrid.js parses,
// mapGen.js builds, future passes collide and navigate on it).
//
// Legend:
//   #  wall (full height, cell-thick — chunky by design)
//   .  walkable floor
//   D  doorway (walkable; rendered with a header lintel; future real doors)
//   W  window (blocked: sill + header; the zombie spawn barrier from 4.3 on)
//   P  player start (walkable; exactly one per floor)
//
// Authoring rules (suite Section 13 enforces every one):
//   rows all the same length; the perimeter is entirely # or W; exactly one
//   P; windows only on the perimeter (v1); every walkable cell reachable
//   from P (flood fill — sealed rooms cannot ship).
//
// Floor-aware from day one: `layout` is floor 0; the basement lands as a
// layouts-per-floor extension, not a rewrite.

export const MAPS = {
  house01: {
    id: 'house01',
    CELL: 1.6,          // metres per cell — a 1-cell doorway passes both bodies
    FLOOR_H: 3.2,       // wall height
    WINDOW_SILL_H: 1.0, // the climb-over window barrier
    HEADER_H: 0.8,      // lintel depth over windows and doorways
    COLORS: {
      WALL: 0x4a4440,   // weathered plaster
      TRIM: 0x2e2a27,   // sills and headers, darker
    },
    // Two rooms + a hall doorway between them, two exits to a walled yard,
    // seven windows on the perimeter. 15 × 11 cells = 24 × 17.6 m — fits the
    // current arena with margin.
    layout: [
      '###W#####W#####',
      '#.....#.......#',
      '#.....#.......W',
      '#.....D....P..#',
      '#.....#.......#',
      '##D#######D####',
      '#.............#',
      'W.............#',
      '#.............W',
      '#.............#',
      '###W#######W###',
    ],
  },
};
