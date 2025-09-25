import type { RenderCmd } from "../primitives/render";

export interface RenderQueueReadPort {
  drain(passId: string): ReadonlyArray<RenderCmd>;
}