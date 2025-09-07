import { defineToken } from "../Token";
import type { RenderQueueReadPort, RenderQueueWritePort, RenderQueuePort } from "../ports";

export const RENDER_QUEUE_READ = defineToken<RenderQueueReadPort>("RENDER_QUEUE_READ");
export const RENDER_QUEUE_WRITE = defineToken<RenderQueueWritePort>("RENDER_QUEUE_WRITE");
export const RENDER_QUEUE = defineToken<RenderQueuePort>("RENDER_QUEUE");