import type { Execution, Game } from "../Game";
import type { Unit } from "../Unit";
import { MessageType, UnitType } from "../types";
import { ShellExecution } from "./ShellExecution";
import { sound } from "../../sound/SoundFX";

/**
 * Coastal Artillery Battery Execution.
 * Defends coastal borders by scanning for enemy warships, troop landing transports,
 * and hostile trade vessels within range and firing heavy explosive artillery shells.
 */
export class CoastalBatteryExecution implements Execution {
  private active = true;
  private game!: Game;

  constructor(readonly unit: Unit) {}

  init(game: Game): void {
    this.game = game;
  }

  private findTarget(): Unit | null {
    const game = this.game;
    const cfg = game.config;
    const map = game.map;
    const battery = this.unit;
    const range = cfg.coastalBatteryRange(battery.level);
    const rangeSq = range * range;

    let bestTarget: Unit | null = null;
    let bestScore = -Infinity;

    for (const u of game.units) {
      if (!u.active || u === battery) continue;
      // Only naval units in water
      if (u.type !== UnitType.TransportShip && u.type !== UnitType.Warship && u.type !== UnitType.TradeShip) {
        continue;
      }
      // Cannot target own or allied units
      if (u.owner === battery.owner || battery.owner.isFriendly(u.owner)) {
        continue;
      }
      // If trade ship, spare if destination is our port
      if (u.type === UnitType.TradeShip && u.targetUnit && u.targetUnit.owner === battery.owner) {
        continue;
      }

      const distSq = map.distSq(battery.tile, u.tile);
      if (distSq > rangeSq) continue;

      // Priority calculation:
      // Transports (invading landing craft) are highest priority
      // Warships are second priority
      // Trade ships are third priority
      let priority = 1000;
      if (u.type === UnitType.TransportShip) {
        priority = 3000 + Math.min(500, u.troops);
      } else if (u.type === UnitType.Warship) {
        priority = 2000;
      }

      const score = priority - Math.sqrt(distSq);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = u;
      }
    }

    return bestTarget;
  }

  tick(): void {
    const battery = this.unit;
    if (!battery.active) {
      this.active = false;
      return;
    }
    if (battery.constructing) return;
    if (!battery.owner.alive) {
      this.game.removeUnit(battery);
      this.active = false;
      return;
    }

    const game = this.game;
    const cfg = game.config;

    // Ready to fire?
    if (battery.cooldownUntil <= game.ticks) {
      const target = this.findTarget();
      if (target) {
        battery.cooldownUntil = game.ticks + cfg.coastalBatteryCooldown(battery.level);
        battery.targetUnit = target;

        // Spawn artillery shell projectile
        game.addExecution(new ShellExecution(battery.tile, battery.owner, battery, target));

        // Play cannon sound effect
        sound.playCannon();

        if (battery.owner.isHuman() && (target.type === UnitType.TransportShip || target.type === UnitType.Warship)) {
          if (game.random.chance(4)) {
            const what = target.type === UnitType.TransportShip ? "hostile transport" : "enemy warship";
            game.displayMessage(`Coastal Battery engaged ${what} of ${target.owner.name}`, MessageType.Info, battery.owner.smallID);
          }
        }
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
