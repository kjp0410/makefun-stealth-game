/* main.js — boot, input, the frame loop, and the screenshot states.
 *
 * ?shot=N&still=1 poses the game for a screenshot: shot 1 is level 2
 * mid-play behind a crate with the eye part open, shot 2 is level 4
 * with a suspicious guard and a coin in the air, shot 3 is level 5
 * near the exit with the eye nearly full, shot 4 is the win screen.
 * With still=1 the game renders once and never advances, so the shot
 * is exactly the posed frame.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const shot = parseInt(params.get("shot") || "0", 10);
  const still = params.get("still") === "1";

  const KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
  };

  function applyShot(n) {
    if (n === 1) {
      // Level 2, mid-play: thief tucked behind a crate, two cones
      // sweeping, exit in sight, eye part open.
      Game.loadLevel(1);
      Game.player.x = 6.5 * TILE; Game.player.y = 3.5 * TILE;
      Game.player.dirX = 1; Game.player.dirY = 0;
      Game.guards[0].x = 13.5 * TILE; Game.guards[0].y = 5.5 * TILE;
      Game.guards[0].facing = Math.PI;
      Game.guards[1].x = 5.5 * TILE; Game.guards[1].y = 8.5 * TILE;
      Game.guards[1].facing = -Math.PI / 2;
      Game.meter = 38; Game.maxMeter = 38;
      Game.levelTime = 34;
      Game.setState("playing");
    } else if (n === 2) {
      // Level 4: a guard just turned suspicious (!) and a coin is
      // mid-throw toward the far corridor.
      Game.loadLevel(3);
      Game.player.x = 4.5 * TILE; Game.player.y = 9.5 * TILE;
      Game.player.dirX = 1; Game.player.dirY = 0;
      const g = Game.guards[1];
      g.x = 3.5 * TILE; g.y = 8.5 * TILE;
      g.state = GUARD_STATES.SUSPICIOUS;
      g.stateTime = 0.6;
      g.lookX = Game.player.x; g.lookY = Game.player.y;
      g.facing = Math.atan2(Game.player.y - g.y, Game.player.x - g.x);
      Game.coin = makeCoin(Game.player.x, Game.player.y, 9.5 * TILE, 5.5 * TILE);
      Game.coin.t = 0.25;
      updateCoin(Game.coin, 0);
      Game.coinsLeft = 2;
      Game.meter = 55; Game.maxMeter = 55;
      Game.levelTime = 52;
      Game.setState("playing");
    } else if (n === 3) {
      // Level 5: one step from the exit, eye nearly full, a guard
      // chasing down the corridor behind.
      Game.loadLevel(4);
      Game.player.x = 16.5 * TILE; Game.player.y = 2.5 * TILE;
      Game.player.dirX = 1; Game.player.dirY = 0;
      const g = Game.guards[0];
      g.x = 14.5 * TILE; g.y = 5.5 * TILE;
      g.state = GUARD_STATES.CHASE;
      g.stateTime = 0.4;
      g.facing = Math.atan2(Game.player.y - g.y, Game.player.x - g.x);
      Game.meter = 82; Game.maxMeter = 82;
      Game.levelTime = 88;
      Game.setState("playing");
    } else if (n === 4) {
      // The win screen, with a finished run's totals.
      Game.loadLevel(0);
      Game.totalTime = 386;
      Game.spotted = 2;
      Game.stars = [3, 3, 1, 3, 2, 1];
      Game.setState("win");
    }
  }

  function boot() {
    Game.loadLevel(0);
    Game.setState("menu");
    if (shot >= 1 && shot <= 4) applyShot(shot);

    window.addEventListener("keydown", (e) => {
      if (KEYMAP[e.code]) {
        Game.keys[KEYMAP[e.code]] = true;
        e.preventDefault();
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") Game.keys.sneak = true;
      if (e.code === "Space") {
        if (Game.state === "playing") { Game.throwCoin(); e.preventDefault(); }
      }
      if (e.code === "Enter") Game.advance();
      if (e.code === "KeyP") {
        if (Game.state === "playing") Game.setState("paused");
        else if (Game.state === "paused") Game.setState("playing");
      }
      if (e.code === "KeyR") {
        if (Game.state === "playing" || Game.state === "paused" || Game.state === "caught") {
          Game.loadLevel(Game.levelIndex);
          Game.setState("playing");
        }
      }
      if (e.code === "KeyM") {
        AudioSys.ensure();
        AudioSys.setMuted(!AudioSys.muted);
        document.getElementById("btnMute").textContent = AudioSys.muted ? "Unmute" : "Mute";
      }
    });
    window.addEventListener("keyup", (e) => {
      if (KEYMAP[e.code]) Game.keys[KEYMAP[e.code]] = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") Game.keys.sneak = false;
    });

    const cv = document.getElementById("cv");
    cv.addEventListener("mousemove", (e) => {
      Game.mouse.x = e.clientX; Game.mouse.y = e.clientY; Game.mouse.seen = true;
    });
    cv.addEventListener("click", () => {
      AudioSys.ensure();
      if (Game.state === "playing") Game.throwCoin();
    });
    document.getElementById("overlay").addEventListener("click", (e) => {
      if (e.target.closest(".lvl-btn")) return; // level buttons handle themselves
      Game.advance();
    });
    document.getElementById("btnPause").addEventListener("click", () => {
      if (Game.state === "playing") Game.setState("paused");
      else if (Game.state === "paused") Game.setState("playing");
    });
    document.getElementById("btnRestart").addEventListener("click", () => {
      Game.loadLevel(Game.levelIndex);
      Game.setState("playing");
    });
    document.getElementById("btnMute").addEventListener("click", () => {
      AudioSys.ensure();
      AudioSys.setMuted(!AudioSys.muted);
      document.getElementById("btnMute").textContent = AudioSys.muted ? "Unmute" : "Mute";
    });
    document.addEventListener("pointerdown", () => AudioSys.ensure(), { once: true });

    // A handle for automated play tests: state, meter, level, guards.
    window.__shadowShift = Game;

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (Game.state !== "paused") Game.update(dt);
      Game.render();
      if (!still) requestAnimationFrame(frame);
    }
    if (still) {
      Game.update(0.016);
      Game.render();
    } else {
      requestAnimationFrame(frame);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
