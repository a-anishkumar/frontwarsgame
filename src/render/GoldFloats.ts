import { fmt, fmtTroops } from "../core/executions/AttackExecution";
import type { TileRef } from "../core/types";
import type { RendererInterface } from "./RendererInterface";

interface Pop {
  el: HTMLElement;
  tile: TileRef;
  born: number;
  life: number;
}

/** Pixel "+15K" that floats up from a train stop. */
export class GoldFloats {
  private pops: Pop[] = [];
  private proj = { x: 0, y: 0, scale: 1 };

  constructor(
    private container: HTMLElement,
    private globe: RendererInterface,
  ) {}

  spawn(tile: TileRef, gold: number, troops = 0): void {
    const el = document.createElement("div");
    el.className = troops > 0 ? "gold-pop claim-pop" : "gold-pop";
    const bits: string[] = [];
    if (gold > 0) bits.push(`+${fmt(gold)}`);
    if (troops > 0) bits.push(`+${fmtTroops(troops)} troops`);
    if (!bits.length) return;
    el.textContent = bits.join("  ");
    this.container.appendChild(el);
    this.pops.push({ el, tile, born: performance.now(), life: troops > 0 ? 2200 : 1400 });
  }

  spawnEmote(tile: TileRef, emoji: string, label: string): void {
    const el = document.createElement("div");
    el.className = "gold-pop emote-pop";
    el.innerHTML = `<span style="font-size:26px;display:block;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.6));">${emoji}</span><span style="font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 4px #000;letter-spacing:0.5px">${label}</span>`;
    this.container.appendChild(el);
    this.pops.push({ el, tile, born: performance.now(), life: 2500 });
  }

  update(now: number): void {
    if (!this.pops.length) return;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      const t = (now - p.born) / p.life;
      if (t >= 1) {
        p.el.remove();
        this.pops.splice(i, 1);
        continue;
      }
      if (!this.globe.projectTile(p.tile, this.proj)) {
        p.el.style.display = "none";
        continue;
      }
      const easeOut = 1 - Math.pow(1 - t, 2.5);
      const rise = 46 * easeOut;
      const scalePop = Math.max(0.9, this.proj.scale) * (1 + 0.28 * Math.sin(Math.min(1, t * 3) * Math.PI));
      p.el.style.display = "";
      p.el.style.opacity = String(Math.max(0, 1 - Math.pow(t, 1.8)));
      p.el.style.transform = `translate(-50%, -100%) translate3d(${this.proj.x.toFixed(1)}px, ${(this.proj.y - 18 - rise).toFixed(1)}px, 0) scale(${scalePop.toFixed(2)})`;
    }
  }
}
