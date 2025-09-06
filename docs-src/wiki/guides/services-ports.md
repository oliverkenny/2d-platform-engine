---
title: services-ports
group: Documents
category: Guides
---

# Service Tokens & Ports

This document explains the token/port pattern used to expose and consume cross‑cutting services in the engine. It describes conventions, design rules, and short examples.

Purpose

- Decouple API from implementation so modules can be swapped or mocked.
- Provide a small, well‑typed surface for each subsystem (renderer, physics, camera, etc.).

Key concepts

- Service Token: a unique token (symbol/string wrapper) used to register and look up a service in ctx.services.
- Port (interface): a TypeScript interface that defines the public API consumers depend on. Ports are intentionally small and focused.

Basic workflow

1. Define a token and a port in a shared place (engine/core/tokens & engine/core/ports).
2. Implementation module registers an object implementing the port: ctx.services.set(MY_TOKEN, impl).
3. Consumers fetch the port by token: const svc = ctx.services.getOrThrow(MY_TOKEN) and call methods defined by the port.

Design rules

- Depend on the port only: consumers must use the interface, not the concrete module.
- Keep ports minimal: expose only methods callers need; prefer small, focused APIs.
- Separate read vs write when useful: provide PHYSICS_READ / PHYSICS_WRITE for controlled access.
- Use a step token for time‑driven services: PHYSICS_STEP allows a module or external owner to drive deterministic stepping.
- Return booleans for setters where failure is expected (safe mutations), and avoid throwing in hot paths.

Token/port naming conventions

- Tokens are namespaced by domain: CAMERA_2D, DRAW_ALL, PHYSICS_READ, etc.
- Ports: Camera2DReadPort, DrawServicePort, PhysicsWritePort. Use clear names indicating capability.

Example: read/write/step split (conceptual)

- PHYSICS_READ (read‑only snapshot APIs)
  - getBody(id): Body | undefined
  - readSnapshot(): Snapshot
- PHYSICS_WRITE (mutation APIs)
  - createBody(opts): BodyId
  - applyForce(id, force): boolean
- PHYSICS_STEP (stepping)
  - step(dt: number): void

Example registration

- In physics module init():
  ctx.services.set(PHYSICS_READ, physicsSvc)
  ctx.services.set(PHYSICS_WRITE, physicsSvc)
  ctx.services.set(PHYSICS_STEP, physicsSvc)

Example consumption

- In a gameplay module start():
  const physicsRead = ctx.services.getOrThrow(PHYSICS_READ) as PhysicsReadPort
  const bodies = physicsRead.readSnapshot().bodies

API evolution & stability

- Keep ports stable: add non‑breaking methods where possible and avoid removing or renaming existing methods without a migration path.
- When changing a token/port in a breaking way, provide a migration note in docs-src/wiki/release-migration.md and update tests/examples.

Testing tips

- For unit tests, create a lightweight fake implementing the port that records calls and returns deterministic values.
- For integration tests, register a test implementation under the token using createServices() helper.

When to create a new port

- New cross‑cutting API surface used by multiple modules.
- When you need to hide implementation details and provide a stable contract to consumers.

Where to look for examples

- engine/core/tokens and engine/core/ports implementations in the repo.
- modules/physics-2d, modules/renderer-canvas, and modules/camera-2d for concrete registration and consumption patterns.
