# Sunset Coast — builder log (gta6-01)

## What was built

An original open-world crime game, "Sunset Coast", in `game/` (three.js vendored as
`game/vendor/three.module.min.js`, loaded via an import map; no network at play time).
All names, characters, places, story, art and sound are original — nothing from any
commercial game.

- `game/src/city.js` — Palmera Bay layout: 30-unit street grid, landmarks, seeded RNG.
- `game/src/world.js` — 3D scene: sun, sky, ocean, beach, roads, buildings with lit
  windows, palms, Sol Plaza fountain, marina piers; building collision data.
- `game/src/input.js` — WASD + mouse-drag camera, one-shot key presses.
- `game/src/audio.js` — synthesized WebAudio: engine hum, two-tone sirens, blips.
- `game/src/vehicles.js` — car meshes, parked fleet, police Interceptors, enter/exit, driving.
- `game/src/traffic.js` — traffic cars on road loops, pedestrians wandering sidewalks.
- `game/src/police.js` — 5-star wanted level, heat, police spawn/chase/ram, cooldown.
- `game/src/combat.js` — punch, vehicle ramming, damage, health regen.
- `game/src/missions.js` — 3-job story (The Package / Hot Wheels / Sunset Showdown),
  glowing beacon marker, cash + reputation rewards.
- `game/src/hud.js` — health, cash, rep, stars, objective + distance, toasts.
- `game/src/minimap.js` — live 2D minimap (streets, ocean, cars, police, peds, marker).
- `game/src/save.js` — localStorage save/load, 30 s autosave.
- `game/src/main.js` — boot, game loop, start/pause screens, third-person camera,
  `?shot=` staging scenes, `window.__game` test hook.
- `main.ts` rewritten in this session; `README.md` expanded (3 make.fun badge lines kept
  verbatim at the top); `.makefun/owner.json` untouched.

## Play-test (headless Chrome via CDP + Fetch interception from disk)

- Game object present; Start button enters play; walking moves the player;
  entering a car works and stealing raises wanted to 1 star with a police unit spawned;
  driving moves the car; punching registers. Zero console errors and zero failed
  requests in the final screenshot run (favicon served via a `data:` URI).
- Note: headless SwiftShader renders at ~2.3 fps, so scripted movement covers only a
  few units per second there — a software-rendering artifact, not a game defect;
  on a real desktop GPU the loop runs at full frame rate (dt is capped at 0.05 s).

## Genuine revisions (Stage 2)

1. **Mission rivals never spawned** (`missions.js`): the showdown looked for
   *dead* pedestrians to repurpose as rivals, but all pedestrians start alive, so
   no rivals ever appeared. Fixed to repurpose the first three pedestrians
   regardless of state, teleport them to the beach, mark them hostile and dress
   them red. Also fixed the showdown finale: once all 3 rivals are down the
   marker now moves from the beach to the yacht (`updateMissions`).
2. **Chase staging killed the player** (`main.js`): the 240-step police close-in
   ran the ram damage, dropping health to 0, so the first game-loop frame fired
   the "Wasted!" respawn (plaza, wanted 0, on foot) — the cover shot showed an
   on-foot player with empty stars. Fixed by restoring health to 100 after the
   staging loop and syncing the player record onto the car after repositioning it
   (same sync fix in the drive staging).
3. **Cover camera swung away from the police** (`main.js`): the front-facing
   chase camera was undone by the camera auto-follow once its 2.5 s freeze
   expired during the slow screenshot drive. Extended the freeze to 10 s in the
   chase staging, so the police car stays in frame behind the player's car.
4. **Screenshot driver waits** (`/tmp/cdp-shots.mjs`): replaced the fixed 1.5 s
   wait with polling for `window.__shotReady` (up to 30 s), which fixed the
   mission shot once rendering the start screen instead of the beach.
5. Minor: removed a dead variable in `police.js` `addHeat`; added a `data:` favicon
   to `index.html` to stop the favicon 404.

## Verification

- `node --check` passes on all 13 `game/src/*.js` files.
- `MAKEFUN_OUTPUT_DIR=out1 node main.ts` and `out2` — `diff -r out1 out2` identical.
- Dossier re-derived independently via `buildDossier` — byte-identical to `main.ts` output.
- Gate self-check: game/ within file/byte limits, `index.html` well under 1 MiB,
  4 screenshots 1280x720 JPEG, each under 256 KiB, dossier under 1.5 MiB,
  no `http(s)://` or external references in `index.html` or any reachable script.
- Screenshots viewed: 1-chase (player car, police car in pursuit, 4 stars, Job 2
  objective, minimap), 2-street (on foot, traffic, pedestrians, Job 1), 3-drive
  (coastal road, beach, palms, ocean), 4-mission (beach showdown, red rivals,
  beacon, Job 3 objective).
