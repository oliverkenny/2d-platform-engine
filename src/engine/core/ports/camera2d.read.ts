import type { Camera2D } from "../primitives"

export interface Camera2DReadPort {
  /** Current camera value (immutable snapshot). */
  get(): Readonly<Camera2D>
}