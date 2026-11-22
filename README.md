# makefun-stealth-game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/kjp0410/makefun-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/kjp0410/makefun-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Shadow Shift is a top-down stealth game for desktop browsers. Slip past patrolling guards' raycast vision cones, hide behind crates and in shadow, toss coins to pull guards away, and reach the glowing exit unseen across six hand-built floors. A detection eye in the HUD opens as guards spot you — fill it and you are caught. Every sound is synthesized live with WebAudio: no files, no network, no dependencies.

## Run it

```sh
python3 -m http.server 8080 --directory game
```

Then open http://localhost:8080 in a desktop browser and play. (Opening game/index.html straight from disk works too.)

The hand-in program writes the entry — `game/`, `screenshots/` and `dossier.json` — to an output directory:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=4s3d9qw1&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
