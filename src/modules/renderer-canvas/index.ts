// src/modules/renderer-canvas/index.ts

/**
 * RendererCanvas module for 2D rendering using HTMLCanvasElement.
 *
 * Provides the RenderBackendPort (internal) and an InputSurfacePort.
 */

import type { Module, GameContext } from "../../engine/core/Types";
import { INPUT_SURFACE } from "../../engine/core/tokens";
import type { InputSurfacePort } from "../../engine/core/ports";

// ⬇️ Internal-only token: do NOT re-export in your public barrel.
import { RENDER_BACKEND } from "../../engine/core/tokens/internal";
import type { RenderBackendPort } from "../../engine/core/ports/renderbackend.all";

import {
  createDrawService,
  CanvasMaterialRegistry,
  type ImageProvider,
} from "./service";
import { buildMaterialDefs, DefaultPalette } from "../../engine/core/render/materials.catalogue";

export default function RendererCanvas(): Module {
  let canvas!: HTMLCanvasElement;
  let ctx2d!: CanvasRenderingContext2D;
  let surface!: InputSurfacePort;
  let backend!: RenderBackendPort;

  function resizeCanvas(ctx: GameContext, width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Update logical size exposed via the surface
    if (surface) {
      surface.logicalWidth = width;
      surface.logicalHeight = height;
    }
  }

  return {
    id: "renderer/canvas",

    async init(ctx) {
      // Create and mount canvas
      canvas = document.createElement("canvas");
      if (ctx.config.mount) ctx.config.mount.appendChild(canvas);

      // Initial sizing
      resizeCanvas(ctx, ctx.config.width, ctx.config.height);

      // 2D context
      const c = canvas.getContext("2d");
      if (!c) throw new Error("2D context not available");
      ctx2d = c;
      ctx2d.imageSmoothingEnabled = false;

      const materials = new CanvasMaterialRegistry();

        // Register the whole catalog in one go
        for (const def of buildMaterialDefs(DefaultPalette)) {
          materials.register(def);
        }

        const images: ImageProvider = {
          get: (atlasId: string) => ctx.services.assets.getImage(atlasId),
        };

      // Create the backend (RenderBackendPort)
      backend = await createDrawService(canvas, ctx2d, materials, images);

      // Expose the backend ONLY via the internal token
      ctx.services.set(RENDER_BACKEND, backend);

      // ---- Publish InputSurface (no canvas leakage outside renderer) ----
      surface = {
        element: canvas,
        logicalWidth: ctx.config.width,
        logicalHeight: ctx.config.height,
        toLogical(clientX: number, clientY: number) {
          const rect = canvas.getBoundingClientRect();
          const px = clientX - rect.left;
          const py = clientY - rect.top;
          return {
            x: (px / rect.width) * surface.logicalWidth,
            y: (py / rect.height) * surface.logicalHeight,
          };
        },
      };
      ctx.services.set(INPUT_SURFACE, surface);
      // -------------------------------------------------------------------
    },

    onEvent(ctx, e) {
      if (e.type === "render/resize") {
        resizeCanvas(ctx, e.width, e.height);
      }
    },
  };
}
