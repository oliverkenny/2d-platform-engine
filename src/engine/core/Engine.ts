import { createEventBus } from './EventBus'
import { createServices } from './Services'
import type { EngineConfig, Module, GameContext } from './Types'

/**
 * Core game engine.
 *
 * @remarks
 * The engine owns a fixed-step update loop and a free render pass.
 * Modules are added via {@link Engine.add} and communicate using the
 * {@link GameContext.bus | event bus} and {@link GameContext.services | service registry}.
 *
 * @example
 * ```ts
 * const engine = new Engine({ width: 800, height: 600, mount })
 *   .add(RendererCanvas())
 *   .add(MyModule());
 * await engine.init();
 * await engine.start();
 * ```
 */
export class Engine {
  /** Registered modules in call order for update/render. */
  private modules: Module[] = []

  /** Shared context passed to all module hooks. */
  private ctx: GameContext

  /** Engine loop running flag. */
  private running = false

  /** Timestamp of previous frame (ms, from performance.now). */
  private last = 0

  /**
   * Create a new engine instance.
   *
   * @param config - Canvas size, target FPS, and mounting options.
   */
  constructor(config: EngineConfig) {
    const bus = createEventBus()
    const services = createServices()
    this.ctx = { config, bus, services }

    // Broadcast bus events to all modules via onEvent()
    const origEmit = bus.emit.bind(bus)
    bus.emit = (e) => {
      origEmit(e);
      for (const m of this.modules) {
        try {
          m.onEvent?.(this.ctx, e)
        } catch (err) {
          console.error(`Error in module ${m.id} handling event`, e, err)
        }
      }
    }
  }

  /**
   * Add a module (plugin) to the engine.
   *
   * @remarks
   * Modules should have no cross-imports; they should communicate via the event bus
   * and services. Order can matter if modules rely on earlier services being registered
   * during {@link Module.init | init()}.
   *
   * @param module - The module to register.
   * @returns The engine (for chaining).
   */
  add(module: Module) {
    this.modules.push(module)
    return this
  }

  /**
   * Initialize all modules.
   *
   * @remarks
   * Called once before {@link Engine.start}. Use this to register services
   * and subscribe to events. Avoid heavy asset loading here.
   */
  async init() {
    for (const m of this.modules) {
      await m.init?.(this.ctx)
    }
  }

  /**
   * Start the engine loop.
   *
   * @remarks
   * Calls each module's {@link Module.start | start()} first (good place to load assets),
   * then begins the fixed-step update loop with a render pass.
   *
   * @example
   * ```ts
   * await engine.init();
   * await engine.start();
   * ```
   */
  async start() {
    for (const m of this.modules) {
      await m.start?.(this.ctx)
    }
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.frame)
  }

  /**
   * Per-frame callback (internal).
   * @param t - Current timestamp from rAF.
   * @internal
   */
  private frame = (t: number) => {
    if (!this.running) return
    const time = this.ctx.services.time
    const dtMs = t - this.last; this.last = t
    time.accumulator += dtMs / 1000

    // Fixed-step updates
    while (time.accumulator >= time.fixedStep) {
      for (const m of this.modules) m.update?.(this.ctx, time.fixedStep)
      time.accumulator -= time.fixedStep
    }

    const alpha = time.accumulator / time.fixedStep
    for (const m of this.modules) m.render?.(this.ctx, alpha)

    requestAnimationFrame(this.frame)
  }

  /**
   * Stop the engine and dispose all modules.
   *
   * @remarks
   * Calls each module's {@link Module.destroy | destroy()} if present.
   */
  stop() {
    this.running = false
    this.modules.forEach(m => m.destroy?.())
  }

  /**
   * The live game context (config, event bus, services).
   *
   * @readonly
   */
  get context(): GameContext { return this.ctx }
}
