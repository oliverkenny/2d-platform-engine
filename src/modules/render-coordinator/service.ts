import type { RenderQueueWritePort, RenderQueueReadPort } from "../../engine/core/ports";
import type { RenderCmd } from "../../engine/core/primitives/render";

export function createRenderQueueService(): RenderQueueWritePort & RenderQueueReadPort & {
  registerPass(id: string): void;
} {
  const byPass = new Map<string, RenderCmd[]>();

  return {
    registerPass(id) { if (!byPass.has(id)) byPass.set(id, []); },

    push(cmd) {
      const arr = byPass.get(cmd.passId) ?? [];
      arr.push(cmd);
      byPass.set(cmd.passId, arr);
    },

    pushMany(cmds) { for (const c of cmds) this.push(c); },

    clearPass(passId) { byPass.set(passId, []); },

    drain(passId) {
      const arr = byPass.get(passId) ?? [];
      byPass.set(passId, []);
      return arr;
    },
  };
}