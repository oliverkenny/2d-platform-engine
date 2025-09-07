/**
 * 2D Camera module for the game engine.
 *
 * Registers a camera service in the game context, providing position, rotation, zoom, and pixels-per-meter (ppm) configuration.
 * Optionally supports automatic adjustment on device pixel ratio (DPR) or window size changes.
 *
 * @module modules/camera-2d
 *
 * @param cfg - Configuration for the camera module.
 * @param cfg.initial - Initial camera state (position, rotation, zoom, ppm).
 * @param cfg.autoResize - If true, listens for window resize events to adjust camera settings for DPR changes. Default is false.
 *
 * @returns A game engine module that initializes and registers the camera service.
 *
 * @remarks
 * - The camera service is registered under three tokens: CAMERA_2D, CAMERA_2D_READ (readonly), and CAMERA_2D_WRITE (write-only).
 * - By default, ppm is not changed on DPR changes. To lock scale to CSS pixels, uncomment the provided line in the resize handler.
 */

import type { Module, GameContext } from "../../engine/core/Types"
import type { Camera2D } from "../../engine/core/primitives"
import { CAMERA_2D, CAMERA_2D_READ, CAMERA_2D_WRITE } from "../../engine/core/tokens"
import { createCamera2DService } from './service'

export interface Camera2DModuleConfig {
  initial?: Partial<Camera2D>
  autoResize?: boolean   // keep ppm stable on DPR/size changes? default: false
}

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
