import { DRAW_ALL, DrawServicePort } from '../../engine/core'
import type {
  Module,
  GameContext
} from '../../engine/core/Types'
import { createDrawService } from './service'

export default function RendererCanvas(): Module {
  let canvas: HTMLCanvasElement
  let ctx2d: CanvasRenderingContext2D
  let draw!: DrawServicePort

  return {
    id: 'renderer/canvas',
    async init(ctx: GameContext) {
      canvas = ctx.config.canvas ?? document.createElement('canvas')
      if (!ctx.config.canvas && ctx.config.mount) ctx.config.mount.appendChild(canvas)
      canvas.width = ctx.config.width
      canvas.height = ctx.config.height

      const c = canvas.getContext('2d')
      if (!c) throw new Error('2D context not available')
      ctx2d = c

      ctx2d.imageSmoothingEnabled = false

      draw = await createDrawService(canvas, ctx2d)
      ctx.services.set(DRAW_ALL, draw)
    }
  }
}
