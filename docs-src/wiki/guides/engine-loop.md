---
title: engine-loop
group: Documents
category: Guides
---

# Engine Loop & Timekeeping

This guide explains the fixed‑step update loop the engine uses, why it's used, and practical guidance for writing deterministic systems and tests.

Why fixed‑step

- Determinism: fixed timestep produces repeatable simulations useful for physics, replays, and tests.
- Stability: physics integrations behave more predictably with a constant dt.

Core concepts

- fixedStep: target update interval in seconds (e.g. 1/60).
- accumulator: accumulates real time and drives how many update steps to run per frame.
- alpha: interpolation factor in [0..1] representing how far between the last completed update and the next one the render should represent.

Simplified pseudocode

- On each requestAnimationFrame(t):
  const dtMs = t - last
  accumulator += dtMs / 1000
  while (accumulator >= fixedStep) {
    for each module: module.update(ctx, fixedStep)
    accumulator -= fixedStep
  }
  const alpha = accumulator / fixedStep
  for each module: module.render(ctx, alpha)

Practical rules for module authors

- Treat dt as seconds (not ms). Use floating point arithmetic.
- update(): perform deterministic simulation logic; do not use performance.now() inside update for time deltas.
- render(): use alpha for interpolation of visuals only; do not mutate simulation state.

Stepping strategies

- Single owner stepping (module steps physics internally in update): the physics module calls physics.step(dt) during its update hook.
- Exposed step token (PHYSICS_STEP): engine or another coordinating module may call step to centralize timing.

Testing deterministic behavior

- Unit tests: call module.update(ctx, fixedStep) in a loop with controlled inputs; avoid relying on wall clock.
- Integration tests: create a fake TimeService and advance its accumulator manually; call engine.frame or the public update methods.

Handling slow frames

- Avoid unbounded update loops; optionally cap number of updates per frame to avoid spiraling (e.g., maxUpdates = 5).
- If the engine falls far behind, consider a recovery strategy (drop frames, clamp dt) but document the tradeoff (loss of determinism vs avoiding freeze).

Interpolation and visual smoothness

- Use alpha in render to interpolate positions/rotations between previous and current physics states for smooth visuals.
- Keep previous state snapshots or expose read APIs that return both previous and current states if needed.

Summary

- Fixed‑step with accumulator + alpha balances determinism and smooth rendering. Follow the rules: deterministic updates in update(), interpolation in render(), and avoid time sources other than the provided dt for simulation.