import type { ServiceToken } from './Token'
import type { TimeService, AssetService, Services } from './Types'

/**
 * Create a new, empty service registry.
 * @returns A new service registry.
 */
export function createServices(): Services {
  const bag = new Map<symbol, unknown>()

  const get = <T>(t: ServiceToken<T>) => bag.get(t.key) as T | undefined
  const set = <T>(t: ServiceToken<T>, v: T) => { bag.set(t.key, v) }
  const has = <T>(t: ServiceToken<T>) => bag.has(t.key)
  const getOrThrow = <T>(t: ServiceToken<T>) => {
    const v = get(t); if (!v) throw new Error(`Missing service: ${String(t.key.description ?? 'unknown')}`)
    return v
  }

  return {
    time: createTime(1/60),
    assets: createAssets(),
    rng: () => Math.random(),
    get, getOrThrow, set, has,
  }
}

/**
 * Create a timekeeping service.
 * @param fixedStep - Fixed step size in seconds (e.g., 1/60).
 * @returns A timekeeping service.
 */
export function createTime(fixedStep: number): TimeService {
  return { now: () => performance.now(), fixedStep, accumulator: 0 }
}

/**
 * Create an asset management service.
 * @returns An asset management service.
 */
export function createAssets(): AssetService {
  const images = new Map<string, HTMLImageElement>()
  return {
    async loadImage(key, url) {
      const img = new Image()
      img.src = url
      await img.decode()
      images.set(key, img)
      return img
    },
    getImage(key) {
      return images.get(key)
    }
  }
}
