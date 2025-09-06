import type { Module, DebugPanel } from '../../engine/core/Types'
import type { Colour, BodyId, Vec2 } from '../../engine/core/primitives'
import type { PhysicsService, Shape, ShapeBox, ShapeCircle, ShapeCapsule } from './types'
import type { DrawServicePort, Camera2DPort } from '../../engine/core/ports'
import { PHYSICS_READ, PHYSICS_WRITE, PHYSICS_STEP, DRAW_ALL, CAMERA_2D } from '../../engine/core/tokens'
import { createRapierPhysicsService } from './service'

const WHITE: Colour = { r: 1, g: 1, b: 1, a: 1 }
const CYAN:  Colour = { r: 0.25, g: 0.78, b: 1, a: 1 }

// ---------------------------------------------------------------------------
// Geometry helpers (world space, y-up)
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

// Convert a world AABB (min corner, meters, y-up) into a screen rect (top-left px).
function aabbWorldToScreenRect(
  draw: DrawServicePort,
  cam: Readonly<Camera2DPort['get'] extends () => infer T ? T : never>,
  aabb: { x:number; y:number; w:number; h:number }
) {
  // top-left is (minX, maxY), bottom-right is (maxX, minY) in world
  const tl = draw.toScreen({ x: aabb.x,           y: aabb.y + aabb.h }, cam as any)
  const br = draw.toScreen({ x: aabb.x + aabb.w,  y: aabb.y           }, cam as any)
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y }
}

// Stroke (outline) a screen-space rect using 4 thin filled rects (pixels).
function strokeRectPx(draw: DrawServicePort, x: number, y: number, w: number, h: number, thicknessPx = 2, color?: Colour) {
  draw.rect(x, y, w, thicknessPx, color)                    // top
  draw.rect(x, y + h - thicknessPx, w, thicknessPx, color)  // bottom
  draw.rect(x, y, thicknessPx, h, color)                    // left
  draw.rect(x + w - thicknessPx, y, thicknessPx, h, color)  // right
}

// Draw outlines for a body’s shapes (AABBs). Falls back to a small marker if shapes are unknown.
function drawBodyOutline(
  draw: DrawServicePort,
  camVal: Readonly<Camera2DPort['get'] extends () => infer T ? T : never>,
  physics: PhysicsService,
  body: { id: BodyId, t: { x:number; y:number; angle:number } }
) {
  const ud = physics.getUserData<{ shapes?: Array<{ shape: Shape }> }>(body.id)
  const shapes = ud?.shapes?.map(s => s.shape)
  const thicknessPx = 2

  if (shapes && shapes.length > 0) {
    for (const shape of shapes) {
      const aabbWorld = shapeWorldAABB(shape, body.t.x, body.t.y, body.t.angle)
      if (aabbWorld) {
        const rectPx = aabbWorldToScreenRect(draw, camVal, aabbWorld)
        strokeRectPx(draw, rectPx.x, rectPx.y, rectPx.w, rectPx.h, thicknessPx, CYAN)
      }
    }
  } else {
    // Unknown shapes: draw a small 0.3m square centered at body
    const s = 0.3
    const aabbWorld = { x: body.t.x - s * 0.5, y: body.t.y - s * 0.5, w: s, h: s }
    const rectPx = aabbWorldToScreenRect(draw, camVal, aabbWorld)
    strokeRectPx(draw, rectPx.x, rectPx.y, rectPx.w, rectPx.h, thicknessPx, WHITE)
  }

  // Label near center
  const label = draw.toScreen({ x: body.t.x, y: body.t.y }, camVal as any)
  draw.text(String(body.id), label.x + 6, label.y - 6, WHITE)
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
export function Physics2D(): Module {
  let physics: PhysicsService | undefined

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
      const camSvc = ctx.services.getOrThrow(CAMERA_2D) as Camera2DPort


      if (!draw || !camSvc) return

      const camVal = camSvc.get()
      const snap = physics.readSnapshot()

      // Draw all debug overlays in **UI space** for consistent pixel thickness
      draw.toUi(() => {
        for (const b of snap.bodies) {
          drawBodyOutline(draw, camVal, physics!, {
            id: b.id as unknown as BodyId,
            t: { x: b.t.x, y: b.t.y, angle: b.t.angle }
          })
        }
      })
    }
  }

  return {
    id: 'physics/2d',

    async init(ctx) {
      physics = await createRapierPhysicsService()
      ctx.services.set(PHYSICS_READ,  physics)
      ctx.services.set(PHYSICS_WRITE, physics)
      ctx.services.set(PHYSICS_STEP,  physics)
      // Register debug panel
      ctx.bus.emit({ type: 'debug/panel/register', panel: debugPanel })
    },

    // If this module also owns the stepping, keep it here:
    update(_ctx, dt) {
      physics!.step(dt)
    },

    destroy() {
      const d = (physics as any)?.dispose as (() => void) | undefined
      try { d?.() } finally { physics = undefined }
    },
  }
}
