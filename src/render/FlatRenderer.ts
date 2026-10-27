/**
 * FlatRenderer — 2D canvas renderer replacing the Three.js GlobeRenderer.
 *
 * Public API is intentionally identical to GlobeRenderer so App.ts needs
 * minimal changes: method names, parameter types, and return shapes all match.
 *
 * Architecture:
 *   offCanvas   : full-map ImageData (1 px per tile), painted on dirty tiles
 *   canvas      : visible overlay, composites offCanvas scaled + draws minimap
 *
 * Pan/zoom:
 *   screenX = tileX * zoom + panX
 */

import { generatedColor } from "../map/generator";
import { PATTERNS, type Cosmetics } from "../customization/cosmetics";
import type { RailGhostTile } from "../core/RailNetwork";
import type { GameMap } from "../core/GameMap";
import {
  FLAG_BORDER,
  FLAG_DEFENDED,
  FLAG_FRONT_IN,
  FLAG_FRONT_OUT,
  FLAG_PREVIEW,
  GraphicsQuality,
  TerrainType,
  type TileRef,
} from "../core/types";
import { displayTile } from "../map/displayGrid";

// ─── Terrain palettes ─────────────────────────────────────────────────────────

const EARTH_PAL: Record<number, [number, number, number]> = {
  [TerrainType.Water]:      [17,  45, 80],
  [TerrainType.Plains]:     [82, 124, 58],
  [TerrainType.Highland]:   [130, 110, 68],
  [TerrainType.Mountain]:   [185, 176, 160],
  [TerrainType.Impassable]: [215, 228, 232],
};
const MARS_PAL: Record<number, [number, number, number]> = {
  [TerrainType.Water]:      [38,  14, 10],
  [TerrainType.Plains]:     [138, 68, 38],
  [TerrainType.Highland]:   [158, 88, 48],
  [TerrainType.Mountain]:   [198, 148, 98],
  [TerrainType.Impassable]: [218, 198, 178],
};

// Curated FrontWars-style geopolitical territory palette
const COUNTRY_PALETTE: [number, number, number][] = [
  [198, 142, 126], // warm peach / terracotta (like Uighur Canton)
  [145, 168, 128], // soft sage (like Ethiopian territory)
  [158, 142, 178], // muted violet / lavender (like Serbian Sultanate)
  [186, 172, 140], // warm tan / khaki (like Tongan Fief)
  [138, 162, 175], // slate blue (like Apache Protectorate)
  [175, 148, 162], // dusty rose (like Hmong Colony)
  [188, 158, 118], // golden ochre (like Ghanaian Kingdom)
  [132, 172, 158], // soft teal / seafoam
  [168, 172, 138], // olive tan
  [178, 140, 140], // brick rose
  [142, 155, 185], // periwinkle slate
  [192, 168, 132], // pale amber
  [152, 178, 148], // muted mint
  [172, 152, 182], // thistle mauve
  [185, 148, 130], // coral clay
  [138, 168, 172], // steel cyan
  [182, 175, 145], // desert sand
  [162, 145, 168], // twilight lilac
  [148, 172, 135], // field green
  [195, 155, 142], // salmon tan
  [140, 158, 178], // storm blue
  [178, 165, 135], // parchment
  [165, 152, 142], // warm grey
  [158, 175, 165], // celadon
];

function countryColor(cid: number): [number, number, number] {
  if (cid <= 0) return [140, 160, 130];
  const idx = Math.abs(Math.imul(cid, 2654435761 >>> 0)) % COUNTRY_PALETTE.length;
  return COUNTRY_PALETTE[idx];
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Pack [r,g,b] into a Uint32 in the order ImageData stores it (ABGR little-endian) */
function px(r: number, g: number, b: number, a = 255): number {
  return ((a & 255) * 0x1000000) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

/** THREE.Color-compatible duck type — the real THREE.Color has r,g,b in 0..1 */
interface ColorLike { r: number; g: number; b: number }

// ─── Fake THREE.Vector3 so the pick() return type satisfies App.ts ─────────────
class FlatVec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  copy(o: { x: number; y: number; z: number }): this { this.x = o.x; this.y = o.y; this.z = o.z; return this; }
}

export interface PickResult {
  tile: number;
  /** mimics THREE.Vector3 so App.ts can call hoverPoint.copy(pick.point) */
  point: FlatVec3;
}

// ─── FlatRenderer ─────────────────────────────────────────────────────────────

export class FlatRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /** offscreen full-map image (1 px = 1 tile) */
  private offCanvas: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private mapPixels!: Uint32Array;
  private imageData!: ImageData;

  /** per-player colors  [smallID → [r,g,b]] */
  private playerRgb = new Map<number, [number, number, number]>();
  private playerPatterns = new Map<number, { pattern: number; secondary: [number, number, number] }>();

  // front-tile flags (renderer-owned, not game)
  private frontFlags: Uint8Array;
  private ghostRail: Uint8Array;
  railPreview: RailGhostTile[] = [];
  railPreviewVersion = 0;
  private frontList: number[] = [];
  private previewList: number[] = [];
  private ghostList: number[] = [];
  private previousOut: number[] = [];
  private previousIn: number[] = [];

  // view state
  private panX = 0;
  private panY = 0;
  private _zoom = 1.5;
  private minZoom = 0.3;
  private maxZoom = 40;

  // render flags
  private spawnMode = false;
  private localOwner = 0;
  private terrainView = false;
  private hoverOwner = -1;
  private hoverCountry = -1;

  // drag-to-pan (middle/right button)
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panAtDrag = { x: 0, y: 0 };

  // fly animation
  private flyFromPanX = 0;
  private flyFromPanY = 0;
  private flyFromZoom = 1;
  private flyToPanX: number | null = null;
  private flyToPanY: number | null = null;
  private flyToZoom: number | null = null;
  private flyStart = 0;
  private flyDurS = 0.9;

  /** A no-op "fake" renderer object so code that does `globe.renderer.compileAsync(…)` won't crash */
  readonly renderer = {
    compileAsync: () => Promise.resolve(),
    scene: null,
    camera: null,
  } as unknown as { compileAsync: (a?: unknown, b?: unknown) => Promise<void> };

  /** Fake scene/camera stubs so any remaining THREE references don't crash */
  readonly scene = {};
  readonly camera = {};

  readonly map: GameMap;
  private unitLayer?: { render(ctx: CanvasRenderingContext2D): void };

  get zoom(): number { return this._zoom; }

  setUnitLayer(layer: { render(ctx: CanvasRenderingContext2D): void }): void {
    this.unitLayer = layer;
  }

  constructor(
    a: HTMLCanvasElement | GameMap,
    b: GameMap | HTMLElement,
  ) {
    let canvas: HTMLCanvasElement;
    let map: GameMap;
    if (a instanceof HTMLCanvasElement) {
      canvas = a;
      map = b as GameMap;
    } else if ("width" in a && "height" in a) {
      map = a as GameMap;
      if (b instanceof HTMLCanvasElement) {
        canvas = b;
      } else {
        canvas = document.createElement("canvas");
        canvas.id = "flat-map";
        (b as HTMLElement).appendChild(canvas);
      }
    } else {
      canvas = document.getElementById("globe") as HTMLCanvasElement;
      map = b as GameMap;
    }
    this.canvas = canvas;
    this.map = map;
    this.canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;touch-action:none;image-rendering:pixelated;";
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;

    this.offCanvas = document.createElement("canvas");
    this.offCanvas.width = map.width;
    this.offCanvas.height = map.height;
    this.offCtx = this.offCanvas.getContext("2d")!;

    this.frontFlags = new Uint8Array(map.width * map.height);
    this.ghostRail = new Uint8Array(map.width * map.height);

    this.rebuildFullImage();
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.resetView();
    this.attachInput();
  }

  // ─── Full map repaint ────────────────────────────────────────────────────────

  private rebuildFullImage(): void {
    const { width: W, height: H } = this.map;
    this.imageData = new ImageData(W, H);
    this.mapPixels = new Uint32Array(this.imageData.data.buffer);
    for (let t = 0; t < W * H; t++) this.paintTilePixel(t);
    this.flushImageRect(0, 0, W - 1, H - 1);
  }

  /** Paint a single tile into the mapPixels array (does NOT flush to offCanvas) */
  private paintTilePixel(t: TileRef): void {
    const map = this.map;
    const terrain = map.terrain[t];
    const owner = map.owner[t];
    const mflags = map.flags[t];
    const ff = this.frontFlags[t];
    const hasFallout = map.fallout[t] !== 0;

    let [r, g, b] = this.baseColor(terrain, t);

    if (!this.terrainView) {
      if (terrain !== TerrainType.Water) {
        const cid = map.country[t];
        if (owner !== 0) {
          // Conquered player/bot territory
          const pc = this.playerRgb.get(owner) ?? [175, 175, 175];
          let baseR = pc[0], baseG = pc[1], baseB = pc[2];
          const pat = this.playerPatterns.get(owner);
          if (pat && pat.pattern > 0) {
            const tx = t % map.width;
            const ty = Math.floor(t / map.width);
            let ink = false;
            switch (pat.pattern) {
              case 1: // stripes: 45deg diagonals
                ink = ((tx + ty) % 6) < 2;
                break;
              case 2: // dots: grid dots
                ink = (tx % 4 === 0) && (ty % 4 === 0);
                break;
              case 3: // checks: 4x4 checkerboard
                ink = (((tx >> 2) + (ty >> 2)) & 1) === 1;
                break;
              case 4: // chevrons: zigzag pattern
                ink = ((ty + Math.abs((tx % 6) - 3)) % 6) < 2;
                break;
              case 5: // crosshatch: grid lines
                ink = (tx % 5 === 0) || (ty % 5 === 0);
                break;
            }
            if (ink) {
              const sec = pat.secondary;
              baseR = Math.round(lerp(baseR, sec[0], 0.70));
              baseG = Math.round(lerp(baseG, sec[1], 0.70));
              baseB = Math.round(lerp(baseB, sec[2], 0.70));
            }
          }
          r = Math.round(lerp(r, baseR, 0.75));
          g = Math.round(lerp(g, baseG, 0.75));
          b = Math.round(lerp(b, baseB, 0.75));
        } else {
          // Neutral territory: distinct geopolitical nation pastel
          const [cr, cg, cb] = countryColor(cid);
          const elev = map.elevation ? map.elevation[t] / 255 : 0.5;
          const shade = 0.88 + 0.24 * elev;
          r = Math.min(255, Math.max(0, Math.round(cr * shade)));
          g = Math.min(255, Math.max(0, Math.round(cg * shade)));
          b = Math.min(255, Math.max(0, Math.round(cb * shade)));
        }

        // Clean country borders
        if (cid > 0) {
          const tx = t % map.width;
          const eastT = t - tx + ((tx + 1) % map.width);
          const southT = t + map.width < map.width * map.height ? t + map.width : t;
          if (map.country[eastT] !== cid || map.country[southT] !== cid) {
            r = Math.round(r * 0.60);
            g = Math.round(g * 0.60);
            b = Math.round(b * 0.60);
          }
        }
      }

      // Hover highlight (same owner)
      if (owner !== 0 && owner === this.hoverOwner) {
        r = Math.min(255, r + 45);
        g = Math.min(255, g + 45);
        b = Math.min(255, b + 45);
      }
      // Country hover (neutral land)
      if (owner === 0 && this.hoverCountry > 0 && map.country[t] === this.hoverCountry) {
        r = Math.min(255, r + 40);
        g = Math.min(255, g + 40);
        b = Math.min(255, b + 40);
      }

      // Fallout: radioactive yellowish
      if (hasFallout) {
        r = Math.min(255, Math.round(lerp(r, 195, 0.45)));
        g = Math.min(255, Math.round(lerp(g, 175, 0.25)));
        b = Math.round(lerp(b, 0, 0.45));
      }

      // Territory border
      if (mflags & FLAG_BORDER) {
        const s = (mflags & FLAG_DEFENDED) ? 0.92 : 0.55;
        r = Math.round(r * (1 - s));
        g = Math.round(g * (1 - s));
        b = Math.round(b * (1 - s));
      }

      // Attack fronts
      if (ff & FLAG_FRONT_OUT) {
        r = Math.min(255, r + 155); g = Math.min(255, g + 75); b = Math.max(0, b - 30);
      } else if (ff & FLAG_FRONT_IN) {
        r = Math.min(255, r + 155); g = Math.max(0, g - 15); b = Math.max(0, b - 15);
      }

      // Preview (cyan)
      if (ff & FLAG_PREVIEW) {
        r = Math.round(lerp(r, 70, 0.55));
        g = Math.round(lerp(g, 215, 0.55));
        b = Math.round(lerp(b, 215, 0.55));
      }
    }

    this.mapPixels[t] = px(r, g, b);
  }

  private baseColor(terrain: number, t: TileRef): [number, number, number] {
    // Use generated world colors if available
    if (this.map.generated) {
      const elev = this.map.elevation ? this.map.elevation[t] : 128;
      const c = generatedColor(this.map.generated, terrain, elev, 0, false);
      return [c[0], c[1], c[2]];
    }
    const pal = this.map.world === "mars" ? MARS_PAL : EARTH_PAL;
    const base = pal[terrain] ?? [128, 128, 128];
    const elev = this.map.elevation ? this.map.elevation[t] / 255 : 0.5;
    const shade = terrain === TerrainType.Water ? 0.72 + 0.28 * elev : 0.84 + 0.16 * elev;
    return [Math.round(base[0] * shade), Math.round(base[1] * shade), Math.round(base[2] * shade)];
  }

  /** Push imageData region to the offscreen canvas */
  private flushImageRect(x0: number, y0: number, x1: number, y1: number): void {
    const W = this.map.width;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    // putImageData only accepts full-width strips efficiently; use clipping via offsets
    this.offCtx.putImageData(this.imageData, 0, 0, x0, y0, w, h);
    void W; // used implicitly
  }

  // ─── GlobeRenderer API (public, matched exactly) ─────────────────────────────

  setQuality(_q: GraphicsQuality): void { /* no-op in 2D */ }

  /** Accept THREE.Color (r/g/b in 0..1), CSS hex string ("#ff3b30"), or hex number */
  setPlayerColor(smallID: number, color: ColorLike | number | string): void {
    let r: number, g: number, b: number;
    if (typeof color === "string") {
      const hex = color.startsWith("#") ? color.slice(1) : color;
      const num = parseInt(hex, 16);
      r = (num >> 16) & 255; g = (num >> 8) & 255; b = num & 255;
    } else if (typeof color === "number") {
      r = (color >> 16) & 255; g = (color >> 8) & 255; b = color & 255;
    } else {
      r = Math.round(color.r * 255); g = Math.round(color.g * 255); b = Math.round(color.b * 255);
    }
    this.playerRgb.set(smallID, [r, g, b]);
    // repaint tiles of this player
    const map = this.map;
    for (let t = 0, n = map.width * map.height; t < n; t++) {
      if (map.owner[t] === smallID) this.paintTilePixel(t);
    }
    this.flushImageRect(0, 0, map.width - 1, map.height - 1);
  }

  setPlayerPattern(smallID: number, cosmetics: Cosmetics): void {
    if (!cosmetics) return;
    const patIdx = PATTERNS.indexOf(cosmetics.pattern);
    const hex = cosmetics.secondary?.startsWith("#") ? cosmetics.secondary.slice(1) : (cosmetics.secondary || "ffffff");
    const num = parseInt(hex, 16) || 0xffffff;
    const sr = (num >> 16) & 255;
    const sg = (num >> 8) & 255;
    const sb = num & 255;
    this.playerPatterns.set(smallID, { pattern: Math.max(0, patIdx), secondary: [sr, sg, sb] });

    // Repaint all tiles belonging to this player with pattern
    const map = this.map;
    for (let t = 0, n = map.width * map.height; t < n; t++) {
      if (map.owner[t] === smallID) this.paintTilePixel(t);
    }
    this.flushImageRect(0, 0, map.width - 1, map.height - 1);
  }

  setSpawnMode(on: boolean): void { this.spawnMode = on; }
  setLocalOwner(id: number): void { this.localOwner = id; void id; }

  setTerrainView(on: boolean): void {
    if (this.terrainView === on) return;
    this.terrainView = on;
    this.rebuildFullImage();
  }

  private countryTileIndex: number[][] | null = null;
  private game?: any;

  bindGame(game: any): void {
    this.game = game;
  }

  private buildCountryTileIndex(): void {
    const num = this.map.countries.length;
    this.countryTileIndex = Array.from({ length: num }, () => [] as number[]);
    const map = this.map;
    for (let t = 0, n = map.width * map.height; t < n; t++) {
      const c = map.country[t];
      if (c > 0 && c < num) {
        this.countryTileIndex[c].push(t);
      }
    }
  }

  setHover(ownerId: number, countryId: number): void {
    if (this.hoverOwner === ownerId && this.hoverCountry === countryId) return;
    const prevOwner = this.hoverOwner;
    const prevCountry = this.hoverCountry;
    this.hoverOwner = ownerId;
    this.hoverCountry = countryId;

    let minX = this.map.width, maxX = -1, minY = this.map.height, maxY = -1;
    let count = 0;
    const map = this.map;

    const touch = (t: number) => {
      this.paintTilePixel(t);
      const x = map.x(t);
      const y = map.y(t);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count++;
    };

    // Fast selective update using player tile sets
    if (this.game) {
      if (prevOwner > 0) {
        const p = this.game.player(prevOwner);
        if (p?.tiles) for (const t of p.tiles) touch(t);
      }
      if (ownerId > 0) {
        const p = this.game.player(ownerId);
        if (p?.tiles) for (const t of p.tiles) touch(t);
      }
    }

    // Country hover on unowned land
    if (prevCountry > 0 || countryId > 0) {
      if (!this.countryTileIndex) this.buildCountryTileIndex();
      if (prevCountry > 0 && this.countryTileIndex?.[prevCountry]) {
        for (const t of this.countryTileIndex[prevCountry]) {
          if (map.owner[t] === 0) touch(t);
        }
      }
      if (countryId > 0 && this.countryTileIndex?.[countryId]) {
        for (const t of this.countryTileIndex[countryId]) {
          if (map.owner[t] === 0) touch(t);
        }
      }
    }

    if (count > 0 && minX <= maxX && minY <= maxY) {
      this.flushImageRect(minX, minY, maxX, maxY);
    }
  }

  setFrontTiles(outgoing: Iterable<number>, incoming: Iterable<number>): void {
    const visible = (tiles: Iterable<number>) =>
      [...new Set(Array.from(tiles, (t) => displayTile(this.map.width, this.map.height, t)))];
    const nextOut = visible(outgoing);
    const nextInc = visible(incoming);
    if (
      nextOut.length === this.previousOut.length && nextInc.length === this.previousIn.length &&
      nextOut.every((t, i) => t === this.previousOut[i]) && nextInc.every((t, i) => t === this.previousIn[i])
    ) return;
    this.previousOut = nextOut;
    this.previousIn = nextInc;
    const flags = this.frontFlags;
    const keep = new Set([...nextOut, ...nextInc]);

    let minX = this.map.width, maxX = -1, minY = this.map.height, maxY = -1;
    const touch = (t: number) => {
      this.paintTilePixel(t);
      const x = this.map.x(t);
      const y = this.map.y(t);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    for (const t of this.frontList) {
      if (!keep.has(t)) { flags[t] &= ~(FLAG_FRONT_OUT | FLAG_FRONT_IN); touch(t); }
    }
    this.frontList.length = 0;
    for (const t of nextOut) { flags[t] = (flags[t] & ~FLAG_FRONT_IN) | FLAG_FRONT_OUT; touch(t); this.frontList.push(t); }
    for (const t of nextInc) { flags[t] = (flags[t] & ~FLAG_FRONT_OUT) | FLAG_FRONT_IN; touch(t); this.frontList.push(t); }

    if (minX <= maxX && minY <= maxY) {
      this.flushImageRect(minX, minY, maxX, maxY);
    }
  }

  setPreviewTiles(tiles: Iterable<number>): void {
    const flags = this.frontFlags;
    let minX = this.map.width, maxX = -1, minY = this.map.height, maxY = -1;
    const touch = (t: number) => {
      this.paintTilePixel(t);
      const x = this.map.x(t);
      const y = this.map.y(t);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    for (const t of this.previewList) { flags[t] &= ~FLAG_PREVIEW; touch(t); }
    this.previewList.length = 0;
    for (const t of tiles) { flags[t] |= FLAG_PREVIEW; touch(t); this.previewList.push(t); }

    if (minX <= maxX && minY <= maxY) {
      this.flushImageRect(minX, minY, maxX, maxY);
    }
  }

  setRailGhost(tiles: Iterable<RailGhostTile>, overlap: Iterable<number> = []): void {
    const map = this.map;
    const list = [...tiles];
    const overlapping = [...overlap];
    const preview = [...list, ...overlapping.map((ref) => ({ ref, type: map.railType[ref] }))];
    if (preview.length !== this.railPreview.length ||
      preview.some((t, i) => t.ref !== this.railPreview[i].ref || t.type !== this.railPreview[i].type)) {
      this.railPreview = preview;
      this.railPreviewVersion++;
    }
    const flags = this.frontFlags;
    const ghost = this.ghostRail;

    let minX = this.map.width, maxX = -1, minY = this.map.height, maxY = -1;
    const touch = (t: number) => {
      this.paintTilePixel(t);
      const x = map.x(t);
      const y = map.y(t);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    for (const t of this.ghostList) { ghost[t] = 0; flags[t] &= ~FLAG_PREVIEW; touch(t); }
    this.ghostList.length = 0;
    for (const { ref, type } of list) {
      if (map.railType[ref] > 0) flags[ref] |= FLAG_PREVIEW;
      else ghost[ref] = type;
      touch(ref);
      this.ghostList.push(ref);
    }
    for (const t of overlapping) {
      if (map.railType[t] > 0) flags[t] |= FLAG_PREVIEW;
      touch(t);
      this.ghostList.push(t);
    }

    if (minX <= maxX && minY <= maxY) {
      this.flushImageRect(minX, minY, maxX, maxY);
    }
  }

  /** Called by game when a tile sinks (nuke water). Dirty sync handles it. */
  paintSunk(_t: TileRef): void {
    // game marks dirty; syncTerritory/syncTerrain will repaint
  }

  /**
   * syncTerritory — matches GlobeRenderer.syncTerritory() signature.
   * In 2D mode we repaint dirty tile pixels from game state.
   */
  syncTerritory(): void {
    const map = this.map;
    if (!map.dirty) return;
    const y0 = map.dirtyMinY;
    const y1 = map.dirtyMaxY;
    let needFlush = false;
    for (let y = y0; y <= y1; y++) {
      if (!map.dirtyRows[y]) continue;
      const x0 = map.dirtyRowMinX[y];
      const x1 = map.dirtyRowMaxX[y];
      for (let x = x0; x <= x1; x++) { this.paintTilePixel(y * map.width + x); }
      map.dirtyRows[y] = 0;
      needFlush = true;
    }
    if (needFlush) this.flushImageRect(map.dirtyMinX, y0, map.dirtyMaxX, y1);
    map.clearDirty();
    (map.dirtyRowMinX as Int32Array).fill(map.width);
    (map.dirtyRowMaxX as Int32Array).fill(-1);
  }

  /**
   * syncTerrain — matches GlobeRenderer.syncTerrain().
   * For sunk tiles the terrain array changes; we do a full repaint of dirty rows.
   */
  syncTerrain(): void {
    // In 2D mode terrain changes are caught by syncTerritory (same dirty tracking)
    // Only need extra work if terrain truly changed (nuke water-mode)
    this.syncTerritory();
  }

  // ─── Picking / projection ─────────────────────────────────────────────────

  pick(clientX: number, clientY: number): PickResult | null {
    const rect = this.canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const tileX = Math.floor((cx - this.panX) / this._zoom);
    const tileY = Math.floor((cy - this.panY) / this._zoom);
    const W = this.map.width;
    const H = this.map.height;
    if (tileY < 0 || tileY >= H) return null;
    // wrap X for panning past antimeridian
    const tx = ((tileX % W) + W) % W;
    const t = this.map.ref(tx, tileY);
    if (!this.map.isValid(t)) return null;
    // return a point-like with x/y/z so App.ts hoverPoint.copy(pick.point) works
    return { tile: t, point: new FlatVec3(cx, cy, 0) };
  }

  projectTile(tile: number, out: { x: number; y: number; scale: number }): boolean {
    return this.projectXY(this.map.x(tile) + 0.5, this.map.y(tile) + 0.5, out);
  }

  projectXY(fx: number, fy: number, out: { x: number; y: number; scale: number }): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const sx = fx * this._zoom + this.panX;
    const sy = fy * this._zoom + this.panY;
    const W = rect.width || 1;
    const H = rect.height || 1;
    if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) return false;
    out.x = sx;
    out.y = sy;
    out.scale = Math.max(0.45, Math.min(2.8, this._zoom / 5));
    return true;
  }

  cameraDistance(): number {
    // Emulate the globe metric: lower zoom = higher virtual distance
    return Math.max(15, 380 / this._zoom);
  }

  flyTo(tile: number, durationMs = 750): void {
    if (!this.map.isValid(tile)) return;
    const rect = this.canvas.getBoundingClientRect();
    const W = rect.width || window.innerWidth;
    const H = rect.height || window.innerHeight;
    const targetZoom = Math.min(5, Math.max(2.4, this._zoom));
    const tx = (this.map.x(tile) + 0.5) * targetZoom;
    const ty = (this.map.y(tile) + 0.5) * targetZoom;
    this.flyFromPanX = this.panX;
    this.flyFromPanY = this.panY;
    this.flyFromZoom = this._zoom;
    this.flyToPanX = W / 2 - tx;
    this.flyToPanY = H / 2 - ty;
    this.flyToZoom = targetZoom;
    this.flyStart = performance.now();
    this.flyDurS = durationMs / 1000;
  }

  zoomTo(distance: number): void {
    this._zoom = Math.max(this.minZoom, Math.min(this.maxZoom, 380 / distance));
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  render(): void {
    this.animateFly();
    const ctx = this.ctx;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    // Background (deep space / cosmic ocean tone)
    ctx.fillStyle = this.map.world === "mars" ? "#140806" : "#060c16";
    ctx.fillRect(0, 0, cW, cH);

    const mW = this.map.width;
    const mH = this.map.height;
    const drawW = mW * this._zoom;
    const drawH = mH * this._zoom;

    ctx.imageSmoothingEnabled = this._zoom < 2;
    // Main draw (+ seamless horizontal wrap)
    ctx.drawImage(this.offCanvas, this.panX, this.panY, drawW, drawH);
    if (this.panX > 0)              ctx.drawImage(this.offCanvas, this.panX - drawW, this.panY, drawW, drawH);
    else if (this.panX + drawW < cW) ctx.drawImage(this.offCanvas, this.panX + drawW, this.panY, drawW, drawH);

    // Unit layer (units, rails, range circles, ghosts, pings, multi-stage explosions, missiles, ship wakes)
    this.unitLayer?.render(ctx);

    // High-tech cybernetic minimap
    this.drawMinimap(ctx, cW, cH);
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, cW: number, cH: number): void {
    const mm = Math.min(220, Math.max(160, cW * 0.18));
    const mmH = Math.round((mm * this.map.height) / this.map.width);
    const mx = cW - mm - 14;
    const my = cH - mmH - 14;

    ctx.save();

    // 1. High-tech clean glass container backdrop
    ctx.fillStyle = "rgba(10, 16, 28, 0.92)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - 2, my - 2, mm + 4, mmH + 4, 4);
    ctx.fill();
    ctx.stroke();

    // 2. Map contents clipped inside rounded container
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mx, my, mm, mmH, 4);
    ctx.clip();
    ctx.drawImage(this.offCanvas, mx, my, mm, mmH);

    // Dynamic rotating radar sweep beam with gradient trail
    const now = performance.now();
    const radarAngle = (now * 0.0014) % (Math.PI * 2);
    const centerX = mx + mm / 2;
    const centerY = my + mmH / 2;
    const radarLen = Math.hypot(mm / 2, mmH / 2);

    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radarLen);
    grad.addColorStop(0, "rgba(50, 255, 180, 0.3)");
    grad.addColorStop(0.7, "rgba(20, 200, 140, 0.1)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radarLen, radarAngle - 0.45, radarAngle);
    ctx.closePath();
    ctx.fill();

    // Leading scan line
    ctx.strokeStyle = "rgba(120, 255, 200, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(radarAngle) * radarLen, centerY + Math.sin(radarAngle) * radarLen);
    ctx.stroke();

    ctx.restore();

    // 3. Cybernetic frame border
    ctx.strokeStyle = "rgba(100, 180, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, mm, mmH, 4);
    ctx.stroke();

    // 4. Corner tactical accents
    const cSize = 6;
    ctx.strokeStyle = "rgba(100, 220, 255, 0.9)";
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(mx, my + cSize); ctx.lineTo(mx, my); ctx.lineTo(mx + cSize, my);
    // Top-right
    ctx.moveTo(mx + mm - cSize, my); ctx.lineTo(mx + mm, my); ctx.lineTo(mx + mm, my + cSize);
    // Bottom-left
    ctx.moveTo(mx, my + mmH - cSize); ctx.lineTo(mx, my + mmH); ctx.lineTo(mx + cSize, my + mmH);
    // Bottom-right
    ctx.moveTo(mx + mm - cSize, my + mmH); ctx.lineTo(mx + mm, my + mmH); ctx.lineTo(mx + mm, my + mmH - cSize);
    ctx.stroke();

    // 5. Viewport rect with glowing indicator
    const scaleX = mm / this.map.width;
    const scaleY = mmH / this.map.height;
    const vx = mx + (-this.panX / this._zoom) * scaleX;
    const vy = my + (-this.panY / this._zoom) * scaleY;
    const vw = (this.canvas.width / this._zoom) * scaleX;
    const vh = (this.canvas.height / this._zoom) * scaleY;

    // Viewport translucent fill
    ctx.fillStyle = "rgba(255, 225, 90, 0.08)";
    ctx.fillRect(vx, vy, vw, vh);

    // Viewport glowing border
    ctx.strokeStyle = "rgba(255, 230, 95, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);

    // Viewport center pip
    ctx.fillStyle = "rgba(255, 235, 120, 0.9)";
    ctx.fillRect(vx + vw / 2 - 1.5, vy + vh / 2 - 1.5, 3, 3);

    // 6. Live RADAR badge
    ctx.fillStyle = "rgba(10, 20, 35, 0.78)";
    ctx.fillRect(mx + 5, my + 5, 48, 13);
    ctx.fillStyle = "#50e3c2";
    ctx.beginPath();
    ctx.arc(mx + 9, my + 11.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#e0e6ed";
    ctx.fillText("RADAR", mx + 15, my + 14.5);

    ctx.restore();
  }

  private animateFly(): void {
    if (this.flyToPanX === null) return;
    const k = Math.min(1, (performance.now() - this.flyStart) / 1000 / this.flyDurS);
    const ease = 1 - Math.pow(1 - k, 3);
    this.panX = lerp(this.flyFromPanX, this.flyToPanX, ease);
    this.panY = lerp(this.flyFromPanY, this.flyToPanY!, ease);
    this._zoom = lerp(this.flyFromZoom, this.flyToZoom!, ease);
    if (k >= 1) { this.flyToPanX = null; this.flyToPanY = null; this.flyToZoom = null; }
    this.clampPan();
  }

  // ─── View ────────────────────────────────────────────────────────────────

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.minZoom = Math.min(w / this.map.width, h / this.map.height) * 0.45;
    this.clampPan();
  }

  resetView(): void {
    const w = this.canvas.width || window.innerWidth;
    const h = this.canvas.height || window.innerHeight;
    this._zoom = Math.min(w / this.map.width, h / this.map.height);
    this.panX = (w - this.map.width * this._zoom) / 2;
    this.panY = (h - this.map.height * this._zoom) / 2;
    this.clampPan();
    this.rebuildFullImage();
  }

  private clampPan(): void {
    const W = this.canvas.width || window.innerWidth;
    const H = this.canvas.height || window.innerHeight;
    const mW = this.map.width * this._zoom;
    const mH = this.map.height * this._zoom;
    const mx = Math.min(W * 0.45, mW * 0.5);
    const my = Math.min(H * 0.45, mH * 0.5);
    this.panX = Math.max(W - mW - mx, Math.min(mx, this.panX));
    this.panY = Math.max(H - mH - my, Math.min(my, this.panY));
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private attachInput(): void {
    const cv = this.canvas;

    // Middle or right mouse drag = pan
    cv.addEventListener("pointerdown", (e) => {
      if (e.button === 1 || e.button === 2) {
        this.dragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.panAtDrag = { x: this.panX, y: this.panY };
        cv.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    cv.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.panX = this.panAtDrag.x + e.clientX - this.dragStartX;
      this.panY = this.panAtDrag.y + e.clientY - this.dragStartY;
      this.clampPan();
    });
    cv.addEventListener("pointerup", () => { this.dragging = false; });
    cv.addEventListener("pointercancel", () => { this.dragging = false; });

    // Scroll-wheel zoom (Shift+wheel is used by App for attack ratio, captured first)
    cv.addEventListener("wheel", (e) => {
      if (e.shiftKey) return; // let App handle shift+wheel
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.13 : 1 / 1.13;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this._zoom * factor));
      this.panX = cx - (cx - this.panX) * (newZoom / this._zoom);
      this.panY = cy - (cy - this.panY) * (newZoom / this._zoom);
      this._zoom = newZoom;
      this.clampPan();
    }, { passive: false });

    // Touch pinch-to-zoom
    let lastDist = 0, lastMidX = 0, lastMidY = 0;
    cv.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });
    cv.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2 || lastDist === 0) return;
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const factor = dist / lastDist;
      const rect = cv.getBoundingClientRect();
      const cx = midX - rect.left;
      const cy = midY - rect.top;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this._zoom * factor));
      this.panX = cx - (cx - this.panX) * (newZoom / this._zoom) + (midX - lastMidX);
      this.panY = cy - (cy - this.panY) * (newZoom / this._zoom) + (midY - lastMidY);
      this._zoom = newZoom;
      this.clampPan();
      lastDist = dist; lastMidX = midX; lastMidY = midY;
    }, { passive: false });
    cv.addEventListener("touchend", () => { lastDist = 0; });
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.clampPan();
  }

  zoomBy(factor: number): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this._zoom * factor));
    this.panX = cx - (cx - this.panX) * (newZoom / this._zoom);
    this.panY = cy - (cy - this.panY) * (newZoom / this._zoom);
    this._zoom = newZoom;
    this.clampPan();
  }
}

