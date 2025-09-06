---
title: architecture
group: Documents
category: Guides
---

# Architecture

This document describes the core architectural patterns used by the engine. It focuses on the responsibilities of the small core, how modules plug in, and the key runtime flows and contracts modules rely on.

Core philosophy

- Minimal core: the engine core intentionally stays small. It provides the runtime loop, a typed EventBus, and a Services registry. Feature areas (rendering, physics, input, audio, game logic) are implemented as modules (plugins).
- Inversion of control: modules register services and react to events rather than importing concrete implementations. Consumers depend on well‑documented interfaces (ports) and service tokens.
- Determinism and explicit units: the physics layer and simulation logic use explicit units (meters, radians, seconds) and deterministic, fixed‑timestep stepping so simulations and replays are stable.

Primary concepts

- Engine (core)
  - Owns module list and the shared GameContext (config, bus, services).
  - Manages lifecycle: add(module) → init() → start() → update loop → render → destroy().
  - Implements a fixed‑step update loop with a free render pass. Updates run 0..n times per frame; render is once per frame with an interpolation alpha.

- GameContext
  - Passed to every module hook. Contains engine configuration, the EventBus, and the Services registry.

- EventBus
  - Typed publish/subscribe mechanism for decoupled communication. Modules emit and listen to domain events (input, debug, level/loaded, etc.).

- Services registry
  - Centralized, type‑safe map of shared APIs (time, assets, draw, physics, camera, etc.). Modules register implementations under tokens and other modules retrieve by token.
  - Design rule: depend on the interface (token/port) not on a concrete module implementation.

Module contract and lifecycle

- A Module implements a small set of hooks: id, init(ctx), start(ctx), update(ctx, dt), render(ctx, alpha), destroy().
  - init: register services and subscribe to events (lightweight; run before start of any module).
  - start: per‑session setup and asset loading; runs once after all init() calls complete.
  - update: deterministic game logic, runs at the fixed timestep (dt in seconds).
  - render: drawing only; receives an interpolation alpha between updates; should not mutate simulation state.
- Modules should avoid cross‑importing each other. Communication is via the EventBus and Services registry.

Rendering architecture

- DrawService (renderer module) exposes drawing primitives and transform helpers (toWorld / toUi, world↔screen conversions).
- RenderQueue service lets modules enqueue RenderFn callbacks with z ordering for named passes.
- RenderCoordinator defines ordered passes (e.g. background → world → fx → ui → debug) and drains the queue each frame. For 'world' passes it applies the camera transform via DrawService.toWorld; for 'ui' passes it uses toUi.
- This separation ensures: modules decide what to draw and when to enqueue, the coordinator decides when and with which camera/context to execute draws.

Camera and coordinate spaces

- Camera2D service holds camera state (position, rotation, zoom, px‑per‑meter). DrawService applies camera transforms for world rendering.
- Two primary spaces: UI (pixel space) and World (meters). Use UI for stable pixel fonts/HUD, World for physics‑sized entities.

Physics and simulation

- Physics module exposes separated ports: read, write, and step (PHYSICS_READ, PHYSICS_WRITE, PHYSICS_STEP).
- The physics service implements deterministic step(dt) semantics. Bodies are created/removed via explicit APIs; query and contact events are supported.
- Engines or modules may drive physics stepping inside update(), or the module can expose the step token for other coordination.

Typical runtime flow (high level)

1. init/start
   - Modules register services and subscribe to events in init(); assets are loaded in start().
2. update (fixed‑step)
   - Engine accumulates time and runs update(dt) repeatedly while catching up. Physics stepping usually happens here.
3. render (once per rAF)
   - Modules enqueue draw operations (RenderFns) to the RenderQueue. RenderCoordinator drains passes and executes draws with the correct camera/space via DrawService.
4. events
   - Input and other systems emit events on the EventBus; modules react and may modify state via service APIs.

Design patterns and tradeoffs

- Swapability: using tokens and ports means implementations are easily replaceable (e.g., swap Canvas renderer for WebGL, or Rapier for another physics backend).
- Single responsibility: coordinator patterns (render queue / coordinator) separate concerns of what to draw from how/when to draw.
- Determinism vs convenience: fixed‑step stepping favors reproducibility at the cost of slightly more complexity (accumulator, interpolation alpha).
- Safety: read/write/step splits and boolean setters on services encourage explicit and safe state mutation.

Guidelines for writing modules

- Do not import other modules directly. Use ctx.services and ctx.bus.
- Register services in init(), load assets in start().
- Perform deterministic logic in update(); enqueue draw actions in render().
- Respect coordinate spaces: use world units for physics and toWorld transforms for drawing; use toUi for HUD/UI drawing.

Further reading

- ENGINE_API.md for quick API references and the core contracts.
- Module source files (modules/renderer-canvas, modules/render-coordinator, modules/physics-2d, modules/camera-2d) for concrete examples and service implementations.

