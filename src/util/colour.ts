import type { Colour } from '../engine/core/primitives'

/**
 * Common colour constants expressed as normalised RGBA (0..1).
 *
 * @remarks
 * These are convenience values only. Modules may construct colours
 * manually (`{ r: 1, g: 0, b: 0 }`) or use {@link ColourUtil}.
 */
export const Colours = {
  WHITE: { r: 1, g: 1, b: 1, a: 1 } as Colour,
  BLACK: { r: 0, g: 0, b: 0, a: 1 } as Colour,
  DARK_GREY: { r: 0.25, g: 0.25, b: 0.25, a: 1 } as Colour,
  RED: { r: 1, g: 0, b: 0, a: 1 } as Colour,
  GREEN: { r: 0, g: 1, b: 0, a: 1 } as Colour,
  BLUE: { r: 0, g: 0, b: 1, a: 1 } as Colour,
  YELLOW: { r: 1, g: 1, b: 0, a: 1 } as Colour,
  BROWN: { r: 0.5, g: 0.25, b: 0, a: 1 } as Colour,
  CYAN: { r: 0, g: 1, b: 1, a: 1 } as Colour,
  MAGENTA: { r: 1, g: 0, b: 1, a: 1 } as Colour,
  ORANGE: { r: 1, g: 0.5, b: 0, a: 1 } as Colour,
  TRANSPARENT: { r: 0, g: 0, b: 0, a: 0 } as Colour,
}

/**
 * Helper functions for constructing {@link Colour} values.
 *
 * @remarks
 * Keep colour *representation* renderer-agnostic by using normalised [0..1] floats.
 * Renderers are responsible for converting to CSS/WebGL/etc.
 */
export const ColourUtil = {
  /**
   * Construct a normalised RGBA colour.
   *
   * @param r - Red component (0..1).
   * @param g - Green component (0..1).
   * @param b - Blue component (0..1).
   * @param a - Alpha component (0..1, default 1).
   */
  rgba: (r: number, g: number, b: number, a = 1): Colour => ({ r, g, b, a }),

  /**
   * Construct a colour from 8-bit per channel RGB values (0..255).
   *
   * @param r - Red component (0..255).
   * @param g - Green component (0..255).
   * @param b - Blue component (0..255).
   * @param a - Alpha (0..1, default 1).
   */
  rgb255: (r: number, g: number, b: number, a = 1): Colour => ({
    r: r / 255,
    g: g / 255,
    b: b / 255,
    a,
  }),

  /**
   * Construct a colour from a CSS hex string.
   *
   * @param hex - A 6-digit hex string, with or without leading `#`
   * (e.g. `"#ff0000"` or `"00ff00"`).
   * @param a - Alpha component (0..1, default 1).
   *
   * @example
   * ```ts
   * const red = ColourUtil.hex("#ff0000")
   * ```
   */
  hex: (hex: string, a = 1): Colour => {
    const h = hex.replace('#', '')
    if (h.length !== 6) {
      throw new Error(`Invalid hex colour: ${hex}`)
    }
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255
    return { r: n(0), g: n(2), b: n(4), a }
  },
}
