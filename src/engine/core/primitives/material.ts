/**
 * Physical and collision material parameters bound to a shape/fixture.
 * @remarks
 * - `density` contributes to mass (dynamic bodies only). Set 0 (or omit) for massless fixtures.
 * - `friction` is Coulomb friction coefficient in [0,1] (values > 1 are allowed in some engines but clamped here by convention).
 * - `restitution` controls bounciness [0,1].
 * - `isSensor` triggers contact events but does not produce collision response.
 * - Filtering uses classic Box2D-like `categoryBits`/`maskBits`/`groupIndex`.
 */
export interface Material {
  /** Mass per unit area (kg/m²) for 2D. Default: engine-chosen (often 1). */
  density?: number;
  /** Surface friction coefficient. Default: engine-chosen (often 0.5). */
  friction?: number;
  /** Coefficient of restitution (bounciness). Default: 0. */
  restitution?: number;
  /** If true, this fixture generates contacts but no collision impulses. Default: false. */
  isSensor?: boolean;
  /** Category bitfield (1..0x8000). Default: 0x0001. */
  categoryBits?: number;
  /** Mask bitfield determining which categories this collides with. Default: 0xFFFF. */
  maskBits?: number;
  /**
   * Event subscription for this shape’s collider.
   * - "none": no events
   * - "contacts": rigid contact events only
   * - "intersections": sensor/intersection events only
   * - "all": both (default)
   */
  events?: "none" | "contacts" | "intersections" | "all";
}