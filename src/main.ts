// src/main.ts
import { Engine } from "./engine/core/Engine";
import RendererCanvas from "./modules/renderer-canvas";
import DemoBouncy from "./modules/demo-bouncy";
import { DebugOverlayModule } from "./modules/debug-overlay";
import KeyboardInput from "./modules/keyboard-input";
import { Physics2D } from "./modules/physics-2d";
import Camera2D from "./modules/camera-2d";
import RenderCoordinator from "./modules/render-coordinator";
import PointerInput from "./modules/pointer-input";
import InputState from "./modules/input-state";

import { RENDER_BACKEND } from "./engine/core/tokens/internal"; // internal-only
import {
  CAMERA_2D_READ,
  RENDER_QUEUE_WRITE,
  RENDER_QUEUE_READ,
  CAMERA_2D_WRITE,
  PHYSICS_READ,
  PHYSICS_WRITE,
  INPUT_READ,
} from "./engine/core/tokens";
import type { Module } from "./engine/core/Types";
import type { ServiceToken } from "./engine/core/Token";

const mount = document.getElementById("mount")!;

// Decide which services each module may read post-init
const resolveWhitelist = (m: Module): ReadonlyArray<ServiceToken<any>> => {
  const baseList = [RENDER_QUEUE_WRITE, CAMERA_2D_READ, CAMERA_2D_WRITE, PHYSICS_READ, PHYSICS_WRITE, INPUT_READ];

  switch (m.id) {
    case "render/coordinator":
      // Coordinator needs queue READ, camera, and the private backend
      return [...baseList, RENDER_BACKEND];

    default:
      // Typical module can only write to the render queue and read camera
      return [...baseList];
  }
};

const engine = new Engine(
  { width: 800, height: 600, mount, targetFPS: 60 },
  { resolveWhitelist }
)
  .add(DemoBouncy())
  .add(
    DebugOverlayModule({
      startVisible: false,
      hotkey: "`",
      margin: { x: 8, y: 14, line: 14 },
    })
  )
  .add(Physics2D())
  .add(KeyboardInput())
  .add(InputState())
  .add(Camera2D())
  .add(RendererCanvas())
  .add(RenderCoordinator({ clearEachFrame: true }))
  .add(PointerInput());

async function run() {
  await engine.init();
  await engine.start();
}
run();
