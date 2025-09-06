import { Colour } from '../primitives/colour'

/**
 * Example drawing API a renderer module can register for others to consume.
 * @remarks
 * A concrete renderer (Canvas2D/WebGL) should set this on the registry:
 * `ctx.services.set('draw', drawService)`.
 */
export interface DrawServicePort {
  /**
   * Clear the render target for a new frame.
   */
  clear(): void

  /**
   * Fill a rectangle at `(x,y)` of size `(w,h)` in the current style.
   */
  rect(x: number, y: number, w: number, h: number, color?: Colour): void

  /**
   * Draw text at `(x,y)` using the renderer's current font settings.
   */
  text(msg: string, x: number, y: number, color?: Colour): void

  /**
   * Draw a sprite image.
   * @param img Image to draw
   * @param x X position
   * @param y Y position
   * @param opts Sprite options
   */
  sprite(img: HTMLImageElement, x: number, y: number, opts?: SpriteOptions): void
}

/**
 * Options for drawing sprites/images.
 * @remarks
 * Used by the {@link DrawServicePort.sprite} method.
 */
export interface SpriteOptions {
  /** Optional source rect (sprite sheet) */
  sx?: number; sy?: number; sw?: number; sh?: number
  /** Origin/pivot (pixels), default (0,0) */
  ox?: number; oy?: number
  /** Scale factors, default 1 */
  scaleX?: number; scaleY?: number
  /** Rotation in radians, default 0 */
  rotation?: number
  /** Alpha transparency, 0..1, default 1 */
  alpha?: number
}