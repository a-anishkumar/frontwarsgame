/**
 * FlatUnitLayer — Canvas 2D unit, structure, railroad, rocket, and effect renderer.
 * Features high-end animations: multi-stage nuclear shockwaves, rocket smoke trails,
 * ship water wakes, train headlights, and active frontline battle sparks.
 */

import type { Game } from "../core/Game";
import type { Unit } from "../core/Unit";
import { NUKES, STRUCTURES, UnitType, type TileRef } from "../core/types";
import { paintStructureMark, paintOwnerGlyph, shade } from "../ui/icons";
import { fmt, fmtTroops } from "../core/executions/AttackExecution";
import type { FlatRenderer } from "./FlatRenderer";

let trainSpritesReady = true;
const trainSpritesCallbacks: (() => void)[] = [];
export function whenTrainSpritesReady(cb: () => void): void {
  if (trainSpritesReady) cb();
  else trainSpritesCallbacks.push(cb);
}

interface SinkingShipEffect {
  tile: TileRef;
  x: number;
  y: number;
  heading: number;
  type: UnitType;
  ownerColor: string;
  born: number;
  duration: number;
}

interface PingEffect {
  tile: TileRef;
  color: string;
  maxRadius: number;
  born: number;
  duration: number;
}

interface ExplosionEffect {
  tile: TileRef;
  type: UnitType;
  maxRadius: number;
  born: number;
  duration: number;
  particles: { x: number; y: number; vx: number; vy: number; color: string; size: number }[];
}

interface RangeOverlay {
  tile: TileRef;
  range: number;
  color: string;
}

interface GhostInfo {
  type: UnitType;
  tile: TileRef;
  valid: boolean;
  range?: number;
  inner?: number;
  rangeColor?: string;
  innerColor?: string;
  ownerColor?: string;
}

interface MissileTrailPoint {
  x: number;
  y: number;
  time: number;
}

export class FlatUnitLayer {
  private pings: PingEffect[] = [];
  private explosions: ExplosionEffect[] = [];
  private missileTrails = new Map<number, MissileTrailPoint[]>();
  private rangeOverlay: RangeOverlay | null = null;
  private ghost: GhostInfo | null = null;
  private missileTargets: { tile: TileRef; type: UnitType }[] = [];
  private sinkingShips: SinkingShipEffect[] = [];
  private tempProj = { x: 0, y: 0, scale: 1 };

  constructor(
    private globe: FlatRenderer,
    private game: Game,
  ) {
    game.onConstructionComplete = () => {};
    game.onNukeDetonated = (tile, type) => {
      this.spawnExplosion(tile, type);
    };
    game.onSamIntercept = (samTile, missileTile) => {
      this.ping(samTile, "#7ec8ff", 24);
      this.spawnInterceptBurst(missileTile);
    };
    const prevRemoved = game.onUnitRemoved;
    game.onUnitRemoved = (u) => {
      prevRemoved?.(u);
      if ((u.type === UnitType.TransportShip || u.type === UnitType.Warship || u.type === UnitType.TradeShip) && !u.beached) {
        this.triggerShipSinking(u);
      }
    };

    // Link into globe renderer
    this.globe.setUnitLayer(this);
  }

  triggerShipSinking(u: Unit): void {
    const map = this.game.map;
    const fx = u.fx > 0 ? u.fx : map.x(u.tile) + 0.5;
    const fy = u.fy > 0 ? u.fy : map.y(u.tile) + 0.5;
    if (!this.globe.projectXY(fx, fy, this.tempProj)) return;
    this.sinkingShips.push({
      tile: u.tile,
      x: this.tempProj.x,
      y: this.tempProj.y,
      heading: u.heading,
      type: u.type,
      ownerColor: u.owner?.color ?? "#999999",
      born: performance.now(),
      duration: 2200,
    });
  }

  ping(tile: TileRef, color: string, radius = 16): void {
    this.pings.push({
      tile,
      color,
      maxRadius: radius,
      born: performance.now(),
      duration: 750,
    });
  }

  spawnExplosion(tile: TileRef, type: UnitType): void {
    const big = type === UnitType.HydrogenBomb;
    const maxRadius = big ? 85 : 46;
    const duration = big ? 2200 : 1500;
    const particles = [];
    const count = big ? 32 : 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 2.8) * (big ? 1.5 : 1.0);
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.35 ? (big ? "#ff3344" : "#ff9020") : "#ffe850",
        size: (big ? 3.5 : 2.5) + Math.random() * 3,
      });
    }
    this.explosions.push({
      tile,
      type,
      maxRadius,
      born: performance.now(),
      duration,
      particles,
    });
  }

  spawnInterceptBurst(tile: TileRef): void {
    const particles = [];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.2;
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? "#7ec8ff" : "#ffe566",
        size: 2 + Math.random() * 2,
      });
    }
    this.explosions.push({
      tile,
      type: UnitType.Shell,
      maxRadius: 22,
      born: performance.now(),
      duration: 700,
      particles,
    });
  }

  setGhost(
    type: UnitType | null,
    tile: TileRef,
    valid: boolean,
    range?: number,
    inner?: number,
    rangeColor?: number,
    innerColor?: number,
    _hoverPoint?: unknown,
    ownerColor?: string,
  ): void {
    if (type === null || tile < 0) {
      this.ghost = null;
      return;
    }
    const toHex = (c?: number) => (c !== undefined ? `#${c.toString(16).padStart(6, "0")}` : undefined);
    this.ghost = {
      type,
      tile,
      valid,
      range,
      inner,
      rangeColor: toHex(rangeColor),
      innerColor: toHex(innerColor),
      ownerColor,
    };
  }

  setMissileTargets(targets: TileRef[], type: UnitType): void {
    this.missileTargets = targets.map((t) => ({ tile: t, type }));
  }

  setRangeOverlay(tile: TileRef, range: number, color: number): void {
    this.rangeOverlay = {
      tile,
      range,
      color: `#${color.toString(16).padStart(6, "0")}`,
    };
  }

  clearRangeOverlay(): void {
    this.rangeOverlay = null;
  }

  update(): void {
    const now = performance.now();
    this.pings = this.pings.filter((p) => now - p.born < p.duration);
    this.explosions = this.explosions.filter((e) => now - e.born < e.duration);
  }

  async warmAssets(progress: () => Promise<void>): Promise<void> {
    await progress();
  }

  // ─── Rendering on Canvas ───────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    this.renderRailroads(ctx);
    this.renderCombatFronts(ctx);
    this.renderUnits(ctx);
    this.renderRangeOverlays(ctx);
    this.renderMissileTargets(ctx);
    this.renderGhost(ctx);
    this.renderPings(ctx);
    this.renderExplosions(ctx);
  }

  private renderRailroads(ctx: CanvasRenderingContext2D): void {
    const map = this.game.map;
    const railroads = this.game.rail?.railroads;
    if (!railroads || railroads.size === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const rail of railroads) {
      if (rail.tiles.length < 2) continue;
      const first = rail.tiles[0];
      const ownerId = map.owner[first];
      const owner = this.game.player(ownerId);
      const railColor = owner?.color ?? "#d4a017";

      // Background bed
      ctx.lineWidth = Math.max(2, this.globe.zoom * 0.9);
      ctx.strokeStyle = "rgba(20, 20, 20, 0.75)";
      ctx.beginPath();
      let prevTile = -1;
      for (const t of rail.tiles) {
        if (!map.isValid(t)) continue;
        if (this.globe.projectTile(t, this.tempProj)) {
          if (prevTile === -1 || Math.abs(map.x(t) - map.x(prevTile)) > 2) {
            ctx.moveTo(this.tempProj.x, this.tempProj.y);
          } else {
            ctx.lineTo(this.tempProj.x, this.tempProj.y);
          }
        }
        prevTile = t;
      }
      ctx.stroke();

      // Golden / owner rails
      ctx.lineWidth = Math.max(1, this.globe.zoom * 0.45);
      ctx.strokeStyle = railColor;
      ctx.stroke();
    }

    // Ghost rail preview
    const ghosts = this.globe.railPreview ?? [];
    if (ghosts.length > 0) {
      ctx.lineWidth = Math.max(2, this.globe.zoom * 0.6);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (const g of ghosts) {
        if (this.globe.projectTile(g.ref, this.tempProj)) {
          ctx.strokeRect(this.tempProj.x - 2, this.tempProj.y - 2, 4, 4);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /** Render dynamic battle sparks and clashing frontlines where armies engage (culled & batched for 60fps) */
  private renderCombatFronts(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    const human = this.game.human;

    ctx.save();
    let sparkCount = 0;

    // Prioritize human attacks and nearby active fronts (cap at 16 active spark points)
    const players = human ? [human, ...this.game.allPlayers().filter((p) => p !== human && p.alive && p.outgoingAttacks.length > 0)] : this.game.allPlayers();

    for (const p of players) {
      if (!p.alive || p.outgoingAttacks.length === 0) continue;
      for (const a of p.outgoingAttacks) {
        if (!a.isActive() || a.troops() < 10) continue;
        const front = a.frontTiles();
        if (!front || front.size === 0) continue;

        // Sample 1-2 front tiles for visible sparks
        let count = 0;
        for (const t of front) {
          if (count++ > 1) break;
          if (!this.globe.projectTile(t, this.tempProj)) continue;
          const { x, y } = this.tempProj;

          const phase = (now * 0.008 + t * 0.3) % 1;
          if (phase < 0.45) {
            const jx = Math.sin(t * 7 + now * 0.015) * 4;
            const jy = Math.cos(t * 5 + now * 0.015) * 4;
            ctx.fillStyle = phase < 0.2 ? "#ffffff" : (phase < 0.35 ? "#ffe066" : "#ff3b30");
            ctx.beginPath();
            ctx.arc(x + jx, y + jy, 1.2, 0, Math.PI * 2);
            ctx.fill();
            if (++sparkCount >= 16) {
              ctx.restore();
              return;
            }
          }
        }
      }
    }

    ctx.restore();
  }

  private renderUnits(ctx: CanvasRenderingContext2D): void {
    const zoom = this.globe.zoom;
    const map = this.game.map;
    const now = performance.now();

    // Filter units on screen
    for (const u of this.game.units) {
      if (!u.active && !u.targetTile) continue;
      const tile = u.tile >= 0 ? u.tile : u.targetTile;
      if (!map.isValid(tile)) continue;

      // Use exact fractional coordinates for smooth sub-pixel gliding
      const fx = u.fx > 0 ? u.fx : map.x(tile) + 0.5;
      const fy = u.fy > 0 ? u.fy : map.y(tile) + 0.5;
      if (!this.globe.projectXY(fx, fy, this.tempProj)) continue;
      const { x, y } = this.tempProj;
      const ownerColor = u.owner?.color ?? "#cccccc";

      if (STRUCTURES.has(u.type)) {
        // Base size scaled with zoom
        const s = Math.max(16, Math.min(42, 11 * Math.sqrt(zoom)));
        const px = Math.max(1, Math.round(s / 13));
        const markSize = 13 * px;
        ctx.save();
        ctx.translate(x - markSize / 2, y - markSize / 2);
        paintStructureMark(ctx, u.type, ownerColor, 13, px, {
          level: u.level,
          constructing: u.constructing,
        });
        ctx.restore();

        // Construction progress bar
        if (u.constructing && u.readyAt > u.createdAt) {
          const pct = Math.min(1, Math.max(0, (this.game.ticks - u.createdAt) / (u.readyAt - u.createdAt)));
          const bw = s * 1.2;
          const bh = Math.max(3, s * 0.12);
          const bx = x - bw / 2;
          const by = y + s * 0.55;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          ctx.fillStyle = ownerColor;
          ctx.fillRect(bx, by, bw * pct, bh);
        }
      } else if (u.type === UnitType.TransportShip) {
        const bob = Math.sin(now * 0.003 + u.id * 1.5) * 0.8;
        const sy = y + bob;
        // Compact authentic FrontWars proportions
        const s = Math.max(6.5, Math.min(15, 4.2 + 2.8 * Math.sqrt(zoom)));
        this.drawTransportShip(ctx, x, sy, u.heading, s, ownerColor, u, now, zoom);
      } else if (u.type === UnitType.Warship) {
        const bob = Math.sin(now * 0.0025 + u.id * 1.5) * 0.7;
        const sy = y + bob;
        const s = Math.max(7.5, Math.min(17, 5.0 + 3.2 * Math.sqrt(zoom)));
        this.drawWarship(ctx, x, sy, u.heading, s, ownerColor, u, now, zoom);
      } else if (u.type === UnitType.TradeShip) {
        const bob = Math.sin(now * 0.002 + u.id * 1.5) * 0.6;
        const sy = y + bob;
        const s = Math.max(7.0, Math.min(16, 4.6 + 3.0 * Math.sqrt(zoom)));
        this.drawTradeShip(ctx, x, sy, u.heading, s, ownerColor, u, now, zoom);
      } else if (u.type === UnitType.Shell) {
        this.drawShell(ctx, x, y, u);
      } else if (NUKES.has(u.type) || u.type === UnitType.SAMMissile) {
        // Track smoke trail
        let trail = this.missileTrails.get(u.id);
        if (!trail) {
          trail = [];
          this.missileTrails.set(u.id, trail);
        }
        trail.push({ x, y, time: now });
        if (trail.length > 24) trail.shift();

        // Draw smoke trail
        if (trail.length > 1) {
          ctx.save();
          ctx.lineCap = "round";
          for (let i = 1; i < trail.length; i++) {
            const p0 = trail[i - 1];
            const p1 = trail[i];
            const tAlpha = (i / trail.length) * 0.65;
            ctx.strokeStyle = u.type === UnitType.SAMMissile ? `rgba(120, 200, 255, ${tAlpha})` : `rgba(255, 120, 40, ${tAlpha})`;
            ctx.lineWidth = Math.max(1.5, 4 * (i / trail.length));
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Target reticle
        if (u.targetTile && this.globe.projectTile(u.targetTile, this.tempProj)) {
          const tx = this.tempProj.x, ty = this.tempProj.y;
          const pulse = (Math.sin(now * 0.008) + 1) * 0.5;
          ctx.save();
          ctx.strokeStyle = `rgba(255, 60, 40, ${0.4 + 0.4 * pulse})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(tx, ty, 8 + 4 * pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Target line
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "rgba(255, 100, 50, 0.25)";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();
        }

        // Rocket head
        ctx.save();
        ctx.fillStyle = u.type === UnitType.SAMMissile ? "#7ec8ff" : "#ff3b30";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffe566";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fiery exhaust flare
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(x, y, 7 + Math.random() * 3, 0, Math.PI * 2);
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.restore();
      } else if (u.type === UnitType.Train) {
        // Train locomotive
        const ts = Math.max(7, Math.min(16, 5 * Math.sqrt(zoom)));
        ctx.save();
        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(x - ts / 2 + 1, y - ts / 2 + 2, ts, ts);

        // Body
        ctx.fillStyle = ownerColor ?? "#d4a017";
        ctx.fillRect(x - ts / 2, y - ts / 2, ts, ts);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - ts / 2, y - ts / 2, ts, ts);

        // Headlight
        ctx.fillStyle = "#fff8b0";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, ts * 0.22), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Render active sinking ship animations
    this.renderSinkingShips(ctx, now);
  }

  private drawTransportShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heading: number,
    s: number,
    ownerColor: string,
    u: Unit,
    now: number,
    zoom: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);

    const L = s * 1.35;
    const W = s * 0.58;

    ctx.save();
    ctx.rotate(heading);

    // Dynamic water wake lines trailing behind the stern
    const wakePulse = (now * 0.003 + u.id * 0.7) % 1;

    // V-shaped bow cutting ripple
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-W * 0.45, -L * 0.45);
    ctx.lineTo(-W * 0.9, -L * 0.15);
    ctx.moveTo(W * 0.45, -L * 0.45);
    ctx.lineTo(W * 0.9, -L * 0.15);
    ctx.stroke();

    // Twin stern wake trails
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * (1 - wakePulse)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-W * 0.35, L * 0.5);
    ctx.lineTo(-W * (0.6 + 0.5 * wakePulse), L * (1.1 + 0.7 * wakePulse));
    ctx.moveTo(W * 0.35, L * 0.5);
    ctx.lineTo(W * (0.6 + 0.5 * wakePulse), L * (1.1 + 0.7 * wakePulse));
    ctx.stroke();

    // Hull shadow on ocean
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(-W * 0.5 + 1, -L * 0.55 + 2, W, L * 1.05, 2);
    ctx.fill();

    // Landing Craft Profile: Angular bow ramp with steel bulwarks
    ctx.fillStyle = ownerColor;
    ctx.strokeStyle = shade(ownerColor, -0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-W * 0.42, -L * 0.55); // bow ramp port
    ctx.lineTo(W * 0.42, -L * 0.55);  // bow ramp starboard
    ctx.lineTo(W * 0.5, -L * 0.05);   // starboard flare
    ctx.lineTo(W * 0.44, L * 0.55);   // starboard stern
    ctx.lineTo(-W * 0.44, L * 0.55);  // port stern
    ctx.lineTo(-W * 0.5, -L * 0.05);  // port flare
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Open well deck (military naval steel)
    ctx.fillStyle = "#263238";
    ctx.fillRect(-W * 0.3, -L * 0.38, W * 0.6, L * 0.65);

    // Aft wheelhouse console
    ctx.fillStyle = shade(ownerColor, -0.3);
    ctx.fillRect(-W * 0.32, L * 0.3, W * 0.64, L * 0.22);
    ctx.fillStyle = "#81d4fa"; // windshield
    ctx.fillRect(-W * 0.24, L * 0.32, W * 0.48, Math.max(1, L * 0.06));

    // Nav lights (green starboard, red port)
    ctx.fillStyle = "#00e676";
    ctx.fillRect(W * 0.38, -L * 0.45, 1.5, 1.5);
    ctx.fillStyle = "#ff1744";
    ctx.fillRect(-W * 0.48, -L * 0.45, 1.5, 1.5);

    ctx.restore(); // restore heading rotation

    // Tactical Troop Badge (rendered upright above ship, only when zoomed in enough)
    if (u.troops > 0 && zoom >= 0.75) {
      const troopText = fmtTroops(u.troops);
      ctx.font = "bold 8px system-ui, sans-serif";
      const tw = troopText.length * 5.2 + 8;
      const th = 11;
      const badgeY = -L * 0.85;

      ctx.fillStyle = "rgba(10, 16, 28, 0.88)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-tw / 2, badgeY - th / 2, tw, th, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(troopText, 0, badgeY);
    }

    // Retreating warning indicator
    if (u.retreatOrdered) {
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("↩ RETREAT", 0, L * 0.85);
    }

    ctx.restore();
  }

  private drawWarship(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heading: number,
    s: number,
    ownerColor: string,
    u: Unit,
    now: number,
    zoom: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);

    const L = s * 1.55;
    const W = s * 0.52;

    ctx.save();
    ctx.rotate(heading);

    // Cutting Bow Wave
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.65);
    ctx.lineTo(-W * 0.8, -L * 0.2);
    ctx.moveTo(0, -L * 0.65);
    ctx.lineTo(W * 0.8, -L * 0.2);
    ctx.stroke();

    // Stern propeller wake
    const wakeT = (now * 0.0035 + u.id * 0.5) % 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * (1 - wakeT)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-W * 0.35, L * 0.52);
    ctx.lineTo(-W * (0.7 + 0.6 * wakeT), L * (1.0 + 0.8 * wakeT));
    ctx.moveTo(W * 0.35, L * 0.52);
    ctx.lineTo(W * (0.7 + 0.6 * wakeT), L * (1.0 + 0.8 * wakeT));
    ctx.stroke();

    // Hull Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.moveTo(1, -L * 0.65 + 2);
    ctx.lineTo(W * 0.5 + 1, -L * 0.2 + 2);
    ctx.lineTo(W * 0.4 + 1, L * 0.55 + 2);
    ctx.lineTo(-W * 0.4 + 1, L * 0.55 + 2);
    ctx.lineTo(-W * 0.5 + 1, -L * 0.2 + 2);
    ctx.closePath();
    ctx.fill();

    // Armored Destroyer Hull (Battleship Gray with faction stripe)
    ctx.fillStyle = "#37474f";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.65); // sharp clipper bow
    ctx.lineTo(W * 0.5, -L * 0.2);
    ctx.lineTo(W * 0.4, L * 0.55);
    ctx.lineTo(-W * 0.4, L * 0.55);
    ctx.lineTo(-W * 0.5, -L * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Faction Camo Stripe along centerline
    ctx.fillStyle = ownerColor;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.58);
    ctx.lineTo(W * 0.16, -L * 0.15);
    ctx.lineTo(W * 0.14, L * 0.5);
    ctx.lineTo(-W * 0.14, L * 0.5);
    ctx.lineTo(-W * 0.16, -L * 0.15);
    ctx.closePath();
    ctx.fill();

    // Bridge Tower Superstructure
    ctx.fillStyle = "#cfd8dc";
    ctx.strokeStyle = "#37474f";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-W * 0.25, -L * 0.12, W * 0.5, L * 0.26, 2);
    ctx.fill();
    ctx.stroke();

    // Bridge Windows (Blue glass)
    ctx.fillStyle = "#0288d1";
    ctx.fillRect(-W * 0.2, -L * 0.1, W * 0.4, Math.max(1, L * 0.05));

    // Rotating Radar Dish
    const radarAng = now * 0.006;
    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.02);
    ctx.lineTo(Math.cos(radarAng) * W * 0.25, -L * 0.02 + Math.sin(radarAng) * W * 0.25);
    ctx.stroke();

    // Forward Dual Artillery Turret (Rotates towards target if engaging)
    let forwardTurretAngle = 0;
    if (u.targetUnit && u.targetUnit.active) {
      const map = this.game.map;
      const tX = u.targetUnit.fx > 0 ? u.targetUnit.fx : map.x(u.targetUnit.tile) + 0.5;
      const tY = u.targetUnit.fy > 0 ? u.targetUnit.fy : map.y(u.targetUnit.tile) + 0.5;
      const sX = u.fx > 0 ? u.fx : map.x(u.tile) + 0.5;
      const sY = u.fy > 0 ? u.fy : map.y(u.tile) + 0.5;
      const targetHeading = Math.atan2(tX - sX, -(tY - sY));
      forwardTurretAngle = targetHeading - heading;
    }

    ctx.save();
    ctx.translate(0, -L * 0.35);
    ctx.rotate(forwardTurretAngle);
    // Turret mount
    ctx.fillStyle = "#eceff1";
    ctx.strokeStyle = "#263238";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, W * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Gun Barrels
    ctx.fillStyle = "#263238";
    ctx.fillRect(-W * 0.08, -L * 0.22, Math.max(1, W * 0.05), L * 0.22);
    ctx.fillRect(W * 0.03, -L * 0.22, Math.max(1, W * 0.05), L * 0.22);
    ctx.restore();

    ctx.restore(); // restore heading rotation

    // Health Bar and Veterancy Stars
    if (zoom >= 0.75) {
      const maxHp = this.game.config.warshipHealthFor(u.veterancy);
      const hpPct = Math.max(0, Math.min(1, u.health / maxHp));
      const hbw = s * 1.0;
      const hbh = 2.5;
      const hby = -L * 0.65;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(-hbw / 2 - 1, hby - 1, hbw + 2, hbh + 2);
      ctx.fillStyle = hpPct > 0.5 ? "#4caf50" : (hpPct > 0.25 ? "#ff9800" : "#f44336");
      ctx.fillRect(-hbw / 2, hby, hbw * hpPct, hbh);

      // Veterancy Stars
      if (u.veterancy > 0) {
        const stars = "★".repeat(u.veterancy);
        ctx.font = "bold 8px sans-serif";
        ctx.fillStyle = "#ffd700";
        ctx.textAlign = "center";
        ctx.fillText(stars, 0, hby - 3);
      }
    }

    ctx.restore();
  }

  private drawTradeShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heading: number,
    s: number,
    ownerColor: string,
    u: Unit,
    now: number,
    zoom: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);

    const L = s * 1.4;
    const W = s * 0.52;

    ctx.save();
    ctx.rotate(heading);

    // Stern cargo wake
    const wakeT = (now * 0.0025 + u.id * 0.4) % 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * (1 - wakeT)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-W * 0.35, L * 0.5);
    ctx.lineTo(-W * (0.6 + 0.5 * wakeT), L * (1.0 + 0.6 * wakeT));
    ctx.moveTo(W * 0.35, L * 0.5);
    ctx.lineTo(W * (0.6 + 0.5 * wakeT), L * (1.0 + 0.6 * wakeT));
    ctx.stroke();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(-W * 0.45 + 1, -L * 0.55 + 2, W * 0.9, L * 1.05, 3);
    ctx.fill();

    // Commercial Cargo Hull
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = shade(ownerColor, -0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.6); // bulbous bow
    ctx.lineTo(W * 0.44, -L * 0.35);
    ctx.lineTo(W * 0.44, L * 0.45);
    ctx.lineTo(-W * 0.44, L * 0.45);
    ctx.lineTo(-W * 0.44, -L * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Raised Forecastle
    ctx.fillStyle = ownerColor;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.6);
    ctx.lineTo(W * 0.4, -L * 0.35);
    ctx.lineTo(-W * 0.4, -L * 0.35);
    ctx.closePath();
    ctx.fill();

    // Multi-colored Cargo Containers in Hold
    const containerColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
    const cw = W * 0.32;
    const ch = L * 0.16;
    for (let r = 0; r < 2; r++) {
      const cy = -L * 0.25 + r * (ch + 1.5);
      const c1 = containerColors[(u.id + r * 2) % containerColors.length];
      ctx.fillStyle = c1;
      ctx.fillRect(-W * 0.38, cy, cw, ch);
      const c2 = containerColors[(u.id + r * 2 + 1) % containerColors.length];
      ctx.fillStyle = c2;
      ctx.fillRect(W * 0.06, cy, cw, ch);
    }

    // Aft Bridge & Smokestack
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-W * 0.35, L * 0.24, W * 0.7, L * 0.18);
    ctx.fillStyle = "#dc2626"; // smokestack
    ctx.fillRect(-W * 0.1, L * 0.34, W * 0.2, L * 0.08);

    ctx.restore(); // restore heading rotation

    // Cargo Gold Icon Badge
    if (zoom >= 0.75) {
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💰", 0, -L * 0.7);
    }

    ctx.restore();
  }

  private drawShell(ctx: CanvasRenderingContext2D, x: number, y: number, u: Unit): void {
    ctx.save();
    ctx.fillStyle = "#fff59d";
    ctx.shadowColor = "#ff5722";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 138, 101, 0.75)";
    ctx.lineWidth = 2;
    const hx = Math.sin(u.heading) * 10;
    const hy = -Math.cos(u.heading) * 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - hx, y - hy);
    ctx.stroke();
    ctx.restore();
  }

  private renderSinkingShips(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.sinkingShips.length) return;
    for (let i = this.sinkingShips.length - 1; i >= 0; i--) {
      const ship = this.sinkingShips[i];
      const t = (now - ship.born) / ship.duration;
      if (t >= 1) {
        this.sinkingShips.splice(i, 1);
        continue;
      }
      const alpha = 1 - Math.pow(t, 1.5);
      const listAngle = ship.heading + (t * 0.5); // ship lists to side as it sinks
      const sinkDepth = t * 18;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ship.x, ship.y + sinkDepth);
      ctx.rotate(listAngle);

      // Expanding water bubble rings
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + t * 24, 0, Math.PI * 2);
      ctx.stroke();

      // Burning oil smoke
      ctx.fillStyle = `rgba(30, 41, 59, ${0.7 * (1 - t)})`;
      for (let p = 0; p < 4; p++) {
        const px = Math.sin(now * 0.01 + p) * 10;
        const py = -t * 28 - p * 6;
        ctx.beginPath();
        ctx.arc(px, py, 4 + t * 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hull silhouette going under
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(-8, -14, 16, 28, 4);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderRangeOverlays(ctx: CanvasRenderingContext2D): void {
    if (!this.rangeOverlay) return;
    const { tile, range, color } = this.rangeOverlay;
    if (!this.globe.projectTile(tile, this.tempProj)) return;
    const { x, y } = this.tempProj;
    const pixelRadius = range * this.globe.zoom;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.restore();
  }

  private renderMissileTargets(ctx: CanvasRenderingContext2D): void {
    if (this.missileTargets.length === 0) return;
    const zoom = this.globe.zoom;

    ctx.save();
    for (const mt of this.missileTargets) {
      if (!this.globe.projectTile(mt.tile, this.tempProj)) continue;
      const { x, y } = this.tempProj;
      const radius = Math.max(16, 12 * zoom);

      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x - radius - 4, y); ctx.lineTo(x + radius + 4, y);
      ctx.moveTo(x, y - radius - 4); ctx.lineTo(x, y + radius + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderGhost(ctx: CanvasRenderingContext2D): void {
    if (!this.ghost) return;
    const g = this.ghost;
    if (!this.globe.projectTile(g.tile, this.tempProj)) return;
    const { x, y } = this.tempProj;
    const zoom = this.globe.zoom;

    ctx.save();
    // Range circle
    if (g.range && g.range > 0) {
      const radius = g.range * zoom;
      ctx.strokeStyle = g.rangeColor ?? "#7ec8ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = g.rangeColor ?? "#7ec8ff";
      ctx.globalAlpha = 0.1;
      ctx.fill();
    }

    // Ghost icon
    const s = Math.max(20, Math.min(48, 14 * Math.sqrt(zoom)));
    const px = Math.max(1, Math.round(s / 13));
    const markSize = 13 * px;
    ctx.save();
    ctx.translate(x - markSize / 2, y - markSize / 2);
    ctx.globalAlpha = 0.85;
    paintStructureMark(ctx, g.type, g.ownerColor ?? "#5ac8fa", 13, px, {
      ghost: g.valid ? "valid" : "invalid",
    });
    ctx.restore();

    // If invalid, red cross
    if (!g.valid) {
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.4); ctx.lineTo(x + s * 0.4, y + s * 0.4);
      ctx.moveTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x - s * 0.4, y + s * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderPings(ctx: CanvasRenderingContext2D): void {
    if (this.pings.length === 0) return;
    const now = performance.now();
    ctx.save();

    for (const p of this.pings) {
      const elapsed = now - p.born;
      if (elapsed >= p.duration) continue;
      const progress = elapsed / p.duration;
      if (!this.globe.projectTile(p.tile, this.tempProj)) continue;
      const { x, y } = this.tempProj;

      const r = (p.maxRadius * progress + 4) * Math.max(1, this.globe.zoom * 0.5);
      const alpha = (1 - progress) * 0.9;

      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1.5, 3 * (1 - progress));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderExplosions(ctx: CanvasRenderingContext2D): void {
    if (this.explosions.length === 0) return;
    const now = performance.now();
    ctx.save();

    for (const exp of this.explosions) {
      const elapsed = now - exp.born;
      if (elapsed >= exp.duration) continue;
      const progress = elapsed / exp.duration;
      if (!this.globe.projectTile(exp.tile, this.tempProj)) continue;
      const { x, y } = this.tempProj;
      const zoom = this.globe.zoom;
      const rMax = exp.maxRadius * Math.max(0.8, Math.sqrt(zoom));
      const big = exp.type === UnitType.HydrogenBomb;

      // 1. Initial blinding flash (first 18% of life)
      if (progress < 0.18) {
        const flashProg = progress / 0.18;
        const flashAlpha = (1 - flashProg) * 0.95;
        const flashR = rMax * (0.3 + 0.7 * flashProg);
        ctx.fillStyle = big ? "#ffffff" : "#fffde8";
        ctx.globalAlpha = flashAlpha;
        ctx.beginPath();
        ctx.arc(x, y, flashR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Fiery expanding fireball
      if (progress < 0.7) {
        const fireProg = progress / 0.7;
        const fireR = rMax * Math.sin(fireProg * Math.PI * 0.5);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, fireR));
        grad.addColorStop(0, "rgba(255, 255, 240, 0.95)");
        grad.addColorStop(0.3, big ? "rgba(255, 140, 20, 0.85)" : "rgba(255, 200, 30, 0.85)");
        grad.addColorStop(0.7, big ? "rgba(240, 30, 30, 0.65)" : "rgba(230, 60, 20, 0.65)");
        grad.addColorStop(1, "rgba(40, 5, 5, 0)");
        ctx.fillStyle = grad;
        ctx.globalAlpha = 1 - fireProg;
        ctx.beginPath();
        ctx.arc(x, y, fireR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Shockwave blast ring
      const shockR = rMax * (0.15 + 0.85 * Math.pow(progress, 0.65));
      ctx.strokeStyle = big ? "#ff3b50" : "#ffca3a";
      ctx.lineWidth = Math.max(1.5, 4 * (1 - progress));
      ctx.globalAlpha = (1 - progress) * 0.9;
      ctx.beginPath();
      ctx.arc(x, y, shockR, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Second outer distortion ring for Hydrogen bomb
      if (big) {
        const shock2 = rMax * 1.35 * Math.pow(progress, 0.8);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = Math.max(1, 2.5 * (1 - progress));
        ctx.globalAlpha = (1 - progress) * 0.65;
        ctx.beginPath();
        ctx.arc(x, y, shock2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5. Flying shrapnel embers & sparks
      for (const p of exp.particles) {
        p.x += p.vx * 1.2;
        p.y += p.vy * 1.2;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = (1 - progress) * 0.85;
        ctx.beginPath();
        ctx.arc(x + p.x, y + p.y, Math.max(1, p.size * (1 - progress)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
