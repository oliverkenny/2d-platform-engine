export function toLogicalXY(
  e: MouseEvent | PointerEvent | WheelEvent,
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number
) {
  const rect = canvas.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  // scale into logical space (handles CSS scaling / HiDPI)
  const x = (px / rect.width) * logicalWidth
  const y = (py / rect.height) * logicalHeight
  return { x, y }
}