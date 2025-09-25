// src/modules/renderer-canvas/service.ts

import type { Vec2, Camera2D } from "../../engine/core/primitives";
import type {
  RenderCmd,
  RectCmd,
  CircleCmd,
  TextCmd,
  SpriteCmd,
} from "../../engine/core/primitives/render";
import type {
  RenderMaterial,
  RenderMaterialId
} from "../../engine/core/primitives/material.render";
import { applyWorldTransform, applyUiTransform, worldToScreen, screenToWorld } from "./util";
import type { RenderBackendPort } from "../../engine/core/ports/renderbackend.all";

/** Browser-safe dev flag (Vite/import.meta first; fallback to process if present). */
const __DEV__ = (import.meta as any).env?.DEV === true; 

/** Minimal image/atlas provider (plug in your asset system). */
export interface ImageProvider {
  get(atlasId: string): HTMLImageElement | undefined;
}

/** Registry for render materials (private to renderer). */
export class CanvasMaterialRegistry {
  private byId = new Map<RenderMaterialId, RenderMaterial>();
  register(mat: RenderMaterial) { this.byId.set(mat.id, mat); }
  get(id: RenderMaterialId) { return this.byId.get(id); }
}

/** Canvas-based implementation of the RenderBackendPort. */
export class DrawService implements RenderBackendPort {
  constructor(
    private canvas: HTMLCanvasElement,
    private ctx2d: CanvasRenderingContext2D,
    private materials: CanvasMaterialRegistry,
    private images: ImageProvider
  ) {}

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  clear(): void {
    this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ---------------------------------------------------------------------------
  // Pass control (coordinator drives these)
  // ---------------------------------------------------------------------------

  beginPass(ctx: { passId: string; space: "world" | "ui"; camera: Readonly<Camera2D> | null }): void {
    this.ctx2d.save();
    if (ctx.camera) {
      applyWorldTransform(this.ctx2d, this.canvas, ctx.camera);
    } else {
      applyUiTransform(this.ctx2d); // identity + y-down
    }
  }

  submitBatch(batch: ReadonlyArray<RenderCmd>): void {
    if (!batch.length) return;

    const first = batch[0];
    const mat = this.materials.get(first.renderMaterial);

    if (!mat) {
      if (__DEV__) console.warn(`[DrawService] Missing render material: '${first.renderMaterial}' for kind '${first.kind}'`);
      this.applyDefaultState(first.kind);
    } else {
      this.applyMaterialState(mat);
    }

    switch (first.kind) {
      case "rect":
        this.drawRects(batch as ReadonlyArray<RectCmd>);
        break;

      case "circle":
        this.drawCircles(batch as ReadonlyArray<CircleCmd>);
        break;

      case "text":
        this.drawTexts(batch as ReadonlyArray<TextCmd>);
        break;

      case "sprite":
        this.drawSprites(batch as ReadonlyArray<SpriteCmd>, mat);
        break;
    }
  }

  endPass(): void {
    this.ctx2d.restore();
  }

  // ---------------------------------------------------------------------------
  // Private helpers: state/material application + per-kind drawers
  // ---------------------------------------------------------------------------

  private applyDefaultState(kind: RenderCmd["kind"]) {
    const { ctx2d } = this;
    ctx2d.globalAlpha = 1;
    ctx2d.globalCompositeOperation = "source-over";
    ctx2d.shadowBlur = 0;
    ctx2d.shadowColor = "transparent";
    ctx2d.shadowOffsetX = 0;
    ctx2d.shadowOffsetY = 0;

    if (kind === "text") {
      ctx2d.font = "14px system-ui, sans-serif";
      ctx2d.textAlign = "left";
      ctx2d.textBaseline = "alphabetic";
      ctx2d.fillStyle = "#000";
    } else {
      ctx2d.fillStyle = "#000";
      ctx2d.strokeStyle = "#000";
      ctx2d.lineWidth = 1;
    }
  }

  private applyMaterialState(mat: RenderMaterial) {
    const { ctx2d } = this;

    ctx2d.globalCompositeOperation = "source-over";

    switch (mat.kind) {
      case "flat": {
        if (mat.fill)   ctx2d.fillStyle = mat.fill;
        if (mat.stroke) ctx2d.strokeStyle = mat.stroke;
        if (mat.lineWidth != null) ctx2d.lineWidth = mat.lineWidth;
        if (mat.opacity) ctx2d.globalAlpha = mat.opacity;
        break;
      }
      case "text": {
        ctx2d.font = mat.font;
        if (mat.align)    ctx2d.textAlign = mat.align;
        if (mat.baseline) ctx2d.textBaseline = mat.baseline;
        if (mat.shadow) {
          ctx2d.shadowBlur = mat.shadow.blur;
          ctx2d.shadowColor = mat.shadow.color;
          ctx2d.shadowOffsetX = mat.shadow.x;
          ctx2d.shadowOffsetY = mat.shadow.y;
        } else {
          ctx2d.shadowBlur = 0;
          ctx2d.shadowColor = "transparent";
          ctx2d.shadowOffsetX = 0;
          ctx2d.shadowOffsetY = 0;
        }
        break;
      }
      case "sprite": {
        switch (mat.blend) {
          case "add":      ctx2d.globalCompositeOperation = "lighter"; break;
          case "multiply": ctx2d.globalCompositeOperation = "multiply"; break;
          default:         ctx2d.globalCompositeOperation = "source-over"; break;
        }
        break;
      }
    }
  }

  private drawRects(rects: ReadonlyArray<RectCmd>) {
    for (const c of rects) this._rect(c.x, c.y, c.w, c.h);
  }

  private drawCircles(circles: ReadonlyArray<CircleCmd>) {
    for (const c of circles) this._circle(c.x, c.y, c.r);
  }

  private drawTexts(texts: ReadonlyArray<TextCmd>) {
    for (const c of texts) this._text(c.text, c.x, c.y);
  }

  private drawSprites(sprites: ReadonlyArray<SpriteCmd>, mat?: RenderMaterial) {
    const atlasId =
      (mat && mat.kind === "sprite" && mat.atlas) ||
      sprites[0]?.atlas;

    const img = atlasId ? this.images.get(atlasId) : undefined;

    if (!img) {
      if (__DEV__) console.warn(`[DrawService] Missing image for atlas '${atlasId}'`);
      for (const c of sprites) this._rect(c.x, c.y, c.w ?? 8, c.h ?? 8);
      return;
    }

    for (const c of sprites) {
      const { x, y, w = img.width, h = img.height, rotation = 0, sx = 1, sy = 1 } = c;

      this.ctx2d.save();
      this.ctx2d.translate(x, y);
      if (rotation) this.ctx2d.rotate(rotation);
      if (sx !== 1 || sy !== 1) this.ctx2d.scale(sx, sy);
      // origin at top-left; adjust if you need centered origins
      this.ctx2d.drawImage(img, 0, 0, w, h);
      this.ctx2d.restore();
    }
  }

  private _rect(x: number, y: number, w: number, h: number): void {
    this.ctx2d.fillRect(x, y, w, h);
  }

  private _text(msg: string, x: number, y: number): void {
    this.ctx2d.fillText(msg, x, y);
  }

  private _circle(x: number, y: number, r: number): void {
    if (!Number.isFinite(r) || r <= 0) return;
    const c = this.ctx2d;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  // ---------------------------------------------------------------------------
  // Optional helpers (unchanged; useful for tools/debug)
  // ---------------------------------------------------------------------------

  toWorld(cam: Camera2D, drawFn: () => void): void;
  toWorld(screenPoint: Vec2, cam: Camera2D): Vec2;
  toWorld(a: Camera2D | Vec2, b?: (() => void) | Camera2D): void | Vec2 {
    if (typeof a === "object" && "position" in a) {
      const cam = a as Camera2D;
      const fn = b as () => void;
      this.ctx2d.save();
      applyWorldTransform(this.ctx2d, this.canvas, cam);
      try { fn(); } finally { this.ctx2d.restore(); }
      return;
    } else {
      const screenPoint = a as Vec2;
      const cam = b as Camera2D;
      return screenToWorld(screenPoint, this.canvas, cam);
    }
  }

  toUi(drawFn: () => void): void {
    this.ctx2d.save();
    applyUiTransform(this.ctx2d);
    try { drawFn(); } finally { this.ctx2d.restore(); }
  }

  toScreen(worldPoint: Vec2, cam: Camera2D): Vec2 {
    return worldToScreen(worldPoint, this.canvas, cam);
  }
}

/** Factory: supply a material registry and image provider from your renderer module. */
export async function createDrawService(
  canvas: HTMLCanvasElement,
  ctx2d: CanvasRenderingContext2D,
  materials: CanvasMaterialRegistry,
  images: ImageProvider
): Promise<RenderBackendPort> {
  return new DrawService(canvas, ctx2d, materials, images);
}
