/* vision.js — raycast vision cones and line of sight.
 *
 * A guard's cone is built by casting rays across its field of view and
 * stopping each ray at the first wall or crate it hits. The same march
 * answers "can this guard see that point" for the detection check.
 * Everything works in pixels; TILE is the pixel size of one grid cell.
 */
const TILE = 40;

/* True when the grid cell (gx, gy) blocks sight. Out of bounds counts. */
function blocksSight(grid, gx, gy) {
  if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length) return true;
  const ch = grid[gy][gx];
  return ch === "#" || ch === "C";
}

/* March from (x0, y0) toward (x1, y1); true when no wall or crate
 * stands between the two points. Steps in 4 px hops, cheap and exact
 * enough for a 40 px tile. */
function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const steps = Math.ceil(dist / 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = Math.floor((x0 + dx * t) / TILE);
    const gy = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(grid, gx, gy)) return false;
  }
  return true;
}

/* Cast one ray from (x, y) along angle a; return the hit point, at most
 * `range` px away. Walls and crates stop the ray. */
function castRay(grid, x, y, a, range) {
  const step = 4;
  const dx = Math.cos(a) * step, dy = Math.sin(a) * step;
  let px = x, py = y;
  for (let d = 0; d < range; d += step) {
    px += dx; py += dy;
    if (blocksSight(grid, Math.floor(px / TILE), Math.floor(py / TILE))) {
      return { x: px, y: py, d };
    }
  }
  return { x: x + Math.cos(a) * range, y: y + Math.sin(a) * range, d: range };
}

/* The cone polygon for a guard: the guard's eye plus one point per ray
 * across its field of view. 21 rays give a smooth edge that still
 * flickers softly when the game jitters the angles a touch. */
function conePolygon(grid, gx, gy, facing, fov, range, wobble) {
  const rays = 21;
  const pts = [{ x: gx, y: gy }];
  for (let i = 0; i <= rays; i++) {
    const t = i / rays - 0.5;
    const a = facing + t * fov + (wobble || 0) * Math.sin(i * 1.7 + performance.now() / 900);
    const hit = castRay(grid, gx, gy, a, range);
    pts.push({ x: hit.x, y: hit.y });
  }
  return pts;
}

/* Classic ray-casting point-in-polygon test. */
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/* True when the guard at (gx, gy) facing `facing` can see the point
 * (px, py): inside the cone's angle and range, inside the raycast
 * polygon, and with a clear line of sight. */
function guardSees(grid, gx, gy, facing, fov, range, px, py) {
  const dx = px - gx, dy = py - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  let da = Math.atan2(dy, dx) - facing;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  if (Math.abs(da) > fov / 2) return false;
  const poly = conePolygon(grid, gx, gy, facing, fov, range, 0);
  if (!pointInPolygon(px, py, poly)) return false;
  return hasLineOfSight(grid, gx, gy, px, py);
}
