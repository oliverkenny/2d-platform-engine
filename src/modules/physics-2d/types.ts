import type { Vec2, BodyId, Material } from '../../engine/core/primitives'
import type { PhysicsReadPort, PhysicsWritePort, PhysicsStepPort } from '../../engine/core/ports'

/**
 * Physics Service API (2D)
 * ------------------------
 * A deterministic, fixed-timestep oriented physics façade designed to sit behind your engine/runtime.
 * 
 * ## Design goals
 * - **Deterministic stepping:** You drive time via {@link PhysicsService.step} so game logic and replay are stable.
 * - **Clear lifecycle:** Bodies are created via {@link PhysicsService.createBody} and removed via {@link PhysicsService.removeBody}.
 * - **Explicit units:** All distances are **meters**, angles are **radians**, velocities are **per second**.
 * - **Safe mutations:** Setters return `boolean` to indicate success. Unknown or invalid IDs return `false`.
 * - **Thread/ECS friendly:** You *may* choose to queue commands internally; the API does not require immediate mutation.
 * 
 * ## Conventions
 * - Coordinate system (handedness, Y-up vs Y-down) is engine-defined. Gravity is specified in world units (m/s²).
 * - Getters return **immutable snapshots**. Do not mutate returned objects expecting the world to change.
 * - Calling mutators (e.g., `applyForce`, `setVelocity`) should **wake** sleeping bodies.
 * 
 * ## Error Handling Contract
 * - Methods returning `boolean`: `true` on success, `false` if the body or resource is unknown or the operation is invalid in the current state.
 * - Methods returning `null`: The entity was not found or the data is unavailable.
 * - Methods returning arrays: Empty arrays if no results / nothing hit.
 * 
 * ## Determinism Tips
 * - Use a fixed update (e.g., 60 Hz) and accumulate render time separately.
 * - Prefer impulses/forces for gameplay over directly overwriting velocities every frame.
 */

/**
 * Type of body:
 * - `"dynamic"`: fully simulated; affected by forces, impulses, and gravity.
 * - `"kinematic"`: driven by user code via target transform/velocity; ignores gravity and forces.
 * - `"static"`: infinite mass; does not move; useful for terrain and walls.
 */
export type BodyType = "dynamic" | "kinematic" | "static";

/**
 * Circle shape (2D disc).
 * @remarks
 * - Origin is at the body's origin plus optional {@link offset}.
 * - `radius` must be > 0.
 */
export interface ShapeCircle {
  /** Discriminator. */
  type: "circle";
  /** Circle radius in meters. */
  radius: number;
  /** Local offset in meters from the body origin (before rotation). */
  offset?: Vec2;
}

/**
 * Axis-aligned box in the body's local frame before rotation.
 * @remarks
 * - `hx` and `hy` are **half extents** in meters (i.e., width = 2*hx).
 * - `angle` rotates the box around its local center; applied after `offset` and before body transform.
 */
export interface ShapeBox {
  /** Discriminator. */
  type: "box";
  /** Half extent on X in meters. */
  hx: number;
  /** Half extent on Y in meters. */
  hy: number;
  /** Local offset in meters from the body origin (before rotation). */
  offset?: Vec2;
  /** Local rotation in radians applied to the box (optional). */
  angle?: number;
}

/**
 * Capsule (stadium) shape aligned to its local Y by default.
 * @remarks
 * - `halfHeight` is half the cylindrical segment length (not counting the semicircular caps).
 * - `radius` is the radius of the semicircular caps and cylindrical segment.
 * - Use `angle` to tilt in local space; `offset` to shift relative to body origin.
 */
export interface ShapeCapsule {
  /** Discriminator. */
  type: "capsule";
  /** Half of the cylinder height in meters (excluding caps). Must be >= 0. */
  halfHeight: number;
  /** Radius in meters for the caps and cylinder. Must be > 0. */
  radius: number;
  /** Local offset in meters from the body origin (before rotation). */
  offset?: Vec2;
  /** Local rotation in radians applied to the capsule (optional). */
  angle?: number;
}

/**
 * Union of all supported convex shapes.
 * @remarks
 * Extend with polygons, chains, etc., as engine support grows.
 */
export type Shape = ShapeCircle | ShapeBox | ShapeCapsule;

/**
 * Options to create a body.
 * @remarks
 * - Provide at least one shape in {@link shapes}.
 * - For `"kinematic"` bodies, prefer setting a target via {@link PhysicsService.setKinematicTarget}.
 * - For `"static"` bodies, velocity/damping/gravityScale are ignored.
 */
export interface BodyOpts {
  /** Body type. @defaultValue "dynamic" */
  type?: BodyType;

  /** Initial position in meters. @defaultValue {x:0, y:0} */
  position?: Vec2;

  /** Initial angle in radians. @defaultValue 0 */
  angle?: number;

  /** Initial linear velocity in m/s. @defaultValue {x:0, y:0} */
  linearVelocity?: Vec2;

  /** Initial angular velocity in rad/s. @defaultValue 0 */
  angularVelocity?: number;

  /** Linear damping (drag). @defaultValue engine-chosen (often 0) */
  linearDamping?: number;

  /** Angular damping. @defaultValue engine-chosen (often 0) */
  angularDamping?: number;

  /** Multiplier for world gravity. 1 = full gravity, 0 = no gravity. @defaultValue 1 */
  gravityScale?: number;

  /** If true, locks rotation (infinite inertia). @defaultValue false */
  fixedRotation?: boolean;

  /**
   * Enables continuous collision detection (CCD) for fast-moving small bodies.
   * Use sparingly; has performance cost. @defaultValue false
   */
  bullet?: boolean;

  /** Allows the body to enter a low-cost sleeping state when at rest. @defaultValue true */
  allowSleep?: boolean;

  /**
   * One or more shape + material pairs that define collision geometry.
   * @remarks
   * - The *effective mass* of a dynamic body is computed from the union of fixture densities.
   * - Multiple shapes are common for complex hulls or sensors.
   */
  shapes: Array<{ shape: Shape; material?: Material }>;

  /** Opaque user-owned payload for identification, ECS linkage, etc. */
  userData?: unknown;
}

/**
 * Extended Physics Service API (2D)
 * -----------------------------
 * Includes read, write, and step ports plus extras.
 * @remarks
 * This is the type actually registered in the engine core.
 * 
 * @see PhysicsReadPort
 * @see PhysicsWritePort
 * @see PhysicsStepPort
 */
export interface PhysicsExtras extends PhysicsReadPort, PhysicsWritePort, PhysicsStepPort {

  // ---------------------------------------------------------------------------
  // Contacts & Events
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to global contact events.
   * @remarks
   * - `begin-contact` fires when two fixtures start touching.
   * - `end-contact` fires when they stop touching.
   * - The returned function **unsubscribes** the handler.
   * - For sensors, events still fire but no impulses are generated.
   * @param event Contact event name.
   * @param cb Callback receiving the two body IDs (order not guaranteed).
   * @returns Unsubscribe function.
   */
  on(
    event: "begin-contact" | "end-contact",
    cb: (a: BodyId, b: BodyId) => void
  ): () => void;

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  /**
   * Get mass and rotational inertia for a body.
   * @remarks
   * - Units: mass in kg; inertia in kg·m² (about center of mass).
   * - For `"static"` and `"kinematic"` bodies, implementations may return zeros or `null`.
   * @param id Target body.
   * @returns `{ mass, inertia }` or `null` if unknown/not applicable.
   */
  getMass(id: BodyId): { mass: number; inertia: number } | null;

  /**
   * Retrieve user data object previously associated with the body.
   * @param id Target body.
   * @returns User data (typed via generic) or `null` if none/unknown.
   */
  getUserData<T = unknown>(id: BodyId): T | null;

  /**
   * Associate opaque user data with the body.
   * @remarks
   * - Replaces any existing data.
   * - Use sparingly; prefer IDs into your ECS or scene graph where possible.
   * @param id Target body.
   * @param data Arbitrary payload.
   * @returns `true` if set; `false` if body unknown.
   */
  setUserData<T = unknown>(id: BodyId, data: T): boolean;
}

/**
 * The Physics Service (2D)
 * @remarks
 * - Provides access to the physics simulation for 2D bodies.
 * - Includes methods for querying and manipulating body states.
 * 
 * @see PhysicsReadPort
 * @see PhysicsWritePort
 * @see PhysicsStepPort
 * @see PhysicsExtras
 */
export type PhysicsService = 
  PhysicsExtras & 
  PhysicsReadPort & 
  PhysicsWritePort & 
  PhysicsStepPort;