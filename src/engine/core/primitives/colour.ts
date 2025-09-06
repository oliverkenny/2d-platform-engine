/**
 * Normalised RGBA colour with optional alpha.
 * @remarks
 * All components are in the range 0..1.
 */
export interface Colour {
  /** Red 0..1 */
  r: number
  /** Green 0..1 */
  g: number
  /** Blue 0..1 */
  b: number
  /** Alpha 0..1 (default 1) */
  a?: number
}