// src/engine/core/primitives/collision2d.ts
import type { Vec2, PhysicsMaterial } from "./index";

/**
 * Body types understood by the engine-facing API.
 * Implementation (Rapier, Box2D, custom) maps these internally.
 */
export type BodyType = "dynamic" | "kinematic" | "static";

/** Circle (meters, local space) */
export interface ShapeCircle {
  type: "circle";
  radius: number;      // > 0
  offset?: Vec2;       // local offset before body transform
}

/** Box using half-extents (meters, local space) */
export interface ShapeBox {
  type: "box";
  hx: number;          // half width  (> 0)
  hy: number;          // half height (> 0)
  offset?: Vec2;       // local offset
  angle?: number;      // local rotation (radians)
}

/** Capsule aligned to local Y by default (meters, local space) */
export interface ShapeCapsule {
  type: "capsule";
  halfHeight: number;  // >= 0 (cylinder half-height, caps excluded)
  radius: number;      // > 0
  offset?: Vec2;
  angle?: number;      // local rotation (radians)
}

/** Union of supported convex shapes */
export type Shape2D = ShapeCircle | ShapeBox | ShapeCapsule;

/**
 * Fixture/shape options common to all engines.
 * If you already have PhysicsMaterial in primitives, reuse it here.
 */
export interface Fixture2D {
  shape: Shape2D;
  material?: PhysicsMaterial;  // density, friction, restitution, isSensor, filters...
}
