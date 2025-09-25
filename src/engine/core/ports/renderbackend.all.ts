import type { Vec2, Camera2D } from "../primitives";
import type { RenderCmd, RenderSpace } from "../primitives/render";
import type { RenderMaterialId } from "../primitives/material.render";

/**
 * RenderBackendPort
 * -----------------------------------------------------------------------------
 * A renderer-agnostic backend interface driven exclusively by the
 * RenderCoordinator. No module should call this directly.
 *
 * Lifecycle per frame (per pass):
 *   - clear()          // usually once per frame (optional per config)
 *   - beginPass({ ... })
 *   - submitBatch([...])  // repeated as needed; each batch shares (kind, material)
 *   - endPass()
 *
 * Notes:
 * - The coordinator provides already *culled*, *sorted*, *batched* commands.
 * - The backend applies transforms in beginPass() (world via camera, or UI if null).
 * - Primitive drawing methods (rect/text/sprite/…) are *internal* to the renderer.
 */
export interface RenderBackendPort {
  // ---------------------------------------------------------------------------
  // Frame control
  // ---------------------------------------------------------------------------

  /** Clear the entire render target for a new frame (or between passes if desired). */
  clear(): void;

  // ---------------------------------------------------------------------------
  // Pass control
  // ---------------------------------------------------------------------------

  /**
   * Prepare to render a pass. If `camera` is provided, draw in **world space**
   * (meters, y-up) using that camera. If `camera` is null, draw in **UI space**
   * (pixels, y-down). Implementations should set up the appropriate transform.
   */
  beginPass(ctx: {
    /** For debugging/telemetry only; rendering behavior shouldn't depend on id. */
    passId: string;
    /** "world" or "ui" — redundant but convenient for backends/metrics. */
    space: RenderSpace;
    /** World camera for world-space passes, or null for UI passes. */
    camera: Readonly<Camera2D> | null;
  }): void;

  /**
   * Draw a batch of commands that all share the same (kind, renderMaterial).
   * The coordinator guarantees this invariant; the backend may rely on it to
   * apply material state once and loop the primitives.
   */
  submitBatch(batch: ReadonlyArray<RenderCmd>): void;

  /** Finish the current pass and restore any transient state. */
  endPass(): void;

  // ---------------------------------------------------------------------------
  // Optional measurement & helpers (useful for layout and anchoring)
  // ---------------------------------------------------------------------------

  /**
   * Optional: measure text width/metrics for a given material. Backends may no-op
   * or approximate. If provided, the coordinator or UI systems can use it for layout.
   */
  measureText?(
    text: string,
    material: RenderMaterialId
  ): { width: number; actualAscent?: number; actualDescent?: number };

  /**
   * Convenience conversions using the same math as beginPass(world):
   * Keep these here if you want easy HUD anchoring from modules; otherwise
   * move them to a Camera utility port.
   */
  toScreen?(worldPoint: Vec2, cam: Camera2D): Vec2;
  toWorld?(screenPoint: Vec2, cam: Camera2D): Vec2;
}
