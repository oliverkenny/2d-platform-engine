// src/modules/demo-bouncy/index.ts
import type { Module, GameContext } from '../../engine/core/Types';
import type { BodyId } from '../../engine/core/primitives';

import type {
  PhysicsReadPort,
  PhysicsWritePort,
  Camera2DReadPort,
  InputReadPort,
  RenderQueueWritePort,
  Camera2DWritePort
} from '../../engine/core/ports';

import {
  PHYSICS_READ,
  PHYSICS_WRITE,
  CAMERA_2D_READ,
  CAMERA_2D_WRITE,
  INPUT_READ,
  RENDER_QUEUE_WRITE
} from '../../engine/core/tokens';

import { Colours } from '../../util/colour';
import type { Colour } from '../../engine/core/primitives';
import { PreloadImages } from '../../util/preload';
import { loadSpriteSheet } from '../../util/spritesheet';
import { Animator } from '../../util/animator';
import { Materials } from '../../util/material';

type RenderBox = { body: BodyId, hx: number, hy: number, colour: Colour };

type Mover = {
  body: BodyId;
  hx: number;
  hy: number;
  colour: Colour;
  originX: number;
  originY: number;
  axis: 'x' | 'y';
  amplitudeM: number;
  speedHz: number;
};

export default function DemoBouncy(): Module {
  let playerBody: BodyId | undefined;
  let boxBody: BodyId | undefined;
  let boxBody2: BodyId | undefined;
  let groundBody: BodyId | undefined;

  const staticPlatforms: RenderBox[] = [];
  const movers: Mover[] = [];

  const player = { speedPx: 140, dir: 1 as -1 | 1, attacking: false, jumping: false, moving: false };

  let physics_read!: PhysicsReadPort;
  let physics_write!: PhysicsWritePort;
  let inputState!: InputReadPort;
  let cameraRead!: Camera2DReadPort;
  let cameraWrite!: Camera2DWritePort;
  let rq!: RenderQueueWritePort;

  let ready = false;
  let progress = 0;

  const manifest = {
    background: '/assets/background.jpg',
    player: '/assets/character.png',
    blocks: '/assets/tiles/blocks.png',
  };

  let playerImg: HTMLImageElement | undefined;
  let playerAnim: Animator | undefined;

  let tSec = 0;

  // keep the ground width for rendering
  let groundHalfWidthM = 0;

  const playIfDifferent = (name: string) => {
    if (!playerAnim) return;
    if (playerAnim.clip !== name) playerAnim.play(name, true);
  };

  return {
    id: 'demo/bouncy-rect-physics-large',

    async start(ctx: GameContext) {
      physics_read  = ctx.services.getOrThrow(PHYSICS_READ);
      physics_write = ctx.services.getOrThrow(PHYSICS_WRITE);
      inputState    = ctx.services.getOrThrow(INPUT_READ);
      cameraRead    = ctx.services.getOrThrow(CAMERA_2D_READ);
      cameraWrite   = ctx.services.getOrThrow(CAMERA_2D_WRITE);
      rq            = ctx.services.getOrThrow(RENDER_QUEUE_WRITE);

      const [_, sheet] = await Promise.all([
        PreloadImages(ctx, manifest, (loaded, total) => { progress = loaded / total; }),
        loadSpriteSheet('/assets/character.json'),
      ]);
      playerImg  = ctx.services.assets.getImage('player')!;
      playerAnim = new Animator(sheet, 'idle');

      const { width, height } = ctx.config;
      const ppm = cameraRead.get().ppm;
      const pxToMeters = (px: number) => px / ppm;
      const screenYpxToWorldMeters = (y_px: number) => (height - y_px) / ppm;

      const levelWidthPx = width * 5;
      groundHalfWidthM = pxToMeters(levelWidthPx / 2);

      physics_write.setGravity({ x: 0, y: -9.81 });

      playerBody = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(64), y: screenYpxToWorldMeters(32) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(16), hy: pxToMeters(16) }, material: { friction: 0.8, restitution: 0 } }],
        linearDamping: 0.01, angularDamping: 0.01, bullet: true,
        userData: { tag: 'player' },
      });

      boxBody = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(220), y: screenYpxToWorldMeters(40) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(20), hy: pxToMeters(20) }, material: { friction: 0.5, restitution: 0.6 } }],
        userData: { tag: 'crate' },
      });

      boxBody2 = physics_write.createBody({
        type: 'dynamic',
        position: { x: pxToMeters(900), y: screenYpxToWorldMeters(40) },
        shapes: [{ shape: { type: 'box', hx: pxToMeters(20), hy: pxToMeters(20) }, material: { friction: 0.5, restitution: 0.2 } }],
        userData: { tag: 'crate' },
      });

      const addStaticPlatform = (xPx: number, yPx: number, wPx: number, hPx: number, colour: Colour = Colours.BROWN) => {
        const hx = pxToMeters(wPx / 2);
        const hy = pxToMeters(hPx / 2);
        const body = physics_write.createBody({
          type: 'static',
          position: { x: pxToMeters(xPx), y: screenYpxToWorldMeters(yPx) },
          shapes: [{ shape: { type: 'box', hx, hy }, material: Materials.Grass }],
          userData: { tag: 'platform' },
        });
        staticPlatforms.push({ body, hx, hy, colour });
      };

      const addMover = (opts: {
        xPx: number, yPx: number, wPx: number, hPx: number,
        axis: 'x' | 'y', amplitudePx: number, speedHz: number, colour?: Colour
      }) => {
        const hx = pxToMeters(opts.wPx / 2);
        const hy = pxToMeters(opts.hPx / 2);
        const body = physics_write.createBody({
          type: 'kinematic',
          position: { x: pxToMeters(opts.xPx), y: screenYpxToWorldMeters(opts.yPx) },
          shapes: [{ shape: { type: 'box', hx, hy }, material: { friction: 1.0, restitution: 0 } }],
          fixedRotation: true,
          linearDamping: 0.0,
          angularDamping: 10.0,
          userData: { tag: 'moving-platform' },
        });
        const t = physics_read.getTransform(body)!;
        movers.push({
          body, hx, hy, colour: opts.colour ?? Colours.DARK_GREY,
          originX: t.x, originY: t.y,
          axis: opts.axis,
          amplitudeM: pxToMeters(opts.amplitudePx),
          speedHz: opts.speedHz
        });
      };

      // Level layout
      addStaticPlatform(300, 180, 96, 24);
      addStaticPlatform(520, 240, 64, 24);
      addStaticPlatform(740, 300, 64, 24);
      addStaticPlatform(1000, 220, 160, 32);
      addStaticPlatform(1250, 160, 96, 24);
      addStaticPlatform(1500, 260, 220, 28);
      addStaticPlatform(1750, 200, 64, 20);
      addStaticPlatform(1870, 240, 64, 20);
      addStaticPlatform(1990, 280, 64, 20);
      addStaticPlatform(2200, 360, 120, 24);
      addMover({ xPx: 1050, yPx: 120, wPx: 96, hPx: 20, axis: 'x', amplitudePx: 140, speedHz: 0.4 });
      addMover({ xPx: 1680, yPx: 180, wPx: 96, hPx: 20, axis: 'y', amplitudePx: 100, speedHz: 0.6 });
      addStaticPlatform(2450, 220, 180, 24);
      addStaticPlatform(2700, 180, 80, 24);
      addStaticPlatform(2900, 260, 160, 24);
      addStaticPlatform(3150, 320, 120, 24);

      groundBody = physics_write.createBody({
        type: 'static',
        position: { x: pxToMeters(levelWidthPx / 2), y: screenYpxToWorldMeters(height - 8) },
        shapes: [{ shape: { type: 'box', hx: groundHalfWidthM, hy: pxToMeters(8) }, material: { friction: 0.9, restitution: 0.0 } }],
        userData: { tag: 'ground' },
      });

      ready = true;
    },

    update(_ctx, dt) {
      if (!ready) return;
      tSec += dt;

      const left   = inputState.isDown('ArrowLeft')  || inputState.isDown('a');
      const right  = inputState.isDown('ArrowRight') || inputState.isDown('d');
      const up     = inputState.isDown('ArrowUp')    || inputState.isDown('w');
      const attack = inputState.isDown(' ') || inputState.isDown('z');

      player.moving    = left !== right;
      player.attacking = attack;

      if (physics_read && physics_write && playerBody != null) {
        const vel = physics_read.getVelocity(playerBody) ?? { vx: 0, vy: 0, w: 0 };

        const ppm = cameraRead.get().ppm;
        let vx = 0;
        if (left)  vx = -player.speedPx / ppm;
        if (right) vx = +player.speedPx / ppm;
        if (vx !== 0) player.dir = vx > 0 ? 1 : -1;

        const canJump = Math.abs(vel.vy * ppm) < 5;
        let vy = vel.vy;
        if (up && canJump) vy = +360 / ppm;

        physics_write.setVelocity(playerBody, { vx, vy, w: vel.w });
        player.jumping = Math.abs(vy * ppm) > 5 && !attack;
      }

      // Kinematic platform motion
      for (const m of movers) {
        const omega = 2 * Math.PI * m.speedHz;
        const s = Math.sin(omega * tSec);
        const targetX = m.axis === 'x' ? m.originX + m.amplitudeM * s : m.originX;
        const targetY = m.axis === 'y' ? m.originY + m.amplitudeM * s : m.originY;
        physics_write.setKinematicTarget(m.body, { x: targetX, y: targetY, angle: 0 });
      }

      // Camera follow
      if (playerBody && physics_read) {
        const p = physics_read.getTransform(playerBody);
        if (p) cameraWrite.follow({ x: p.x, y: p.y }, { lerp: 0.2, deadzoneHalf: { x: 2, y: 1 } });
      }

      if (player.attacking)      playIfDifferent('attack');
      else if (player.jumping)   playIfDifferent('jump');
      else if (player.moving)    playIfDifferent('walk');
      else                       playIfDifferent('idle');

      playerAnim?.update(dt);
    },

    render(ctx, _alpha) {
      const cmds: any[] = [];

      // ---------------------------------------------------------------------
      // UI: background image and loading bar/text while assets load
      // ---------------------------------------------------------------------
      if (!ready) {
        const passId = "ui";
        const layer  = "hud";

        // Loading bar
        const w = Math.floor(ctx.config.width * 0.6);
        const h = 8;
        const x = Math.floor((ctx.config.width  - w) / 2);
        const y = Math.floor((ctx.config.height - h) / 2);

        cmds.push(
          { kind:"rect", passId, space:"ui", layer, z:1000, renderMaterial:"flat/black", x, y, w, h },
          { kind:"rect", passId, space:"ui", layer, z:1001, renderMaterial:"flat/blue",  x, y, w: Math.max(1, Math.floor(w * progress)), h },
          { kind:"text", passId, space:"ui", layer, z:1002, renderMaterial:"text/default", x, y: y-10, text:`Loading ${(progress * 100) | 0}%` }
        );

        rq.pushMany(cmds);
        return;
      }

      // Optional UI background image (cover screen)
      const bg = ctx.services.assets.getImage('background');
      if (bg) {
        cmds.push({
          kind: "sprite",
          passId: "ui",
          space: "ui",
          layer: "hud-bg",
          z: -1000,
          renderMaterial: "sprite/default",
          x: 0, y: 0,
          w: ctx.config.width,
          h: ctx.config.height,
          atlas: "background"
        });
      }

      // ---------------------------------------------------------------------
      // WORLD: player, crates, platforms, ground
      // ---------------------------------------------------------------------
      const cam = cameraRead.get();
      const ppm = cam.ppm;

      // Player (whole image; spritesheet sub-rect not yet in RenderCmd schema)
      if (playerImg && playerBody && physics_read) {
        const t = physics_read.getTransform(playerBody)!;

        // desired on-screen scale = 2x (as before)
        const pixelsPerMeter = ppm;
        const metersPerPixel = 1 / pixelsPerMeter;
        const scale = 2 * metersPerPixel;

        const w = playerImg.width  * scale;
        const h = playerImg.height * scale;

        // Center on body; if flipped, offset x by +w to compensate for negative scale
        const flip = player.dir < 0 ? -1 : 1;
        const x = t.x - w * 0.5 + (flip < 0 ? w : 0);
        const y = t.y - h * 0.5;

        cmds.push({
          kind: "sprite",
          passId: "world",
          space: "world",
          layer: "actors",
          z: 0,
          renderMaterial: "sprite/default",
          x, y, w, h,
          atlas: "player",
          rotation: t.angle,
          sx: flip,    // mirror horizontally when facing left
          sy: 1
        });
      }

      // Crates
      for (const b of [boxBody, boxBody2]) {
        if (!b) continue;
        const t = physics_read.getTransform(b);
        if (!t) continue;
        cmds.push({
          kind: "rect",
          passId: "world",
          space: "world",
          layer: "props",
          z: 0,
          renderMaterial: "flat/blue",
          x: t.x - 0.4,
          y: t.y - 0.4,
          w: 0.8,
          h: 0.8,
          aabb: { x: t.x - 0.4, y: t.y - 0.4, w: 0.8, h: 0.8 }
        });
      }

      // Static platforms
      for (const p of staticPlatforms) {
        const t = physics_read.getTransform(p.body)!;
        cmds.push({
          kind: "rect",
          passId: "world",
          space: "world",
          layer: "terrain",
          z: 0,
          renderMaterial: "flat/brown",
          x: t.x - p.hx,
          y: t.y - p.hy,
          w: p.hx * 2,
          h: p.hy * 2,
          aabb: { x: t.x - p.hx, y: t.y - p.hy, w: p.hx * 2, h: p.hy * 2 }
        });
      }

      // Movers
      for (const m of movers) {
        const t = physics_read.getTransform(m.body)!;
        cmds.push({
          kind: "rect",
          passId: "world",
          space: "world",
          layer: "terrain",
          z: 0,
          renderMaterial: "flat/darkgrey",
          x: t.x - m.hx,
          y: t.y - m.hy,
          w: m.hx * 2,
          h: m.hy * 2,
          aabb: { x: t.x - m.hx, y: t.y - m.hy, w: m.hx * 2, h: m.hy * 2 }
        });
      }

      // Ground
      if (groundBody && physics_read) {
        const g = physics_read.getTransform(groundBody)!;
        cmds.push({
          kind: "rect",
          passId: "world",
          space: "world",
          layer: "terrain",
          z: -1,
          renderMaterial: "flat/black",
          x: g.x - groundHalfWidthM,
          y: g.y - 0.16,
          w: groundHalfWidthM * 2,
          h: 0.32,
          aabb: { x: g.x - groundHalfWidthM, y: g.y - 0.16, w: groundHalfWidthM * 2, h: 0.32 }
        });
      }

      // ---------------------------------------------------------------------
      // UI overlay: player label
      // ---------------------------------------------------------------------
      if (playerBody && physics_read) {
        const t = physics_read.getTransform(playerBody)!;
        // For labels in UI space, we can approximate by letting the coordinator convert/cull.
        // If you prefer exact placement, convert to screen via a helper in the renderer backend.
        // Here we place the label into UI pass directly using toScreen would require draw; we avoid it.
        // We'll let the coordinator skip conversion and just overlay near center by z-order.
        // Better approach: add a small world->screen conversion helper port; for now keep it simple.
        // Use the camera to derive a screen-space anchor:
        const cx = ctx.config.width  * 0.5;
        const cy = ctx.config.height * 0.5;
        // Not exact, but if you want exact, wire a tiny converter port.
        // (Or push a world-space text material and let backend scale; text in world will scale with zoom.)
        // We'll render text in world space above the player so it follows camera properly:
        cmds.push({
          kind: "text",
          passId: "world",
          space: "world",
          layer: "overlay",
          z: 10,
          renderMaterial: "text/default",
          x: t.x - 0.25,
          y: t.y + 0.6,
          text: "Player"
        } as any);
      }

      if (cmds.length) rq.pushMany(cmds);
    }
  };
}
