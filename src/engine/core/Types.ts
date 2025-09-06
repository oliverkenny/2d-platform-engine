import { DrawServicePort } from './ports/draw.all'
import { BodyId, Camera2D, Space } from './primitives'
import type { ServiceToken } from './Token'

/**
 * Common engine contracts for modules to depend on.
 * @packageDocumentation
 */

/**
 * Runtime configuration for the engine and canvas mounting.
 */
export type EngineConfig = {
  /**
   * Logical canvas width in pixels.
   * Modules should use this (not `clientWidth`) for simulation bounds.
   */
  width: number

  /**
   * Logical canvas height in pixels.
   * Modules should use this (not `clientHeight`) for simulation bounds.
   */
  height: number

  /**
   * Target frames per second for the simulation/render loop.
   * @remarks
   * The engine uses a fixed-step update (`time.fixedStep`) and
   * may run multiple updates per animation frame to catch up.
   * This value is advisory; browsers schedule actual frames.
   */
  targetFPS?: number

  /**
   * Optional existing canvas to render into.
   * If omitted, the renderer module may create/append one.
   */
  canvas?: HTMLCanvasElement

  /**
   * Optional DOM element to mount a created canvas into.
   * Ignored if `canvas` is provided.
   */
  mount?: HTMLElement
}

/**
 * Contract for all engine modules (plugins).
 *
 * @remarks
 * A module is a self-contained feature (renderer, audio, input, AI, UI, etc.)
 * that communicates via the {@link EventBus} and {@link Services} registry.
 * The engine drives the lifecycle in this order:
 *
 * 1. `init(ctx)`   — register services, subscribe to events (once).
 * 2. `start(ctx)`  — load assets / reset state (once, before the loop).
 * 3. `update(ctx)` — fixed-step simulation tick (0..n times per frame).
 * 4. `render(ctx)` — draw current state (once per frame).
 * 5. `destroy()`   — cleanup on shutdown.
 *
 * Implement only the hooks you need.
 */
export interface Module {
  /**
   * Unique, namespaced identifier (e.g. `"renderer/canvas"`, `"audio/webaudio"`).
   * Helpful for debugging and telemetry.
   */
  id: string

  /**
   * Called once after the module is added, before `start()`.
   *
   * @remarks
   * Use this to:
   * - Register services: `ctx.services.set('my/service', api)`
   * - Subscribe to events: `ctx.bus.on('level/loaded', ...)`
   * Avoid heavy network/asset work here; prefer `start()`.
   */
  init?(ctx: GameContext): Promise<void> | void

  /**
   * Called once when the engine starts.
   *
   * @remarks
   * Good place for asset loading and per-session initialization.
   * Runs after all modules' `init()` have completed.
   */
  start?(ctx: GameContext): Promise<void> | void

  /**
   * Fixed-step simulation update.
   *
   * @param ctx - Engine context (config, event bus, services).
   * @param dt - Delta time in **seconds** (e.g. `1/60`).
   *
   * @remarks
   * Deterministic logic should live here (movement, physics, AI).
   * May run 0..n times per animation frame depending on timing.
   */
  update?(ctx: GameContext, dt: number): void

  /**
   * Render pass, called once per animation frame after all pending updates.
   *
   * @param ctx - Engine context.
   * @param alpha - Interpolation factor in [0..1] between the last completed
   * update and the next; use for smooth visual interpolation.
   *
   * @remarks
   * Do not mutate simulation state here—keep it to drawing only.
   */
  render?(ctx: GameContext, alpha: number): void

  /**
   * Optional centralized event handler.
   *
   * @remarks
   * If you prefer, you can subscribe in `init()` with `ctx.bus.on(...)` instead.
   * This hook is called by the engine when events are emitted.
   */
  onEvent?(ctx: GameContext, event: GameEvent): void

  /**
   * Cleanup hook invoked when the engine stops.
   * Unsubscribe listeners, release audio/graphics resources, etc.
   */
  destroy?(): void
}

/**
 * Minimal, documented event set.
 * @remarks
 * Prefer short, flat, namespaced `type` strings. Extend this union in your project as needed.
 */
export type GameEvent =
  /**
   * DOM key pressed (keydown) translated into a game event.
   * - `key`: The KeyboardEvent `key` value (e.g., `"ArrowUp"`, `"a"`).
   */
  | { type: 'input/keydown'; key: string }
  /**
   * DOM key released (keyup) translated into a game event.
   * - `key`: The KeyboardEvent `key` value (e.g., `"ArrowUp"`, `"a"`).
   */
  | { type: 'input/keyup'; key: string }
  /**
   * A level has been loaded and is ready.
   * - `name`: Logical level name or identifier.
   */
  | { type: 'level/loaded'; name: string }
  /**
   * Request to play a sound via the audio system.
   * - `sound`: Asset key for an audio buffer/clip.
   * - `loop`: Play in a loop (default: `false`).
   * - `volume`: Linear volume 0..1 (module may clamp).
   */
  | { type: 'audio/play'; sound: string; loop?: boolean; volume?: number }
  /**
   * The render surface has been resized.
   * - `width`: New logical width.
   * - `height`: New logical height.
   */
  | { type: 'render/resize'; width: number; height: number }
  /**
   * Collision started event from the physics system.
   * - `bodyA`: ID of the first body.
   * - `bodyB`: ID of the second body.
   */
  | { type: 'physics/collisionStart'; bodyA: number; bodyB: number }
  /**
   * Collision ended event from the physics system.
   * - `bodyA`: ID of the first body.
   * - `bodyB`: ID of the second body.
   */
  | { type: 'physics/collisionEnd'; bodyA: number; bodyB: number }
  /**
   * Register a debug panel to appear in the debug overlay.
   * - `panel`: The panel definition.
   */
  | { type: 'debug/panel/register'; panel: DebugPanel }
  /**
   * Unregister a debug panel by ID.
   * - `id`: The panel ID to remove.
   */
  | { type: 'debug/panel/unregister'; id: PanelId }

/**
 * Typed publish/subscribe event bus shared by all modules.
 */
export interface EventBus {
  /**
   * Emit a game event to all current subscribers of the event's `type`.
   */
  emit(ev: GameEvent): void

  /**
   * Subscribe to a specific event `type`.
   *
   * @typeParam T - Discriminant string from {@link GameEvent} `type`.
   * @param type - The event `type` to listen for.
   * @param handler - Callback invoked with the event payload.
   * @returns Function to unsubscribe the handler.
   *
   * @example
   * ```ts
   * const off = ctx.bus.on('input/keydown', e => console.log(e.key));
   * // later
   * off();
   * ```
   */
  on<T extends GameEvent['type']>(
    type: T,
    handler: (e: Extract<GameEvent, { type: T }>) => void
  ): () => void
}

/**
 * Timekeeping utilities used by the engine loop.
 */
export interface TimeService {
  /**
   * Monotonic timestamp in milliseconds (typically `performance.now()`).
   */
  now(): number

  /**
   * Fixed update step in seconds (e.g., `1/60`).
   * Controls the cadence of {@link Module.update}.
   */
  fixedStep: number

  /**
   * Accumulator of leftover fractional seconds carried between frames.
   * Advanced by the engine and consumed by fixed-step updates.
   */
  accumulator: number
}

/**
 * Minimal asset loader/lookup service.
 * @remarks
 * Keep the core slim; audio and other asset types can be provided by modules.
 */
export interface AssetService {
  /**
   * Load an image and register it under the provided key.
   * @param key - Unique asset key.
   * @param url - Image URL (relative or absolute).
   * @returns The decoded `HTMLImageElement`.
   */
  loadImage(key: string, url: string): Promise<HTMLImageElement>

  /**
   * Retrieve a previously loaded image by key.
   * @param key - Asset key.
   * @returns The image or `undefined`.
   */
  getImage(key: string): HTMLImageElement | undefined
}

/**
 * Shared service registry available to all modules.
 * @remarks
 * Use this to expose cross-cutting APIs (renderer draw API, physics, pathfinding, etc.).
 * Consumers should depend on the **interface** they read from the registry, not on a
 * concrete module implementation.
 */
export interface Services {
  time: TimeService
  assets: AssetService
  rng: () => number

  get<T>(token: ServiceToken<T>): T | undefined
  getOrThrow<T>(token: ServiceToken<T>): T
  set<T>(token: ServiceToken<T>, service: T): void
  has<T>(token: ServiceToken<T>): boolean
}

/**
 * Context passed to every module hook.
 * @remarks
 * This is the primary way modules interact with the engine and each other
 * (via the {@link EventBus} and {@link Services} registry).
 */
export type GameContext = {
  /**
   * Engine configuration (canvas sizing / mounting).
   */
  config: EngineConfig

  /**
   * Global event bus for decoupled communication.
   */
  bus: EventBus

  /**
   * Shared service registry (time, assets, custom services).
   */
  services: Services
}

export type PanelId = BodyId

export type DebugPanel = {
  id?: PanelId,
  title: string,
  order?: number,
  render(ctx: GameContext): string[],
  draw?(ctx: GameContext, draw: DrawServicePort): void,
}


/**
 * Options for drawing sprites/images.
 * @remarks
 * Used by the {@link DrawServicePort.sprite} method.
 */
export interface SpriteOptions {
  /** Optional source rect (sprite sheet) */
  sx?: number; sy?: number; sw?: number; sh?: number
  /** Origin/pivot (pixels), default (0,0) */
  ox?: number; oy?: number
  /** Scale factors, default 1 */
  scaleX?: number; scaleY?: number
  /** Rotation in radians, default 0 */
  rotation?: number
  /** Alpha transparency, 0..1, default 1 */
  alpha?: number
}

export type RenderFn = (draw: DrawServicePort, cam?: Readonly<Camera2D>) => void;