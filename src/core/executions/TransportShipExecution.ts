import type { Execution, Game } from "../Game";
import type { GameMap } from "../GameMap";
import type { Player } from "../Player";
import type { Unit } from "../Unit";
import { moveAlongPath } from "../movement";
import { MessageType, UnitType, type TileRef } from "../types";
import { AttackExecution, fmt, fmtTroops } from "./AttackExecution";
import { portWaterTile } from "./PortExecution";

const nearBuf: TileRef[] = [0, 0, 0, 0];

function adjacentTo(map: GameMap, a: TileRef, b: TileRef): boolean {
  if (a < 0 || b < 0) return false;
  const n = map.neighbors4(a, nearBuf);
  for (let i = 0; i < n; i++) if (nearBuf[i] === b) return true;
  return false;
}

/** A boat carrying troops across water; on landing it starts a regular attack from the landing tile. */
export class TransportShipExecution implements Execution {
  private active = true;
  private game!: Game;
  private unit: Unit | null = null;
  private returning = false;

  constructor(
    readonly owner: Player,
    readonly src: TileRef,
    readonly dst: TileRef,
    private troops: number,
    private path: TileRef[],
  ) {}

  init(game: Game): void {
    this.game = game;
    if (!this.owner.alive || game.map.owner[this.src] !== this.owner.smallID ||
      this.owner.unitCount(UnitType.TransportShip) >= game.config.boatMaxNumber()) {
      this.active = false;
      return;
    }
    this.troops = Math.floor(Math.min(this.troops, this.owner.troops));
    if (this.troops < 1 || this.path.length < 2) {
      this.active = false;
      return;
    }
    this.owner.removeTroops(this.troops);
    const u = game.addUnit(UnitType.TransportShip, this.owner, this.src);
    u.troops = this.troops;
    u.path = this.path;
    u.pathIndex = 1;
    u.originTile = this.src;
    u.targetTile = this.dst;
    u.health = 1;
    this.unit = u;
    if (this.owner.isHuman()) game.displayMessage(`Boat launched with ${fmtTroops(this.troops)} troops`, MessageType.Info, this.owner.smallID);
  }

  /** turn the boat around (troops return where they embarked) */
  retreat(): void {
    if (!this.unit || this.returning) return;
    this.returning = true;
    const u = this.unit;
    const done = u.path.slice(0, u.pathIndex).reverse();
    u.path = done.length ? done : [this.src];
    u.pathIndex = 0;
  }

  unitRef(): Unit | null {
    return this.unit;
  }

  private interactNaval(): boolean {
    const u = this.unit;
    if (!u || !u.active || u.troops <= 0) return false;
    const game = this.game;
    const map = game.map;
    const rSq = map.tiles(5) ** 2;

    for (const o of game.units) {
      if (!o.active || o === u) continue;
      // Never capture or battle own units or alliance nation units
      if (o.owner === this.owner || this.owner.isFriendly(o.owner)) continue;

      const d2 = map.distSq(u.tile, o.tile);
      if (d2 > rSq) continue;

      // 1. Capture enemy Trade Ship (except alliance nation boat)
      if (o.type === UnitType.TradeShip) {
        this.captureEnemyTradeShip(o);
        continue;
      }

      // 2. Battle enemy Transport Ship (troop ship vs troop ship skirmish)
      if (o.type === UnitType.TransportShip) {
        const dmgToEnemy = Math.max(1, Math.floor(u.troops * 0.1 + 25));
        const dmgToSelf = Math.max(1, Math.floor(o.troops * 0.1 + 25));
        o.troops = Math.max(0, o.troops - dmgToEnemy);
        u.troops = Math.max(0, u.troops - dmgToSelf);

        if (o.troops <= 0) {
          game.removeUnit(o);
          if (this.owner.isHuman()) {
            game.displayMessage("Naval skirmish victory! Enemy troop ship sunk.", MessageType.Info, this.owner.smallID);
          }
          if (o.owner.isHuman()) {
            game.displayMessage(`Your troop ship was intercepted and sunk by ${this.owner.name}!`, MessageType.Warn, o.owner.smallID);
          }
        }
        if (u.troops <= 0) {
          game.removeUnit(u);
          this.active = false;
          if (this.owner.isHuman()) {
            game.displayMessage("Your troop ship was defeated and sunk in naval combat!", MessageType.Warn, this.owner.smallID);
          }
          return true;
        }
        continue;
      }

      // 3. Battle enemy Warship (troop ship troops engage warship)
      if (o.type === UnitType.Warship) {
        const casualties = Math.max(1, Math.floor(u.troops * 0.08 + 35));
        u.troops = Math.max(0, u.troops - casualties);
        if (game.ticks % 3 === 0) {
          o.health = Math.max(0, o.health - 1);
        }
        if (o.health <= 0) {
          game.removeUnit(o);
          if (this.owner.isHuman()) {
            game.displayMessage("Your army boat boarded and sank an enemy warship!", MessageType.Info, this.owner.smallID);
          }
          if (o.owner.isHuman()) {
            game.displayMessage(`Warship sunk in battle against ${this.owner.name}'s army boat!`, MessageType.Warn, o.owner.smallID);
          }
        }
        if (u.troops <= 0) {
          game.removeUnit(u);
          this.active = false;
          if (this.owner.isHuman()) {
            game.displayMessage("Your troop ship was destroyed by an enemy warship!", MessageType.Warn, this.owner.smallID);
          }
          return true;
        }
      }
    }
    return false;
  }

  private captureEnemyTradeShip(t: Unit): void {
    const game = this.game;
    const captor = this.owner;
    const prevOwner = t.owner;
    const plunder = 15000 + Math.floor(game.random.next() * 10000);
    captor.addGold(plunder);

    game.displayMessage(`Your trade ship was captured by ${captor.name}`, MessageType.Warn, prevOwner.smallID);
    if (captor.isHuman()) {
      game.displayMessage(`Army boat captured enemy trade ship of ${prevOwner.name} (+${fmt(plunder)} gold)`, MessageType.Info, captor.smallID);
    }
    prevOwner.updateRelation(captor, -20);
    game.transferUnit(t, captor);

    const port = game.nearestPort(captor, t.tile);
    if (port) {
      t.targetUnit = port;
      const dstWater = portWaterTile(game.map, port.tile);
      const path = game.waterPathfinder.findPath(t.tile, dstWater, 25000);
      if (path) {
        t.path = path;
        t.pathIndex = 1;
      }
    }
    if (this.unit) this.unit.recordTradeCapture();
  }

  tick(): void {
    const u = this.unit;
    if (!u || !u.active) {
      this.active = false;
      return;
    }
    if (!this.owner.alive) {
      this.game.removeUnit(u);
      this.active = false;
      return;
    }
    if (u.retreatOrdered && !this.returning) this.retreat();

    // Naval interactions: combat vs enemy warships & troop transports; capturing enemy trade ships
    if (this.game.ticks % 2 === 0) {
      if (this.interactNaval()) return;
    }

    const map = this.game.map;
    const arrived = moveAlongPath(u, this.game.config.boatSpeed(), map);
    // Land as soon as the hull is on water next to the beach — don't wait for
    // the path's last land waypoint, which used to park a 1px boat on the coast.
    const atBeach = arrived || (!this.returning && map.isWater(u.tile) && adjacentTo(map, u.tile, this.dst));
    if (!atBeach) return;

    const dst = this.dst;
    const targetOwner = map.isLand(dst) ? this.game.ownerAt(dst) : null;
    const friendly = targetOwner === this.owner || (targetOwner !== null && this.owner.isFriendly(targetOwner));
    if (this.returning || friendly) {
      const keep = Math.floor(u.troops * (1 - this.game.config.retreatMalusPercent() / 100));
      const deaths = u.troops - keep;
      if (deaths > 0 && this.owner.isHuman()) {
        this.game.displayMessage(
          this.returning ? `Boat retreat: lost ${fmtTroops(deaths)} troops` : `Friendly landing: lost ${fmtTroops(deaths)} troops`,
          MessageType.Warn,
          this.owner.smallID,
        );
      }
      this.owner.addTroops(keep);
      u.beached = true;
      this.game.removeUnit(u);
      this.active = false;
      return;
    }
    if (!map.isLand(dst)) {
      this.owner.addTroops(u.troops);
    } else {
      const troops = u.troops;
      this.game.conquer(this.owner, dst);
      this.game.addExecution(new AttackExecution(troops, this.owner, targetOwner, dst, false, true));
      if (this.owner.isHuman()) {
        this.game.displayMessage(
          `Troops landed (${fmtTroops(troops)})`,
          MessageType.Info,
          this.owner.smallID,
        );
      }
    }
    u.beached = true;
    this.game.removeUnit(u);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}
