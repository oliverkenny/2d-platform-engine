import { defineToken } from "../Token";
import type { RenderQueueReadPort, RenderQueueWritePort, RenderQueuePort } from "../ports";

export const RENDER_QUEUE_READ = defineToken<RenderQueueReadPort>("render/queue/read");
export const RENDER_QUEUE_WRITE = defineToken<RenderQueueWritePort>("render/queue/write");
export const RENDER_QUEUE = defineToken<RenderQueuePort>("render/queue");