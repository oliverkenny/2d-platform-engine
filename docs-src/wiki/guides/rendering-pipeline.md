---
title: rendering-pipeline
group: Documents
category: Guides
---

# Rendering Pipeline

This document details the rendering pipeline patterns: how modules enqueue draws, how rendering is ordered and executed, and best practices for efficiency and correctness.

Roles

- Module: decides what to draw and enqueues a RenderFn with z and pass id.
- RenderQueue: service that collects and returns sorted draw items per pass.
- RenderCoordinator: owns pass ordering and executes queued draws each frame, applying camera transforms for world passes.
- DrawService: renderer‑provided API with primitives and helpers (toWorld / toUi, world↔screen conversions).

Passes and ordering

- RenderCoordinator defines named passes in order (default: background → world → fx → ui → debug).
- Modules enqueue to a pass by id; each item has a z value for stable depth ordering within a pass.
- RenderCoordinator drains each pass and executes draw callbacks in z order.

World vs UI

- Pass.space = 'world': RenderCoordinator wraps execution in draw.toWorld(cam, () => { ... }) so draws are in meters and transformed by camera.
- Pass.space = 'ui': RenderCoordinator wraps execution in draw.toUi(() => { ... }) to draw in pixel coordinates.

Enqueuing draws

- Prefer RenderQueue.enqueue(passId, drawFn, z) from module.render().
- drawFn signature: (draw: DrawService, cam?: Camera2D) => void. Keep drawFns lightweight; precompute heavy work in render() outside the callback.

Batching and performance

- Batch draw calls where possible (same image/sprite sheet) to reduce state changes in the renderer.
- Avoid allocating inside tight loops in drawFns (minimize GC churn).
- For canvas: group fills/strokes and minimize context save/restore calls.

When to draw immediately

- Ownership: if a module owns the renderer implementation (rare), immediate draws are acceptable.
- Rare cases: one‑off overlays that must bypass queueing; prefer a dedicated pass and document the exception.

Multi‑renderer considerations

- If swapping renderers (Canvas → WebGL), keep the DrawService API stable. RenderQueue + RenderCoordinator should remain renderer‑agnostic.
- Implement renderer‑specific optimizations inside the DrawService, not in modules that call it.

Debugging

- Use the debug pass to add overlays (bounding boxes, physics debug). These are enqueued like any other pass but kept last so they overlay other visuals.

Summary

- Enqueue, don’t draw. Let the coordinator decide order and camera transforms. Keep draw callbacks small and batchable.