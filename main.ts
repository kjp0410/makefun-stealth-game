/*
 * main.ts — the hand-in program for Shadow Shift (program/v1).
 *
 * It copies this repository's game/ and screenshots/ into the output
 * directory and writes dossier.json there with buildDossier from the
 * vendored make.fun library. In the grader the repository is read-only
 * at /bot and the output is /output; outside the grader,
 * MAKEFUN_OUTPUT_DIR stands in for /output. The program is
 * deterministic: the same repository writes the same bytes every run.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
cpSync(join(here, "game"), join(out, "game"), { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });
if (existsSync(join(here, "screenshots"))) {
  cpSync(join(here, "screenshots"), join(out, "screenshots"), { recursive: true });
}

// buildDossier reads game/ and screenshots/ from the directory it is
// given, so it runs on the output directory after the copies above.
// The caps are the scorer's own: at most 4 screenshots of 256 KiB,
// at most 993 game files totalling 48 MiB, dossier text capped at
// 160 KiB.
writeFileSync(
  join(out, "dossier.json"),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
