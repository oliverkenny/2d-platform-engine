import type { Colour, Vec2, Camera2D } from '../../engine/core/primitives'

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

  /** Build world→screen transform matching the draw pass (DOMMatrix keeps it simple). */
export function worldToScreenMatrix(
  canvas: HTMLCanvasElement,
  cam: Camera2D
): DOMMatrix {
  return new DOMMatrix()
    .translate(canvas.width * 0.5, canvas.height * 0.5)
    .scale(cam.ppm * cam.zoom, -cam.ppm * cam.zoom)           // meters→px, flip Y
    .rotate((-cam.rotation * 180) / Math.PI)
    .translate(-cam.position.x, -cam.position.y);
}

/** Apply world→screen transform to a 2D context. */
export function applyWorldTransform(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cam: Camera2D
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Note: Canvas 2D has a different matrix type than DOMMatrix; reuse the same ops.
  ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
  ctx.scale(cam.ppm * cam.zoom, -cam.ppm * cam.zoom);
  ctx.rotate(-cam.rotation);
  ctx.translate(-cam.position.x, -cam.position.y);
}

/** Reset to UI/screen space (pixels, y-down). */
export function applyUiTransform(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Convenience converters (useful for mouse picking, tooltips, etc.). */
export function worldToScreen(p: Vec2, canvas: HTMLCanvasElement, cam: Camera2D): Vec2 {
  const m = worldToScreenMatrix(canvas, cam);
  const r = m.transformPoint(new DOMPoint(p.x, p.y));
  return { x: r.x, y: r.y };
}

export function screenToWorld(p: Vec2, canvas: HTMLCanvasElement, cam: Camera2D): Vec2 {
  const m = worldToScreenMatrix(canvas, cam).invertSelf();
  const r = m.transformPoint(new DOMPoint(p.x, p.y));
  return { x: r.x, y: r.y };
}