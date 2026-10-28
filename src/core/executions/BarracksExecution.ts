import type { Execution, Game } from "../Game";
import type { Unit } from "../Unit";
import { MessageType, UnitType } from "../types";

/**
 * Military Barracks Execution.
 * Recruits professional combat divisions directly into the nation's troop pool
 * and provides tactical breakthrough buffs to frontline assaults.
 */
export class BarracksExecution implements Execution {
  private active = true;
  private game!: Game;
  private lastRecruitTick = 0;

  constructor(readonly unit: Unit) {}

  init(game: Game): void {
    this.game = game;
    this.lastRecruitTick = game.ticks;
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

    // Train fresh combat troops every 30 ticks (3s)
    if (game.ticks - this.lastRecruitTick >= 30) {
      this.lastRecruitTick = game.ticks;
      const recruits = cfg.barracksTroopsPerCycle(u.level);
      u.owner.troops += recruits;

      if (u.owner.isHuman() && game.random.chance(10)) {
        game.displayMessage(`Barracks garrison deployed +${recruits} elite recruits`, MessageType.Success, u.owner.smallID);
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
