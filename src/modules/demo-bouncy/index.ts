import type { Module, GameContext } from '../../engine/core/Types'
import type { BodyId } from '../../engine/core/primitives'
import type { PhysicsReadPort, PhysicsWritePort, Camera2DPort, InputReadPort } from '../../engine/core/ports'
import { PHYSICS_READ, PHYSICS_WRITE, CAMERA_2D, INPUT_READ } from '../../engine/core/tokens'
import { Colours } from '../../util/colour'
import type { Colour } from '../../engine/core/primitives'
import { PreloadImages } from '../../util/preload'
import { loadSpriteSheet } from '../../util/spritesheet'
import { Animator } from '../../util/animator'
import { Materials } from '../../util/material'
import { queueRender } from '../../util/render'

// Use Colour, not number
type RenderBox = { body: BodyId, hx: number, hy: number, colour: Colour }

type Mover = {
  body: BodyId
  hx: number
  hy: number
  colour: Colour
  originX: number
  originY: number
  axis: 'x' | 'y'
  amplitudeM: number
  speedHz: number
}

export default function DemoBouncy(): Module {
  let playerBody: BodyId | undefined
  let boxBody: BodyId | undefined
  let boxBody2: BodyId | undefined   // <-- track the 2nd crate
  let groundBody: BodyId | undefined
  let leftWallBody: BodyId | undefined
  let rightWallBody: BodyId | undefined

  const staticPlatforms: RenderBox[] = []
  const movers: Mover[] = []

  const player = { speedPx: 140, dir: 1 as -1 | 1, attacking: false, jumping: false, moving: false }

  let physics_read!: PhysicsReadPort
  let physics_write!: PhysicsWritePort
  let inputState!: InputReadPort
  let camera!: Camera2DPort

  let ready = false
  let progress = 0

  const manifest = {
    background: '/assets/background.jpg',
    player: '/assets/character.png',
    blocks: '/assets/tiles/blocks.png',
  }

  let playerImg: HTMLImageElement | undefined
  let playerAnim: Animator | undefined

  let tSec = 0

  // keep the ground width for rendering
  let groundHalfWidthM = 0

  const playIfDifferent = (name: string) => {
    if (!playerAnim) return
    if (playerAnim.clip !== name) playerAnim.play(name, true)
  }

  return {
    id: 'demo/bouncy-rect-physics-large',

    async start(ctx: GameContext) {
      physics_read = ctx.services.getOrThrow(PHYSICS_READ)
      physics_write = ctx.services.getOrThrow(PHYSICS_WRITE)
      inputState = ctx.services.getOrThrow(INPUT_READ)
      camera = ctx.services.getOrThrow(CAMERA_2D)

      const [_, sheet] = await Promise.all([
        PreloadImages(ctx, manifest, (loaded, total) => { progress = loaded / total }),
        loadSpriteSheet('/assets/character.json'),
      ])
      playerImg = ctx.services.assets.getImage('player')!
      playerAnim = new Animator(sheet, 'idle')

      const { width, height } = ctx.config
      const ppm = camera.get().ppm
      const pxToMeters = (px: number) => px / ppm
      const screenYpxToWorldMeters = (y_px: number) => (height - y_px) / ppm

      const levelWidthPx = width * 5
      groundHalfWidthM = pxToMeters(levelWidthPx / 2)

      physics_write.setGravity({ x: 0, y: -9.81 })

      playerBody = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(64), y: screenYpxToWorldMeters(32) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(16), hy: pxToMeters(16) }, material: { friction: 0.8, restitution: 0 } }],
        linearDamping: 0.01, angularDamping: 0.01, bullet: true,
        userData: { tag: 'player' },
      })

      boxBody = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(220), y: screenYpxToWorldMeters(40) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(20), hy: pxToMeters(20) }, material: { friction: 0.5, restitution: 0.6 } }],
        userData: { tag: 'crate' },
      })
      boxBody2 = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(900), y: screenYpxToWorldMeters(40) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(20), hy: pxToMeters(20) }, material: { friction: 0.5, restitution: 0.2 } }],
        userData: { tag: 'crate' },
      })

      const addStaticPlatform = (xPx: number, yPx: number, wPx: number, hPx: number, colour: Colour = Colours.BROWN) => {
        const hx = pxToMeters(wPx / 2)
        const hy = pxToMeters(hPx / 2)
        const body = physics_write.createBody({
          type: 'static',
          position: { x: pxToMeters(xPx), y: screenYpxToWorldMeters(yPx) },
          shapes: [{ shape: { type: 'box', hx, hy }, material: Materials.Grass }],
          userData: { tag: 'platform' },
        })
        staticPlatforms.push({ body, hx, hy, colour })
      }

      const addMover = (opts: {
        xPx: number, yPx: number, wPx: number, hPx: number,
        axis: 'x' | 'y', amplitudePx: number, speedHz: number, colour?: Colour
      }) => {
        const hx = pxToMeters(opts.wPx / 2)
        const hy = pxToMeters(opts.hPx / 2)
        const body = physics_write.createBody({
          type: 'kinematic',               // <-- kinematic, not dynamic
          position: { x: pxToMeters(opts.xPx), y: screenYpxToWorldMeters(opts.yPx) },
          shapes: [{ shape: { type: 'box', hx, hy }, material: { friction: 1.0, restitution: 0 } }],
          fixedRotation: true,             // keep level
          linearDamping: 0.0,
          angularDamping: 10.0,
          userData: { tag: 'moving-platform' },
        })
        const t = physics_read.getTransform(body)!
        movers.push({
          body, hx, hy, colour: opts.colour ?? Colours.DARK_GREY,
          originX: t.x, originY: t.y,
          axis: opts.axis,
          amplitudeM: pxToMeters(opts.amplitudePx),
          speedHz: opts.speedHz
        })
      }

      // Layout (unchanged from my previous message)
      addStaticPlatform(300, 180, 96, 24)
      addStaticPlatform(520, 240, 64, 24)
      addStaticPlatform(740, 300, 64, 24)
      addStaticPlatform(1000, 220, 160, 32)
      addStaticPlatform(1250, 160, 96, 24)
      addStaticPlatform(1500, 260, 220, 28)
      addStaticPlatform(1750, 200, 64, 20)
      addStaticPlatform(1870, 240, 64, 20)
      addStaticPlatform(1990, 280, 64, 20)
      addStaticPlatform(2200, 360, 120, 24)
      addMover({ xPx: 1050, yPx: 120, wPx: 96, hPx: 20, axis: 'x', amplitudePx: 140, speedHz: 0.4 })
      addMover({ xPx: 1680, yPx: 180, wPx: 96, hPx: 20, axis: 'y', amplitudePx: 100, speedHz: 0.6 })
      addStaticPlatform(2450, 220, 180, 24)
      addStaticPlatform(2700, 180, 80, 24)
      addStaticPlatform(2900, 260, 160, 24)
      addStaticPlatform(3150, 320, 120, 24)

      groundBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(levelWidthPx / 2), y: screenYpxToWorldMeters(height - 8) },
        shapes: [{ shape: { type: 'box', hx: groundHalfWidthM, hy: pxToMeters(8) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'ground' },
      })

      leftWallBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(-8), y: screenYpxToWorldMeters(height / 2) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(8), hy: pxToMeters(height / 2) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'wall' },
      })

      rightWallBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(levelWidthPx + 8), y: screenYpxToWorldMeters(height / 2) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(8), hy: pxToMeters(height / 2) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'wall' },
      })

      ready = true
    },

    update(_ctx, dt) {
      if (!ready) return
      tSec += dt

      const left = inputState.isDown('ArrowLeft') || inputState.isDown('a')
      const right = inputState.isDown('ArrowRight') || inputState.isDown('d')
      const up = inputState.isDown('ArrowUp') || inputState.isDown('w')
      const attack = inputState.isDown(' ') || inputState.isDown('z')

      player.moving = left !== right
      player.attacking = attack

      if (physics_read && physics_write && playerBody != null) {
        const vel = physics_read.getVelocity(playerBody) ?? { vx: 0, vy: 0, w: 0 }

        const ppm = camera.get().ppm
        let vx = 0
        if (left) vx = -player.speedPx / ppm
        if (right) vx = +player.speedPx / ppm
        if (vx !== 0) player.dir = vx > 0 ? 1 : -1

        const canJump = Math.abs(vel.vy * ppm) < 5
        let vy = vel.vy
        if (up && canJump) vy = +360 / ppm

        physics_write.setVelocity(playerBody, { vx, vy, w: vel.w })
        player.jumping = Math.abs(vy * ppm) > 5 && !attack
      }

      // Kinematic platform motion
      // Move kinematic platforms along simple sine paths via velocity
      // Drive kinematic platforms by setting their next transform every frame
      for (const m of movers) {
        const omega = 2 * Math.PI * m.speedHz
        const s = Math.sin(omega * tSec)

        const targetX = m.axis === 'x' ? m.originX + m.amplitudeM * s : m.originX
        const targetY = m.axis === 'y' ? m.originY + m.amplitudeM * s : m.originY

        physics_write.setKinematicTarget(m.body, { x: targetX, y: targetY, angle: 0 })
      }

      // Camera follow
      if (playerBody && physics_read) {
        const p = physics_read.getTransform(playerBody)
        if (p) camera.follow({ x: p.x, y: p.y }, { lerp: 0.2, deadzoneHalf: { x: 2, y: 1 } })
      }

      if (player.attacking) playIfDifferent('attack')
      else if (player.jumping) playIfDifferent('jump')
      else if (player.moving) playIfDifferent('walk')
      else playIfDifferent('idle')

      playerAnim?.update(dt)
    },

    render(ctx, _alpha) {
      const cam = camera.get()

      const bg = ctx.services.assets.getImage('background')
      if (bg) {
        queueRender(ctx, 'background', (d) => { d.sprite(bg, 0, 0) }, -1000)
      }

      if (!ready) {
        queueRender(ctx, 'ui', (d) => {
          const w = Math.floor(ctx.config.width * 0.6)
          const h = 8
          const x = Math.floor((ctx.config.width - w) / 2)
          const y = Math.floor((ctx.config.height - h) / 2)
          d.rect(x, y, w, h, Colours.BLACK)
          d.rect(x, y, Math.max(1, Math.floor(w * progress)), h, Colours.BLUE)
          d.text(`Loading ${(progress * 100) | 0}%`, x, y - 10, Colours.WHITE)
        }, 1000)
        return
      }

      queueRender(ctx, 'world', (d, worldCam) => {
        if (!worldCam) return

        if (playerImg && playerAnim && playerBody && physics_read) {
          const t = physics_read.getTransform(playerBody)!
          const { sx, sy, sw, sh } = playerAnim.sourceRect
          const pxToMeters = 1 / worldCam.ppm
          const scaleX = 2 * player.dir * pxToMeters
          const scaleY = 2 * pxToMeters
          d.sprite(playerImg, t.x, t.y, { sx, sy, sw, sh, ox: sw / 2, oy: sh / 2, scaleX, scaleY, rotation: t.angle })
        }

        // Draw both crates
        for (const b of [boxBody, boxBody2]) {
          if (!b) continue
          const t = physics_read.getTransform(b)
          if (t) d.rect(t.x - 0.4, t.y - 0.4, 0.8, 0.8, Colours.BLUE)
        }

        for (const p of staticPlatforms) {
          const t = physics_read.getTransform(p.body)!
          d.rect(t.x - p.hx, t.y - p.hy, p.hx * 2, p.hy * 2, p.colour)
        }

        for (const m of movers) {
          const t = physics_read.getTransform(m.body)!
          d.rect(t.x - m.hx, t.y - m.hy, m.hx * 2, m.hy * 2, m.colour)
        }

        if (groundBody && physics_read) {
          const g = physics_read.getTransform(groundBody)!
          d.rect(g.x - groundHalfWidthM, g.y - 0.16, groundHalfWidthM * 2, 0.32, Colours.BLACK)
        }
      }, 10)

      queueRender(ctx, 'ui', (d) => {
        if (playerBody && physics_read) {
          const t = physics_read.getTransform(playerBody)!
          const s = d.toScreen({ x: t.x, y: t.y }, cam)
          d.text('Player', s.x - 16, s.y - 10, Colours.WHITE)
        }
      }, 100)
    }
  }
}
