/**
 * KeyboardInput module for handling DOM keyboard events and emitting game input events.
 *
 * This module listens for global `keydown` and `keyup` events, tracks the set of currently pressed keys,
 * and emits corresponding events to the engine's event bus. It prevents auto-repeat floods by only emitting
 * a keydown event once per physical key press.
 *
 * @module modules/keyboard-input
 * @returns {Module} A module implementing keyboard input handling for the game engine.
 *
 * @remarks
 * - The module emits events of type `'input/keydown'` and `'input/keyup'` with the pressed key.
 * - Listeners are attached to the global `window` object by default.
 * - To scope input to a specific element, replace `window` with the desired DOM node.
 *
 * @example
 * ```typescript
 * import KeyboardInput from './modules/keyboard-input'
 * engine.use(KeyboardInput())
 * ```
 */

import type { Module, GameContext, GameEvent } from '../../engine/core/Types'

export default function KeyboardInput(): Module {
  /** Set of keys currently held down (prevents auto-repeat floods). */
  const down = new Set<string>()

  /** Cached DOM event handler for keydown. */
  let onKeyDown: (e: KeyboardEvent) => void
  /** Cached DOM event handler for keyup. */
  let onKeyUp: (e: KeyboardEvent) => void

  return {
    /** Unique module identifier. */
    id: 'input/dom',

    /**
     * Initialize DOM listeners and wire them to the event bus.
     *
     * @param ctx - Engine context (provides the global {@link EventBus}).
     */
    init(ctx: GameContext) {
      onKeyDown = (e: KeyboardEvent) => {
        // Only emit once per physical press; ignore auto-repeat
        if (!down.has(e.key)) {
          down.add(e.key)
          ctx.bus.emit({ type: 'input/keydown', key: e.key })
        }
      }

      onKeyUp = (e: KeyboardEvent) => {
        // Only emit if we previously considered this key pressed
        if (down.delete(e.key)) {
          ctx.bus.emit({ type: 'input/keyup', key: e.key })
        }
      }

      // Global keyboard input; swap with `ctx.config.canvas` if you prefer focus-scoped input
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
    },

    /**
     * Remove DOM listeners and clear internal state.
     */
    destroy() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      down.clear()
    },
  }
}
