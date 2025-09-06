import { RenderFn } from "../Types";

export interface RenderQueueWritePort {
  /** Register a pass id so queues exist up-front (optional but nice). */
  registerPass(id: string): void;
  /** Enqueue a call for a pass (z default 0). */
  enqueue(passId: string, fn: RenderFn, z?: number): void;
}