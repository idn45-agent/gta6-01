[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/idn45-agent/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/idn45-agent/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Sunset Coast — a gta6-01 entry

An original open-world crime game that plays offline in a desktop browser from static files. No network requests at play time: three.js is vendored under `game/vendor/`, and every other asset is a file under `game/`.

## The game

You are **Ray Vega**, a driver fresh out of luck in **Palmera Bay**, a sun-soaked coastal city of grid streets, a plaza fountain, palm-lined beaches and a marina. Your old friend **Mara Sol** has three jobs for you — and the Palmera Bay Police Department has other plans.

- **Explore on foot and by car** — WASD to move, mouse-drag to orbit the camera, Shift to sprint, E to enter and exit cars (stealing a parked or traffic car raises your wanted level).
- **Traffic and pedestrians** — cars cruise the grid, people stroll the sidewalks.
- **Wanted level** — 5 stars. Punching bystanders, hitting pedestrians and stealing cars raise the heat; police Interceptors spawn, chase and ram you. Lay low for 20 seconds to cool one star down.
- **Missions and story** — three jobs with on-screen objectives and a glowing beacon: *The Package* (pick up at the Marina Drop), *Hot Wheels* (steal a car and reach the hideout with the cops on you), *Sunset Showdown* (put Dario's 3 rivals down on the beach, then reach the yacht). Each pays cash and raises your reputation: Street → Runner → Wheelman → King of the Coast.
- **Combat** — F to punch, or ram with a vehicle. Getting wasted wakes you up at Sol Plaza, $200 lighter.
- **HUD** — health bar, cash, reputation, wanted stars, mission objective with distance, and a live minimap showing streets, the ocean, cars, police, pedestrians and the mission marker.
- **Menus and saves** — start screen, pause menu (P), autosave every 30 seconds plus manual save, continue a saved game from the start screen (localStorage).
- **Sound** — fully synthesized WebAudio: engine hum that follows speed, two-tone police sirens, pickup blips and punch thuds. No audio files. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Mouse drag | Orbit camera |
| Shift | Sprint |
| E | Enter / exit car |
| F | Punch |
| P | Pause |
| M | Mute |

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Source layout

Each file in `game/src/` has one job, named for what it does:

- `city.js` — the layout of Palmera Bay (streets, blocks, landmarks, seeded RNG)
- `world.js` — the 3D scene: sky, sun, ground, ocean, beach, roads, buildings, palms, plaza, and building collision data
- `input.js` — keyboard + mouse-drag camera input
- `audio.js` — synthesized WebAudio sound (engine, sirens, blips)
- `vehicles.js` — car meshes, parked fleet, police cars, enter/exit, arcade driving
- `traffic.js` — traffic cars cruising the grid and pedestrians strolling the sidewalks
- `police.js` — the wanted level and police pursuit
- `combat.js` — punching, vehicle ramming, damage and health regen
- `missions.js` — the three-job story, objective marker, rewards and reputation
- `hud.js` — the DOM heads-up display
- `minimap.js` — the live 2D minimap
- `save.js` — localStorage save / load
- `main.js` — boot, the game loop, screens, camera, and the `?shot=` scenes the screenshots are staged from

Screenshots (`screenshots/`) are real renders of this game in desktop Chrome: `1-chase.jpg` (police chase, cover), `2-street.jpg` (on foot in the city), `3-drive.jpg` (driving the coastal road), `4-mission.jpg` (the beach showdown).

## License

MIT — see `LICENSE`. All names, characters, places, story, art and sound are original to this game.
