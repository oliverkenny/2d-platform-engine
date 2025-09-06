import { defineToken } from "../Token";
import type { Camera2DPort } from "../ports";
import type { Camera2DWritePort } from "../ports";
import type { Camera2DReadPort } from "../ports";

export const CAMERA_2D_WRITE = defineToken<Camera2DWritePort>('CAMERA_2D_WRITE');
export const CAMERA_2D_READ = defineToken<Camera2DReadPort>('CAMERA_2D_READ');
export const CAMERA_2D = defineToken<Camera2DPort>('CAMERA_2D');