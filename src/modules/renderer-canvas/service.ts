import type { Colour, Vec2, Camera2D } from "../../engine/core/primitives"
import type { DrawServicePort } from "../../engine/core/ports"
import type { SpriteOptions } from "../../engine/core/Types"
import { toCss, applyWorldTransform, applyUiTransform, worldToScreen, screenToWorld } from "./util"

export class DrawService implements DrawServicePort {
  constructor(private canvas: HTMLCanvasElement, private ctx2d: CanvasRenderingContext2D) {}

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  clear(): void {
    this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  // ---------------------------------------------------------------------------
  // Core drawing (unit-aware inside scopes)
  // ---------------------------------------------------------------------------

  rect(x: number, y: number, w: number, h: number, color?: Colour): void {
    const fill = toCss(color) ?? 'black'
    this.ctx2d.fillStyle = fill
    this.ctx2d.fillRect(x, y, w, h)
  }

  text(msg: string, x: number, y: number, color?: Colour): void {
    this.ctx2d.font = '14px system-ui, sans-serif'
    const fill = toCss(color) ?? 'black'
    this.ctx2d.fillStyle = fill
    this.ctx2d.fillText(msg, x, y)
  }

  circle(x: number, y: number, r: number, fill?: Colour, stroke?: Colour, lineWidth: number = 1): void {
    if (!Number.isFinite(r) || r <= 0) return;

    this.ctx2d.save();
    this.ctx2d.beginPath();
    this.ctx2d.arc(x, y, r, 0, Math.PI * 2);
  
    if (fill != null) {
      const css = toCss(fill);
      if (css) this.ctx2d.fillStyle = css;
      this.ctx2d.fill();
    }
    if (stroke != null) {
      const css = toCss(stroke);
      if (css) this.ctx2d.strokeStyle = css;
      if (lineWidth !== this.ctx2d.lineWidth) this.ctx2d.lineWidth = lineWidth;
      this.ctx2d.stroke();
    }
  
    this.ctx2d.restore();
  }

  /**
   * Draw an image (or a region of it) at (x,y) with optional transform.
   *
   * - If `sx/sy/sw/sh` are provided, uses them as a source rect (spritesheet).
   * - `ox/oy` are the origin/pivot in destination units (px in UI, meters in World).
   * - `scaleX/scaleY` scale the destination (default 1).
   * - `rotation` is in radians, around the translated origin.
   * - `alpha` multiplies global alpha for this draw only.
   */
  sprite(img: HTMLImageElement, x: number, y: number, o: SpriteOptions = {}): void {
    const {
      sx, sy, sw, sh,
      ox = 0, oy = 0,
      scaleX = 1, scaleY = 1,
      rotation = 0,
      alpha = 1,
    } = o

    this.ctx2d.save()
    this.ctx2d.translate(x, y)
    if (rotation) this.ctx2d.rotate(rotation)
    if (scaleX !== 1 || scaleY !== 1) this.ctx2d.scale(scaleX, scaleY)
    if (alpha !== 1) this.ctx2d.globalAlpha *= alpha

    if (sx != null && sy != null && sw != null && sh != null) {
      // Source-rect draw (spritesheet frame)
      this.ctx2d.drawImage(img, sx, sy, sw, sh, -ox, -oy, sw, sh)
    } else {
      // Whole image draw
      this.ctx2d.drawImage(img, -ox, -oy)
    }

    this.ctx2d.restore()
  }

  // ---------------------------------------------------------------------------
  // Space / Layer scopes
  // ---------------------------------------------------------------------------

  /**
   * Scoped draw into **World Space** (Rapier meters, y-up) using the given camera.
   * Applies camera transform, runs `drawFn`, then restores previous state.
   */
  toWorld(cam: Camera2D, drawFn: () => void): void
  /**
   * Convert a **screen-space** point (pixels, y-down) to **world-space** (meters, y-up).
   */
  toWorld(screenPoint: Vec2, cam: Camera2D): Vec2
  toWorld(a: Camera2D | Vec2, b?: (() => void) | Camera2D): void | Vec2 {
    // Overload resolution by arg types
    if (typeof a === 'object' && 'position' in a) {
      // Signature: toWorld(cam, fn)
      const cam = a as Camera2D
      const fn = b as () => void
      this.ctx2d.save()
      applyWorldTransform(this.ctx2d, this.canvas, cam)
      try { fn() } finally { this.ctx2d.restore() }
      return
    } else {
      // Signature: toWorld(screenPoint, cam)
      const screenPoint = a as Vec2
      const cam = b as Camera2D
      return screenToWorld(screenPoint, this.canvas, cam)
    }
  }

  /**
   * Scoped draw into **UI / Screen Space** (pixels, y-down).
   * Resets to identity, runs `drawFn`, then restores previous state.
   */
  toUi(drawFn: () => void): void {
    this.ctx2d.save()
    applyUiTransform(this.ctx2d)
    try { drawFn() } finally { this.ctx2d.restore() }
  }

  // ---------------------------------------------------------------------------
  // Point conversion helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a **world-space** point (meters, y-up) to **screen-space** (pixels, y-down).
   */
  toScreen(worldPoint: Vec2, cam: Camera2D): Vec2 {
    return worldToScreen(worldPoint, this.canvas, cam)
  }
}

export async function createDrawService(
  canvas: HTMLCanvasElement,
  ctx2d: CanvasRenderingContext2D
): Promise<DrawServicePort> {
  return new DrawService(canvas, ctx2d)
}
