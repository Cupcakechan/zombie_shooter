// data/maps.js — the map registry (Stage 4). A map IS data: an ASCII tile
// layout plus its constants — geometry, colliders, the nav grid, and spawn
// windows all DERIVE from this one artifact (mapGrid.js parses, mapGen.js
// builds, future passes collide and navigate on it).
//
// Legend:
//   #  wall (full height, cell-thick — chunky by design)
//   .  open ground / floor (walkable)
//   D  doorway (walkable; rendered with jambs + lintel; future real doors)
//   W  window (blocked: sill + header; the zombie spawn barrier from 4.3 on)
//   F  fountain (blocked; rendered as basin + column)
//   P  player start (walkable; exactly one)
//
// Authoring rules (suite Section 13 enforces every one): rows all the same
// length; exactly one P; every window embedded in a straight wall run;
// every walkable cell reachable from P (flood fill — sealed rooms cannot
// ship); the whole map fits inside the arena's walkable clamp. The map
// EDGE is open ground — mapGen renders a low fence ring at the boundary,
// and the fog swallows what lies beyond.
//
// ANCHOR is the world point the layout is CENTRED on; the player spawns at
// P (the map owns the start). Floor-aware from day one: `layout` is floor
// 0; the basement lands as a layouts-per-floor extension.

export const MAPS = {
  // The village (Daniel's sketch, 2026-07-12): four buildings around a
  // central fountain on open ground. Start = the small south-west house.
  // TL: two rooms (partition door), two south exits, two north windows.
  // TR: two rooms (partition door), one south exit, two north windows.
  // BL (START): two rooms, north exit + east exit, P in the south room.
  // BR: open hall, west door facing the fountain, two north windows.
  village01: {
    id: 'village01',
    CELL: 1.6,
    FLOOR_H: 3.2,
    WINDOW_SILL_H: 1.0,
    HEADER_H: 0.8,
    ANCHOR: { x: 0, z: -15 }, // arena centre; extent must fit the clamp
    COLORS: {
      WALL: 0x4a4440,   // weathered plaster
      TRIM: 0x2e2a27,   // sills, headers, jambs, the fence
      FOUNTAIN: 0x55504a,
      WATER: 0x1e3a3f,
    },
    // Wall-buys (19): WHICH wall sells WHAT. A buy is (cell, face, weapon):
    // the cell is a '#' in the layout, FACE names the side the panel hangs on
    // (and the side you stand on to buy — the cell one step that way must be
    // walkable; suite §27 derives both checks from this data via mapGrid, so
    // a typo'd cell fails the suite instead of hanging a panel inside a wall).
    // PRICES ARE NOT HERE — a price is a gun-fact (weaponTypes.js); where it
    // is sold is the map's only say. Placement is a design statement:
    //   shotgun — BR hall's west face, SEEN from the fountain crossing every
    //     lap: the early saving goal stays visible while you save (probed:
    //     wall (13,16) '#', front (12,16) '.', world x4.8 z-7.0);
    //   smg — DEEP in the TR house's north room, two doors from anywhere:
    //     the panic gun costs points AND a walk through zombie ground
    //     (probed: wall (15,2) '#', front (15,3) '.', world x8.0 z-29.4).
    BUYS: [
      { WEAPON: 'shotgun', CELL: [13, 16], FACE: 'W' },
      { WEAPON: 'smg', CELL: [15, 2], FACE: 'S' },
    ],
    // Grown 2026-07-12 (felt cramped): same buildings and CELL, more ground
    // — wider building gaps, deeper edge margins, taller mid-field.
    layout: [
      '.....................',
      '.....................',
      '..#W###W##...#W##W#..',
      '..#..#...#...#....#..',
      '..#..D...W...#....#..',
      '..#..#...#...#D####..',
      '..#..#...#...#....W..',
      '..##D###D#...###D##..',
      '.....................',
      '.....................',
      '.........FFF.........',
      '.........FFF.........',
      '.........FFF.........',
      '.....................',
      '.....................',
      '..###D##.....#W##W#..',
      '..W....#.....#....#..',
      '..##D###.....D....#..',
      '..#....D.....#....#..',
      '..#P...#.....#....#..',
      '..###W##.....###W##..',
      '.....................',
      '.....................',
    ],
  },

  // The first authored map (4.1) — kept as the registry's second valid
  // entry: two maps proving the format is data, not code.
  house01: {
    id: 'house01',
    CELL: 1.6,
    FLOOR_H: 3.2,
    WINDOW_SILL_H: 1.0,
    HEADER_H: 0.8,
    ANCHOR: { x: 0, z: -13 },
    COLORS: {
      WALL: 0x4a4440,
      TRIM: 0x2e2a27,
      FOUNTAIN: 0x55504a,
      WATER: 0x1e3a3f,
    },
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

// The map the game currently plays.
export const ACTIVE_MAP_ID = 'village01';
