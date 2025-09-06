// SpriteSheet.ts
// Minimal, renderer-agnostic spritesheet description + helper loader.

/**
 * Describes a single rectangular frame within a spritesheet image.
 *
 * @remarks
 * - Coordinates are expressed in pixels relative to the top-left of the source image.
 * - If {@link Frame.duration} is provided, it takes precedence over a clip's FPS
 *   when determining the time a frame is displayed.
 */
export type Frame = {
  /**
   * Source rectangle in the spritesheet image.
   *
   * @remarks
   * `{ x, y }` specify the top-left corner; `{ w, h }` specify the width and height.
   */
  x: number; y: number; w: number; h: number
  /**
   * Optional per-frame duration in seconds.
   *
   * @remarks
   * When set, this overrides the clip's {@link Clip.fps} for this frame only.
   */
  duration?: number
}

/**
 * A named animation clip that references a sequence of frames.
 *
 * @example
 * ```ts
 * const walk: Clip = {
 *   name: 'walk',
 *   frames: [0, 1, 2, 3],
 *   fps: 10,
 *   loop: true,
 *   pingpong: false,
 * }
 * ```
 *
 * @remarks
 * - {@link Clip.frames} contains indices into {@link SpriteSheet.frames}.
 * - If some {@link Frame}s specify {@link Frame.duration}, those values override
 *   {@link Clip.fps} on a per-frame basis.
 * - {@link Clip.pingpong} plays frames forward then backward (e.g., `0..N..0..N`).
 */
export type Clip = {
  /**
   * Human-readable identifier (for example, `"idle"`, `"walk"`).
   */
  name: string
  /**
   * Sequence of indices into {@link SpriteSheet.frames} forming the clip timeline.
   */
  frames: number[]
  /**
   * Default playback rate in frames per second (FPS).
   *
   * @remarks
   * Optional if frames provide explicit {@link Frame.duration} values.
   */
  fps?: number
  /**
   * Whether playback should loop upon reaching the end.
   *
   * @defaultValue true
   */
  loop?: boolean
  /**
   * Whether playback should bounce at the ends (`0..N..0..N`).
   *
   * @defaultValue false
   */
  pingpong?: boolean
}

/**
 * Container describing a spritesheet atlas: all frames plus named clips.
 *
 * @remarks
 * - This structure is renderer-agnostic and can be used with any drawing API.
 * - Frame indices used by {@link Clip.frames} must be valid indices into `frames`.
 */
export type SpriteSheet = {
  /**
   * All frames contained in the spritesheet image.
   */
  frames: Frame[]
  /**
   * Named clips that reference frames by index.
   */
  clips: Record<string, Clip>
}

/**
 * Loads a JSON spritesheet atlas from a URL and returns it as a {@link SpriteSheet}.
 *
 * @param url - The URL pointing to a JSON document matching the types defined here.
 * @returns A promise that resolves to the parsed {@link SpriteSheet}.
 *
 * @throws {Error} If the network request fails or the response is not OK (non-2xx).
 *
 * @example
 * ```ts
 * const sheet = await loadSpriteSheet('/assets/hero.sheet.json')
 * console.log(sheet.frames.length, Object.keys(sheet.clips))
 * ```
 *
 * @remarks
 * - This helper is kept separate from any rendering code to keep engines lightweight.
 * - The function trusts the remote JSON to conform to the {@link SpriteSheet} schema;
 *   additional validation may be desirable in production.
 */
export async function loadSpriteSheet(url: string): Promise<SpriteSheet> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load spritesheet: ${url}`)
  const json = (await res.json()) as SpriteSheet
  return json
}
