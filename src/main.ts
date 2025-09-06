// main.ts
import { Engine } from './engine/core/Engine'
import RendererCanvas from './modules/renderer-canvas'
import DemoBouncy from './modules/demo-bouncy'
import { DebugOverlayModule } from './modules/debug-overlay'
import InputModule from './modules/input'
import { createServices } from './engine/core/Services'
import { Physics2D } from './modules/physics-2d'

const services = createServices()

const mount = document.getElementById('mount')!

const engine = new Engine({ width: 800, height: 600, mount, targetFPS: 60 })
  .add(Physics2D())
  .add(InputModule())
  .add(RendererCanvas())
  .add(DemoBouncy())
  .add(DebugOverlayModule({
    startVisible: false,
    hotkey: '`',
    margin: { x: 8, y: 14, line: 14 }
  }))

async function run() {
  await engine.init()
  await engine.start()
}
run()
