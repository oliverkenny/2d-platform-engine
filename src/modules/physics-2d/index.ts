// src/modules/physics-2d/index.ts

/**
 * 2D Physics module (Rapier) with debug rendering via the Render Queue.
 */

import type { Module, DebugPanel } from '../../engine/core/Types';
import type { Colour, BodyId } from '../../engine/core/primitives';
import type { PhysicsService } from './types';

import type { Camera2DReadPort } from '../../engine/core/ports';
import { PHYSICS_READ, PHYSICS_WRITE, PHYSICS_STEP, CAMERA_2D_READ } from '../../engine/core/tokens';

import type { RenderQueueWritePort } from '../../engine/core/ports';
import { RENDER_QUEUE_WRITE } from '../../engine/core/tokens';

import type { RenderCmd } from '../../engine/core/primitives/render';
import { createRapierPhysicsService } from './service';
import { Colours } from '../../util/colour';
import { Shape2D, ShapeBox, ShapeCapsule, ShapeCircle } from '../../engine/core/primitives/collision2d';

// ---------------------------------------------------------------------------
// Geometry helpers (world space, y-up) — unchanged
// ---------------------------------------------------------------------------
function xformPoint(px: number, py: number, tx: number, ty: number, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: tx + (px * c - py * s), y: ty + (px * s + py * c) };
}
function aabbOf(points: Array<{x:number;y:number}>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// Build an *approximate* world-space AABB for a shape on a body (meters, Y-up).
function shapeWorldAABB(shape: Shape2D, bodyX: number, bodyY: number, bodyAngle: number) {
  switch (shape.type) {
    case 'box': {
      const b = shape as ShapeBox;
      const ox = b.offset?.x ?? 0, oy = b.offset?.y ?? 0;
      const localAngle = (b.angle ?? 0);
      const hx = b.hx, hy = b.hy;
      const corners = [
        {x: -hx, y: -hy}, {x: +hx, y: -hy},
        {x: +hx, y: +hy}, {x: -hx, y: +hy},
      ].map(p => xformPoint(p.x, p.y, ox, oy, localAngle))
       .map(p => xformPoint(p.x, p.y, bodyX, bodyY, bodyAngle));
      const {minX, minY, maxX, maxY} = aabbOf(corners);
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case 'circle': {
      const c = shape as ShapeCircle;
      const ox = c.offset?.x ?? 0, oy = c.offset?.y ?? 0;
      const center = xformPoint(ox, oy, bodyX, bodyY, bodyAngle);
      const r = c.radius;
      return { x: center.x - r, y: center.y - r, w: 2*r, h: 2*r };
    }
    case 'capsule': {
      const cp = shape as ShapeCapsule;
      const ox = cp.offset?.x ?? 0, oy = cp.offset?.y ?? 0;
      const localAngle = (cp.angle ?? 0);
      const r = cp.radius;
      const hh = cp.halfHeight;
      const endsLocal = [
        {x: 0, y: -hh},
        {x: 0, y: +hh},
      ].map(p => xformPoint(p.x, p.y, ox, oy, localAngle))
       .map(p => xformPoint(p.x, p.y, bodyX, bodyY, bodyAngle));
      const {minX, minY, maxX, maxY} = aabbOf(endsLocal);
      return { x: minX - r, y: minY - r, w: (maxX - minX) + 2*r, h: (maxY - minY) + 2*r };
    }
  }
}

// ---------------------------------------------------------------------------
// Camera math: world (m, y-up) → UI pixels (y-down, logical canvas size)
// ---------------------------------------------------------------------------

type Camera2DShape = {
  position: { x:number; y:number };
  zoom: number;
  ppm: number;          // pixels per meter at zoom = 1
  rotation?: number;    // radians CCW
};

// Convert a world point to UI pixels using the same convention as your renderer.
function worldToUi(
  world: {x:number;y:number},
  cam: Camera2DShape,
  screenW: number,
  screenH: number
) {
  const dx = world.x - cam.position.x;
  const dy = world.y - cam.position.y;
  const ang = -(cam.rotation ?? 0);       // renderer applied -rotation for world->screen
  const c = Math.cos(ang), s = Math.sin(ang);
  const rx = dx * c - dy * s;
  const ry = dx * s + dy * c;
  const scale = cam.ppm * cam.zoom;
  // flip Y to go y-up (world) → y-down (screen)
  const sx = screenW * 0.5 + rx * scale;
  const sy = screenH * 0.5 - ry * scale;
  return { x: sx, y: sy };
}

function worldAabbToUiRect(
  aabb: { x:number;y:number;w:number;h:number },
  cam: Camera2DShape,
  screenW: number,
  screenH: number
) {
  // World AABB: min=(x,y), max=(x+w,y+h). In UI px, top-left is (minX, maxY)
  const tl = worldToUi({ x: aabb.x,         y: aabb.y + aabb.h }, cam, screenW, screenH);
  const br = worldToUi({ x: aabb.x + aabb.w,y: aabb.y          }, cam, screenW, screenH);
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

// Emit 4 thin rects (in UI pixels) to simulate a stroked rectangle.
function emitStrokeRectUI(
  out: RenderCmd[],
  passId: string,
  layer: string,
  z: number,
  material: string,
  x: number, y: number, w: number, h: number,
  thicknessPx = 2
) {
  out.push(
    { kind:"rect", passId, space:"ui", layer, z,     renderMaterial: material, x,         y,          w,         h: thicknessPx },
    { kind:"rect", passId, space:"ui", layer, z,     renderMaterial: material, x,         y: y+h-thicknessPx, w, h: thicknessPx },
    { kind:"rect", passId, space:"ui", layer, z,     renderMaterial: material, x,         y,          w: thicknessPx, h },
    { kind:"rect", passId, space:"ui", layer, z,     renderMaterial: material, x: x+w-thicknessPx, y, w: thicknessPx, h }
  );
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
export function Physics2D(): Module {
  let physics: PhysicsService | undefined;
  let rq!: RenderQueueWritePort;
  let cams!: Camera2DReadPort;

  const debugPanel: DebugPanel = {
    title: 'Physics 2D',
    render(ctx) {
      if (!physics) return ['Physics not initialized'];
      const g = physics.getGravity();
      const snapshot = physics.readSnapshot();
      return [
        `Gravity: ${g.x.toFixed(2)}, ${g.y.toFixed(2)}`,
        `Sim Time: ${snapshot.time.toFixed(3)}s`,
        `Bodies: ${snapshot.bodies.length}`,
      ];
    },
    // No direct drawing here anymore; visuals are pushed in module.render()
  };

  return {
    id: 'physics/2d',

    async init(ctx) {
      physics = await createRapierPhysicsService();
      ctx.services.set(PHYSICS_READ,  physics);
      ctx.services.set(PHYSICS_WRITE, physics);
      ctx.services.set(PHYSICS_STEP,  physics);

      // Register debug panel
      ctx.bus.emit({ type: 'debug/panel/register', panel: debugPanel });
    },

    start(ctx) {
      rq   = ctx.services.getOrThrow(RENDER_QUEUE_WRITE);
      cams = ctx.services.getOrThrow(CAMERA_2D_READ);
    },

    // Step the simulation (unchanged)
    update(_ctx, dt) {
      physics!.step(dt);
    },

    // NEW: push UI-space debug geometry every frame
    render(ctx) {
      if (!physics) return;

      const cam = cams.get() as unknown as Camera2DShape;
      const screenW = ctx.config.width;
      const screenH = ctx.config.height;

      const snap = physics.readSnapshot();

      // Accumulate commands and push in one go to reduce overhead
      const cmds: RenderCmd[] = [];
      const passId = "ui";       // must match your coordinator's pass id
      const layer  = "debug";    // keep above HUD
      const stroke = "flat/cyan";
      const labelMat = "text/default";
      const thicknessPx = 2;

      for (const b of snap.bodies) {
        const bodyId = b.id as unknown as BodyId;
        const ud = physics.getUserData<{ shapes?: Array<{ shape: Shape2D }> }>(bodyId);
        const shapes = ud?.shapes?.map(s => s.shape);

        if (shapes && shapes.length > 0) {
          for (const shape of shapes) {
            const aabbWorld = shapeWorldAABB(shape, b.t.x, b.t.y, b.t.angle);
            if (!aabbWorld) continue;
            const rectPx = worldAabbToUiRect(aabbWorld, cam, screenW, screenH);
            emitStrokeRectUI(cmds, passId, layer, 100, stroke, rectPx.x, rectPx.y, rectPx.w, rectPx.h, thicknessPx);
          }
        } else {
          // Unknown shapes: draw a small square at body center
          const s = 0.3;
          const aabbWorld = { x: b.t.x - s*0.5, y: b.t.y - s*0.5, w: s, h: s };
          const rectPx = worldAabbToUiRect(aabbWorld, cam, screenW, screenH);
          emitStrokeRectUI(cmds, passId, layer, 100, "flat/white", rectPx.x, rectPx.y, rectPx.w, rectPx.h, thicknessPx);
        }

        // Label the body id near center
        const labelPos = worldToUi({ x: b.t.x, y: b.t.y }, cam, screenW, screenH);
        cmds.push({
          kind: "text",
          passId,
          space: "ui",
          layer,
          z: 101,
          renderMaterial: labelMat,
          x: labelPos.x + 6,
          y: labelPos.y - 6,
          text: String(bodyId),
        });
      }

      if (cmds.length) rq.pushMany(cmds);
    },

    destroy() {
      const d = (physics as any)?.dispose as (() => void) | undefined;
      try { d?.(); } finally { physics = undefined; }
    },
  };
}
