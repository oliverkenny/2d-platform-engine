import type { RenderFn } from "../../engine/core/Types";
import { RenderQueuePort, RenderQueueReadPort, RenderQueueWritePort } from "../../engine/core/ports";

export function createRenderQueueService(): RenderQueuePort & RenderQueueReadPort & RenderQueueWritePort {
  const queues = new Map<string, Array<{ z: number; draw: RenderFn }>>();

  return {
    registerPass(id) {
      if (!queues.has(id)) queues.set(id, []);
    },
    enqueue(passId, draw, z = 0) {
      if (!queues.has(passId)) queues.set(passId, []);
      queues.get(passId)!.push({ z, draw });
    },
    drain(passId) {
      const arr = queues.get(passId) ?? [];
      queues.set(passId, []);      // clear for next frame
      // stable sort by z
      return arr.sort((a, b) => a.z - b.z);
    },
  };
}