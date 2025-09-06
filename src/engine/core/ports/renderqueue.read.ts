import { RenderFn } from "../Types";

export interface RenderQueueReadPort {
  /** Get & clear the queue for a pass (used by coordinator). */
  drain(passId: string): Array<{ z: number; draw: RenderFn }>;
}