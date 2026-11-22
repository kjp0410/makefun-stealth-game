/* game.js — Shadow Shift: state machine, detection, HUD and rendering.
 *
 * States: menu → intro → playing ⇄ paused → caught → playing …
 *        playing → complete → intro (next) → … → win → menu
 * The detection eye (0–100) fills while any guard sees the thief and
 * drains while hidden. Full eye = caught. Shadow halves the fill rate,
 * sneaking nearly halves it again; distance softens it at the cone edge.
 */
const Game = {
  state: "menu",
  levelIndex: 0,
  grid: [],
  cols: 0,
  rows: 0,
  player: null,
  guards: [],
  exit: { x: 0, y: 0 },
  intel: null,
  coinsLeft: 3,
  coin: null,
  meter: 0,
  maxMeter: 0,
  levelTime: 0,
  totalTime: 0,
  spotted: 0,
  stars: [0, 0, 0, 0, 0, 0], // bit 1 = ghost (eye never past 50), bit 2 = intel
  stateTime: 0,
  flash: 0,
  noiseTimer: 0,
  sawPlayer: false,
  keys: { up: false, down: false, left: false, right: false, sneak: false },
  mouse: { x: 0, y: 0, seen: false },
  levelSpotted: 0,

  /* ---- level setup ---- */

  loadLevel(idx) {
    const L = LEVELS[idx];
    this.levelIndex = idx;
    this.grid = L.map.map((row) => row.split(""));
    this.rows = this.grid.length;
    this.cols = this.grid[0].length;
    this.guards = L.guards.map(makeGuard);
    this.coinsLeft = L.coins;
    this.coin = null;
    this.meter = 0;
    this.maxMeter = 0;
    this.levelTime = 0;
    this.levelSpotted = 0;
    this.sawPlayer = false;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const ch = this.grid[y][x];
        if (ch === "P") this.player = makePlayer(x, y);
        if (ch === "E") this.exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
        if (ch === "I") this.intel = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, taken: false };
      }
    }
    if (!this.intel) this.intel = null;
    this.fitCanvas();
  },

  fitCanvas() {
    const cv = document.getElementById("cv");
    cv.width = this.cols * TILE;
    cv.height = this.rows * TILE;
  },

  startLevel(idx) {
    this.loadLevel(idx);
    this.setState("intro");
  },

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.renderOverlays();
  },

  /* ---- per-frame update ---- */

  update(dt) {
    if (this.state === "playing") {
      this.levelTime += dt;
      const stepped = updatePlayer(this.player, this.grid, this.keys, dt);
      if (stepped) {
        AudioSys.step(this.player.sneaking);
        if (!this.player.sneaking) {
          this.noiseTimer -= dt;
          if (this.noiseTimer <= 0) {
            guardsHearSteps(this.guards, this.player.x, this.player.y);
            this.noiseTimer = 0.5;
          }
        }
      }
      for (const g of this.guards) updateGuard(g, this.grid, dt, this.player, this.meter);
      this.detect(dt);
      if (this.coin) {
        updateCoin(this.coin, dt);
        if (this.coin.landed && this.coin.ring === 0) {
          AudioSys.coinLand();
          guardsHearCoin(this.guards, this.coin.landX, this.coin.landY);
        }
        if (this.coin.landed && this.coin.ring > 1.2) this.coin = null;
      }
      if (this.intel && !this.intel.taken &&
          Math.hypot(this.player.x - this.intel.x, this.player.y - this.intel.y) < 24) {
        this.intel.taken = true;
        AudioSys.pickup();
        this.toast("Intel secured — worth a star.");
      }
      const pt = playerTile(this.player);
      if (Math.floor(this.exit.x / TILE) === pt.x && Math.floor(this.exit.y / TILE) === pt.y) {
        this.completeLevel();
      }
      AudioSys.setTension(this.meter);
    } else if (this.state === "caught") {
      this.flash = Math.max(0, 1 - this.stateTime / 0.9);
      if (this.stateTime > 1.1) {
        this.loadLevel(this.levelIndex);
        this.setState("playing");
      }
    } else if (this.state === "complete") {
      if (this.stateTime > 0.4) { /* wait for Enter/click */ }
    }
    this.updateHud();
  },

  /* The detection eye: every guard that sees the thief pours in. */
  detect(dt) {
    let seen = false;
    let nearest = null;
    let nearestD = Infinity;
    for (const g of this.guards) {
      const sees = guardSees(this.grid, g.x, g.y, g.facing,
        (g.def.fov * Math.PI) / 180, g.def.range, this.player.x, this.player.y);
      if (!sees) continue;
      seen = true;
      const d = Math.hypot(this.player.x - g.x, this.player.y - g.y);
      if (d < nearestD) { nearestD = d; nearest = g; }
      const proximity = 1 - (d / g.def.range) * 0.65;
      let rate = 55 * proximity;
      if (playerInShadow(this.grid, this.player)) rate *= 0.5;
      if (this.player.sneaking) rate *= 0.55;
      this.meter += rate * dt;
      if (!this.sawPlayer && this.meter > 25) {
        this.sawPlayer = true;
        AudioSys.suspicious();
      }
    }
    if (seen) {
      if (this.meter > 70 && nearest && nearest.state !== GUARD_STATES.CHASE) {
        nearest.state = GUARD_STATES.CHASE;
        nearest.stateTime = 0;
      }
    } else {
      this.meter = Math.max(0, this.meter - 25 * dt);
      if (this.meter < 25) this.sawPlayer = false;
    }
    this.meter = Math.min(100, this.meter);
    this.maxMeter = Math.max(this.maxMeter, this.meter);
    for (const g of this.guards) {
      if (g.state === GUARD_STATES.CHASE &&
          Math.hypot(g.x - this.player.x, g.y - this.player.y) < 24) {
        this.caught();
        return;
      }
    }
    if (this.meter >= 100) this.caught();
  },

  caught() {
    this.spotted++;
    this.levelSpotted++;
    AudioSys.caught();
    this.flash = 1;
    this.setState("caught");
  },

  completeLevel() {
    AudioSys.levelClear();
    this.totalTime += this.levelTime;
    let star = 0;
    if (this.maxMeter <= 50) star |= 1;
    if (this.intel && this.intel.taken) star |= 2;
    this.stars[this.levelIndex] |= star;
    this.setState("complete");
  },

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) {
      this.startLevel(this.levelIndex + 1);
    } else {
      this.setState("win");
    }
  },

  score() {
    let total = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      const s = this.stars[i];
      total += (s & 1 ? 250 : 0) + (s & 2 ? 250 : 0);
    }
    total += Math.max(0, 6000 - Math.round(this.totalTime) * 8 - this.spotted * 150);
    return total;
  },

  /* ---- coin ---- */

  throwCoin() {
    if (this.state !== "playing" || this.coinsLeft <= 0 || this.coin) return;
    let tx, ty;
    if (this.mouse.seen) {
      const cv = document.getElementById("cv");
      const rect = cv.getBoundingClientRect();
      const sx = cv.width / rect.width, sy = cv.height / rect.height;
      tx = (this.mouse.x - rect.left) * sx;
      ty = (this.mouse.y - rect.top) * sy;
    } else {
      tx = this.player.x + this.player.dirX * 4 * TILE;
      ty = this.player.y + this.player.dirY * 4 * TILE;
    }
    // Pull the landing point back out of any wall.
    for (let i = 0; i < 20; i++) {
      const gx = Math.floor(tx / TILE), gy = Math.floor(ty / TILE);
      if (gx < 0 || gy < 0 || gy >= this.rows || gx >= this.cols ||
          blocksSight(this.grid, gx, gy)) {
        tx += (this.player.x - tx) * 0.1;
        ty += (this.player.y - ty) * 0.1;
      } else break;
    }
    this.coinsLeft--;
    this.coin = makeCoin(this.player.x, this.player.y, tx, ty);
    AudioSys.coin();
  },

  /* ---- HUD + overlays ---- */

  fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + String(s).padStart(2, "0");
  },

  updateHud() {
    const L = LEVELS[this.levelIndex];
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set("hudLevel", "Level " + (this.levelIndex + 1) + " / " + LEVELS.length + " — " + L.name);
    set("hudTime", this.fmtTime(this.levelTime) + "  ·  total " + this.fmtTime(this.totalTime + this.levelTime));
    set("hudCoins", "Coins " + this.coinsLeft);
    const intelTxt = this.intel ? (this.intel.taken ? "Intel ★" : "Intel ☆") : "Intel —";
    set("hudIntel", intelTxt);
    set("hudSpotted", "Spotted " + this.spotted);
    this.renderEye();
  },

  toast(msg) {
    const el = document.getElementById("toast");
    if (el) el.textContent = msg;
  },

  starText(i) {
    const s = this.stars[i];
    return (s & 1 ? "★" : "☆") + (s & 2 ? "★" : "☆");
  },

  renderOverlays() {
    const ov = document.getElementById("overlay");
    if (!ov) return;
    const L = LEVELS[this.levelIndex];
    if (this.state === "menu") {
      let rows = "";
      LEVELS.forEach((lv, i) => {
        rows += '<button class="lvl-btn" data-level="' + i + '">' +
          '<b>' + (i + 1) + ". " + lv.name + "</b><span>" + this.starText(i) +
          " · " + lv.guards.length + (lv.guards.length === 1 ? " guard" : " guards") +
          " · par " + lv.par + "s</span></button>";
      });
      ov.innerHTML =
        '<div class="card"><h1>SHADOW SHIFT</h1>' +
        '<p class="tag">A top-down stealth game. Slip past the patrols, hide in ' +
        'shadow, reach the green exit unseen.</p>' +
        '<div class="lvl-grid">' + rows + '</div>' +
        '<p class="keys">Move <b>WASD / arrows</b> · Sneak <b>Shift</b> · Throw coin ' +
        '<b>Space / click</b> · Pause <b>P</b> · Restart <b>R</b> · Mute <b>M</b></p>' +
        '<p class="keys dim">Shadow halves the eye. A full eye means you are caught. ' +
        'Finish with the eye never past half for a Ghost star; grab the intel folder for another.</p></div>';
      ov.classList.add("show");
      ov.querySelectorAll(".lvl-btn").forEach((b) => {
        b.addEventListener("click", () => {
          AudioSys.ensure();
          this.startLevel(parseInt(b.dataset.level, 10));
        });
      });
    } else if (this.state === "intro") {
      ov.innerHTML =
        '<div class="card"><div class="kicker">LEVEL ' + (this.levelIndex + 1) + " / " + LEVELS.length + "</div>" +
        "<h1>" + L.name + "</h1><p class=\"tag\">" + L.sub + "</p>" +
        '<p class="keys">' + L.guards.length + (L.guards.length === 1 ? " guard" : " guards") +
        " on patrol · " + L.coins + " coins · par " + L.par + "s</p>" +
        '<p class="keys dim">Press <b>Enter</b> or click to begin</p></div>';
      ov.classList.add("show");
    } else if (this.state === "complete") {
      const ghost = this.maxMeter <= 50;
      const gotIntel = this.intel && this.intel.taken;
      ov.innerHTML =
        '<div class="card"><div class="kicker">LEVEL CLEAR</div>' +
        "<h1>" + L.name + "</h1>" +
        '<p class="tag">Time ' + this.fmtTime(this.levelTime) + " · eye peaked at " +
        Math.round(this.maxMeter) + "%" + (this.levelSpotted ? " · spotted " + this.levelSpotted + "×" : "") + "</p>" +
        '<p class="stars">' + (ghost ? "★ Ghost — unseen" : "☆ Ghost — eye passed 50%") + "<br>" +
        (this.intel ? (gotIntel ? "★ Intel secured" : "☆ Intel left behind") : "No intel on this floor") + "</p>" +
        '<p class="keys dim">Press <b>Enter</b> or click for the next level</p></div>';
      ov.classList.add("show");
    } else if (this.state === "caught") {
      ov.innerHTML = '<div class="card spotted"><h1>SPOTTED!</h1>' +
        '<p class="tag">The patrol saw you. The floor resets.</p></div>';
      ov.classList.add("show");
    } else if (this.state === "paused") {
      ov.innerHTML = '<div class="card"><h1>PAUSED</h1>' +
        '<p class="keys dim">Press <b>P</b> to keep moving</p></div>';
      ov.classList.add("show");
    } else if (this.state === "win") {
      let stars = 0;
      this.stars.forEach((s) => { stars += (s & 1 ? 1 : 0) + (s & 2 ? 1 : 0); });
      ov.innerHTML =
        '<div class="card"><div class="kicker">ALL SIX FLOORS CLEARED</div>' +
        "<h1>GHOST OF THE NIGHT</h1>" +
        '<p class="tag">Total time ' + this.fmtTime(this.totalTime) +
        " · spotted " + this.spotted + "× · stars " + stars + " / 12</p>" +
        '<p class="stars">Score ' + this.score() + "</p>" +
        '<p class="keys dim">Press <b>Enter</b> or click to return to the menu</p></div>';
      ov.classList.add("show");
    } else {
      ov.innerHTML = "";
      ov.classList.remove("show");
    }
  },

  advance() {
    AudioSys.ensure();
    if (this.state === "intro") this.setState("playing");
    else if (this.state === "complete") this.nextLevel();
    else if (this.state === "win") { this.totalTime = 0; this.spotted = 0; this.setState("menu"); }
    else if (this.state === "menu") this.startLevel(0);
  },

  /* ---- rendering ---- */

  render() {
    const cv = document.getElementById("cv");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // Floor.
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const ch = this.grid[y][x];
        const px = x * TILE, py = y * TILE;
        if (ch === "#") {
          ctx.fillStyle = "#39415a";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#4c5878";
          ctx.fillRect(px, py, TILE, 5);
          ctx.fillStyle = "#2b3247";
          ctx.fillRect(px, py + TILE - 4, TILE, 4);
        } else if (ch === ",") {
          ctx.fillStyle = "#181d29";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = "rgba(120,140,190,0.10)";
          ctx.beginPath();
          ctx.moveTo(px, py + TILE); ctx.lineTo(px + TILE, py);
          ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE / 2, py);
          ctx.moveTo(px + TILE / 2, py + TILE); ctx.lineTo(px + TILE, py + TILE / 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#272d3d" : "#252a38";
          ctx.fillRect(px, py, TILE, TILE);
        }
        if (ch !== "#") {
          ctx.strokeStyle = "rgba(0,0,0,0.18)";
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }

    // Crates.
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] !== "C") continue;
        const px = x * TILE + 4, py = y * TILE + 4, s = TILE - 8;
        ctx.fillStyle = "#6e4f2a";
        ctx.fillRect(px, py, s, s);
        ctx.strokeStyle = "#4a3419";
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, s, s);
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(px + s, py + s);
        ctx.moveTo(px + s, py); ctx.lineTo(px, py + s);
        ctx.stroke();
        ctx.fillStyle = "#8a6537";
        ctx.fillRect(px + 3, py + 3, s - 6, 4);
      }
    }

    // Exit portal.
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 350);
    const ex = this.exit.x, ey = this.exit.y;
    const glow = ctx.createRadialGradient(ex, ey, 4, ex, ey, 46);
    glow.addColorStop(0, "rgba(80,255,150," + (0.55 * pulse + 0.25) + ")");
    glow.addColorStop(1, "rgba(80,255,150,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ex - 46, ey - 46, 92, 92);
    ctx.fillStyle = "#123524";
    ctx.beginPath();
    ctx.arc(ex, ey, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4dff88";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#4dff88";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EXIT", ex, ey + 28);

    // Intel folder.
    if (this.intel && !this.intel.taken) {
      const ix = this.intel.x, iy = this.intel.y;
      const bob = Math.sin(performance.now() / 400) * 2;
      ctx.fillStyle = "#f5c542";
      ctx.fillRect(ix - 9, iy - 6 + bob, 18, 12);
      ctx.fillRect(ix - 9, iy - 9 + bob, 8, 4);
      ctx.strokeStyle = "#a67c00";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ix - 9, iy - 6 + bob, 18, 12);
      ctx.fillStyle = "#7a5c00";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("INTEL", ix, iy + 3 + bob);
    }

    // Vision cones (under the guards, over the floor).
    for (const g of this.guards) {
      const fov = (g.def.fov * Math.PI) / 180;
      const poly = conePolygon(this.grid, g.x, g.y, g.facing, fov, g.def.range, 0.02);
      const hot = g.state === GUARD_STATES.CHASE;
      const warm = g.state === GUARD_STATES.SUSPICIOUS || g.state === GUARD_STATES.INVESTIGATE;
      const grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, g.def.range);
      const col = hot ? "255,90,70" : warm ? "255,190,80" : "255,225,120";
      grad.addColorStop(0, "rgba(" + col + ",0.30)");
      grad.addColorStop(1, "rgba(" + col + ",0.05)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(" + col + ",0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Thrown coin.
    if (this.coin) {
      const c = this.coin;
      const h = coinHeight(c);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 4, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd94d";
      ctx.beginPath();
      ctx.arc(c.x, c.y - h, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a67c00";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (c.landed && c.ring < 1.2) {
        ctx.strokeStyle = "rgba(255,217,77," + (1 - c.ring / 1.2) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.landX, c.landY, 8 + c.ring * 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Guards.
    for (const g of this.guards) {
      const bob = Math.sin(g.stepPhase) * 1.5;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + 12, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = g.state === GUARD_STATES.CHASE ? "#c22e2e" : "#8c2f2f";
      ctx.beginPath();
      ctx.arc(g.x, g.y + bob * 0.3, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e8b4b4";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Visor wedge showing where the guard looks.
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath();
      ctx.moveTo(g.x, g.y + bob * 0.3);
      ctx.arc(g.x, g.y + bob * 0.3, 9, g.facing - 0.45, g.facing + 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2a0d0d";
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.facing) * 4, g.y + Math.sin(g.facing) * 4 + bob * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
      // Alert mark.
      if (g.state === GUARD_STATES.SUSPICIOUS) {
        ctx.fillStyle = "#ffd94d";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", g.x, g.y - 20);
      } else if (g.state === GUARD_STATES.CHASE) {
        ctx.fillStyle = "#ff5040";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", g.x, g.y - 20);
      } else if (g.state === GUARD_STATES.INVESTIGATE) {
        ctx.fillStyle = "#cfe0ff";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("?", g.x, g.y - 20);
      }
    }

    // The thief.
    const p = this.player;
    const crouch = p.sneaking ? 3 : 0;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151a26";
    ctx.beginPath();
    ctx.arc(p.x, p.y - crouch, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = playerInShadow(this.grid, p) ? "#7f8fc4" : "#c8d2ea";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood point in the facing direction.
    const pa = Math.atan2(p.dirY, p.dirX);
    ctx.fillStyle = "#151a26";
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(pa - 0.5) * 12, p.y - crouch + Math.sin(pa - 0.5) * 12);
    ctx.lineTo(p.x + Math.cos(pa) * 19, p.y - crouch + Math.sin(pa) * 19);
    ctx.lineTo(p.x + Math.cos(pa + 0.5) * 12, p.y - crouch + Math.sin(pa + 0.5) * 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9fe8ff";
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(pa) * 5, p.y - crouch + Math.sin(pa) * 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Caught flash.
    if (this.flash > 0) {
      ctx.fillStyle = "rgba(200,30,30," + (this.flash * 0.55) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    // Vignette: the room feels darker at the edges.
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  },

  /* The detection eye in the HUD: an eye that opens as the meter rises. */
  renderEye() {
    const ec = document.getElementById("eyeCv");
    if (!ec) return;
    const ctx = ec.getContext("2d");
    const W = ec.width, H = ec.height;
    ctx.clearRect(0, 0, W, H);
    const m = this.meter / 100;
    const cx = W / 2 - 14, cy = H / 2 + 2;
    // Eye outline.
    ctx.strokeStyle = m > 0.7 ? "#ff5040" : m > 0.35 ? "#ffd94d" : "#8fa3c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.quadraticCurveTo(cx, cy - 20 - m * 4, cx + 26, cy);
    ctx.quadraticCurveTo(cx, cy + 20 + m * 4, cx - 26, cy);
    ctx.stroke();
    // Iris: opens with the meter.
    const irisR = 4 + m * 9;
    const irisCol = m > 0.7 ? "#ff4030" : m > 0.35 ? "#ffae00" : "#4dff88";
    ctx.fillStyle = irisCol;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0e16";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.5, irisR * 0.45), 0, Math.PI * 2);
    ctx.fill();
    // Lashes stiffen as the eye opens.
    ctx.strokeStyle = "rgba(200,210,235,0.7)";
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      const lx = cx + i * 14;
      ctx.beginPath();
      ctx.moveTo(lx, cy - 14 - m * 3);
      ctx.lineTo(lx + i * 3, cy - 22 - m * 4);
      ctx.stroke();
    }
    ctx.fillStyle = "#c8d2ea";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("DETECTION", 4, 12);
    ctx.textAlign = "right";
    ctx.fillText(Math.round(this.meter) + "%", W - 4, 12);
  },
};
