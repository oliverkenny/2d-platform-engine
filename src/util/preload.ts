import type { GameContext } from '../engine/core/Types'

/**
 * Image manifest: keys are asset IDs, values are URLs.
 * Used by {@link PreloadImages}.
 * @example
 * ```ts
 * const manifest: ImageManifest = {
 * 'player': '/assets/player.png',
 * 'enemy': '/assets/enemy.png',
 * 'background': '/assets/bg.jpg'
 * }
 * await PreloadImages(ctx, manifest, (loaded, total) => {
 *   console.log(`Loaded ${loaded}/${total} images`)
 * })
 * ```
 */
export type ImageManifest = Record<string, string>

/**
 * Preload a batch of images in parallel using the engine's AssetService.
 * Reports progress (0..1) via a callback and resolves when all succeed.
 * If any fail, it throws with an aggregated error.
 * @param ctx - Game context with AssetService.
 * @param manifest - Image manifest mapping keys to URLs.
 * @param onProgress - Optional callback receiving (loaded, total) counts.
 */
export async function PreloadImages(
  ctx: GameContext,
  manifest: ImageManifest,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const entries = Object.entries(manifest)
  const total = entries.length
  if (total === 0) return

  let loaded = 0
  const bump = () => onProgress?.(++loaded, total)

  const tasks = entries.map(async ([key, url]) => {
    await ctx.services.assets.loadImage(key, url)
    bump()
  })
  
  const results = await Promise.allSettled(tasks)
  const errs = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
  if (errs.length) {
    const msg = errs.map(e => e.reason?.toString?.() ?? 'unknown error').join('; ')
    throw new Error(`Failed to load ${errs.length} of ${total} images: ${msg}`)
  }
}
