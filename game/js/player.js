/* player.js — the thief: smooth pixel movement, grid collision,
 * sneaking, and the coin toss.
 *
 * Speeds are in tiles per second: a brisk walk when upright, half that
 * when sneaking (Shift). Running is loud — guards within earshot turn
 * suspicious — while sneaking is near-silent and halves how fast the
 * detection eye opens.
 */
const PLAYER_SPEED = 4.6; // tiles per second, upright
const SNEAK_SPEED = 2.4;  // tiles per second, crouched

function makePlayer(startX, startY) {
  return {
    x: (startX + 0.5) * TILE,
    y: (startY + 0.5) * TILE,
    dirX: 0,
    dirY: 1,
    sneaking: false,
    moving: false,
    stepPhase: 0,
    stepAcc: 0,
  };
}

/* One frame of movement from the held keys. `keys` holds booleans for
 * up/down/left/right/sneak. Returns true when a footstep tick is due. */
function updatePlayer(p, grid, keys, dt) {
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  p.moving = dx !== 0 || dy !== 0;
  if (!p.moving) return false;
  const len = Math.hypot(dx, dy);
  dx /= len; dy /= len;
  p.dirX = dx; p.dirY = dy;
  p.sneaking = !!keys.sneak;
  const speed = (p.sneaking ? SNEAK_SPEED : PLAYER_SPEED) * TILE;
  const nx = p.x + dx * speed * dt, ny = p.y + dy * speed * dt;
  const r = 12;
  const free = (px, py) =>
    !blocksSight(grid, Math.floor((px - r) / TILE), Math.floor((py - r) / TILE)) &&
    !blocksSight(grid, Math.floor((px + r) / TILE), Math.floor((py - r) / TILE)) &&
    !blocksSight(grid, Math.floor((px - r) / TILE), Math.floor((py + r) / TILE)) &&
    !blocksSight(grid, Math.floor((px + r) / TILE), Math.floor((py + r) / TILE));
  if (free(nx, ny)) { p.x = nx; p.y = ny; }
  else if (free(nx, p.y)) { p.x = nx; }
  else if (free(p.x, ny)) { p.y = ny; }
  // Footstep ticks: one per stride, slower while sneaking.
  p.stepAcc += speed * dt;
  const stride = p.sneaking ? 26 : 34;
  if (p.stepAcc >= stride) {
    p.stepAcc -= stride;
    p.stepPhase += 1;
    return true;
  }
  return false;
}

/* The tile under the thief's feet, and whether it is shadow. */
function playerTile(p) {
  return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
}
function playerInShadow(grid, p) {
  const t = playerTile(p);
  if (t.y < 0 || t.y >= grid.length || t.x < 0 || t.x >= grid[0].length) return false;
  return grid[t.y][t.x] === ",";
}

/* A thrown coin: it arcs from the thief toward the aim point and lands
 * after 0.45 s. While it flies the guards can already hear it coming. */
function makeCoin(fromX, fromY, toX, toY) {
  return {
    x0: fromX, y0: fromY, x1: toX, y1: toY,
    x: fromX, y: fromY,
    t: 0, dur: 0.45,
    landed: false, landX: toX, landY: toY,
    ring: 0,
  };
}
function updateCoin(c, dt) {
  if (c.landed) {
    c.ring += dt;
    return;
  }
  c.t += dt;
  const k = Math.min(1, c.t / c.dur);
  c.x = c.x0 + (c.x1 - c.x0) * k;
  c.y = c.y0 + (c.y1 - c.y0) * k;
  if (k >= 1) { c.landed = true; c.ring = 0; }
  return c;
}
function coinHeight(c) {
  if (c.landed) return 0;
  const k = Math.min(1, c.t / c.dur);
  return Math.sin(k * Math.PI) * 26; // arc peak, pixels above the floor
}
