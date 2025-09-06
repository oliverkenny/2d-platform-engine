import type { Colour } from '../../engine/core'

/**
 * Convert a Colour object to a CSS-compatible string.
 * @param c - Colour to convert
 * @returns CSS color string or undefined
 */
export function toCss(c?: Colour): string | undefined {
    if (!c) return
    const r = Math.round((c.r ?? 0) * 255)
    const g = Math.round((c.g ?? 0) * 255)
    const b = Math.round((c.b ?? 0) * 255)
    const a = c.a == null ? 1 : c.a
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }