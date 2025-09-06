import type { Colour } from "../../engine/core/primitives"
import type { DrawServicePort } from "../../engine/core/ports"
import type { SpriteOptions } from "../../engine/core/Types"
import { toCss } from "./util"

export class DrawService implements DrawServicePort {
    constructor(private canvas: HTMLCanvasElement, private ctx2d: CanvasRenderingContext2D) {}

    clear() {
      this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    rect(x: number, y: number, w: number, h: number, color?: Colour) {
      const fill = toCss(color) ?? 'black'
      this.ctx2d.fillStyle = fill
      this.ctx2d.fillRect(x, y, w, h)
    }

    text(msg: string, x: number, y: number, color?: Colour) {
      this.ctx2d.font = '14px system-ui, sans-serif'
      const fill = toCss(color) ?? 'black'
      this.ctx2d.fillStyle = fill
      this.ctx2d.fillText(msg, x, y)
    }

    /**
     * Draw an image (or a region of it) at (x,y) with optional transform.
     *
     * - If `sx/sy/sw/sh` are provided, uses them as a source rect (spritesheet).
     * - `ox/oy` are the origin/pivot in **destination pixels** (default 0,0).
     * - `scaleX/scaleY` scale the destination (default 1).
     * - `rotation` is in radians, around the translated origin.
     * - `alpha` multiplies global alpha for this draw only.
     */
    sprite(img: HTMLImageElement, x: number, y: number, o: SpriteOptions = {}) {
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

      if (
        sx != null && sy != null &&
        sw != null && sh != null
      ) {
        // Source-rect draw (spritesheet frame)
        this.ctx2d.drawImage(img, sx, sy, sw, sh, -ox, -oy, sw, sh)
      } else {
        // Whole image draw
        this.ctx2d.drawImage(img, -ox, -oy)
      }

      this.ctx2d.restore()
    }
  }

export async function createDrawService(canvas: HTMLCanvasElement, ctx2d: CanvasRenderingContext2D): Promise<DrawServicePort> {
  return new DrawService(canvas, ctx2d)
}