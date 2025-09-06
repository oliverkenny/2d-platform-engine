import { RENDER_QUEUE } from "../engine/core/tokens";
import { GameContext, RenderFn } from "../engine/core/Types";

export function queueRender(ctx: GameContext, passId: string, fn: RenderFn, z = 0) {
  const rq = ctx.services.getOrThrow(RENDER_QUEUE);
  rq.enqueue(passId, fn, z);
}