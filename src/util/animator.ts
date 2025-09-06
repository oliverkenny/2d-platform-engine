import type { SpriteSheet, Clip, Frame } from './spritesheet'

/**
 * Simple, render-agnostic sprite animator that manages frame timing and clip switching.
 *
 * The animator does **not** draw anything itself; it simply determines which frame
 * of a {@link SpriteSheet} should be shown at any given time and exposes the current
 * frame and a convenient source rectangle.
 *
 * @example
 * ```ts
 * const animator = new Animator(spriteSheet, 'idle')
 * // advance by the frame's delta time in seconds
 * animator.update(deltaTime)
 * // use with your renderer of choice
 * draw.sprite(animator.sourceRect, x, y)
 * ```
 *
 * @remarks
 * - Timing is driven by calls to {@link Animator.update}. If you stop calling it,
 *   the animation pauses.
 * - Clip lookups are by name and must exist on the provided {@link SpriteSheet}.
 * - Per-frame durations (if present on {@link Frame.duration}) override the clip FPS.
 * - Ping-pong playback reverses direction at the ends of the sequence.
 */
export class Animator {
  /**
   * The sprite sheet that provides frames and clip metadata used by this animator.
   *
   * @readonly
   */
  readonly sheet: SpriteSheet

  /** @internal Current clip definition (normalised). */
  private _clip: Clip
  /** @internal Accumulated time, in seconds, within the current frame/clip. */
  private _time = 0 // seconds within the clip
  /** @internal Current frame index within the clip's frame sequence. */
  private _index = 0 // current frame index within the clip's sequence
  /** @internal Direction of travel for ping-pong playback: +1 forward, −1 backward. */
  private _dir = 1 // for ping-pong: +1 forward, -1 backward
  /** @internal Whether the current non-looping clip has finished. */
  private _finished = false

  /**
   * Creates a new animator bound to a sprite sheet and initial clip.
   *
   * @param sheet - The {@link SpriteSheet} containing frames and clips.
   * @param clipName - The name of the clip to start playing immediately.
   *
   * @throws {Error} If the specified `clipName` does not exist on the sheet.
   */
  constructor(sheet: SpriteSheet, clipName: string) {
    this.sheet = sheet
    const clip = sheet.clips[clipName]
    if (!clip) throw new Error(`Clip not found: ${clipName}`)
    this._clip = normalizeClip(clip)
  }

  /**
   * The name of the currently active clip.
   *
   * @remarks
   * This is derived from the internal clip definition and reflects the last clip
   * supplied to the constructor or {@link Animator.play}.
   */
  get clip(): string { return this._clip.name }

  /**
   * Indicates whether a non-looping clip has reached its end.
   *
   * @remarks
   * - Returns `false` for looping clips.
   * - Becomes `true` once a non-looping clip completes; remains `true` until a new
   *   clip is played via {@link Animator.play}.
   */
  get finished(): boolean { return this._finished }

  /**
   * The current {@link Frame} selected by the animator.
   *
   * @remarks
   * Use this to access exact source coordinates or other frame metadata.
   */
  get frame(): Frame { return this.sheet.frames[this._clip.frames[this._index]] }

  /**
   * Convenience getter returning a source rectangle compatible with typical
   * rendering APIs (e.g., `drawImage`-style functions).
   *
   * @returns An object with `{ sx, sy, sw, sh }` describing the source sub-rectangle.
   */
  get sourceRect() {
    const f = this.frame
    return { sx: f.x, sy: f.y, sw: f.w, sh: f.h }
  }

  /**
   * Switches to another clip and optionally resets progress.
   *
   * @param clipName - The name of the target clip on {@link SpriteSheet.clips}.
   * @param reset - Whether to reset time and frame index to the start of the new clip.
   * Default is `true`.
   *
   * @throws {Error} If the specified `clipName` does not exist on the sheet.
   *
   * @remarks
   * - Always resets playback direction to forward.
   * - Clears {@link Animator.finished} so the new clip can play to completion.
   */
  play(clipName: string, reset = true) {
    const clip = this.sheet.clips[clipName]
    if (!clip) throw new Error(`Clip not found: ${clipName}`)
    this._clip = normalizeClip(clip)
    this._dir = 1
    this._finished = false
    if (reset) {
      this._time = 0
      this._index = 0
    }
  }

  /**
   * Advances the animation by a given number of seconds.
   *
   * @param dt - Delta time in seconds since the last update. Must be non-negative.
   *
   * @remarks
   * - If {@link Animator.finished} is `true`, the call is a no-op.
   * - This method will internally step through as many frames as required to
   *   account for the elapsed time, preserving any leftover fractional time.
   */
  update(dt: number) {
    if (this._finished) return

    this._time += dt

    // Advance as many frames as elapsed time allows
    while (this._time >= this.frameDuration(this._index)) {
      this._time -= this.frameDuration(this._index)
      this.step()
      if (this._finished) break
    }
  }

  /**
   * @internal
   * Moves the frame index forward based on the clip's playback mode
   * (forwards, looping, or ping-pong), updating {@link Animator.finished} when a
   * non-looping sequence ends.
   */
  private step() {
    const last = this._clip.frames.length - 1
    if (this._clip.pingpong) {
      // bounce: 0..last..0..last...
      if ((this._dir > 0 && this._index >= last) || (this._dir < 0 && this._index <= 0)) {
        this._dir *= -1
        // If at edge, step once in the opposite direction (avoid staying on edge twice)
        this._index = clamp(this._index + this._dir, 0, last)
        if (!this._clip.loop && ((this._dir < 0 && this._index <= 0) || (this._dir > 0 && this._index >= last))) {
          this._finished = true
        }
        return
      }
      this._index = clamp(this._index + this._dir, 0, last)
    } else {
      if (this._index >= last) {
        if (this._clip.loop) {
          this._index = 0
        } else {
          this._finished = true
        }
      } else {
        this._index++
      }
    }
  }

  /**
   * Computes the duration, in seconds, that the given frame index should be shown.
   *
   * @param i - The index within the current clip's frame sequence.
   * @returns The frame duration in seconds.
   *
   * @remarks
   * - If the referenced {@link Frame} provides an explicit `duration`, it is used.
   * - Otherwise, the duration is derived from the clip's frames-per-second (FPS),
   *   defaulting to 12 FPS when unspecified.
   */
  private frameDuration(i: number): number {
    const f = this.sheet.frames[this._clip.frames[i]]
    if (f.duration != null) return f.duration
    const fps = this._clip.fps ?? 12
    return 1 / fps
  }
}

// Helpers

/**
 * Clamps a number to the inclusive range `[a, b]`.
 *
 * @param n - The number to clamp.
 * @param a - The lower bound (inclusive).
 * @param b - The upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)) }

/**
 * Produces a normalised {@link Clip} with defaulted optional properties.
 *
 * @param clip - The clip to normalise.
 * @returns A new {@link Clip} containing the original values with defaults applied:
 * - `fps` defaults to `12`
 * - `loop` defaults to `true`
 * - `pingpong` defaults to `false`
 */
function normalizeClip(clip: Clip): Clip {
  return {
    name: clip.name,
    frames: clip.frames,
    fps: clip.fps ?? 12,
    loop: clip.loop ?? true,
    pingpong: clip.pingpong ?? false,
  }
}
