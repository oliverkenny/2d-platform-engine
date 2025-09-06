---
title: eventbus
group: Documents
category: Guides
---

# EventBus

This document covers the typed EventBus used for decoupled publish/subscribe communication across modules.

Goals

- Provide a clear, typed contract for domain events (input, level, debug, audio, etc.).
- Encourage consistent naming and payload shapes to reduce coupling.

Core API

- emit(event: GameEvent): void — publish an event to all subscribers.
- on(type, handler): () => void — subscribe to a specific event type; returns an unsubscribe function.

Event typing and naming

- Use discriminated unions for GameEvent in engine/core/Types.ts to keep handlers type‑safe.
- Naming convention: domain/action (e.g. input/keydown, level/loaded, debug/panel/register).
- Keep payloads small and explicit; avoid embedding large objects in events.

Subscription patterns

- Modules should subscribe in init() and capture off() handlers to clean up in destroy().
- If a handler needs to be temporary, unregister it as soon as it is no longer needed.

Example

- Emitting input events (input module)
  ctx.bus.emit({ type: 'input/keydown', key: 'a' })

- Subscribing (game module init)
  const off = ctx.bus.on('input/keydown', e => { keys.add(e.key) })
  // in destroy(): off()

Event bus best practices

- Prefer events for cross‑cutting concerns and notifications; prefer direct service APIs for tight coupling or high‑frequency interactions.
- Avoid emitting events every frame for high‑frequency simulation updates (use services instead); use events for state changes and user input.
- Document new events: add them to the global GameEvent union and update ENGINE_API.md for discoverability.

Performance and safety

- Keep event payloads small to reduce memory churn.
- Handlers should be resilient to missing services or partial state (defensive checks).

Debugging

- Use debug/panel/register events to surface internal state in the debug overlay.
- Log critical events selectively, not every emitted event.

Where to look for examples

- engine/core/Types.ts for the GameEvent union.
- modules/input, modules/debug-overlay, modules/demo-bouncy for practical usage.
