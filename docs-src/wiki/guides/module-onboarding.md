---
title: module-onboarding
group: Documents
category: Guides
---

# Module Onboarding

This guide explains the minimal conventions and a practical template for creating modules that plug cleanly into the engine. Use this as a checklist when authoring or reviewing modules.

Goals

- Produce small, self‑contained modules that communicate only via ctx.bus and ctx.services.
- Encourage predictable lifecycle behavior (init → start → update → render → destroy).
- Provide a consistent pattern for registering services, loading assets, and exposing APIs.

Minimal module template (conceptual)

- id: unique namespaced identifier (e.g. "audio/webaudio", "ai/pathfinding").
- init(ctx): register services, subscribe to events (no heavy IO).
- start(ctx): preload assets and perform per‑session initialization.
- update(ctx, dt): deterministic logic at fixed timestep.
- render(ctx, alpha): enqueue draw commands or perform purely visual work; do not mutate simulation state.
- destroy(): cleanup and unsubscribe.

Checklist (before PR)

- id is unique and namespaced.
- No direct imports from other modules in src/modules/* — use tokens & ctx.services.
- Services the module exposes are registered in init() under tokens and documented.
- All asynchronous asset loading happens in start().
- update() uses dt in seconds and contains deterministic logic only.
- render() enqueues draws or uses provided DrawService; render does not change simulation state.
- Subscriptions to ctx.bus are removed in destroy() (or you keep returned off function and call it).
- Public API surfaces (service ports) are minimal and documented; prefer small, focused methods.

Service registration example

- In init(ctx):
  - ctx.services.set(MY_SERVICE_TOKEN, myServiceImpl)
  - ctx.bus.on('some/event', handler)

Starting and asset loading

- start(ctx) should await any required asset loading (images, audio, data). Use ctx.services.assets for shared asset loading where appropriate.
- Keep start() idempotent for safe restarts.

Update & render patterns

- Update: mutate module state and call other service APIs (e.g., physics write) as needed.
- Render: compute visual state and call ctx.services.get(RENDER_QUEUE) or DrawService to enqueue drawing functions. Prefer RenderQueue.enqueue so the RenderCoordinator controls ordering and camera transforms.

Examples and common pitfalls

- Do: expose a read port and a write port separately if consumers only need read access (e.g., PHYSICS_READ vs PHYSICS_WRITE).
- Do: fail gracefully from start() if assets are missing (throwing will stop engine start()).
- Don’t: draw directly to canvas from module.render(); instead enqueue to the render queue unless you own the renderer.
- Don’t: perform heavy IO in init().

Testing & debugging tips

- For unit tests, provide mock services in a fake GameContext (mocked ctx.services and ctx.bus). Drive update() manually with a fixed dt.
- To debug lifecycle issues, instrument init/start/update/render with debug/panel registration or log events on ctx.bus.

Where to look for examples

- modules/renderer-canvas — DrawService registration.
- modules/render-coordinator — render queue usage and pass coordination.
- modules/physics-2d — service tokens and deterministic stepping.
- modules/demo-bouncy — a compact, end‑to‑end example of a module using physics, draw, and input.

When in doubt, follow the principle: keep modules focused, expose a small API, rely on ctx.bus & ctx.services, and respect the lifecycle hooks.