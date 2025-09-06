import type { EventBus, GameEvent } from './Types'

/**
 * Create a new, type-safe {@link EventBus}.
 *
 * @remarks
 * - Stores handlers in a `Map` keyed by event `type`.
 * - Ensures handlers are strongly typed by discriminated union narrowing.
 * - Emits events using a snapshot of the current handlers, so modifications
 *   (subscribe/unsubscribe) during an `emit` do not affect the current dispatch.
 * - Unsubscribe functions automatically clean up empty handler sets.
 *
 * @example
 * ```ts
 * const bus = createEventBus()
 *
 * // Subscribe to a typed event
 * const off = bus.on('input/keydown', e => {
 *   console.log('Key pressed:', e.key)
 * })
 *
 * // Emit an event
 * bus.emit({ type: 'input/keydown', key: 'ArrowLeft' })
 *
 * // Unsubscribe
 * off()
 * ```
 */
export function createEventBus(): EventBus {
  /** Map of event type → subscribed handlers. */
  const handlers = new Map<GameEvent['type'], Set<(e: GameEvent) => void>>()

  return {
    /**
     * Emit an event to all subscribers of its `type`.
     *
     * @param ev - A {@link GameEvent} to broadcast.
     *
     * @remarks
     * - Takes a snapshot of the current handler set to avoid issues if handlers
     *   subscribe/unsubscribe while the event is in flight.
     * - No-ops if there are no subscribers.
     */
    emit(ev: GameEvent) {
      const set = handlers.get(ev.type)
      if (!set || set.size === 0) return

      // Snapshot avoids concurrent modification problems
      const snapshot = Array.from(set)
      for (const h of snapshot) {
        h(ev as any)
      }
    },

    /**
     * Subscribe a handler to a specific event `type`.
     *
     * @typeParam T - Discriminant string from {@link GameEvent} `type`.
     * @param type - Event type to listen for (e.g. `"input/keydown"`).
     * @param handler - Callback invoked with the event payload.
     * @returns Function to unsubscribe the handler.
     *
     * @remarks
     * - Handlers are stored in a `Set` to avoid duplicates.
     * - When the unsubscribe function is called, the handler is removed.
     * - If no handlers remain for a type, the entry is removed from the map.
     */
    on<T extends GameEvent['type']>(
      type: T,
      handler: (e: Extract<GameEvent, { type: T }>) => void
    ) {
      let set = handlers.get(type)
      if (!set) {
        set = new Set()
        handlers.set(type, set)
      }

      // Internally widen to GameEvent for storage
      set.add(handler as unknown as (e: GameEvent) => void)

      // Return unsubscribe function
      return () => {
        const s = handlers.get(type)
        if (!s) return
        s.delete(handler as unknown as (e: GameEvent) => void)
        if (s.size === 0) {
          handlers.delete(type) // cleanup if empty
        }
      }
    },
  }
}
