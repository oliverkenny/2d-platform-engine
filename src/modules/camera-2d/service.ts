import type { Camera2D } from "../../engine/core/primitives"
import { Camera2DPort, Camera2DReadPort, Camera2DWritePort } from "../../engine/core/ports"

export function createCamera2DService(initial: Camera2D): Camera2DPort & Camera2DReadPort & Camera2DWritePort {
  let cam = { ...initial }
  const subs = new Set<(c: Readonly<Camera2D>) => void>()

  const notify = () => subs.forEach((f) => f(cam))

  return {
    get: () => cam,
    replace(next) { cam = { ...next }; notify() },
    set(patch) { cam = { ...cam, ...patch }; notify() },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn) },
    follow(target, opts) {
      const { lerp = 0.15, deadzoneHalf } = opts ?? {}
      let { x, y } = cam.position

      if (deadzoneHalf) {
        // Only move if outside deadzone box centered on camera
        const dx = target.x - x
        const dy = target.y - y
        const outX = Math.abs(dx) > deadzoneHalf.x
        const outY = Math.abs(dy) > deadzoneHalf.y
        if (outX) x += (dx - Math.sign(dx) * deadzoneHalf.x) * lerp
        if (outY) y += (dy - Math.sign(dy) * deadzoneHalf.y) * lerp
      } else {
        x += (target.x - x) * lerp
        y += (target.y - y) * lerp
      }

      cam = { ...cam, position: { x, y } }
      notify()
    },
  }
}