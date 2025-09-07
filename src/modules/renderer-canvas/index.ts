/**
 * RendererCanvas module for 2D rendering using HTMLCanvasElement.
 *
 * This module provides a rendering backend for the engine, mounting a canvas element,
 * managing its sizing and device pixel ratio, and exposing drawing and input surface services.
 *
 * @module modules/renderer-canvas
 *
 * @remarks
 * - The canvas is created and appended to the DOM based on the provided mount point in the game context configuration.
 * - Handles device pixel ratio for crisp rendering on high-DPI displays.
 * - Publishes a DrawServicePort for rendering and an InputSurfacePort for input mapping.
 * - Ensures no direct canvas leakage outside the renderer by encapsulating the surface.
 *
 * @returns {Module} The renderer/canvas module implementing the engine's Module interface.
 *
 * @example
 * ```typescript
 * import RendererCanvas from "modules/renderer-canvas";
 * engine.use(RendererCanvas());
 * ```
 */

import type { Module, GameContext } from "../../engine/core/Types"
import { DRAW_ALL, INPUT_SURFACE } from "../../engine/core/tokens"
import type { DrawServicePort, InputSurfacePort } from "../../engine/core/ports"
import { createDrawService } from "./service"

export default function RendererCanvas(): Module {
  let canvas!: HTMLCanvasElement
  let ctx2d!: CanvasRenderingContext2D
  let draw!: DrawServicePort
  let surface!: InputSurfacePort

  function resizeCanvas(ctx: GameContext, width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    canvas.width  = Math.floor(width  * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`

    // Update logical size exposed via the surface
    if (surface) {
      surface.logicalWidth = width
      surface.logicalHeight = height
    }
  }

  return {
    id: "renderer/canvas",

    async init(ctx: GameContext) {
      // Create and mount canvas
      canvas = document.createElement("canvas")
      if (ctx.config.mount) ctx.config.mount.appendChild(canvas)

      // Initial sizing
      resizeCanvas(ctx, ctx.config.width, ctx.config.height)

      // 2D context
      const c = canvas.getContext("2d")
      if (!c) throw new Error("2D context not available")
      ctx2d = c
      ctx2d.imageSmoothingEnabled = false

      // Draw service
      draw = await createDrawService(canvas, ctx2d)
      ctx.services.set(DRAW_ALL, draw)

      // ---- Publish InputSurface (no canvas leakage outside renderer) ----
      surface = {
        element: canvas,
        logicalWidth: ctx.config.width,
        logicalHeight: ctx.config.height,
        toLogical(clientX: number, clientY: number) {
          const rect = canvas.getBoundingClientRect()
          const px = clientX - rect.left
          const py = clientY - rect.top
          return {
            x: (px / rect.width) * surface.logicalWidth,
            y: (py / rect.height) * surface.logicalHeight,
          }
        },
      }
      ctx.services.set(INPUT_SURFACE, surface)
      // -------------------------------------------------------------------
    },

    onEvent(ctx, e) {
      if (e.type === "render/resize") {
        resizeCanvas(ctx, e.width, e.height)
      }
    },
  }
}
