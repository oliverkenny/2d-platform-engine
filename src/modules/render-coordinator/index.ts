// modules/render-coordinator/index.ts
import type { Module } from "../../engine/core/Types";
import type { Camera2DReadPort, DrawServicePort } from "../../engine/core/ports";
import type { Camera2D, Space } from "../../engine/core/primitives";
import { DRAW_ALL, CAMERA_2D, RENDER_QUEUE } from "../../engine/core/tokens";
import { createRenderQueueService } from "./service";

export default function RenderCoordinator(cfg?: Partial<RenderCoordinatorConfig>): Module {
  const passes = (cfg?.passes ?? DEFAULT_PASSES).slice();
  const clearEachFrame = cfg?.clearEachFrame ?? true;

  let draw!: DrawServicePort;
  let defaultCamSvc!: Camera2DReadPort;
  const rq = createRenderQueueService();

  return {
    id: "render/coordinator",

    init(ctx) {
      console.log("RenderCoordinator: passes", passes);
      // Register the queue service so modules can enqueue
      ctx.services.set(RENDER_QUEUE, rq);

      // Pre-register pass ids (optional)
      for (const p of passes) rq.registerPass(p.id);
    },

    start(ctx) {
      // Get services we need
      draw = ctx.services.getOrThrow(DRAW_ALL);
      defaultCamSvc = ctx.services.getOrThrow(CAMERA_2D);
    },

    render(ctx) {
      if (clearEachFrame) draw.clear();

      for (const p of passes) {
        const items = rq.drain(p.id);
        if (!items.length) continue;

        if (p.clearBefore) draw.clear();

        if (p.space === "world") {
          const cam = defaultCamSvc.get() as Readonly<Camera2D>;
          draw.toWorld(cam, () => {
            for (const it of items) it.draw(draw, cam);
          });
        } else {
          draw.toUi(() => {
            for (const it of items) it.draw(draw);
          });
        }
      }
    },
  };
}

export interface RenderPassConfig {
  /** Unique id; modules publish events as `render/<id>` */
  id: string;
  /** "ui" or "world" */
  space: Space;
  /** Optional custom camera token for this pass (defaults to CAMERA_2D) */
  cameraToken?: symbol;
  /** Optional: clear the surface right before this pass (default: false). */
  clearBefore?: boolean;
}

export interface RenderCoordinatorConfig {
  /** Ordered list of passes to render each frame. */
  passes: RenderPassConfig[];
  /** If true, clear once at the start of render() (default: true). */
  clearEachFrame?: boolean;
}

export const DEFAULT_PASSES: RenderPassConfig[] = [
  { id: "background", space: "ui" },
  { id: "world",      space: "world" },
  { id: "fx",         space: "ui" },
  { id: "ui",         space: "ui" },
  { id: "debug",      space: "ui" },
];