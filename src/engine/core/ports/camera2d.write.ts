import type { Camera2D, Vec2 } from "../primitives"

export interface Camera2DWritePort {
  /** Patch fields atomically; notifies subscribers if something changed. */
  set(patch: Partial<Camera2D>): void

  /** Replace camera entirely. */
  replace(next: Camera2D): void

  /** Subscribe to camera changes. Returns an unsubscribe fn. */
  onChange(fn: (cam: Readonly<Camera2D>) => void): () => void

  /** Convenience: soft-follow a target (good for platformers). Call each frame. */
  follow(target: Vec2, opts?: {
    /** 0..1 lerp factor per frame; 0.1 = slow, 0.25 = snappier */
    lerp?: number
    /** Optional deadzone extents in world meters: half-width/half-height */
    deadzoneHalf?: Vec2
  }): void

  /** Quick camera shake (duration/strength in world meters). */
  shake?(durationMs: number, strength: number): void
}