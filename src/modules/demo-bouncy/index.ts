import type { Module, GameContext } from '../../engine/core/Types'
import type { BodyId } from '../../engine/core/primitives'
import type { PhysicsReadPort, PhysicsWritePort, DrawServicePort, Camera2DPort } from '../../engine/core/ports'
import { PHYSICS_READ, PHYSICS_WRITE, DRAW_ALL, CAMERA_2D } from '../../engine/core/tokens'
import { Colours } from '../../util/colour'
import { PreloadImages } from '../../util/preload'
import { loadSpriteSheet } from '../../util/spritesheet'
import { Animator } from '../../util/animator'
import { Materials } from '../../util/material'

export default function DemoBouncy(): Module {
  // physics body ids...
  let playerBody: BodyId | undefined
  let boxBody: BodyId | undefined
  let platformBody: BodyId | undefined
  let groundBody: BodyId | undefined
  let leftWallBody: BodyId | undefined
  let rightWallBody: BodyId | undefined

  const player = {
    speedPx: 140,
    dir: 1 as -1 | 1,
    attacking: false,
    jumping: false,
    moving: false,
  }

  // services
  let draw!: DrawServicePort
  let physics_read!: PhysicsReadPort
  let physics_write!: PhysicsWritePort
  let camera!: Camera2DPort

  // loading
  let ready = false
  let progress = 0

  // assets
  const manifest = {
    background: '/assets/background.jpg',
    player: '/assets/character.png',
    blocks: '/assets/tiles/blocks.png',
  }

  // sprite + animation
  let playerImg: HTMLImageElement | undefined
  let playerAnim: Animator | undefined

  // input
  const keys = new Set<string>()
  let offDown: (() => void) | undefined
  let offUp: (() => void) | undefined

  const playIfDifferent = (name: string) => {
    if (!playerAnim) return
    if (playerAnim.clip !== name) playerAnim.play(name, true)
  }

  return {
    id: 'demo/bouncy-rect-physics',

    init(ctx) {
      offDown = ctx.bus.on('input/keydown', e => keys.add(e.key))
      offUp   = ctx.bus.on('input/keyup',   e => keys.delete(e.key))
    },

    async start(ctx: GameContext) {
      draw          = ctx.services.getOrThrow(DRAW_ALL)
      physics_read  = ctx.services.getOrThrow(PHYSICS_READ)
      physics_write = ctx.services.getOrThrow(PHYSICS_WRITE)
      camera        = ctx.services.getOrThrow(CAMERA_2D)

      const [_, sheet] = await Promise.all([
        PreloadImages(ctx, manifest, (loaded, total) => { progress = loaded / total }),
        loadSpriteSheet('/assets/character.json'),
      ])
      playerImg = ctx.services.assets.getImage('player')!
      playerAnim = new Animator(sheet, 'idle')

      // --- Create bodies in METERS (world is y-up) ---------------------------
      const { width, height } = ctx.config
      const ppm = camera.get().ppm
      const pxToMeters = (px: number) => px / ppm
      const screenYpxToWorldMeters = (y_px: number) => (height - y_px) / ppm

      // Downwards gravity in y-up space is negative
      physics_write.setGravity({ x: 0, y: -9.81 })

      // Player (≈32x32 px)
      playerBody = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(64), y: screenYpxToWorldMeters(32) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(16), hy: pxToMeters(16) }, material: { friction: 0.8, restitution: 0 } }],
        linearDamping: 0.01, angularDamping: 0.01, bullet: true,
        userData: { tag: 'player' },
      })

      // Crate (≈40x40 px)
      boxBody = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(200), y: screenYpxToWorldMeters(40) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(20), hy: pxToMeters(20) }, material: { friction: 0.5, restitution: 0.6 } }],
        userData: { tag: 'crate' },
      })

      // Platform (≈64x64 px)
      platformBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(300), y: screenYpxToWorldMeters(200) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(32), hy: pxToMeters(32) }, material: Materials.Grass }],
        userData: { tag: 'platform' },
      })

      // Ground: full width, 16 px high, positioned at y = height - 8 px
      groundBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(width / 2), y: screenYpxToWorldMeters(height - 8) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(width / 2), hy: pxToMeters(8) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'ground' },
      })

      // Side walls
      leftWallBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(-8), y: screenYpxToWorldMeters(height / 2) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(8), hy: pxToMeters(height / 2) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'wall' },
      })

      rightWallBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(width + 8), y: screenYpxToWorldMeters(height / 2) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(8), hy: pxToMeters(height / 2) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'wall' },
      })

      ready = true
    },

    update(_ctx, dt) {
      if (!ready) return

      const left   = keys.has('ArrowLeft') || keys.has('a') || keys.has('A')
      const right  = keys.has('ArrowRight')|| keys.has('d') || keys.has('D')
      const up     = keys.has('ArrowUp')   || keys.has('w') || keys.has('W')
      const attack = keys.has(' ') || keys.has('z') || keys.has('Z')

      player.moving = left !== right
      player.attacking = attack

      if (physics_read && physics_write && playerBody != null) {
        const vel = physics_read.getVelocity(playerBody) ?? { vx: 0, vy: 0, w: 0 }

        // Convert desired px/s to m/s using camera.ppm
        const ppm = camera.get().ppm
        let vx = 0
        if (left)  vx = -player.speedPx / ppm
        if (right) vx = +player.speedPx / ppm
        if (vx !== 0) player.dir = vx > 0 ? 1 : -1

        // In y-up, upward is +Y
        const canJump = Math.abs(vel.vy * ppm) < 5
        let vy = vel.vy
        if (up && canJump) vy = +360 / ppm

        physics_write.setVelocity(playerBody, { vx, vy, w: vel.w })
        player.jumping = Math.abs(vy * ppm) > 5 && !attack
      }

      // Camera follow (platformer feel)
      if (playerBody && physics_read) {
        const p = physics_read.getTransform(playerBody)
        if (p) camera.follow({ x: p.x, y: p.y }, { lerp: 0.2, deadzoneHalf: { x: 2, y: 1 } })
      }

      // Animation state
      if (player.attacking)      playIfDifferent('attack')
      else if (player.jumping)   playIfDifferent('jump')
      else if (player.moving)    playIfDifferent('walk')
      else                       playIfDifferent('idle')

      playerAnim?.update(dt)
    },

    render(ctx, _alpha) {
      const cam = camera.get()
      draw.clear()

      // Background (UI layer, pixels)
      const bg = ctx.services.assets.getImage('background')
      if (bg) draw.toUi(() => draw.sprite(bg, 0, 0))

      if (!ready) {
        // Loading bar in UI pixels
        draw.toUi(() => {
          const w = Math.floor(ctx.config.width * 0.6)
          const h = 8
          const x = Math.floor((ctx.config.width - w) / 2)
          const y = Math.floor((ctx.config.height - h) / 2)
          draw.rect(x, y, w, h, Colours.Black)
          draw.rect(x, y, Math.max(1, Math.floor(w * progress)), h, Colours.Blue)
          draw.text(`Loading ${(progress * 100) | 0}%`, x, y - 10, Colours.White)
        })
        return
      }

      // -------- WORLD PASS (meters, y-up) ------------------------------------
      draw.toWorld(cam, () => {
        // Player
        if (playerImg && playerAnim && playerBody && physics_read) {
          const t = physics_read.getTransform(playerBody)!
          const { sx, sy, sw, sh } = playerAnim.sourceRect

          // Scale sheet pixels to meters so 1px == 1/cam.ppm meters
          const pxToMeters = 1 / cam.ppm
          const scaleX = 2 * player.dir * pxToMeters  // 2x size, flip when facing left
          const scaleY = 2 * pxToMeters

          draw.sprite(
            playerImg,
            t.x, t.y,
            { sx, sy, sw, sh, ox: sw/2, oy: sh/2, scaleX, scaleY, rotation: t.angle }
          )
        }

        // Crate (simple AABB in meters)
        if (boxBody && physics_read) {
          const t = physics_read.getTransform(boxBody)!
          draw.rect(t.x - 0.4, t.y - 0.4, 0.8, 0.8, Colours.Blue) // 0.8m box
        }

        // Platform
        if (platformBody && physics_read) {
          const t = physics_read.getTransform(platformBody)!
          draw.rect(t.x - 0.64, t.y - 0.64, 1.28, 1.28, Colours.Brown)
        }

        // Ground (full-width bar in meters)
        if (groundBody && physics_read) {
          const g = physics_read.getTransform(groundBody)!
          const worldHalfWidth = ctx.config.width / cam.ppm / 2
          draw.rect(g.x - worldHalfWidth, g.y - 0.16, worldHalfWidth * 2, 0.32, Colours.Black)
        }
      })

      // -------- UI PASS (pixels, y-down) -------------------------------------
      draw.toUi(() => {
        // Label the player (anchor UI to world point)
        if (playerBody && physics_read) {
          const t = physics_read.getTransform(playerBody)!
          const s = draw.toScreen({ x: t.x, y: t.y }, cam)
          draw.text('Player', s.x - 16, s.y - 10, Colours.White)
        }
      })
    },

    destroy() {
      offDown?.(); offUp?.(); keys.clear()
    },
  }
}
