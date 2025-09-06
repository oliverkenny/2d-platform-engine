---
title: contributing
group: Documents
category: Guides
---

# Contributing

This document is a short contributor guide and review checklist focused on modules, services, and API stability.

Core principles

- Small, focused modules that use ctx.bus & ctx.services.
- Keep the engine core stable: add features as modules whenever possible.
- Prefer non‑breaking API additions and document breaking changes clearly.

Before opening a PR

- Validate linting and TypeScript build: run the project's checks locally.
- Ensure unit tests and CI pass.
- Run the demo (if relevant) to validate runtime behavior.

Module PR checklist

- Module id is unique and namespaced.
- No direct imports from other modules under src/modules; communication happens via services/tokens and events.
- Services registered in init() are documented and have minimal public surfaces (ports).
- start() performs asset loading; init() is lightweight.
- update() uses dt in seconds and contains only deterministic logic.
- render() does not mutate simulation state; draw commands are enqueued to the render queue.
- All ctx.bus subscriptions are cleaned up in destroy().
- Add or update docs in docs-src/wiki for any new tokens, events, or major behavior.

API stability & versioning

- Non‑breaking changes: adding new methods with default behavior, adding optional parameters.
- Breaking changes: renaming tokens/ports or removing methods. For breaking changes:
  - Add migration notes in docs-src/wiki/release-migration.md.
  - Increment package version and communicate in the PR description.

PR description template (short)

- Summary: what the change does and why.
- Files/areas touched: key modules/services changed.
- Migration notes: if breaking.
- How to test: steps to validate the change locally.

Review guidance for maintainers

- Confirm module isolation: no direct cross‑module imports.
- Confirm ports & tokens are appropriate and documented.
- Validate lifecycle behavior (init/start/update/render/destroy).
- Check tests and small demo scenarios where possible.

Thanks for contributing — keep modules small and well‑documented. If in doubt, open an issue to discuss larger design changes.