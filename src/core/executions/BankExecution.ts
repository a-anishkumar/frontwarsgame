import type { Execution, Game } from "../Game";
import type { Unit } from "../Unit";
import { MessageType } from "../types";
import { sound } from "../../sound/SoundFX";
import { fmt } from "./AttackExecution";

/**
 * Central Bank Execution.
 * Generates compound treasury interest on national gold reserves
 * and boosts international trade profits.
 */
export class BankExecution implements Execution {
  private active = true;
  private game!: Game;
  private lastInterestTick = 0;

  constructor(readonly unit: Unit) {}

  init(game: Game): void {
    this.game = game;
    this.lastInterestTick = game.ticks;
  }

  tick(): void {
    const u = this.unit;
    if (!u.active) {
      this.active = false;
      return;
    }
    if (u.constructing) return;
    if (!u.owner.alive) {
      this.game.removeUnit(u);
      this.active = false;
      return;
    }

    const game = this.game;
    const cfg = game.config;

    // Compound interest paid every 50 ticks (5s)
    if (game.ticks - this.lastInterestTick >= 50) {
      this.lastInterestTick = game.ticks;
      if (u.owner.gold > 500) {
        const rate = cfg.bankInterestRate(u.level);
        const interest = Math.min(60_000 * u.level, Math.floor(u.owner.gold * rate));
        if (interest > 0) {
          u.owner.addGold(interest);
          if (u.owner.isHuman()) {
            sound.playCash();
            if (game.random.chance(6)) {
              game.displayMessage(`Treasury Interest: +${fmt(interest)} gold deposited`, MessageType.Success, u.owner.smallID);
            }
          }
        }
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
