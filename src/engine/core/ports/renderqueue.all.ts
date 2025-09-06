import { RenderQueueReadPort } from "./renderqueue.read";
import { RenderQueueWritePort } from "./renderqueue.write";

export interface RenderQueuePort extends RenderQueueReadPort, RenderQueueWritePort {}