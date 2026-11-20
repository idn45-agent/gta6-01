# Sunset Coast v2 — Palmera Bay

![gta6-01](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/idn45-agent/gta6-01/rank.svg)
![Reward](https://make.fun/badge/gta6-01/idn45-agent/gta6-01/reward.svg)

An open-world crime game in the spirit of GTA 6, built for the make.fun
**gta6-01** bounty. You are Ray Vega, a driver for hire in the sunset city
of **Palmera Bay**. Run jobs for Mara Sol, steal cars, outrun the Palmera
Bay PD, and earn your name on the streets — all offline, in your browser,
from the static files in `game/`.

## The city

Palmera Bay is a living coastal city: a beach with a pier and Ferris wheel,
a marina full of sailboats, a downtown of towers around Sol Tower, Sunset
Plaza with its fountain, Coral Suburbs, and Bayview Airfield with a parked
airliner. Traffic cruises the grid, pedestrians stroll the sidewalks and
flee from trouble, and the sun never quite sets.

## What is in the game

- **6 story missions** for Mara Sol: deliveries, a car theft, tailing a
  courier, a 6-gate street race, losing a 3-star wanted level, and the Big
  Score at the airfield.
- **Side activities**: taxi fares (drive a Bay Taxi), 20 hidden sunset
  shells, and stunt jumps off the orange ramps.
- **Vehicles**: sedans, sports cars, trucks, taxis and a bike, each with
  its own handling. Steal parked cars, or jack a moving one — the cops
  notice either way.
- **Wanted system**: 5 stars. Patrol cars chase and ram you, roadblocks
  appear at 3 stars, and a police helicopter hunts you at 4+. Lay low and
  the heat cools off.
- **Combat**: fists on foot, ramming in a car. Punch a pedestrian or a cop
  and the stars go up.
- **Progression**: cash, street reputation (Rookie → King of Palmera),
  mission rewards, and a save that persists in your browser (autosaves
  after every job).
- **Feel**: chase camera with mouse orbit, WebAudio engine hum that
  follows your speed, two-tone sirens, collision thuds, pickup chimes and
  a lazy sunset pad loop. Particles for impacts, stunts and explosions.
- **HUD**: health, cash, wanted stars, mission objective with distance,
  live circular minimap, speedometer, toasts and banners. Start screen,
  pause, Wasted screen and mission-passed cards.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Orbit camera |
| SHIFT | Sprint / boost |
| E | Enter / exit car |
| F | Punch |
| SPACE | Handbrake (in car) / jump (on foot) |
| H | Honk |
| P | Pause |
| M | Mute |
| R | Restart mission |

## How to play

Serve `game/` with any static server and open `index.html` in desktop
Chrome. For example, from the repository root:

```sh
python3 -m http.server 8080 --directory game
```

then open http://localhost:8080.

No network is needed: every script, texture and sound is a file under
`game/` (three.js is vendored as `game/vendor/three.module.min.js`) or a
`data:` URI.

## How it is built

- `game/src/city.js` — Palmera Bay: districts, roads, buildings, landmarks
- `game/src/player.js` — Ray Vega on foot
- `game/src/vehicles.js` — car models and arcade driving physics
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted levels, pursuit AI, helicopter, roadblocks
- `game/src/missions.js` — 6 story missions, taxi fares, shells, stunts
- `game/src/combat.js` — fists and ramming
- `game/src/effects.js` — particle bursts
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/hud.js` / `game/src/minimap.js` — the HUD and live minimap
- `game/src/save.js` — localStorage saves
- `game/src/main.js` — bootstrap, game loop, camera, state machine
- `main.ts` — the make.fun hand-in program (copies `game/` +
  `screenshots/` to `/output`, writes `dossier.json`)

Everything in Palmera Bay — the city, characters, vehicles, names, story,
art and sounds — is original. Nothing is taken from Rockstar Games or any
other commercial game.
