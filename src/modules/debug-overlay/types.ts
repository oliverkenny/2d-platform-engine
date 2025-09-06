export type DebugOverlayOptions = {
  /** Start with the debug overlay visible (default false) */
  startVisible?: boolean,
  /** Hotkey to open the debug overlay */
  hotkey?: string,
  /** Top-left offset in pixels when drawing the debug overlay */
  margin?: { x: number; y: number; line: number }
  /** Hotkey to navigate to the next panel */
  nextKey?: string
  /** Hotkey to navigate to the previous panel */
  prevKey?: string
}
