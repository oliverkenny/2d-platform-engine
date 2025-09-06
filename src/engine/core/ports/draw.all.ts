import { Colour, Vec2, Camera2D } from '../primitives'
import { SpriteOptions } from '../Types'

/**
 * DrawServicePort
 * -----------------------------------------------------------------------------
 * A renderer-agnostic 2D drawing API that supports two coordinate spaces:
 *
 * 1) UI / Screen Space (pixels, y-down)
 *    - Origin at the top-left of the canvas.
 *    - Units are pixels. Positive y goes down.
 *    - Use for HUD, menus, debug overlays, etc.
 *
 * 2) World Space (Rapier world, meters, y-up)
 *    - Origin/axes defined by your simulation (Rapier). Units are meters.
 *    - Positive y goes UP (canvas is flipped internally).
 *    - Camera controls the viewport (position, rotation, zoom, pixels-per-meter).
 *
 * The API exposes two *scoped* entry points for drawing into each space:
 *   - `toUi(fn)`     -> draw in pixel space (y-down).
 *   - `toWorld(cam, fn)` -> draw in world space (meters, y-up) using a camera.
 *
 * Inside either scope, the regular drawing methods (`rect`, `text`, `sprite`) are
 * **unit-aware**:
 *   - In `toWorld(...)`, sizes/positions are in meters; angles are radians CCW.
 *   - In `toUi(...)` (or outside any scope), sizes/positions are in pixels.
 *
 * The service also offers point conversion helpers:
 *   - `toScreen(worldPoint, cam)` : Vec2   // world (m) -> screen (px)
 *   - `toWorld(screenPoint, cam)` : Vec2   // screen (px) -> world (m)
 *
 * Notes for implementers:
 * - `toWorld` and `toUi` MUST use a temporary transform via `ctx.save()/restore()`.
 * - `toWorld` should:
 *     1) center to canvas midpoint,
 *     2) scale by (cam.ppm * cam.zoom) and flip Y (scaleY = -...),
 *     3) rotate by -cam.rotation,
 *     4) translate by -cam.position.
 * - `toUi` should reset to identity (pixel space, y-down).
 * - Converters MUST use the exact same transform matrix used by `toWorld`.
 * - Implement `toWorld` as an overloaded method: (cam, fn) scope **and** (point, cam) -> Vec2
 *   to support the ergonomic `draw.toWorld(...)` naming without ambiguity.
 */
export interface DrawServicePort {
  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  /**
   * Clear the entire render target for a new frame.
   * Implementation typically uses `clearRect(0,0,width,height)`.
   */
  clear(): void

  // ---------------------------------------------------------------------------
  // Core drawing (unit-aware inside scopes)
  // ---------------------------------------------------------------------------

  /**
   * Fill a rectangle at `(x, y)` with size `(w, h)`.
   *
   * Units & orientation:
   * - In `toUi(...)`: x,y,w,h are in **pixels**, origin top-left, y-down.
   * - In `toWorld(...)`: x,y,w,h are in **meters** (Rapier world), y-up.
   */
  rect(x: number, y: number, w: number, h: number, color?: Colour): void

  /**
   * Draw text at `(x, y)`.
   *
   * Units & orientation:
   * - In `toUi(...)`: pixel coordinates.
   * - In `toWorld(...)`: world meters (text will be scaled/rotated by camera).
   *
   * Tip: For HUD text, prefer `toUi(...)` so font size is stable in pixels.
   */
  text(msg: string, x: number, y: number, color?: Colour): void

  /**
   * Draw a sprite image (optionally a source sub-rect) at `(x, y)` with an
   * optional origin, scale, rotation, and alpha.
   *
   * Units & orientation:
   * - In `toUi(...)`: `(x,y)` and sizes are **pixels**; rotation in radians CCW.
   * - In `toWorld(...)`: `(x,y)` and destination sizes are **meters**; rotation in radians CCW.
   *
   * Important: If you provide `sw/sh` (source width/height), they are *source pixels*.
   * Destination size follows the active space (pixels in UI, meters in World),
   * factoring in any `scaleX/scaleY`.
   */
  sprite(img: HTMLImageElement, x: number, y: number, opts?: SpriteOptions): void

  // ---------------------------------------------------------------------------
  // Space / Layer scopes
  // ---------------------------------------------------------------------------

  /**
   * Draw into **World Space** (Rapier meters, y-up) using the given camera.
   *
   * The implementation MUST:
   * - wrap `drawFn` in a temporary canvas state (`save/restore`),
   * - apply the camera transform (center, scale+flip Y, rotate, translate),
   * - restore the previous state after `drawFn` returns, even if it throws.
   *
   * Example:
   *   draw.toWorld(camera, () => {
   *     // 1m x 1m box centered at a Rapier body:
   *     draw.rect(body.x - 0.5, body.y - 0.5, 1, 1)
   *   })
   */
  toWorld(cam: Camera2D, drawFn: () => void): void

  /**
   * Draw into **UI / Screen Space** (pixels, y-down).
   *
   * The implementation MUST:
   * - wrap `drawFn` in `save/restore`,
   * - reset transform to identity so coordinates are pixels.
   *
   * Example:
   *   draw.toUi(() => {
   *     draw.text(`Score: ${score}`, 12, 20)
   *   })
   */
  toUi(drawFn: () => void): void

  // ---------------------------------------------------------------------------
  // Point conversion helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a **world-space** point (meters, y-up) into **screen-space** (pixels, y-down)
   * using the same camera transform as `toWorld`.
   *
   * Typical use: anchoring UI to a world object, debugging gizmos, etc.
   *
   * Example:
   *   const screen = draw.toScreen(player.position, camera)
   *   draw.toUi(() => draw.text("Player", screen.x, screen.y - 8))
   */
  toScreen(worldPoint: Vec2, cam: Camera2D): Vec2

  /**
   * OVERLOAD 1 — Point conversion:
   * Convert a **screen-space** point (pixels, y-down) to **world-space** (meters, y-up)
   * using the inverse of the `toWorld` camera transform.
   *
   * Typical use: mouse picking, spawning at mouse, ray-casting from cursor, etc.
   *
   * Example:
   *   const world = draw.toWorld({ x: mouseX, y: mouseY }, camera)
   *   worldBody.setTranslation(world)
   */
  toWorld(screenPoint: Vec2, cam: Camera2D): Vec2

  /**
   * OVERLOAD 2 — Scoped drawing in world space (see above).
   * (This overload is repeated here to make the interface overload explicit.)
   */
  toWorld(cam: Camera2D, drawFn: () => void): void
}
