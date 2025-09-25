// engine/core/tokens/internal.ts
import { defineToken } from "../Token";
import type { RenderBackendPort } from "../ports/renderbackend.all";

/** @internal Do NOT export from any public barrel. */
export const RENDER_BACKEND = defineToken<RenderBackendPort>("INTERNAL_RENDER_BACKEND");