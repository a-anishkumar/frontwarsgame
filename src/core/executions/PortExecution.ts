import type { Execution, Game } from "../Game";
import type { GameMap } from "../GameMap";
import type { Unit } from "../Unit";
import { moveAlongPath } from "../movement";
import { MessageType, UnitType, type TileRef } from "../types";
import { fmt } from "./AttackExecution";

/**
 * Returns the nearest passable water tile adjacent to a port's coastal tile.
 * This guarantees boats spawn and navigate cleanly on open water without clipping coastlines.
 */
export function portWaterTile(map: GameMap, portTile: TileRef): TileRef {
  if (portTile < 0) return portTile;
  if (map.isWater(portTile)) return portTile;
  const buf: TileRef[] = [0, 0, 0, 0];
  const n = map.neighbors4(portTile, buf);
  for (let i = 0; i < n; i++) {
    if (map.isWater(buf[i])) return buf[i];
  }
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const t = map.refWrapped(map.x(portTile) + dx, map.y(portTile) + dy);
      if (t >= 0 && map.isWater(t)) return t;
    }
  }
  return portTile;
}

/** Each dock periodically sends a trade ship to another reachable dock; gold on arrival for both sides. */
export class PortExecution implements Execution {
  private active = true;
  private game!: Game;
  private nextSpawn = 0;

  constructor(readonly port: Unit) {}

  init(game: Game): void {
    this.game = game;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const base = this.game.config.tradeShipSpawnRate() / Math.max(1, this.port.level);
    this.nextSpawn = this.game.ticks + Math.floor(base * (0.7 + this.game.random.next() * 0.6));
  }

  tick(): void {
    const port = this.port;
    if (!port.active) {
      this.active = false;
      return;
    }
    const game = this.game;
    if (game.ticks < this.nextSpawn) return;
    this.scheduleNext();
    if (port.constructing) return;

    const owner = port.owner;
    const destinations: Unit[] = [];

    // Prioritize other active ports across the world
    for (const u of game.units) {
      if (u.type !== UnitType.Port || !u.active || u.constructing || u === port) continue;
      if (u.owner === owner) {
        // Player's other ports are valid domestic trade routes
        destinations.push(u);
      } else {
        if (u.owner.embargoes.has(owner.smallID) || owner.embargoes.has(u.owner.smallID)) continue;
        if (!u.owner.alive) continue;
        destinations.push(u);
      }
    }

    // If no other ports exist yet, trade with coastal foreign cities
    if (destinations.length === 0) {
      for (const u of game.units) {
        if (u.type === UnitType.City && u.active && !u.constructing && game.map.isShore(u.tile)) {
          if (u.owner !== owner && (u.owner.embargoes.has(owner.smallID) || owner.embargoes.has(u.owner.smallID))) continue;
          if (u.owner.alive) destinations.push(u);
        }
      }
    }

    if (destinations.length === 0) return;

    // Pick from closest destinations
    destinations.sort((a, b) => game.map.distSq(a.tile, port.tile) - game.map.distSq(b.tile, port.tile));
    const dest = destinations[game.random.nextInt(0, Math.min(destinations.length - 1, 3))];

    const srcWater = portWaterTile(game.map, port.tile);
    const destWater = portWaterTile(game.map, dest.tile);
    const path = game.waterPathfinder.findPath(srcWater, destWater, 40000);
    if (!path || path.length < 2) return;

    const ship = game.addUnit(UnitType.TradeShip, owner, srcWater);
    ship.path = path;
    ship.pathIndex = 1;
    ship.targetUnit = dest;
    ship.originTile = port.tile;
    ship.health = 1;
    game.addExecution(new TradeShipExecution(ship, port));
  }

  isActive(): boolean {
    return this.active;
  }
}

export class TradeShipExecution implements Execution {
  private active = true;
  private game!: Game;
  private returning = false;

  constructor(
    readonly ship: Unit,
    readonly homePort?: Unit,
  ) {}

  init(game: Game): void {
    this.game = game;
  }

  tick(): void {
    const s = this.ship;
    if (!s.active) {
      this.active = false;
      return;
    }
    const dest = s.targetUnit;
    if (!dest || !dest.active) {
      this.game.removeUnit(s);
      this.active = false;
      return;
    }
    const arrived = moveAlongPath(s, this.game.config.tradeShipSpeed(), this.game.map);
    if (!arrived) return;

    const dist = this.game.map.dist(s.originTile, dest.tile);
    const gold = this.game.config.tradeShipGold(dist, dest.level);
    const srcOwner = s.owner;
    const dstOwner = dest.owner;
    srcOwner.addGold(gold);
    if (dstOwner !== srcOwner) dstOwner.addGold(gold);

    if (srcOwner.isHuman()) {
      this.game.displayMessage(`Trade ship arrived at ${dstOwner.name}: +${fmt(gold)} gold`, MessageType.Success, srcOwner.smallID);
    } else if (dstOwner.isHuman()) {
      this.game.displayMessage(`Trade ship from ${srcOwner.name} arrived: +${fmt(gold)} gold`, MessageType.Success, dstOwner.smallID);
    }
    if (srcOwner !== dstOwner) {
      srcOwner.updateRelation(dstOwner, 3);
      dstOwner.updateRelation(srcOwner, 3);
    }

    // Outbound trade ship loads cargo and makes a return voyage to home port
    if (!this.returning && this.homePort && this.homePort.active && this.homePort.owner === srcOwner) {
      this.returning = true;
      s.originTile = dest.tile;
      s.targetUnit = this.homePort;
      const homeWater = portWaterTile(this.game.map, this.homePort.tile);
      const retPath = this.game.waterPathfinder.findPath(s.tile, homeWater, 35000);
      if (retPath && retPath.length >= 2) {
        s.path = retPath;
        s.pathIndex = 1;
        return;
      }
    }

    this.game.removeUnit(s);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}
