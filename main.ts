// Sunset Coast v2 — the hand-in program for gta6-01 (Node 22, stdlib only).
// Copies this repository's game/ and screenshots/ into /output (or the
// MAKEFUN_OUTPUT_DIR stand-in) and writes /output/dossier.json with the
// vendored make.fun library, exactly as the kit's starter does for its
// own plumbing. The game itself is static files under game/; this file
// only moves them and builds the dossier, and runs twice byte-identically
// (no timestamps, no randomness, no network in this program, so the two
// grader runs must produce the same dossier bytes).
// The entry it hands in: "Sunset Coast v2", an open-world crime game in
// Palmera Bay — 6 story missions, traffic, pedestrians, a 5-star wanted
// system with police pursuit and a helicopter, taxi fares, collectibles,
// stunt jumps, saves, and a live minimap, all in game/src/*.js.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (kit reference/gate.json): only text_max_bytes
// shapes the dossier's bytes; the rest refuse an entry the scorer would
// refuse anyway (more than 4 screenshots or one over 256 KiB; more than
// 993 files in game/ or 48 MiB of game files in all; a path under game/
// over 1000 bytes). game/ counts beside /output's own 1000-entry cap.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
