import type { Execution, Game } from "../Game";
import type { Unit } from "../Unit";
import { MessageType, UnitType, type TileRef } from "../types";
import { stepToward } from "../movement";
import { sound } from "../../sound/SoundFX";

/**
 * Airplane Sortie Execution.
 * Guides a combat strike aircraft from the Airbase to its target,
 * performs an explosive aerial bombing run, and returns to base.
 */
export class AirplaneSortieExecution implements Execution {
  private active = true;
  private game!: Game;
  private phase: "outbound" | "return" = "outbound";
  private payloadDropped = false;

  constructor(
    readonly airbase: Unit,
    readonly plane: Unit,
    readonly target: Unit,
  ) {}

  init(game: Game): void {
    this.game = game;
    this.plane.fx = game.map.x(this.airbase.tile) + 0.5;
    this.plane.fy = game.map.y(this.airbase.tile) + 0.5;
    this.plane.alt = 2.0;
  }

  tick(): void {
    const p = this.plane;
    if (!p.active) {
      this.active = false;
      return;
    }

    const game = this.game;
    const map = game.map;
    const speed = game.config.tiles(1.8);

    if (this.phase === "outbound") {
      const targetTile = this.target.active ? this.target.tile : p.targetTile;
      const arrived = stepToward(p, targetTile, speed, map);

      if (arrived || (this.target.active && map.distSq(p.tile, this.target.tile) <= map.tiles(2) ** 2)) {
        // Execute Bombing Run!
        if (!this.payloadDropped) {
          this.payloadDropped = true;
          sound.playBombDetonate();

          if (this.target.active && !p.owner.isFriendly(this.target.owner)) {
            if (this.target.type === UnitType.TransportShip) {
              const casualties = Math.min(this.target.troops, 200 + game.random.nextInt(50, 250));
              this.target.troops -= casualties;
              if (this.target.troops <= 0) {
                game.displayMessage(`Airstrike sank ${this.target.owner.name}'s transport ship!`, MessageType.Warn, this.target.owner.smallID);
                game.removeUnit(this.target);
              } else if (p.owner.isHuman()) {
                game.displayMessage(`Airstrike bombed enemy landing craft (-${Math.floor(casualties)} troops)`, MessageType.Info, p.owner.smallID);
              }
            } else if (this.target.type === UnitType.Warship) {
              const dmg = game.random.nextInt(15, 30);
              this.target.health -= dmg;
              if (this.target.health <= 0) {
                game.displayMessage(`Airstrike destroyed ${this.target.owner.name}'s Warship!`, MessageType.Warn, this.target.owner.smallID);
                game.removeUnit(this.target);
              }
            } else if (this.target.type === UnitType.DefensePost) {
              this.target.level = Math.max(1, this.target.level - 1);
              if (p.owner.isHuman()) {
                game.displayMessage(`Airstrike breached enemy Defense Post!`, MessageType.Info, p.owner.smallID);
              }
            }
          }
        }
        // Turn back to airbase
        this.phase = "return";
      }
    } else {
      // Return to airbase
      const arrivedHome = stepToward(p, this.airbase.tile, speed, map);
      if (arrivedHome || !this.airbase.active) {
        game.removeUnit(p);
        this.active = false;
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * Airbase Execution.
 * Stations tactical strike fighters, detects incoming naval invasions or enemy ships,
 * and launches precision bombing runs.
 */
export class AirbaseExecution implements Execution {
  private active = true;
  private game!: Game;
  private planeInFlight: Unit | null = null;

  constructor(readonly unit: Unit) {}

  init(game: Game): void {
    this.game = game;
  }

  private findTarget(): Unit | null {
    const game = this.game;
    const cfg = game.config;
    const map = game.map;
    const airbase = this.unit;
    const range = cfg.airbaseRange(airbase.level);
    const rangeSq = range * range;

    let bestTarget: Unit | null = null;
    let bestScore = -Infinity;

    for (const u of game.units) {
      if (!u.active || u === airbase) continue;
      if (u.owner === airbase.owner || airbase.owner.isFriendly(u.owner)) continue;

      // Only target enemy transports, warships, and defense posts
      if (u.type !== UnitType.TransportShip && u.type !== UnitType.Warship && u.type !== UnitType.DefensePost) {
        continue;
      }

      const distSq = map.distSq(airbase.tile, u.tile);
      if (distSq > rangeSq) continue;

      let score = 1000 - Math.sqrt(distSq);
      if (u.type === UnitType.TransportShip) score += 2000;
      if (u.type === UnitType.Warship) score += 1500;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = u;
      }
    }

    return bestTarget;
  }

  tick(): void {
    const base = this.unit;
    if (!base.active) {
      this.active = false;
      return;
    }
    if (base.constructing) return;
    if (!base.owner.alive) {
      this.game.removeUnit(base);
      this.active = false;
      return;
    }

    const game = this.game;
    const cfg = game.config;

    // Check if current plane returned
    if (this.planeInFlight && !this.planeInFlight.active) {
      this.planeInFlight = null;
    }

    if (!this.planeInFlight && base.cooldownUntil <= game.ticks) {
      const target = this.findTarget();
      if (target) {
        base.cooldownUntil = game.ticks + cfg.airbaseCooldown(base.level);
        const plane = game.addUnit(UnitType.Airplane, base.owner, base.tile);
        plane.targetUnit = target;
        plane.targetTile = target.tile;
        this.planeInFlight = plane;

        sound.playAirstrike();
        game.addExecution(new AirplaneSortieExecution(base, plane, target));

        if (base.owner.isHuman()) {
          const what = target.type === UnitType.TransportShip ? "hostile fleet" : target.type === UnitType.Warship ? "enemy warship" : "defense post";
          game.displayMessage(`Airbase scrambled strike fighter to intercept ${what}!`, MessageType.Info, base.owner.smallID);
        }
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
