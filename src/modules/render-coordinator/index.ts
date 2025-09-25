// src/modules/render-coordinator/index.ts

/**
 * RenderCoordinator: drains render commands per pass, culls/sorts/batches them,
 * and submits to the renderer. Modules only get the write port.
 */
import type { Module } from "../../engine/core/Types";
import type { Camera2DReadPort } from "../../engine/core/ports";
import type { Camera2D, RenderSpace } from "../../engine/core/primitives";
import type { RenderCmd } from "../../engine/core/primitives/render";
import { CAMERA_2D_READ, RENDER_QUEUE_WRITE, RENDER_QUEUE_READ } from "../../engine/core/tokens";
import { RENDER_BACKEND } from "../../engine/core/tokens/internal";
import type { RenderBackendPort } from "../../engine/core/ports/renderbackend.all";
import { createRenderQueueService } from "./service";

/** Default layer ordering hints (can be overridden per pass) */
const WORLD_LAYERS = [
  "background",  // parallax sky, far scenery
  "terrain",     // tiles/ground
  "props",       // static/dynamic props
  "actors",      // players/NPCs
  "effects",     // particles, trails
  "foreground",  // close scenery
  "overlay",     // hit flashes, highlights
];

const UI_LAYERS = [
  "hud-bg",
  "hud",
  "hud-fore",
  "debug",
];

/** Default render passes in submission order */
export const DEFAULT_PASSES: ReadonlyArray<RenderPassConfig> = [
  { id: "ui",         space: "ui",    layerOrder: UI_LAYERS   },
  { id: "foreground", space: "world", layerOrder: WORLD_LAYERS },
  { id: "world",      space: "world", layerOrder: WORLD_LAYERS },
  { id: "background", space: "world", layerOrder: WORLD_LAYERS },
];

export default function RenderCoordinator(cfg?: Partial<RenderCoordinatorConfig>): Module {
  const passes = (cfg?.passes ?? DEFAULT_PASSES).slice();
  const clearEachFrame = cfg?.clearEachFrame ?? true;

  let backend!: RenderBackendPort;
  let cameras!: Camera2DReadPort;

  // Single impl provides both write and read; we register them in init().
  const rq = createRenderQueueService();

  return {
    id: "render/coordinator",

    init(ctx) {
      // Expose WRITE publicly (most modules will get this in their view)
      ctx.services.set(RENDER_QUEUE_WRITE, rq as any);

      // Register known pass ids
      for (const p of passes) rq.registerPass(p.id);

      // Also register READ now; only the coordinator's scoped view will include it
      ctx.services.set(RENDER_QUEUE_READ, rq as any);
    },

    start(ctx) {
      backend = ctx.services.getOrThrow(RENDER_BACKEND);
      cameras = ctx.services.getOrThrow(CAMERA_2D_READ);
    },

    render() {
      if (clearEachFrame) backend.clear();

      for (const p of passes) {
        const cmds = (rq as any as { drain(passId: string): ReadonlyArray<RenderCmd> }).drain(p.id);
        if (!cmds.length) continue;

        if (p.clearBefore) backend.clear();

        // Culling & sorting
        const camera = p.space === "world" ? (cameras.get() as Readonly<Camera2D>) : null;

        const visible = p.space === "world"
          ? cullAgainstCamera(camera!, cmds)
          : cmds;

        const sorted = sortCommands(visible, p.layerOrder ?? []);

        // Batching and submit
        backend.beginPass({ passId: p.id, space: p.space, camera });
        for (const batch of batchByKindAndMaterial(sorted)) {
          backend.submitBatch(batch);
        }
        backend.endPass();
      }
    },
  };
}

/** Simple AABB/frustum cull in camera space (expand as needed). */
function cullAgainstCamera(cam: Readonly<Camera2D>, list: ReadonlyArray<RenderCmd>): RenderCmd[] {
  // assume cam has world visible rect; adapt to your Camera2D
  const view = (cam as any).viewAABB as { x:number; y:number; w:number; h:number } | undefined;
  if (!view) return list.slice();
  const vx = view.x, vy = view.y, vw = view.w, vh = view.h;
  return list.filter(c => {
    const a = c.aabb;
    if (!a) return true; // no aabb => keep (conservative)
    return a.x + a.w >= vx && a.x <= vx + vw && a.y + a.h >= vy && a.y <= vy + vh;
  });
}

/** Deterministic sort: layer order → z → material → kind → stable id. */
function sortCommands(list: ReadonlyArray<RenderCmd>, layerOrder: string[]): RenderCmd[] {
  const order = new Map(layerOrder.map((l,i)=>[l,i]));
  return list.slice().sort((a,b)=>{
    const la = order.get(a.layer) ?? 0, lb = order.get(b.layer) ?? 0;
    if (la !== lb) return la - lb;
    const za = a.z ?? 0, zb = b.z ?? 0;
    if (za !== zb) return za - zb;
    if (a.renderMaterial !== b.renderMaterial) return a.renderMaterial < b.renderMaterial ? -1 : 1;
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    const ia = a.id ?? "", ib = b.id ?? "";
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}

/** Greedy batching by (kind, renderMaterial). */
function* batchByKindAndMaterial(list: ReadonlyArray<RenderCmd>): Generator<RenderCmd[]> {
  let i = 0;
  while (i < list.length) {
    const k = list[i].kind, m = list[i].renderMaterial;
    const batch: RenderCmd[] = [];
    while (i < list.length && list[i].kind === k && list[i].renderMaterial === m) {
      batch.push(list[i++]);
    }
    yield batch;
  }
}

export interface RenderPassConfig {
  id: string;
  space: RenderSpace;         // "ui" or "world"
  cameraToken?: symbol;
  clearBefore?: boolean;
  layerOrder?: string[];      // ordering hint for this pass
}

export interface RenderCoordinatorConfig {
  clearEachFrame?: boolean;
  passes?: ReadonlyArray<RenderPassConfig>;
}
