---
title: physics
group: Documents
category: Guides
---

# Physics (2D) API Guide

This guide documents the intended usage patterns and design assumptions for the physics subsystem. It focuses on the deterministic, fixed‑timestep model and the ported API surface exposed to modules.

Units & conventions

- Distances: meters.
- Angles: radians.
- Velocities: units per second.
- Coordinate system: engine defines handedness (check module docs; this engine uses y‑up conventions in modules/examples).

Ports and tokens

- PHYSICS_READ: read‑only snapshot APIs for rendering and queries.
- PHYSICS_WRITE: mutation APIs to create/remove bodies, apply forces, set properties.
- PHYSICS_STEP: stepping API that advances simulation deterministically.

Stepping & determinism

- The physics service provides step(dt) which must be called with consistent dt values (e.g., engine fixedStep).
- Deterministic stepping enables repeatable replays and predictable tests. Avoid calling step with varying dt in production.

Body lifecycle

- createBody(opts) → BodyId: create with explicit properties (type, mass, shapes, userData).
- removeBody(id): schedules or immediately removes the body (implementation may queue removals; check return boolean).
- setters (setPosition, setVelocity, setAngle) should return boolean indicating success.

Contact and query events

- Physics service exposes contact event hooks (begin/end listeners). Modules can subscribe to receive collision notifications by registering listeners with the physics service.
- For queries (raycasts, overlaps), prefer using read APIs rather than scanning all bodies in JS.

User data

- Bodies support userData for attaching module domain info (entity ids, types). Keep userData small and serializable if you plan to snapshot/serialize state.

Snapshot / read pattern

- Use readSnapshot() to capture a consistent view of bodies and their transforms for rendering or debug panels.
- Prefer readSnapshot for rendering to avoid races with concurrent write operations.

Integration patterns

- Create physics bodies in start() once assets/initial state is ready.
- Drive physics stepping in update(dt), either by the physics module itself or via PHYSICS_STEP if external coordination is required.
- For smooth visuals, interpolate transforms in render(alpha) using the previous and current states from snapshots.

Performance guidance

- Avoid creating/removing many bodies each frame; reuse where possible.
- Use simple collision shapes (boxes/circles) when adequate; complex convex polygons are more expensive.
- Batch queries where feasible and avoid expensive broadphase scans from JS on each frame.

Testing tips

- Use deterministic seeds for random elements and call step(dt) in tests with controlled dt loops.
- For integration tests, stub heavy WASM or native dependencies if possible and validate high‑level behavior via ports.

Where to look

- modules/physics-2d/service.ts for the Rapier‑backed implementation.
- modules/physics-2d/index.ts for example usage and debug overlays.

Summary

- Treat the physics service as a deterministic simulation: use meters/radians/seconds, step explicitly, read snapshots for rendering, and keep mutations explicit and safe.