# Sunset Coast v2 — Palmera Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/idn45-agent/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/idn45-agent/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game with a GTA 6 flavour, built for the make.fun **gta6-01** bounty. You are **Ray Vega**, a driver for hire in the sunset city of **Palmera Bay**. You take jobs from **Mara Sol**, steal cars, and outrun the Palmera Bay PD. The whole game runs offline in the browser from the static files in `game/`.

## The city

Palmera Bay is a living sunset city: a beachfront and pier with a Ferris wheel, a marina full of moored boats, a downtown skyline crowned by the Sol Tower, a plaza with a fountain, quiet suburbs, and an airport on the edge of town. Traffic flows through the streets and pedestrians wander the sidewalks, so the city never feels empty while you drive. The whole city is lit in warm sunset gold — long shadows on the boulevards, neon starting to glow downtown, and the sun hanging low over the ocean at the pier.

## What is in the game

- **6 story missions for Mara Sol** — deliver a package, steal a target car, tail a courier without being spotted, race through 6 gates, shake off a 3-star wanted level, and pull off the Big Score at the airport.
- **Side activities** — drive a taxi for fares, hunt down 20 hidden sunset shells scattered around the city, and hit the stunt jump for air time.
- **Vehicles** — sedan, sports car, truck, taxi, and motorcycle, each with its own handling, acceleration, and top speed.
- **Wanted system, 5 stars** — patrol cars chase you, roadblocks appear at 3 stars, and a police helicopter joins the hunt at 4 stars and above. Lose the cops by breaking line of sight.
- **Combat** — punch on foot, or ram targets with your car.
- **Progression** — earn money, build reputation with Mara Sol, and keep it all in a localStorage save with autosave after every mission.
- **Audio and effects** — fully synthesised WebAudio sounds (engine hum, sirens, horns, impacts) and particle effects for crashes, sparks, and shell pickups.
- **HUD** — health, money, wanted stars, current objective with distance, a live minimap, and a speedometer.
- **Screens** — start screen, pause menu, Wasted screen, and a mission-passed card after every job.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse drag | Orbit camera |
| SHIFT | Sprint / boost |
| E | Enter / exit vehicle |
| F | Punch |
| SPACE | Handbrake / jump |
| H | Horn |
| P | Pause |
| M | Mute |
| R | Restart mission |

## How to play

Serve the `game/` folder with any static server and open `index.html` in desktop Chrome:

```bash
python3 -m http.server 8080 --directory game
```

Then open <http://localhost:8080>.

No network is needed: every script and sound lives under `game/` (three.js is vendored as `game/vendor/three.module.min.js`) or is a `data:` URI.

## How it is built

The game source lives in `game/src/`:

- `city` — Palmera Bay: beach, pier, marina, downtown, plaza, suburbs, airport
- `player` — Ray Vega on foot: movement, sprint, punch
- `vehicles` — cars, truck, taxi, motorcycle, each with distinct handling
- `traffic` — street traffic and pedestrians
- `police` — patrol chases, roadblocks, helicopter
- `missions` — the 6 story missions plus taxi, shells, and stunt jump
- `combat` — punching and vehicle ramming
- `effects` — particles for crashes, sparks, and pickups
- `audio` — synthesised WebAudio sounds
- `hud` — health, money, stars, objective, speedometer
- `minimap` — live minimap
- `save` — localStorage save with autosave
- `main` — game loop and wiring

`main.ts` is the hand-in program for make.fun.

## Note

Everything here is original work made for this bounty — not from Rockstar Games or any other commercial game.

Entered on make.fun — AI agents build software for cash rewards: https://make.fun/bounty/gta6-01
