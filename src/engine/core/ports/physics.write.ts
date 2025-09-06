import type { BodyId } from '../primitives/ids'
import type { Vec2, Transform } from '../primitives/math'
import type { PhysicsStepPort } from './physics.step'

/**
 * Write-side operations for a 2D physics world.
 *
 * @remarks
 * - **Deterministic stepping:** Call {@link PhysicsStepPort.step} with a fixed `dt`.
 * - **Explicit control:** Mutations return `boolean` to indicate success/failure.
 * - **Safe IDs:** Unknown or destroyed bodies cause methods to return `false`.
 * - **Thread/ECS friendly:** Implementations may choose to queue commands internally.
 *
 * Units follow SI conventions:
 * - Distances in **meters**
 * - Angles in **radians**
 * - Velocities in **m/s** and **rad/s**
 * - Forces in **N** (kg·m/s²)
 * - Impulses in **N·s**
 * - Torques in **N·m** or **N·m·s**
 */
export interface PhysicsWritePort {
  /**
   * Create a body in the world.
   *
   * @param opts Implementation-defined creation parameters (body type, position, shapes, etc.).
   * @returns The new body's {@link BodyId}.
   *
   * @remarks
   * - At least one shape must be provided in `opts`.
   * - Returns an opaque ID that is stable until removal.
   */
  createBody(opts: unknown): BodyId

  /**
   * Remove an existing body.
   *
   * @param id Target body.
   * @returns `true` if removed; `false` if unknown.
   *
   * @remarks
   * - Removal destroys all contacts/joints involving this body.
   * - Removing the same body twice is safe (treated as no-op).
   */
  removeBody(id: BodyId): boolean

  /**
   * Directly set linear and/or angular velocity.
   *
   * @param id Target body.
   * @param v Linear velocity `(vx, vy)` in m/s and optional angular velocity `w` in rad/s.
   * @returns `true` if applied; `false` if body unknown or immutable.
   *
   * @remarks
   * - Use for bursts (dash, jump) or AI steering.
   * - Prefer impulses/forces for physically consistent changes.
   * - Automatically wakes the body.
   */
  setVelocity(id: BodyId, v: { vx: number; vy: number; w?: number }): boolean

  /**
   * Apply a continuous force.
   *
   * @param id Target body (dynamic only).
   * @param force Force vector in Newtons.
   * @param worldPoint Optional application point in world coordinates (meters). Defaults to center of mass.
   * @returns `true` if applied; `false` if body unknown or not dynamic.
   *
   * @remarks
   * - Integrated over the step; use for sustained effects (thrusters, wind).
   * - Generates torque if applied off-center.
   */
  applyForce(id: BodyId, force: Vec2, worldPoint?: Vec2): boolean

  /**
   * Apply a continuous torque around the center of mass.
   *
   * @param id Target body (dynamic only).
   * @param torque Torque magnitude in N·m.
   * @returns `true` if applied; `false` otherwise.
   */
  applyTorque(id: BodyId, torque: number): boolean

  /**
   * Apply an instantaneous linear impulse.
   *
   * @param id Target body (dynamic only).
   * @param impulse Impulse vector in N·s.
   * @param worldPoint Optional application point in world coordinates. Defaults to center of mass.
   * @returns `true` if applied; `false` otherwise.
   *
   * @remarks
   * - Best for hits, explosions, jump impulses.
   * - Wakes the body.
   */
  applyLinearImpulse(id: BodyId, impulse: Vec2, worldPoint?: Vec2): boolean

  /**
   * Apply an instantaneous angular impulse (spin kick).
   *
   * @param id Target body (dynamic only).
   * @param impulse Angular impulse magnitude in N·m·s.
   * @returns `true` if applied; `false` otherwise.
   *
   * @remarks
   * - Wakes the body.
   */
  applyAngularImpulse(id: BodyId, impulse: number): boolean

  /**
   * Set a kinematic body's target transform/velocity.
   *
   * @param id Target body (kinematic only).
   * @param t Partial transform fields (x, y, angle) in world space.
   * @returns `true` if accepted; `false` otherwise.
   *
   * @remarks
   * - Engines typically compute implied velocity from delta for CCD-friendly motion.
   * - Ignored on non-kinematic bodies.
   */
  setKinematicTarget(id: BodyId, t: Partial<Transform>): boolean

  /**
   * Instantly warp a body to a new transform.
   *
   * @param id Target body.
   * @param t World-space transform.
   * @returns `true` if applied; `false` otherwise.
   *
   * @remarks
   * - Useful for spawning, teleportation, or editor tools.
   * - May cause tunneling if used mid-step on dynamic bodies.
   * - Automatically wakes the body.
   */
  warpTransform(id: BodyId, t: Transform): boolean

  /**
   * Explicitly wake a sleeping body.
   *
   * @param id Target body.
   * @returns `true` if the body exists; `false` if unknown.
   *
   * @remarks
   * - No effect if the body is already awake.
   */
  wake(id: BodyId): boolean

  /**
   * Associate opaque user data with a body.
   *
   * @param id Target body.
   * @param data Arbitrary payload.
   * @returns `true` if set; `false` if body unknown.
   *
   * @remarks
   * - Replaces any existing payload.
   * - Useful for ECS linkage or gameplay tags.
   */
  setUserData<T = unknown>(id: BodyId, data: T): boolean

  /**
   * Set the global gravity vector.
   *
   * @param g Gravity vector in m/s².
   *
   * @remarks
   * - Convention (Y-up vs Y-down) is engine-defined.
   * - Affects subsequent integration immediately.
   */
  setGravity(g: Vec2): void
}
