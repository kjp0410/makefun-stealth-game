/* guards.js — patrol, suspicion, chase and coin investigation.
 *
 * A guard lives in one of four states:
 *   patrol      — walks its waypoint loop, pausing at each point
 *   suspicious  — stopped, turned toward something it half-saw or heard
 *   chase       — the eye is nearly full: it runs at the thief
 *   investigate — walking to where a coin landed, for a few seconds
 * The guard's facing is an angle in radians; its eye is its position.
 */
const GUARD_STATES = { PATROL: "patrol", SUSPICIOUS: "suspicious", CHASE: "chase", INVESTIGATE: "investigate" };

function makeGuard(def) {
  const start = def.pts[0];
  return {
    x: (def.x + 0.5) * TILE,
    y: (def.y + 0.5) * TILE,
    def,
    wp: 1 % def.pts.length,
    state: GUARD_STATES.PATROL,
    facing: Math.PI / 2,
    pauseLeft: 0,
    stateTime: 0,
    lookX: 0,
    lookY: 0,
    hearX: 0,
    hearY: 0,
    coinX: 0,
    coinY: 0,
    investigateLeft: 0,
    stepPhase: Math.random() * 6,
  };
}

/* Turn `cur` toward `target` by at most `maxStep` radians. */
function turnToward(cur, target, maxStep) {
  let d = target - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

/* Move (x, y) toward (tx, ty) by `speed` px/s for dt, sliding along
 * walls: try the full step, then each axis alone. Returns the new spot. */
function slideMove(grid, x, y, tx, ty, speed, dt) {
  const dx = tx - x, dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { x, y, arrived: true };
  const step = Math.min(dist, speed * dt);
  const nx = x + (dx / dist) * step, ny = y + (dy / dist) * step;
  const r = 13; // body radius
  const free = (px, py) =>
    !blocksSight(grid, Math.floor((px - r) / TILE), Math.floor((py - r) / TILE)) &&
    !blocksSight(grid, Math.floor((px + r) / TILE), Math.floor((py - r) / TILE)) &&
    !blocksSight(grid, Math.floor((px - r) / TILE), Math.floor((py + r) / TILE)) &&
    !blocksSight(grid, Math.floor((px + r) / TILE), Math.floor((py + r) / TILE));
  if (free(nx, ny)) return { x: nx, y: ny, arrived: dist <= step };
  if (free(nx, y)) return { x: nx, y, arrived: false };
  if (free(x, ny)) return { x, y: ny, arrived: false };
  return { x, y, arrived: false };
}

function updateGuard(g, grid, dt, player, meter) {
  const speedPx = g.def.speed * TILE;
  g.stateTime += dt;
  g.stepPhase += dt * speedPx / 14;

  if (g.state === GUARD_STATES.CHASE) {
    // Run at the thief. Lose the trail when the eye empties.
    const m = slideMove(grid, g.x, g.y, player.x, player.y, speedPx * 1.45, dt);
    g.x = m.x; g.y = m.y;
    g.facing = turnToward(g.facing, Math.atan2(player.y - g.y, player.x - g.x), dt * 6);
    if (meter < 25) {
      g.state = GUARD_STATES.SUSPICIOUS;
      g.stateTime = 0;
      g.lookX = player.x; g.lookY = player.y;
    }
    return;
  }

  if (g.state === GUARD_STATES.INVESTIGATE) {
    const m = slideMove(grid, g.x, g.y, g.coinX, g.coinY, speedPx * 1.25, dt);
    g.x = m.x; g.y = m.y;
    g.facing = turnToward(g.facing, Math.atan2(g.coinY - g.y, g.coinX - g.x), dt * 6);
    g.investigateLeft -= dt;
    if (m.arrived || g.investigateLeft <= 0) {
      g.state = GUARD_STATES.SUSPICIOUS;
      g.stateTime = 0;
      g.lookX = g.coinX; g.lookY = g.coinY;
    }
    return;
  }

  if (g.state === GUARD_STATES.SUSPICIOUS) {
    // Stand still, stare at what drew attention, then go back to patrol.
    g.facing = turnToward(g.facing, Math.atan2(g.lookY - g.y, g.lookX - g.x), dt * 4);
    if (g.stateTime > 2.2) {
      g.state = GUARD_STATES.PATROL;
      g.stateTime = 0;
    }
    return;
  }

  // Patrol: walk the loop, pausing at each waypoint.
  if (g.pauseLeft > 0) {
    g.pauseLeft -= dt;
    return;
  }
  const target = g.def.pts[g.wp];
  const tx = (target[0] + 0.5) * TILE, ty = (target[1] + 0.5) * TILE;
  const m = slideMove(grid, g.x, g.y, tx, ty, speedPx, dt);
  g.x = m.x; g.y = m.y;
  g.facing = turnToward(g.facing, Math.atan2(ty - g.y, tx - g.x), dt * 5);
  if (m.arrived) {
    g.wp = (g.wp + 1) % g.def.pts.length;
    g.pauseLeft = g.def.pause;
  }
}

/* A coin just landed at (x, y): every guard close enough walks over. */
function guardsHearCoin(guards, x, y) {
  for (const g of guards) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < 7 * TILE && g.state !== GUARD_STATES.CHASE) {
      g.state = GUARD_STATES.INVESTIGATE;
      g.stateTime = 0;
      g.coinX = x; g.coinY = y;
      g.investigateLeft = 4;
    }
  }
}

/* A running thief is loud: guards nearby turn suspicious toward the noise. */
function guardsHearSteps(guards, x, y) {
  for (const g of guards) {
    if (g.state !== GUARD_STATES.PATROL) continue;
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < 3.5 * TILE) {
      g.state = GUARD_STATES.SUSPICIOUS;
      g.stateTime = 0;
      g.lookX = x; g.lookY = y;
    }
  }
}
