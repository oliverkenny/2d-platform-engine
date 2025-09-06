/**
 * Stepping interface for a 2D physics world.
 *
 * @remarks
 * - The simulation does **not** advance automatically; you must call {@link step}.
 * - Use a fixed timestep (e.g., 1/60s) for deterministic replay and stability.
 * - Accumulate render time separately to avoid jitter.
 */
export interface PhysicsStepPort {
  /**
   * Advance the simulation by `dt` seconds.
   *
   * @param dt Time step in seconds (must be >= 0).
   * @param substeps Optional number of internal solver sub-iterations. Default = 1.
   *
   * @remarks
   * - Use a fixed `dt` for stable simulation (commonly 1/60).
   * - `substeps` can improve stability under large `dt` but increases cost.
   * - Implementations may clamp excessively large `dt` values.
   */
  step(dt: number, substeps?: number): void
}
