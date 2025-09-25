import type { ServiceToken } from './Token';
import type { TimeService, AssetService, Services, ServicesView } from './Types';

export function createServices(): Services {
  const bag = new Map<symbol, unknown>();

  const get = <T>(t: ServiceToken<T>) => bag.get(t.key) as T | undefined;
  const set = <T>(t: ServiceToken<T>, v: T) => { bag.set(t.key, v); };
  const has = <T>(t: ServiceToken<T>) => bag.has(t.key);
  const getOrThrow = <T>(t: ServiceToken<T>) => {
    const v = get(t);
    if (!v) throw new Error(`Missing service: ${String(t.key.description ?? 'unknown')}`);
    return v;
  };

  const time = createTime(1/60);
  const assets = createAssets();
  const rng = () => Math.random();

  function view(whitelist: ReadonlyArray<ServiceToken<any>>): ServicesView {
    const allowed = new Set(whitelist.map(w => w.key));

    const guard = <T>(t: ServiceToken<T>) => {
      if (!allowed.has(t.key)) return undefined;
      return get(t);
    };

    const guardOrThrow = <T>(t: ServiceToken<T>) => {
      if (!allowed.has(t.key)) {
        throw new Error(`Unauthorized service access: ${String(t.key.description ?? 'unknown')}`);
      }
      return getOrThrow(t);
    };

    const hasGuarded = <T>(t: ServiceToken<T>) => allowed.has(t.key) && has(t);

    return {
      time,
      assets,
      rng,
      get: guard,
      getOrThrow: guardOrThrow,
      has: hasGuarded,
    };
  }

  return {
    time,
    assets,
    rng,
    get,
    getOrThrow,
    set,
    has,
    view,
  };
}

export function createTime(fixedStep: number): TimeService {
  return { now: () => performance.now(), fixedStep, accumulator: 0 };
}

export function createAssets(): AssetService {
  const images = new Map<string, HTMLImageElement>();
  return {
    async loadImage(key, url) {
      const img = new Image();
      img.src = url;
      await img.decode();
      images.set(key, img);
      return img;
    },
    getImage(key) {
      return images.get(key);
    }
  };
}
