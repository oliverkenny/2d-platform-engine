// debug/overlay.module.ts
import type {
  Module,
  GameContext,
  GameEvent,
  DebugPanel,
  PanelId
} from '../../engine/core/Types'
import { Colours } from '../../util/colour'
import { DRAW_ALL } from '../../engine/core/tokens/draw'
import { DrawServicePort } from '../../engine/core/ports'
import type { DebugOverlayOptions } from './types'
import { generateId } from '../../util/ids'

type Margin = { x: number; y: number; line: number }

const DEFAULT_MARGIN: Margin = { x: 8, y: 14, line: 14 }

export function DebugOverlayModule(opts: DebugOverlayOptions = {}): Module {
  const {
    startVisible = false,
    hotkey = '`',
    margin = DEFAULT_MARGIN,
    nextKey = ']',
    prevKey = '[',
  } = opts

  // Runtime state
  let draw: DrawServicePort | undefined
  const panels = new Map<PanelId, DebugPanel>()
  let activePanel: PanelId | undefined
  let visible = startVisible
  let sessionStart = 0

  // Listeners to clean up
  let offKeydown: (() => void) | undefined

  function registerPanel(p: DebugPanel): PanelId {
    const id: PanelId = (p.id ?? generateId()) as PanelId
    const panel = (p.id ? p : { ...p, id }) as DebugPanel
    panels.set(id, panel)
    if (!activePanel) activePanel = id
    return id
  }

  function unregisterPanel(id: PanelId) {
    panels.delete(id)
    if (activePanel === id) {
      activePanel = panels.size ? panels.keys().next().value : undefined
    }
  }

  function toggle() {
    visible = !visible
  }

  function formatSeconds(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000))
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return mm > 0 ? `${mm}m ${ss}s` : `${ss}s`
  }

  function drawLines(lines: string[]) {
    if (!draw) return
    let y = margin.y
    const x = margin.x
    for (const line of lines) {
      draw.text(line, x, y, Colours.White)
      y += margin.line
    }
  }

  function drawPanel(ctx: GameContext, panel?: DebugPanel) {
    if (!draw) return

    if (!panel) {
      drawLines(['[DEBUG OVERLAY]', 'No active panel'])
      return
    }

    const lines = panel.render?.(ctx) ?? []
    drawLines([
      '[DEBUG OVERLAY]',
      `${panel.title} (${panel.id})`,
      '',
      ...lines
    ])
    panel.draw?.(ctx, draw)
  }

  // --- Panel ordering & cycling helpers -------------------------------

  function orderedPanels(): DebugPanel[] {
    // Stable sort: order (asc), then title (asc), then id (asc)
    return [...panels.values()].sort((a, b) => {
      const ao = a.order ?? 0
      const bo = b.order ?? 0
      if (ao !== bo) return ao - bo
      const at = a.title.toLowerCase()
      const bt = b.title.toLowerCase()
      if (at !== bt) return at < bt ? -1 : 1
      const ai = String(a.id ?? '')
      const bi = String(b.id ?? '')
      return ai < bi ? -1 : ai > bi ? 1 : 0
    })
  }

  function setActiveByIndex(idx: number) {
    const list = orderedPanels()
    if (list.length === 0) {
      activePanel = undefined
      return
    }
    // wrap-around
    const i = ((idx % list.length) + list.length) % list.length
    activePanel = list[i].id as PanelId
  }

  function activeIndex(): number {
    const list = orderedPanels()
    const i = list.findIndex(p => p.id === activePanel)
    return i < 0 ? 0 : i
  }

  function nextPanel() {
    setActiveByIndex(activeIndex() + 1)
  }

  function prevPanel() {
    setActiveByIndex(activeIndex() - 1)
  }

  // Built-in "Debug Overlay" info panel
  const overlayPanel: DebugPanel = {
    title: 'Debug Overlay',
    render: (ctx) => [
      `Panels Registered: ${panels.size}`,
      `Active Panel: ${activePanel ?? 'none'}`,
      `Toggle Hotkey: ${hotkey}`,
      `Next/Prev: ${nextKey} / ${prevKey}`,
      `Session Duration: ${formatSeconds(Date.now() - sessionStart)}`,
    ]
  }
  registerPanel(overlayPanel)

  const mod: Module = {
    id: 'debug/overlay',

    init(ctx) {
      offKeydown = ctx.bus.on('input/keydown', (e) => {
        if (e.key === hotkey) {
          toggle()
          return
        }
        if (!visible) return

        if (e.key === nextKey) {
          nextPanel()
          return
        }
        if (e.key === prevKey) {
          prevPanel()
          return
        }
      })

      ctx.bus.on('debug/panel/register', (ev) => registerPanel(ev.panel))
      ctx.bus.on('debug/panel/unregister', (ev) => unregisterPanel(ev.id))
    },

    start(ctx) {
      // DrawService is required; throw early if not present.
      draw = ctx.services.getOrThrow(DRAW_ALL)
      sessionStart = Date.now()
    },

    render(ctx) {
      if (!visible || !draw) return
      const panel = activePanel ? panels.get(activePanel) : undefined
      drawPanel(ctx, panel)
    },

    onEvent(_ctx, _ev: GameEvent) {
      // no-op
    },

    destroy() {
      offKeydown?.()
      panels.clear()
      activePanel = undefined
      draw = undefined
    },
  }

  return mod
}
