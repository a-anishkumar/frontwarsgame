# BorderWars — Real-Time Geopolitical Strategy & Territory Warfare

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg)](https://vitejs.dev/)
[![HTML5 Canvas](https://img.shields.io/badge/Canvas-2D-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
[![License](https://img.shields.io/badge/License-AGPL--3.0-green.svg)](https://www.gnu.org/licenses/agpl-3.0.html)

**BorderWars** is a high-performance, real-time territory warfare strategy game playable directly in the browser. Inspired by **[FrontWars.io](https://frontwars.io)**, **[OpenFront.io](https://openfront.io)**, and competitive geopolitical grand strategy games like *Territorial.io*, *Risk*, and *Hearts of Iron*, BorderWars pits players against human commanders and nuanced AI personalities across a crisp, tactical **2D geopolitical map**.

Conquer sovereign nations, build interconnected industrial rail networks, dispatch naval fleets, negotiate non-aggression treaties, customize your faction's flag and patterns, and launch multi-warhead ballistic nuclear salvos in the quest for global dominion.

---

## Table of Contents

1. [Quick Start & Installation](#quick-start--installation)
2. [Controls & Hotkeys Reference](#controls--hotkeys-reference)
3. [Core Gameplay Rules & Mechanics](#core-gameplay-rules--mechanics)
   - [The Spawn Phase](#the-spawn-phase)
   - [Frontier Expansion & Combat Attrition](#frontier-expansion--combat-attrition)
   - [Terrain Modifiers & Elevation Resistance](#terrain-modifiers--elevation-resistance)
   - [Economic Balance: Workers, Troops & Gold](#economic-balance-workers-troops--gold)
   - [Diplomacy, Alliances & The Traitor Penalty](#diplomacy-alliances--the-traitor-penalty)
4. [Buildings, Logistics & The Military Tech Tree](#buildings-logistics--the-military-tech-tree)
   - [City](#city)
   - [Factory & Dual-Track Railroads](#factory--dual-track-railroads)
   - [Port & Naval Fleets](#port--naval-fleets)
   - [Defense Post (Fortress)](#defense-post-fortress)
   - [Missile Silo & Nuclear Arsenals](#missile-silo--nuclear-arsenals)
   - [SAM Battery & Radar Stations](#sam-battery--radar-stations)
5. [The Reddit & Competitive Community Playbook](#the-reddit--competitive-community-playbook)
   - [The 42% Rule (Troop Regeneration Sweet Spot)](#the-42-rule-troop-regeneration-sweet-spot)
   - [The 10% Death Zone & The 25% Defense Buffer](#the-10-death-zone--the-25-defense-buffer)
   - [The Train Economy Loop & Factory Grid Layouts](#the-train-economy-loop--factory-grid-layouts)
   - [Early-Game Build Order: The 2-Factory / 4-City Benchmark](#early-game-build-order-the-2-factory--4-city-benchmark)
   - ["Pixel Probing" Naval Invasions](#pixel-probing-naval-invasions)
   - [Teamplay Etiquette: Frontline vs. Backline Rules](#teamplay-etiquette-frontline-vs-backline-rules)
   - [Fast Mode vs. Classic Economy Adaptation](#fast-mode-vs-classic-economy-adaptation)
6. [Bot Personalities & Strategic AI Archetypes](#bot-personalities--strategic-ai-archetypes)
7. [The Map Engine & World Forge](#the-map-engine--world-forge)
   - [2D Geopolitical Canvas Renderer](#2d-geopolitical-canvas-renderer)
   - [Click-to-Locate Navigation](#click-to-locate-navigation)
   - [Natural Earth 50m Real-World Map](#natural-earth-50m-real-world-map)
   - [World Forge: Procedural Planet Generator](#world-forge-procedural-planet-generator)
   - [Mars Colony World](#mars-colony-world)
8. [Comprehensive Player & Match Customization](#comprehensive-player--match-customization)
9. [Multiplayer Architecture & Networking](#multiplayer-architecture--networking)
10. [Project Architecture & Directory Layout](#project-architecture--directory-layout)
11. [Credits & Licensing](#credits--licensing)

---

## Quick Start & Installation

### Prerequisites
- **Node.js**: v20.x, v22.x, or newer
- **npm**: v10.x or newer

### Setup
```bash
# 1. Clone or navigate to the repository
git clone https://github.com/wavelynks-lgtm/borderwars.git
cd borderwars

# 2. Install dependencies
npm install

# 3. Download Natural Earth 50m vector boundary & terrain data
npm run assets

# 4. Start the local Vite development server
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### Building for Production & Testing
```bash
# Build production bundle (TypeScript compilation + Vite bundler)
npm run build

# Run automated test suite (100+ scenario tests)
npm test

# Launch dedicated multiplayer server (optional)
npm run server
```

---

## Controls & Hotkeys Reference

| Action | Key / Input | In-Game Behavior |
| :--- | :--- | :--- |
| **Pan Camera** | `Right-click + Drag` or `Middle-click + Drag` | Pan across the 2D world map with seamless horizontal wrapping. |
| **Tactical Zoom** | `Mouse Wheel` or `Pinch Gesture` | Zoom from strategic global satellite view down to street-level structure detail. |
| **Select Spawn Tile** | `Left-click` on unowned land | Designate or re-pick your homeland starting tile during the match countdown. |
| **Attack / Expand** | `Left-click` on neighbor / enemy | Direct military forces to push across the border into target territory. |
| **Amphibious Transport** | `Left-click` on distant coast | Launch a naval transport ship fleet to establish an overseas beachhead. |
| **Radial Build Menu** | `Right-click` on owned territory | Open the construction wheel over that tile to build or upgrade structures. |
| **Quick Build: City** | Key `Q` | Place a City to expand population capacity and troop growth. |
| **Quick Build: Factory** | Key `F` | Place an industrial Factory to spawn trade trains across connected rail. |
| **Quick Build: Defense** | Key `W` | Place a fortified Defense Post along threatened border tiles. |
| **Quick Build: Port** | Key `E` | Place a coastal Port to commission trade and war fleets. |
| **Quick Build: Silo** | Key `R` | Place a hardened underground Ballistic Missile Silo. |
| **Quick Build: SAM** | Key `T` | Place a Surface-to-Air Missile interceptor battery. |
| **Quick Build: Radar** | Key `A` | Place a Radar Early Warning Reconnaissance station. |
| **Locate Nation** | `Click` on Leaderboard row / `Locate` btn | Smoothly fly and center camera over that sovereign nation's homeland. |
| **Inspect / Diplomacy** | `Click` on enemy territory or name | Open the Diplomatic Panel to view bot personality, troops, gold, and treaties. |
| **Attack Ratio Adjust** | Keys `1` / `2`, Slider, or `Shift + Wheel` | Set the percentage of available army deployed per assault (10% to 100%). |
| **Economy Worker Split** | Bottom-Left Commander Slider | Shift your national balance between gold-earning workers and military troops. |
| **Center on Homeland** | Key `H` | Instantly fly camera back to your capital / home territory. |
| **Topography Overlay** | Hold `Space` | Toggle pure elevation hillshading satellite relief mode. |
| **Pause / Resume** | Key `P` | Pause single-player match simulation tick loop. |
| **Game Speed Modifier** | Keys `[` and `]` | Adjust simulation tick rate from normal speed (`×1`) up to hyper-speed (`×10`). |
| **Performance Overlay** | Key `F3` | Toggle real-time FPS counter, tick latency (ms/tick), and rendering stats. |
| **Cancel / Close** | Key `Esc` | Close active panels, dismiss radial menus, or cancel targeting cursors. |

---

## Core Gameplay Rules & Mechanics

### The Spawn Phase
Every match begins with a **countdown timer** (default 10s to 30s):
- **Free Placement**: Players and bots may select any passable land tile on Earth or Mars.
- **Dynamic Relocation**: If an opponent clicks too close to your selected homeland, click elsewhere to relocate your starting marker before the countdown expires.
- **Simultaneous Start**: When the clock hits `00:00`, all players spawn simultaneously with baseline starter troops and begin population growth.

---

### Frontier Expansion & Combat Attrition
Unlike tile-flipping turn-based games, BorderWars simulates continuous front-line warfare:
1. **Line of Contact**: When you order an attack on an adjacent nation or neutral territory, all shared border tiles become active combat fronts.
2. **Combat Calculation**: Both sides inflict simultaneous casualties based on deployed attack ratios, current standing armies, and defensive fortification multipliers.
3. **Territory Absorption**: Contested border tiles flip ownership sequentially as defending garrisons are eliminated.
4. **Retreat Mechanics**: If an offensive stalls or an enemy flanks you, you can disengage your attacking troops. Surviving forces immediately return to your homeland (retreating while actively taking heavy fire incurs a 25% disengagement casualty penalty).

---

### Terrain Modifiers & Elevation Resistance
Movement and casualties are heavily influenced by the map's elevation topology:
- **Plains (Elevation 0 – 30)**: Standard `1.0×` movement speed and baseline combat casualties.
- **Highlands & Hills (Elevation 31 – 70)**: `0.70×` movement speed. Defenders gain a +20% terrain cover bonus.
- **Mountains (Elevation 71 – 100)**: Rugged, rocky ridges. Forces move at `0.35×` speed; attackers suffer double attrition.
- **Ocean / Deep Water**: Completely impassable to land infantry. Must be traversed using naval Transport Ships.

---

### Economic Balance: Workers, Troops & Gold
Your empire's power is governed by your **Total Population Capacity**:

$$\text{Population Capacity} = \sum \text{Territory Tiles} \times \text{Density Modifier} + \sum \text{City Bonuses}$$

Using the **Commander Economy Slider**, you divide this capacity between:
1. **Standing Military (Troops)**: Defend borders against invasions and execute expansion pushes.
2. **Workforce (Workers)**: Generate passive **Gold** every second.
   - **40% Workers (Standard Default)**: Ideal balance for steady recruitment and moderate income.
   - **80%–90% Workers (Economic Boom)**: Skyrockets gold revenue to afford expensive late-game structures (factories, ports, nuclear silos, hydrogen bombs), but leaves borders vulnerable.
   - **10%–20% Workers (Total War Mobilization)**: Drastically increases available army count for major blitzkrieg offensives.

---

### Diplomacy, Alliances & The Traitor Penalty
Clicking any foreign nation opens the **Diplomatic Dossier**:
- **Non-Aggression Treaties (Alliances)**:
  - Both nations sign a mutual pact (standard 5-minute duration).
  - Borders turn neon green; friendly troops cannot invade each other's tiles.
  - Can be extended when under 30 seconds remaining.
- **Foreign Aid**: Send emergency gold or troops to backline allies to sustain defensive proxy wars.
- **Trade Embargo**: Forbid foreign trade ships from accessing your coastal ports.
- **The Traitor Penalty**:
  - If a commander breaks an alliance by declaring war on an active partner, they are instantly branded a **Traitor** for 30 seconds.
  - **Severe Debuffs**: Global **-50% defense penalty** applied to all your territories, all bot opponents immediately declare total war against you, and a flashing skull marker (`☠ TRAITOR`) appears above your nation on the global leaderboard.

---

## Buildings, Logistics & The Military Tech Tree

```
                       ┌──────────────┐
                       │     City     │ ── Boosts Pop Cap & Troop Growth
                       └──────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
       ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
       │   Factory   │ │Defense Post │ │    Port     │
       └──────┬──────┘ └─────────────┘ └──────┬──────┘
              │                               │
       ┌──────┴──────┐                 ┌──────┴──────┐
       │Cargo Trains │                 │  Warships   │
       │  Railroads  │                 │ Trade Ships │
       └──────┬──────┘                 └─────────────┘
              │
       ┌──────┴──────┐
       │Missile Silo │ ── Atom / Hydrogen / MIRV Salvos
       └──────┬──────┘
              │
       ┌──────┴──────┐
       │ SAM Battery │ ── Anti-Ballistic Interceptor Dome
       └─────────────┘
```

### City
- **Cost**: 25,000 Gold
- **Function**: Primary urban administrative hub. Expands territory population ceiling and accelerates troop recruitment.
- **Upgrades**: Can be upgraded to **Level 2** and **Level 3** (visualized with double/triple building skyscrapers), doubling and tripling their respective population and recruitment buffs.

### Factory & Dual-Track Railroads
- **Cost**: 40,000 Gold
- **Function**: Heavy industrial center. Automatically surveys neighboring Cities and Ports and lays **dual-track railway lines**.
- **Cargo Trains**: Spawns automated trains that shuttle back and forth along tracks, delivering high-value gold payloads upon docking at destination depots.

### Port & Naval Fleets
- **Cost**: 35,000 Gold *(Must be placed on coastal land adjacent to water)*
- **Function**: Unlocks maritime trade and naval warfare.
- **Trade Ships**: Automatically sail to neutral and allied ports across the globe, providing consistent passive trade income.
- **Warships**: Commissioned combat vessels that patrol a radius around the home port, intercepting enemy trade routes and sinking hostile troop transports before they hit your beaches. Warships earn up to 3 stars of combat veterancy.

### Defense Post (Fortress)
- **Cost**: 15,000 Gold
- **Function**: Heavily fortified border bunker.
- **Tactical Benefit**: Applies a **+100% defensive durability multiplier** to all adjacent border tiles, cutting enemy invasion advance speeds in half and multiplying attacker casualties.

### Missile Silo & Nuclear Arsenals
- **Cost**: 150,000 Gold (Base Silo)
- **Warhead Arsenal**:
  1. **Atom Bomb (750K Gold)**: Tactical nuclear weapon. Vaporizes standing armies, destroys buildings, unclaims territory, and irradiates land.
  2. **Hydrogen Bomb (5M Gold)**: Thermonuclear strategic weapon. Produces a colossal blast shockwave, wiping out regional empires and permanently turning ground to scorched earth.
  3. **MIRV (12M Gold)**: Multiple Independently Targetable Re-entry Vehicle. Launches a ballistic rocket into orbit that separates into a cluster of independently striking atomic warheads.
- **Salvo Planner**: Queue up to 20 coordinates on the map with live blast radii rings, then hit **Launch Salvo** for a synchronized strategic strike.

### SAM Battery & Radar Stations
- **SAM Launcher (60,000 Gold)**: Surface-to-Air Missile battery. Projects an automated defensive radar dome that tracks and intercepts incoming ballistic rockets and nuclear warheads mid-flight.
- **Radar Station (30,000 Gold)**: Expands tactical fog-of-war vision, providing early detection of distant naval flotillas and incoming missile launches.

---

## The Reddit & Competitive Community Playbook

Synthesized from top tactical discussions across **r/FrontWars**, **r/Openfront**, and community Discord strategy guides:

### The 42% Rule (Troop Regeneration Sweet Spot)
In FrontWars and OpenFront mechanics, **troop recruitment is not linear**—it follows a parabolic replenishment curve tied to your non-attacking garrison:
- **Peak Regeneration Rate**: Occurs when your standing, defensive army sits at approximately **~42% of your total troop capacity**.
- If your troops exceed 60%, growth slows down as population reaches saturation.
- If your troops fall too low, you lose the manpower pool necessary to train recruits.

### The 10% Death Zone & The 25% Defense Buffer
- **The 10% Death Zone**: **Never** launch an attack that drops your home defense troops below **10% of capacity**. Dropping into this zone causes your troop regeneration rate to collapse to near zero, leaving your core territory completely defenseless against opportunistic bot and player blitzes.
- **The 25% Rule**: As a competitive golden rule, keep at least **25% to 35% of your troops stationed at home** during any invasion.

### The Train Economy Loop & Factory Grid Layouts
- **Factory Math**: Factories attempt to spawn trains at fixed intervals, but suffer from global diminishing returns if scattered haphazardly.
- **The "Hub & Spoke" Layout**: Place **one central City tightly surrounded by 2 to 4 Factories** (or flanked by a coastal Port). This creates short, rapid-cycle railway routes where trains make round trips in seconds, generating millions in gold within minutes.

### Early-Game Build Order: The 2-Factory / 4-City Benchmark
Top players on Reddit recommend this opening sequence:
1. **0–30 Seconds**: Expand only into neutral territory using 20% attack chunks. Do not provoke human players or Aggressive bots.
2. **First Building**: Build a **Factory first** (not a Port) to start the train generation timer immediately.
3. **Mid-Opening**: Place a City next to the Factory to connect the first rail line.
4. **By 2 Minutes**: Aim for **2 Factories and 4 Cities**. This foundation provides an insurmountable economic advantage going into the mid-game.

### "Pixel Probing" Naval Invasions
- In the early game, launch small **1% troop naval transport boats** to distant, uninhabited islands, corners of Antarctica, or remote shores.
- **Survival Insurance**: Establishing even a single 1-pixel outpost on another continent prevents you from being eliminated if your primary homeland is overrun, allowing you to rebuild and strike back later.

### Teamplay Etiquette: Frontline vs. Backline Rules
When playing team lobbies:
- **Frontline Players**: Expand forward into the enemy; focus military slider on troops.
- **Backline Players**: Expand backward into corners; shift slider to workers to funnel gold donations to frontline teammates.
- **The Water Access Rule**: **Never cut off a teammate from the ocean**. Doing so denies them the ability to build ports, run trade ships, or launch naval expeditions.

### Fast Mode vs. Classic Economy Adaptation
- **Classic Mode**: Methodical pacing, deliberate frontline pushes, and slow economic escalation.
- **Fast Mode**: Hyper-accelerated gold and troop generation. Requires heavy use of quick-build hotkeys (`Q`, `F`, `W`, `E`, `R`, `T`) to keep up with competitive macro users.

---

## Bot Personalities & Strategic AI Archetypes

AI nations feature realistic historical and geopolitical faction names generated dynamically from authentic cultural roots and regime styles (e.g., *Serbian Sultanate, Carthaginian Syndicate, Breton Alliance, Hanoverian Colony, Gupta Empire, Amhara Emirate, Kongo Alliance*).

Each bot is assigned a distinct **Bot Personality** that governs its strategic doctrine:

| Personality | In-Game Style | Strategic Rules & Heuristics |
| :--- | :--- | :--- |
| **`Neutral`** | Homeland Guardian | • **Zero Aggression**: Will never declare an unprovoked war.<br>• **Heavy Reserves**: Keeps 45% of army in reserve at all times.<br>• **Retaliation**: If attacked or invaded, shifts to defensive warfare until borders are restored. |
| **`Aggressive`** | Warmongering Blitz | • **High Attack Frequency**: Attacks twice as often as other bots.<br>• **Low Reserves**: Commits up to 40% of its army per push.<br>• **Predatory Targeting**: Actively identifies and attacks weakened or low-troop neighbors. |
| **`Expansionist`** | Land Grabber | • **Neutral Rush**: Prioritizes grabbing unowned neutral land and islands.<br>• **Infrastructure Boom**: Builds Cities and Ports early to rapidly reach maximum population ceiling. |
| **`Defensive`** | Iron Fortress | • **Border Fortification**: Immediately builds Defense Posts and SAM batteries.<br>• **Overwhelming Ratio**: Only declares attacks when holding a `> 2.5×` numerical troop advantage. |
| **`Opportunist`** | Strategic Hawk | • **War Scanner**: Continuously monitors the map for wars between other nations.<br>• **Backstab Attacks**: Strikes distracted nations that are suffering heavy casualties on opposing fronts. |

---

## The Map Engine & World Forge

### 2D Geopolitical Canvas Renderer
BorderWars features a dedicated Canvas 2D engine optimized for 60+ FPS:
- **Country Color Shading**: Each sovereign country displays a distinct pastel geopolitical tint, completely removing plain monochromatic green.
- **High-Contrast Borders**: Sharp boundaries cleanly demarcate neighboring nations and territories.
- **Elevation Relief**: High-resolution hillshading highlights mountain chains, highlands, and valleys underneath territory colors.
- **Full Horizontal Wrap**: Drag or scroll seamlessly across the International Date Line without visual hitches.
- **Minimap**: Bottom-right live radar showing worldwide territory control and current viewport camera framing.

### Click-to-Locate Navigation
- Clicking any nation on the **Leaderboard** or pressing **Locate** inside the Player Inspection Panel instantly triggers an animated camera flight (`flyTo`), centering and zooming directly over that nation's homeland.

### Natural Earth 50m Real-World Map
- Built from 1:50m Natural Earth Admin 0 country vectors with realistic land boundaries, islands, and geographic features spanning all 7 continents.

### World Forge: Procedural Planet Generator
Design and play custom procedural maps using the in-game World Forge:
- **Layout Topologies**: *Continents*, *Archipelago*, or *Pangaea Supercontinent*.
- **Planetary Biomes**: Earth Standard, Desert Planet, Frozen Ice World, Volcanic Alien.
- **Parameters**: Customizable sea levels, continent scale, mountain roughness, polar ice caps, and country count.
- **Import / Export**: Save maps locally (up to 40 slots) or export `.world.json` recipe files to share with friends.

### Mars Colony World
Take the war to Mars with 28 dust colonies, canyon outposts, and crater basins (including Olympus Mons and Valles Marineris) styled with red atmospheric color grades and colony factions.

---

## Comprehensive Player & Match Customization

Click **Customize** in the main menu to personalize your commander:

- **Commander Identity**: Custom multiplayer player name and clan tag.
- **National Flags**: Over **200+ authentic nation flags**, state banners, and regional emblems.
- **Territory Color Palette**: Curate your faction's map color via curated tactical palettes or a custom HEX color picker.
- **Surface Texture Patterns**: Overlay distinct visual patterns on your territory tiles:
  - *Solid*
  - *Stripes*
  - *Dots*
  - *Checks*
  - *Chevrons*
  - *Crosshatch*
- **Badges & Emblems**: Cosmetic badges displayed alongside your name on the global leaderboard.
- **Match Settings**: Configure custom lobby sizes, player caps, bot counts, AI personality mixes, tick rates, and spawn countdown durations.

---

## Multiplayer Architecture & Networking

- **Authoritative Server Engine**: Prevents client-side hacking of gold, troops, or building speeds.
- **Tick-Synchronized Loop**: 100ms fixed simulation tick rate with client-side movement interpolation.
- **Database Persistence**: Integrated with Postgres for persistent user accounts, ELO ratings, match histories, and global leaderboards.
- **Public & Private Rooms**: Host password-protected matches with custom map seeds and rulesets.

---

## Project Architecture & Directory Layout

```
fwgame/
├── src/
│   ├── app/               # Game loop, input orchestration, sound, match setup
│   │   ├── App.ts         # Central application controller
│   │   └── setup.ts       # Player initialization, bot spawning, and personality setup
│   ├── core/              # Headless simulation engine (runs on client & server)
│   │   ├── ai/            # NationAI, BotAI, FrontWars name generator & personalities
│   │   ├── executions/    # Attack, Boat transport, Nuclear, and Salvo logic
│   │   ├── Game.ts        # Central match controller & rules engine
│   │   ├── Player.ts      # Player entity, troops, workers, personality, gold
│   │   └── types.ts       # Enums, unit types, terrain and building definitions
│   ├── map/               # Map loaders, TopoJSON rasterizer, procedural World Forge
│   │   ├── Map.ts         # High-performance flat array grid
│   │   └── WorldForge.ts  # Procedural noise, elevation & continent generator
│   ├── render/            # High-performance 2D Canvas rendering pipeline
│   │   ├── FlatRenderer.ts   # 2D canvas map, country colors, borders, relief, minimap
│   │   ├── FlatUnitLayer.ts  # Structures, units, trains, rails, missiles & salvo arcs
│   │   ├── Labels.ts         # Territory and commander text labels
│   │   ├── AttackLabels.ts   # Active invasion and combat front indicators
│   │   └── GoldFloats.ts     # Floating gold income indicators
│   └── ui/                # HTML5 HUD, BuildBar, RadialMenu, Panels, Leaderboard
├── public/data/           # Natural Earth 50m boundaries & elevation textures
├── server/                # Node.js WebSocket & HTTP multiplayer server
└── tests/                 # Automated test suite (100+ combat, AI, and rules tests)
```

---

## Credits & Licensing

- **Inspiration**: Mechanics and gameplay design inspired by **[FrontWars.io](https://frontwars.io)** and **[OpenFront.io](https://openfront.io)**.
- **Geographic Data**: [Natural Earth](https://www.naturalearthdata.com/) 1:50m Admin 0 Country Polygons (Public Domain) via [world-atlas](https://github.com/topojson/world-atlas) (ISC License).
- **Icons & Visual Plates**: OpenFront.io icons and SVG plates licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Engine Core**: Built with [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), and the [HTML5 Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D).
- **License**: Released under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html).
