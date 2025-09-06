// main.ts
import { Engine } from "./engine/core/Engine";
import RendererCanvas from "./modules/renderer-canvas";
import DemoBouncy from "./modules/demo-bouncy";
import { DebugOverlayModule } from "./modules/debug-overlay";
import InputModule from "./modules/input";
import { createServices } from "./engine/core/Services";
import { Physics2D } from "./modules/physics-2d";
import Camera2D from "./modules/camera-2d";
import RenderCoordinator, { DEFAULT_PASSES } from "./modules/render-coordinator";

const services = createServices();

const mount = document.getElementById("mount")!;

const engine = new Engine({ width: 800, height: 600, mount, targetFPS: 60 })
  .add(DemoBouncy())
  .add(
    DebugOverlayModule({
      startVisible: false,
      hotkey: "`",
      margin: { x: 8, y: 14, line: 14 },
    })
  )
  .add(Physics2D())
  .add(InputModule())
  .add(Camera2D())
  .add(RendererCanvas())
  .add(RenderCoordinator({
    passes: DEFAULT_PASSES,       // or your custom ordering
    clearEachFrame: true,
  }))

async function run() {
  await engine.init();
  await engine.start();
}
run();
