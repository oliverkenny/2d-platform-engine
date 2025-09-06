import type { Module, DebugPanel } from '../../engine/core/Types'
import { PHYSICS_READ, PHYSICS_WRITE, PHYSICS_STEP } from '../../engine/core/tokens'
import { createRapierPhysicsService } from './service'
import type { PhysicsService } from './types'

// ⬇️ Adjust these imports if your paths differ
import type { DrawServicePort } from '../../engine/core/ports/draw.all'
import type { Colour } from '../../engine/core/primitives/colour'
import type { Shape, ShapeBox, ShapeCircle, ShapeCapsule } from './types'
import { BodyId, DRAW_ALL } from '../../engine/core'

const WHITE: Colour = { r: 255, g: 255, b: 255, a: 255 }
const CYAN:  Colour = { r:  64, g: 200, b: 255, a: 255 }

/**
 * Simple screen mapping (world meters → screen pixels).
 * Replace with your camera/viewport integration when available.
 */
const PPM = 50 // pixels per meter
// Where world (0,0) lands in screen pixels (top-left origin).
// For a 1280x720 surface, this puts world (0,0) at bottom-left.
const ORIGIN_PX = { x: 0, y: 720 }

export function Physics2D(): Module {
  let physics: PhysicsService | undefined

  // ---------------------------------------------------------------------------
  // World <-> Screen helpers
  // ---------------------------------------------------------------------------
  function worldLenToPx(lenM: number) {
    return lenM * PPM
  }
  function worldXToPx(xM: number) {
    return ORIGIN_PX.x + xM * PPM
  }
  // Physics assumed Y-up; screen Y-down => flip
  function worldYToPx(yM: number) {
    return ORIGIN_PX.y - yM * PPM
  }
  function worldPtToScreen(xM: number, yM: number) {
    return { x: worldXToPx(xM), y: worldYToPx(yM) }
  }

  // ---------------------------------------------------------------------------
  // Geometry/AABB helpers
  // ---------------------------------------------------------------------------
  function xformPoint(px: number, py: number, tx: number, ty: number, angle: number) {
    const c = Math.cos(angle), s = Math.sin(angle)
    return { x: tx + (px * c - py * s), y: ty + (px * s + py * c) }
  }
  function aabbOf(points: Array<{x:number;y:number}>) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    return { minX, minY, maxX, maxY }
  }

  // Build an *approximate* world-space AABB for a shape on a body (meters, Y-up).
  function shapeWorldAABB(shape: Shape, bodyX: number, bodyY: number, bodyAngle: number) {
    switch (shape.type) {
      case 'box': {
        const b = shape as ShapeBox
        const ox = b.offset?.x ?? 0, oy = b.offset?.y ?? 0
        const localAngle = (b.angle ?? 0)
        const hx = b.hx, hy = b.hy
        const corners = [
          {x: -hx, y: -hy}, {x: +hx, y: -hy},
          {x: +hx, y: +hy}, {x: -hx, y: +hy},
        ].map(p => xformPoint(p.x, p.y, ox, oy, localAngle))
         .map(p => xformPoint(p.x, p.y, bodyX, bodyY, bodyAngle))
        const {minX, minY, maxX, maxY} = aabbOf(corners)
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      }
      case 'circle': {
        const c = shape as ShapeCircle
        const ox = c.offset?.x ?? 0, oy = c.offset?.y ?? 0
        const center = xformPoint(ox, oy, bodyX, bodyY, bodyAngle)
        const r = c.radius
        return { x: center.x - r, y: center.y - r, w: 2*r, h: 2*r }
      }
      case 'capsule': {
        const cp = shape as ShapeCapsule
        const ox = cp.offset?.x ?? 0, oy = cp.offset?.y ?? 0
        const localAngle = (cp.angle ?? 0)
        const r = cp.radius
        const hh = cp.halfHeight
        const endsLocal = [
          {x: 0, y: -hh},
          {x: 0, y: +hh},
        ].map(p => xformPoint(p.x, p.y, ox, oy, localAngle))
         .map(p => xformPoint(p.x, p.y, bodyX, bodyY, bodyAngle))
        const {minX, minY, maxX, maxY} = aabbOf(endsLocal)
        return { x: minX - r, y: minY - r, w: (maxX - minX) + 2*r, h: (maxY - minY) + 2*r }
      }
    }
  }

  // Convert a world AABB (meters, min corner) into a screen rect (top-left px).
  function aabbWorldToScreenRect(aabb: { x:number; y:number; w:number; h:number }) {
    const wPx = worldLenToPx(aabb.w)
    const hPx = worldLenToPx(aabb.h)
    const sx = worldXToPx(aabb.x)
    // Top-left Y in screen space is the screen Y of world maxY (minY + h)
    const sy = worldYToPx(aabb.y + aabb.h)
    return { x: sx, y: sy, w: wPx, h: hPx }
  }

  // Stroke (outline) a screen-space rect using 4 thin filled rects (pixels).
  function strokeRectPx(draw: DrawServicePort, x: number, y: number, w: number, h: number, thicknessPx = 2, color?: Colour) {
    // top
    draw.rect(x, y, w, thicknessPx, color)
    // bottom
    draw.rect(x, y + h - thicknessPx, w, thicknessPx, color)
    // left
    draw.rect(x, y, thicknessPx, h, color)
    // right
    draw.rect(x + w - thicknessPx, y, thicknessPx, h, color)
  }

  // Draw outlines for a body’s shapes (AABBs). Falls back to a small marker if shapes are unknown.
  function drawBodyOutline(draw: DrawServicePort, body: { id: BodyId, t: { x:number; y:number; angle:number } }) {
    // If at creation you store BodyOpts/shapes in userData, we can read true shapes:
    //   physics.setUserData(id, { shapes: opts.shapes })
    const ud = physics?.getUserData<{ shapes?: Array<{ shape: Shape }> }>(body.id)
    const shapes = ud?.shapes?.map(s => s.shape)

    const thicknessPx = 2

    if (shapes && shapes.length > 0) {
      for (const shape of shapes) {
        const aabbWorld = shapeWorldAABB(shape, body.t.x, body.t.y, body.t.angle)
        if (aabbWorld) {
          const rectPx = aabbWorldToScreenRect(aabbWorld)
          strokeRectPx(draw, rectPx.x, rectPx.y, rectPx.w, rectPx.h, thicknessPx, CYAN)
        }
      }
    } else {
      // Unknown shapes: draw a small 0.3m square centered at body
      const s = 0.3
      const aabbWorld = { x: body.t.x - s * 0.5, y: body.t.y - s * 0.5, w: s, h: s }
      const rectPx = aabbWorldToScreenRect(aabbWorld)
      strokeRectPx(draw, rectPx.x, rectPx.y, rectPx.w, rectPx.h, thicknessPx, WHITE)
    }

    // Label near center
    const label = worldPtToScreen(body.t.x, body.t.y)
    draw.text(String(body.id), label.x + 6, label.y - 6, WHITE)
  }

  // ---------------------------------------------------------------------------
  // Debug panel with render + draw
  // ---------------------------------------------------------------------------
  const debugPanel: DebugPanel = {
    title: 'Physics 2D',
    render(ctx) {
      if (!physics) return ['Physics not initialized']
      const g = physics.getGravity()
      const snapshot = physics.readSnapshot()
      return [
        `Gravity: ${g.x.toFixed(2)}, ${g.y.toFixed(2)}`,
        `Sim Time: ${snapshot.time.toFixed(3)}s`,
        `Bodies: ${snapshot.bodies.length}`,
      ]
    },
    draw(ctx) {
      if (!physics) return
      const draw = ctx.services.getOrThrow(DRAW_ALL) as DrawServicePort | undefined
      if (!draw) return
      const snap = physics.readSnapshot()

      // If your renderer expects a clear per overlay, you can uncomment:
      // draw.clear()

      for (const b of snap.bodies) {
        drawBodyOutline(draw, {
          id: b.id as unknown as Bo,
          t: { x: b.t.x, y: b.t.y, angle: b.t.angle }
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Module lifecycle
  // ---------------------------------------------------------------------------
  return {
    id: 'physics/2d',

    async init(ctx) {
      physics = await createRapierPhysicsService()
      ctx.services.set(PHYSICS_READ,  physics)
      ctx.services.set(PHYSICS_WRITE, physics)
      ctx.services.set(PHYSICS_STEP,  physics)
    },

    start(ctx) {
      ctx.bus.emit({ type: 'debug/panel/register', panel: debugPanel })
    },

    update(_ctx, dt) {
      physics!.step(dt)
    },

    destroy() {
      const d = (physics as any)?.dispose as (() => void) | undefined
      try { d?.() } finally { physics = undefined }
    },
  }
}
