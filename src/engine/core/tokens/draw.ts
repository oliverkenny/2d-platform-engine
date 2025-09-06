import { defineToken } from "../Token";
import type { DrawServicePort } from "../ports/draw.all";

export const DRAW_ALL = defineToken<DrawServicePort>('DRAW_ALL');