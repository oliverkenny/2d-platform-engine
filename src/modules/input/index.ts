import type { Module, GameContext, EventBus, GameEvent } from '../../engine/core/Types'

/**
 * DOM Keyboard Input Module.
 *
 * @remarks
 * - Listens for `keydown` and `keyup` events on the `window` object.
 * - Emits corresponding {@link GameEvent} messages (`'input/keydown'`, `'input/keyup'`)
 *   into the engine {@link EventBus}.
 * - Tracks pressed keys in a `Set` to suppress browser auto-repeat; only the
 *   first physical key press triggers an `'input/keydown'` event until it is released.
 * - Unsubscribes from DOM listeners and clears state on `destroy()`.
 *
 * @example
 * ```ts
 * engine.add(InputModule())
 *
 * // Later, inside a module:
 * ctx.bus.on('input/keydown', e => {
 *   if (e.key === 'ArrowLeft') player.moveLeft()
 * })
 * ctx.bus.on('input/keyup', e => {
 *   if (e.key === 'ArrowLeft') player.stopMoving()
 * })
 * ```
 */
export default function InputModule(): Module {
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
