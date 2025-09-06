import { Vec2 } from "../../engine/core/primitives";

export interface Camera2D {
  /** Camera center in Rapier world meters (y-up) */
  position: Vec2;
  /** Radians, CCW */
  rotation: number;
  /** Zoom multiplier (1 = base ppm) */
  zoom: number;
  /** Pixels per meter at zoom=1 */
  ppm: number;
}