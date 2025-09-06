import type { Module, GameContext } from "../../engine/core/Types";
import { DRAW_ALL } from "../../engine/core/tokens";
import { DrawServicePort } from "../../engine/core/ports";
import { createDrawService } from "./service";

export default function RendererCanvas(): Module {
  let canvas: HTMLCanvasElement
  let ctx2d: CanvasRenderingContext2D
  let draw!: DrawServicePort

  return {
    id: "renderer/canvas",
    async init(ctx: GameContext) {
      canvas = ctx.config.canvas ?? document.createElement("canvas")
      if (!ctx.config.canvas && ctx.config.mount) ctx.config.mount.appendChild(canvas)

      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.floor(ctx.config.width  * dpr)
      canvas.height = Math.floor(ctx.config.height * dpr)
      canvas.style.width  = `${ctx.config.width}px`
      canvas.style.height = `${ctx.config.height}px`

      const c = canvas.getContext("2d")
      if (!c) throw new Error("2D context not available")
      ctx2d = c
      ctx2d.imageSmoothingEnabled = false
      // Keep base transform = identity; DrawService handles transforms per scope.

      draw = await createDrawService(canvas, ctx2d)
      ctx.services.set(DRAW_ALL, draw)
    },
  }
}