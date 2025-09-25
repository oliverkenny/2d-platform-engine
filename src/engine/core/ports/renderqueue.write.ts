import type { RenderCmd } from "../primitives/render";

export interface RenderQueueWritePort {
  push(cmd: RenderCmd): void;
  pushMany(cmds: RenderCmd[]): void;
  clearPass(passId: string): void;
}