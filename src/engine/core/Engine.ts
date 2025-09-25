// src/engine/core/Engine.ts
import { createEventBus } from './EventBus';
import { createServices } from './Services';
import type { EngineConfig, Module, GameInitContext, GameContext } from './Types';
import type { ServiceToken } from './Token';

export class Engine {
  private modules: Module[] = [];

  // Full context for init() only (has full Services)
  private initCtx: GameInitContext;

  // Per-module scoped contexts used after init() (ServicesView only)
  private moduleCtxs: ReadonlyArray<GameContext> = [];

  private running = false;
  private last = 0;

  private resolveWhitelist: (m: Module) => ReadonlyArray<ServiceToken<any>>;

  constructor(
    config: EngineConfig,
    opts?: { resolveWhitelist?: (m: Module) => ReadonlyArray<ServiceToken<any>> }
  ) {
    const bus = createEventBus();
    const services = createServices();
    this.initCtx = { config, bus, services };
    this.resolveWhitelist = opts?.resolveWhitelist ?? (() => []);

    // Broadcast using scoped contexts after init()
    const origEmit = bus.emit.bind(bus);
    bus.emit = (e) => {
      origEmit(e);
      for (let i = 0; i < this.modules.length; i++) {
        const m = this.modules[i];
        const ctx = this.moduleCtxs[i] ?? toRunCtx(this.initCtx, this.initCtx.services.view([]));
        try { m.onEvent?.(ctx, e); } catch (err) {
          console.error(`Error in module ${m.id} handling event`, e, err);
        }
      }
    };
  }

  add(module: Module) { this.modules.push(module); return this; }

  async init() {
    // Full access so modules can register services/tokens.
    for (const m of this.modules) await m.init?.(this.initCtx);

    // Build one scoped context per module (reuses config & bus by reference).
    this.moduleCtxs = Object.freeze(
      this.modules.map((m) =>
        toRunCtx(this.initCtx, this.initCtx.services.view(this.resolveWhitelist(m)))
      )
    );
  }

  async start() {
    for (let i = 0; i < this.modules.length; i++) {
      await this.modules[i].start?.(this.moduleCtxs[i]);
    }
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (t: number) => {
    if (!this.running) return;
    const time = this.initCtx.services.time;
    const dtMs = t - this.last; this.last = t;
    time.accumulator += dtMs / 1000;

    while (time.accumulator >= time.fixedStep) {
      for (let i = 0; i < this.modules.length; i++) {
        this.modules[i].update?.(this.moduleCtxs[i], time.fixedStep);
      }
      time.accumulator -= time.fixedStep;
    }

    const alpha = time.accumulator / time.fixedStep;
    for (let i = 0; i < this.modules.length; i++) {
      this.modules[i].render?.(this.moduleCtxs[i], alpha);
    }

    requestAnimationFrame(this.frame);
  };

  stop() {
    this.running = false;
    this.modules.forEach(m => m.destroy?.());
  }

  /** If you expose this, keep its type explicit: full init context. */
  get context(): GameInitContext { return this.initCtx; }
}

/** Share config/bus by reference; swap in a per-module ServicesView. */
function toRunCtx(root: GameInitContext, view: ReturnType<typeof root.services.view>): GameContext {
  const ctx = {
    get config() { return root.config; },
    get bus() { return root.bus; },
    services: view,
  } as GameContext;
  return Object.freeze(ctx);
}
