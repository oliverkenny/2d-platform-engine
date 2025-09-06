# Engine Core API (One‑Pager)

This document defines the **stable contract** modules use to talk to the engine core. Keep the core tiny; make everything else a plug‑in.

---

## Lifecycle

A module implements `Module` and is added to the engine via `engine.add(module)`. The engine calls hooks in order:

1. `init(ctx)` – register services, subscribe to events.
2. `start(ctx)` – load assets; runs once before the loop.
3. `update(ctx, dt)` – fixed‑step updates (`dt` in seconds, typically `1/60`).
4. `render(ctx, alpha)` – draw; `alpha` is [0..1] interpolation factor.
5. `destroy()` – cleanup.

```ts
export interface Module {
  id: string
  init?(ctx: GameContext): Promise<void> | void
  start?(ctx: GameContext): Promise<void> | void
  update?(ctx: GameContext, dt: number): void
  render?(ctx: GameContext, alpha: number): void
  onEvent?(ctx: GameContext, event: GameEvent): void
  destroy?(): void
}
```

---

## Context

The engine passes a `GameContext` to every hook.

```ts
export type GameContext = {
  config: EngineConfig     // width/height, mount/canvas, targetFPS
  bus: EventBus            // typed event bus
  services: Services       // shared registry (assets, time, rng, etc.)
}
```

### EngineConfig
```ts
export type EngineConfig = {
  width: number; height: number; targetFPS?: number
  canvas?: HTMLCanvasElement; mount?: HTMLElement
}
```

---

## Event Bus (decoupled comms)

- Emit: `ctx.bus.emit({ type: 'level/loaded', name: 'L1' })`
- Subscribe: `const off = ctx.bus.on('input/keydown', e => ... )`
- Unsubscribe by calling the function returned from `on`.

```ts
export interface EventBus {
  emit(ev: GameEvent): void
  on<T extends GameEvent['type']>(
    type: T,
    handler: (e: Extract<GameEvent, { type: T }>) => void
  ): () => void
}
```

**Default events** (extend as needed):
```ts
export type GameEvent =
  | { type: 'input/keydown'; key: string }
  | { type: 'input/keyup'; key: string }
  | { type: 'level/loaded'; name: string }
  | { type: 'audio/play'; sound: string; loop?: boolean; volume?: number }
  | { type: 'render/resize'; width: number; height: number }
```

---

## Services (shared registry)

- Get: `const draw = ctx.services.get<DrawService>('draw')`
- Set: `ctx.services.set('physics', api)`
- Always **depend on the interface**, not the implementing module.

```ts
export interface Services {
  time: TimeService
  assets: AssetService
  rng: () => number
  get<T>(key: string): T | undefined
  set<T>(key: string, service: T): void
}

export interface TimeService {
  now(): number                  // ms
  fixedStep: number              // seconds, e.g. 1/60
  accumulator: number            // seconds
}

export interface AssetService {
  loadImage(key: string, url: string): Promise<HTMLImageElement>
  getImage(key: string): HTMLImageElement | undefined
}
```

### Example: Renderer‑provided Draw Service
A renderer module may register a drawing API other modules can consume:
```ts
export interface DrawService {
  clear(): void
  rect(x: number, y: number, w: number, h: number): void
  text(msg: string, x: number, y: number): void
}
// Registered as: ctx.services.set('draw', drawService)
```

---

## Module template

```ts
import type { Module, GameContext, DrawService } from '../engine/core/Types'

export default function MyModule(): Module {
  let draw: DrawService | undefined

  return {
    id: 'my/module',
    init(ctx) {
      // Subscribe to events, register services, etc.
      ctx.bus.on('level/loaded', e => { /* ... */ })
    },
    start(ctx) {
      draw = ctx.services.get<DrawService>('draw')
      // preload example: await ctx.services.assets.loadImage('player', '/player.png')
    },
    update(ctx, dt) {
      // game logic
    },
    render(ctx, alpha) {
      draw?.clear()
      // draw?.rect(...)
    },
    destroy() {}
  }
}
```

---

## Design rules (to keep modules swappable)

- **No cross‑imports** between modules. Communicate via **events** and **services** only.
- Keep event names **flat & namespaced** (`'audio/play'`, `'input/keydown'`).
- If you change a public interface, bump a suffix (e.g. `'render/resize@2'`).
- Prefer **one responsibility per module**.

---

## Engine Loop

The engine runs a **fixed‑step update** loop (`time.fixedStep`), followed by a render pass with interpolation parameter `alpha`. Control this by replacing the `time` service if needed.

---

**That’s it.** Build modules that only depend on the types above and they’ll remain plug‑and‑play.
