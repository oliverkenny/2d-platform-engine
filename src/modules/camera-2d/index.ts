import type { Module, GameContext } from "../../engine/core/Types"
import type { Camera2D } from "../../engine/core/primitives"
import { CAMERA_2D, CAMERA_2D_READ, CAMERA_2D_WRITE } from "../../engine/core/tokens"
import { createCamera2DService } from './service'

export interface Camera2DModuleConfig {
  initial?: Partial<Camera2D>
  autoResize?: boolean   // keep ppm stable on DPR/size changes? default: false
}

/**
 * Camera2D module
 * - Creates a shared Camera2DService and registers it under CAMERA_2D.
 * - Optionally wires resize handling.
 */
export default function Camera2D(cfg: Camera2DModuleConfig = {}): Module {
  return {
    id: "camera/2d",
    async init(ctx: GameContext) {
      const {
        position = { x: 0, y: 0 },
        rotation = 0,
        zoom = 1,
        ppm = 50, // 50 px == 1 m
      } = cfg.initial ?? {}

      const svc = createCamera2DService({ position, rotation, zoom, ppm })
      ctx.services.set(CAMERA_2D, svc)
      ctx.services.set(CAMERA_2D_READ, svc) // readonly alias
      ctx.services.set(CAMERA_2D_WRITE, svc) // write-only alias

      if (cfg.autoResize) {
        let lastDpr = window.devicePixelRatio || 1
        const onResize = () => {
          const dpr = window.devicePixelRatio || 1
          if (dpr !== lastDpr) {
            // Usually you do NOT change ppm on DPR changes (backing store scales).
            // If you want CSS-pixel-locked scale, uncomment next line:
            // svc.set({ ppm: svc.get().ppm * (dpr / lastDpr) })
            lastDpr = dpr
          }
        }
        window.addEventListener("resize", onResize)
      }
    },
  }
}
