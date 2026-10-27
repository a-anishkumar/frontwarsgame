/**
 * Minimal renderer interface used by Labels, GoldFloats, AttackLabels, BuildLabels.
 * Both GlobeRenderer and FlatRenderer satisfy this interface.
 */
export interface RendererInterface {
  readonly canvas: HTMLCanvasElement;
  projectTile(tile: number, out: { x: number; y: number; scale: number }): boolean;
  projectXY(fx: number, fy: number, out: { x: number; y: number; scale: number }): boolean;
  cameraDistance(): number;
}
