export interface InputReadPort {
  /** Is this keyboard key currently held? */
  isDown(key: string): boolean
  /** Bitfield of pressed pointer buttons (DOM PointerEvent.buttons). */
  buttons(): number
  /** Current cursor position in *logical* canvas coords. */
  cursor(): { x: number; y: number }
}