/* levels.js — the six hand-built floors of Shadow Shift.
 *
 * Map legend (one character per tile):
 *   #  wall — blocks movement and sight
 *   .  floor
 *   ,  shadow floor — standing here halves how fast the eye opens
 *   C  crate — blocks movement and sight, the cover you hide behind
 *   P  where the thief starts
 *   E  the glowing exit — reach it unseen
 *   I  intel folder — optional pickup, worth a star
 *   G  a guard's post (its patrol waypoints live in the guards list)
 *
 * Guards: x/y is the post (must sit on a G tile), pts are the patrol
 * waypoints in grid coordinates, speed is tiles per second, range is the
 * vision cone's reach in pixels, fov its spread in degrees, pause the
 * seconds a guard waits at each waypoint.
 */
const LEVELS = [
  {
    name: "First Steps",
    sub: "Learn the cones. Reach the green exit unseen.",
    coins: 3,
    par: 45,
    map: [
      "################",
      "#P.....#.......#",
      "#......#...E...#",
      "#..##..#.......#",
      "#..##..#...##..#",
      "#......#.......#",
      "#..##..#...G...#",
      "#......#.......#",
      "#......#.......#",
      "#.............##",
      "################",
    ],
    guards: [
      { x: 11, y: 6, pts: [[12, 2], [12, 6], [14, 6]], speed: 1.5, range: 210, fov: 70, pause: 1.2 },
    ],
  },
  {
    name: "Crates & Corners",
    sub: "Crates block sight as well as feet. Use them.",
    coins: 3,
    par: 60,
    map: [
      "##################",
      "#P....,......#...#",
      "#.....C......#.E.#",
      "#..C....,.......##",
      "#.....##....##...#",
      "#..,......C......#",
      "#.....##....##...#",
      "#..C....,.......##",
      "#.....C.....#..G.#",
      "#....,......#....#",
      "#..G........#..I.#",
      "##################",
    ],
    guards: [
      { x: 15, y: 8, pts: [[15, 2], [15, 8], [11, 8]], speed: 1.6, range: 220, fov: 70, pause: 1.0 },
      { x: 3, y: 10, pts: [[3, 10], [8, 10], [8, 4]], speed: 1.5, range: 210, fov: 70, pause: 1.4 },
    ],
  },
  {
    name: "Long Shadows",
    sub: "Shadow halves the eye. The dark corridor is the safe one.",
    coins: 3,
    par: 75,
    map: [
      "####################",
      "#P...,,,,,,....#...#",
      "#....,,,,,,....#.E.#",
      "#....,,,,,,....#...#",
      "###..,,,,,,..###..##",
      "#....,,,,,,........#",
      "#....,,,,,,..C.#...#",
      "#....,,,,,,....#...#",
      "#..C..,,,,,,...#..G#",
      "#.....,,,,,,.......#",
      "#..G...,,,,,,..#.I.#",
      "#.....,,,,,,...#...#",
      "####################",
    ],
    guards: [
      { x: 18, y: 8, pts: [[16, 2], [18, 8], [13, 8]], speed: 1.7, range: 230, fov: 70, pause: 0.9 },
      { x: 3, y: 10, pts: [[3, 10], [3, 4], [9, 4]], speed: 1.6, range: 220, fov: 70, pause: 1.2 },
    ],
  },
  {
    name: "Coin Toss",
    sub: "Space throws a coin. Guards walk to the clink — for 4 seconds.",
    coins: 3,
    par: 90,
    map: [
      "####################",
      "#P.....#......#....#",
      "#......#..C...#..E.#",
      "#..C...#...........#",
      "#......#..##..#....#",
      "#..##....G....#..###",
      "#......#..C...#....#",
      "#..C...#......#.G..#",
      "#......#..##..#....#",
      "#..##.........#....#",
      "#......#..C.....I..#",
      "#..G...#......#....#",
      "####################",
    ],
    guards: [
      { x: 16, y: 7, pts: [[16, 2], [16, 7], [12, 7]], speed: 1.8, range: 230, fov: 72, pause: 0.8 },
      { x: 3, y: 11, pts: [[3, 11], [3, 8], [6, 8]], speed: 1.7, range: 220, fov: 70, pause: 1.0 },
      { x: 9, y: 5, pts: [[9, 2], [9, 9], [6, 9]], speed: 1.6, range: 220, fov: 70, pause: 1.2 },
    ],
  },
  {
    name: "The Gauntlet",
    sub: "Four patrols, one corridor of light. Patience wins.",
    coins: 3,
    par: 110,
    map: [
      "######################",
      "#P.....,,.....#......#",
      "#......,,.....#..E...#",
      "#..C...,,..C..#......#",
      "#......,,.....#..##..#",
      "#..##..,,..##.#......#",
      "#......,,.G......C...#",
      "#..C...,,..C..#......#",
      "#......,,.....#..##..#",
      "#..##.G,,..##.#......#",
      "#......,,.....#..G...#",
      "#..C...,,..C.........#",
      "#..G...,,.....#.I....#",
      "######################",
    ],
    guards: [
      { x: 17, y: 10, pts: [[18, 2], [18, 10], [16, 10]], speed: 1.9, range: 240, fov: 72, pause: 0.7 },
      { x: 3, y: 12, pts: [[3, 12], [3, 6], [8, 6]], speed: 1.8, range: 230, fov: 70, pause: 0.9 },
      { x: 10, y: 6, pts: [[10, 2], [10, 11], [13, 11]], speed: 1.7, range: 230, fov: 70, pause: 1.0 },
      { x: 6, y: 9, pts: [[6, 3], [6, 9], [2, 9]], speed: 1.6, range: 220, fov: 70, pause: 1.1 },
    ],
  },
  {
    name: "Night Shift",
    sub: "The whole floor is dark — but so are the patrols. Last one.",
    coins: 4,
    par: 130,
    map: [
      "########################",
      "#P,,,,,,....,,,,,,.....#",
      "#,,,,,,,,,,.,,,,,,..E..#",
      "#,,,,,,G...,,,,,,......#",
      "###,,,,,,..,,,,,,..##..#",
      "#,,,,,,,,,,.,,,,,G.....#",
      "#,,,,,,....,,,,,,..C...#",
      "#,,,,,,,,,,.G,,,,,.....#",
      "#,,,,,,....,,,,,,..##..#",
      "#,,C,,,,,,,,,,,,,,.....#",
      "#,,,,,,,,,,.,,,,,,..G..#",
      "#,,,,,,....,,,,,,......#",
      "#,,G,,,,,,,,,,,,,,..I..#",
      "#,,,,,,,,,,.,,,,,,.....#",
      "########################",
    ],
    guards: [
      { x: 20, y: 10, pts: [[19, 2], [20, 10], [15, 10]], speed: 2.0, range: 250, fov: 74, pause: 0.6 },
      { x: 3, y: 12, pts: [[3, 12], [3, 5], [9, 5]], speed: 1.9, range: 240, fov: 72, pause: 0.8 },
      { x: 12, y: 7, pts: [[12, 2], [12, 12], [17, 12]], speed: 1.8, range: 240, fov: 72, pause: 0.9 },
      { x: 7, y: 3, pts: [[7, 3], [7, 10], [2, 10]], speed: 1.8, range: 230, fov: 70, pause: 1.0 },
      { x: 17, y: 5, pts: [[17, 5], [17, 12], [21, 12]], speed: 1.7, range: 230, fov: 70, pause: 1.0 },
    ],
  },
];
