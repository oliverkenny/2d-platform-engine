/**
 * InputState module for tracking and exposing the current input state.
 *
 * This module maintains the state of held keyboard keys, mouse buttons, and cursor position.
 * It provides an interface for querying input state via the `INPUT_READ` service token,
 * and registers a debug panel for visualizing the current input state.
 *
 * @module modules/input-state
 *
 * @returns {Module} The InputState module instance.
 *
 * @remarks
 * - Tracks pressed keys in a Set.
 * - Tracks mouse buttons as a bitmask.
 * - Tracks cursor position (x, y).
 * - Exposes input state via the `INPUT_READ` service:
 *   - `isDown(key: string): boolean` — Returns true if the key is currently held.
 *   - `buttons(): number` — Returns the current mouse button bitmask.
 *   - `cursor(): { x: number, y: number }` — Returns the current cursor position.
 * - Registers a debug panel displaying input state information.
 *
 * @event input/keydown - Adds a key to the held keys set.
 * @event input/keyup - Removes a key from the held keys set.
 * @event input/pointermove - Updates cursor position and button state.
 * @event input/pointerdown - Updates cursor position and button state.
 * @event input/pointerup - Updates cursor position and button state.
 */

import type { Module, GameContext, GameEvent, DebugPanel } from '../../engine/core/Types'
import type { InputSurfacePort } from '../../engine/core/ports'
import { INPUT_READ, INPUT_SURFACE } from '../../engine/core/tokens'

export default function InputState(): Module {
  const keys = new Set<string>()
  let buttons = 0
  let x = 0, y = 0
  let lastEvent: string = '—'

  // ---- Debug panel ----
  const PANEL_ID = -1002 as any
  const panel: DebugPanel = {
    id: PANEL_ID,
    title: 'Input State',
    order: 490,
    render(ctx: GameContext) {
      // Surface presence is handy to display even though we don’t bind listeners here.
      const surface = ctx.services.get(INPUT_SURFACE) as InputSurfacePort | undefined
      const attached = !!surface

      const names: string[] = []
      if (buttons & 1)  names.push('Left')
      if (buttons & 4)  names.push('Middle')
      if (buttons & 2)  names.push('Right')
      if (buttons & 8)  names.push('Back')
      if (buttons & 16) names.push('Forward')

      const heldKeys = Array.from(keys).sort()

      return [
        attached ? 'Surface: attached' : 'Surface: (not available)',
        `Cursor (logical): ${x.toFixed(1)}, ${y.toFixed(1)}`,
        `Held buttons: ${names.length ? names.join(', ') : '—'}  [bits=${buttons}]`,
        `Keys down (${heldKeys.length}): ${heldKeys.length ? heldKeys.join(' ') : '—'}`,
        `Last event: ${lastEvent}`,
      ]
    },
  }
  // ---------------------

  return {
    id: 'input/state',

    init(ctx) {
      if (!ctx.services.has(INPUT_READ)) {
        ctx.services.set(INPUT_READ, {
          isDown: (k: string) => keys.has(k),
          buttons: () => buttons,
          cursor: () => ({ x, y }),
        })
      }
    },

    start(ctx) {
      // make the panel visible in your debug UI
      ctx.bus.emit({ type: 'debug/panel/register', panel })
    },

    onEvent(_ctx: GameContext, e: GameEvent) {
      lastEvent = e.type
      switch (e.type) {
        case 'input/keydown': keys.add(e.key); break
        case 'input/keyup':   keys.delete(e.key); break

        case 'input/pointermove':
          x = e.x; y = e.y; buttons = e.buttons; break
        case 'input/pointerdown':
        case 'input/pointerup':
          x = e.x; y = e.y; buttons = e.buttons; break
      }
    },

    destroy() {
      keys.clear()
      buttons = 0
    },
  }
}
