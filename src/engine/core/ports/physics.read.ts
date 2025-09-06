import type { BodyId } from '../primitives/ids'
import type { Vec2, Transform } from '../primitives/math'

/**
 * Read-only operations for a 2D physics world.
 *
 * @remarks
 * - Provides immutable snapshots and queries into the physics state.
 * - All values are **world-space** (meters, radians, SI units).
 * - Returned objects must be treated as read-only snapshots;
 *   do not mutate them expecting the simulation to change.
 */
export interface PhysicsReadPort {
  /**
   * Get the current transform (pose) of a body.
   *
   * @param id Target body.
   * @returns World transform (position + angle), or `null` if unknown.
   */
  getTransform(id: BodyId): Transform | null

  /**
   * Get the current velocity of a body.
   *
   * @param id Target body.
   * @returns `{ vx, vy, w }` in m/s and rad/s, or `null` if unknown.
   */
  getVelocity(id: BodyId): { vx: number; vy: number; w: number } | null

  /**
   * Cast a ray segment and collect hits.
   *
   * @param p1 Ray start point (world meters).
   * @param p2 Ray end point (world meters).
   * @param maskBits Optional category mask filter.
   * @returns Array of hits sorted by intersection fraction (closest first).
   *
   * @remarks
   * Each hit contains:
   * - `id`: the hit body ID
   * - `point`: intersection point (meters)
   * - `normal`: surface normal at hit (unit vector)
   * - `fraction`: [0..1] fraction along the ray segment
   */
  raycast(
    p1: Vec2,
    p2: Vec2,
    maskBits?: number
  ): Array<{ id: BodyId; point: Vec2; normal: Vec2; fraction: number }>

  /**
   * Query bodies overlapping an axis-aligned bounding box (AABB).
   *
   * @param min Minimum corner (meters).
   * @param max Maximum corner (meters).
   * @param maskBits Optional category mask filter.
   * @returns Array of matching body IDs (duplicates removed).
   *
   * @remarks
   * - Useful for triggers, area queries, and editor selection.
   */
  aabbQuery(min: Vec2, max: Vec2, maskBits?: number): BodyId[]

  /**
   * Query the body (if any) under a world-space point.
   *
   * @param p World point in meters.
   * @param maskBits Optional category mask filter.
   * @returns First matching body ID, or `null` if none.
   *
   * @remarks
   * - Deterministic ordering is recommended for stable results.
   */
  pointQuery(p: Vec2, maskBits?: number): BodyId | null

  /**
   * Get the current gravity vector in m/s².
   * @returns Immutable snapshot of gravity.
   */
  getGravity(): Vec2;

  /**
   * Check if a body is currently sleeping (deactivated).
   * @param id Target body.
   * @returns `true` if the body is sleeping.
   */
  isSleeping(id: BodyId): boolean

  /**
   * Read a compact snapshot of the simulation.
   *
   * @returns Snapshot containing transforms and velocities for all bodies.
   *
   * @remarks
   * - Snapshots are safe to iterate without holding locks.
   * - Intended for rendering, netcode sync, or debugging overlays.
   * - `time` is world time in seconds since simulation start.
   */
  readSnapshot(): {
    /** World time in seconds. */
    time: number
    /** One entry per simulated body. */
    bodies: Array<{
      /** Body identifier. */
      id: BodyId
      /** World transform (meters, radians). */
      t: Transform
      /** Velocity components (m/s, rad/s). */
      v: { vx: number; vy: number; w: number }
    }>
  }
}
