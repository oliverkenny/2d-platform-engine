import type { Module, GameContext } from '../../engine/core/Types'
import type { BodyId, PhysicsReadPort, PhysicsWritePort, DrawServicePort } from '../../engine/core'
import { PHYSICS_READ, PHYSICS_WRITE, DRAW_ALL } from '../../engine/core'
import { Colours } from '../../util/colour'
import { PreloadImages } from '../../util/preload'
import { loadSpriteSheet } from '../../util/spritesheet'
import { Animator } from '../../util/animator'
import { Materials } from '../../util/material'

/**
 * Demo module using the new physics service (meters/radians).
 * - Player (dynamic) + a dynamic crate
 * - Static ground + side walls
 * - Arrow/A/D to move, W/Up to jump, Space/Z to "attack" (animation only)
 */
export default function DemoBouncy(): Module {
  // ------- units: pixels <-> meters -------
  const SCALE = 50;                       // 50 px == 1 meter
  const px2m = (px: number) => px / SCALE;
  const m2px = (m: number) => m * SCALE;

  // ------- physics body ids -------
  let playerBody: BodyId | undefined;
  let boxBody: BodyId | undefined;
  let platformBody: BodyId | undefined;
  let groundBody: BodyId | undefined;
  let leftWallBody: BodyId | undefined;
  let rightWallBody: BodyId | undefined;

  // ------- player control/render state -------
  const player = {
    speedPx: 140,        // desired horizontal speed in px/s
    dir: 1 as -1 | 1,
    attacking: false,
    jumping: false,
    moving: false,
  };

  // services
  let draw!: DrawServicePort;
  let physics_read!: PhysicsReadPort;
  let physics_write!: PhysicsWritePort;

  // loading UI
  let ready = false;
  let progress = 0;

  // assets
  const manifest = {
    background: '/assets/background.jpg',
    player: '/assets/character.png',
    blocks: '/assets/tiles/blocks.png',
  };

  // sprite + animation
  let playerImg: HTMLImageElement | undefined;
  let playerAnim: Animator | undefined;

  // input
  const keys = new Set<string>();
  let offDown: (() => void) | undefined;
  let offUp: (() => void) | undefined;

  // helper: change clip only if different
  const playIfDifferent = (name: string) => {
    if (!playerAnim) return;
    if (playerAnim.clip !== name) playerAnim.play(name, true);
  };

  return {
    id: 'demo/bouncy-rect-physics',

    init(ctx) {
      offDown = ctx.bus.on('input/keydown', e => keys.add(e.key));
      offUp = ctx.bus.on('input/keyup', e => keys.delete(e.key));
    },

    async start(ctx: GameContext) {
      draw = ctx.services.getOrThrow(DRAW_ALL);
      if (!draw) {
        throw new Error('DRAW_ALL service not found — the demo cannot run without a renderer.');
      }

      physics_read = ctx.services.getOrThrow(PHYSICS_READ);
      if (!physics_read) {
        console.warn('PHYSICS_READ service not found — the demo will run without physics.');
      }

      physics_write = ctx.services.getOrThrow(PHYSICS_WRITE);
      if (!physics_write) {
        console.warn('PHYSICS_WRITE service not found — the demo will run without physics.');
      }

      const [_, sheet] = await Promise.all([
        PreloadImages(ctx, manifest, (loaded, total) => { progress = loaded / total; }),
        loadSpriteSheet('/assets/character.json'),
      ]);

      playerImg = ctx.services.assets.getImage('player')!;
      playerAnim = new Animator(sheet, 'idle');

      // ------- create physics bodies -------
      if (physics_read) {
        const { width, height } = ctx.config;

        // Y-down gravity: +9.81 m/s^2 on Y
        physics_write.setGravity({ x: 0, y: 9.81 });

        // Player (dynamic) — roughly 32x32 px box
        playerBody = physics_write.createBody({
          type: 'dynamic',
          position: { x: px2m(64), y: px2m(32) },
          shapes: [{
            shape: { type: 'box', hx: px2m(16), hy: px2m(16) },
            material: { friction: 0.8, restitution: 0.0, categoryBits: 0x0002, maskBits: 0xffff },
          }],
          linearDamping: 0.01,
          angularDamping: 0.01,
          bullet: true,
          userData: { tag: 'player' },
        });

        // Crate (dynamic) — 40x40 px box
        boxBody = physics_write.createBody({
          type: 'dynamic',
          position: { x: px2m(200), y: px2m(40) },
          shapes: [{
            shape: { type: 'box', hx: px2m(20), hy: px2m(20) },
            material: { friction: 0.5, restitution: 0.6, categoryBits: 0x0004, maskBits: 0xffff },
          }],
          userData: { tag: 'crate' },
        });

        // Floating Platform (kinematic) - 32x32 px box
        platformBody = physics_write.createBody({
          type: 'static',
          position: { x: px2m(300), y: px2m(200) },
          shapes: [{
            shape: { type: 'box', hx: px2m(32), hy: px2m(32) },
            material: Materials.Grass,
          }],
          userData: { tag: 'platform' },
        });

        // Ground (static) — full width bar 16 px high
        groundBody = physics_write.createBody({
          type: 'static',
          position: { x: px2m(width / 2), y: px2m(height - 8) },
          shapes: [{
            shape: { type: 'box', hx: px2m(width / 2), hy: px2m(8) },
            material: { friction: 0.9, restitution: 0.0, categoryBits: 0x0001, maskBits: 0xffff },
          }],
          userData: { tag: 'ground' },
        });

        // Side walls (static)
        leftWallBody = physics_write.createBody({
          type: 'static',
          position: { x: px2m(-8), y: px2m(height / 2) },
          shapes: [{
            shape: { type: 'box', hx: px2m(8), hy: px2m(height / 2) },
            material: { friction: 0.9, restitution: 0.0, categoryBits: 0x0001, maskBits: 0xffff },
          }],
          userData: { tag: 'wall' },
        });

        rightWallBody = physics_write.createBody({
          type: 'static',
          position: { x: px2m(width + 8), y: px2m(height / 2) },
          shapes: [{
            shape: { type: 'box', hx: px2m(8), hy: px2m(height / 2) },
            material: { friction: 0.9, restitution: 0.0, categoryBits: 0x0001, maskBits: 0xffff },
          }],
          userData: { tag: 'wall' },
        });
      }

      ready = true;
    },

    update(_ctx, _dt) {
      if (!ready) return;

      const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
      const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
      const up = keys.has('ArrowUp') || keys.has('w') || keys.has('W');
      const attack = keys.has(' ') || keys.has('z') || keys.has('Z');

      player.moving = left !== right;
      player.attacking = attack;

      if (physics_read && physics_write && playerBody != null) {
        // Read current velocity (m/s)
        const vel = physics_read.getVelocity(playerBody) ?? { vx: 0, vy: 0, w: 0 };

        // Horizontal control: target vx in m/s
        let vx_m = 0;
        if (left) vx_m = -px2m(player.speedPx);
        if (right) vx_m = +px2m(player.speedPx);
        if (vx_m !== 0) player.dir = vx_m > 0 ? 1 : -1;

        // Naive jump if "near ground": compare vy in px/s
        const vy_px = m2px(vel.vy);
        const canJump = Math.abs(vy_px) < 5;
        let vy_m = vel.vy;
        if (up && canJump) vy_m = px2m(-360); // upward velocity kick

        physics_write.setVelocity(playerBody, { vx: vx_m, vy: vy_m, w: vel.w });
        player.jumping = Math.abs(m2px(vy_m)) > 5 && !attack;
      }

      // Animation state
      if (player.attacking) playIfDifferent('attack');
      else if (player.jumping) playIfDifferent('jump');
      else if (player.moving) playIfDifferent('walk');
      else playIfDifferent('idle');

      playerAnim?.update(_dt);
    },

    render(ctx, _alpha) {
      draw.clear();

      // loading bar
      if (!ready) {
        const w = Math.floor(ctx.config.width * 0.6);
        const h = 8;
        const x = Math.floor((ctx.config.width - w) / 2);
        const y = Math.floor((ctx.config.height - h) / 2);
        draw.rect(x, y, w, h, Colours.Black);
        draw.rect(x, y, Math.max(1, Math.floor(w * progress)), h, Colours.Blue);
        draw.text(`Loading ${(progress * 100) | 0}%`, x, y - 10, Colours.White);
        return;
      }

      // background
      const bg = ctx.services.assets.getImage('background');
      if (bg) draw.sprite(bg, 0, 0);

      // transforms (meters -> pixels)
      const pT = (physics_read && playerBody != null ? physics_read.getTransform(playerBody) : null) ?? { x: px2m(64), y: px2m(64), angle: 0 };
      const bT = (physics_read && boxBody != null ? physics_read.getTransform(boxBody) : null) ?? { x: px2m(200), y: px2m(40), angle: 0 };

      const pPx = { x: Math.floor(m2px(pT.x)), y: Math.floor(m2px(pT.y)), angle: pT.angle };
      const bPx = { x: Math.floor(m2px(bT.x)), y: Math.floor(m2px(bT.y)), angle: bT.angle };

      // animated player
      if (playerImg && playerAnim) {
        const { sx, sy, sw, sh } = playerAnim.sourceRect;
        const ox = Math.floor(sw / 2);
        const oy = Math.floor(sh / 2);
        const scaleX = 2 * player.dir; // flip when facing left
        const scaleY = 2;

        draw.sprite(
          playerImg,
          pPx.x,
          pPx.y,
          { sx, sy, sw, sh, ox, oy, scaleX, scaleY, rotation: pPx.angle }
        );
      }

      // blue crate (simple AABB draw)
      draw.rect(bPx.x - 20, bPx.y - 20, 40, 40, Colours.Blue);

      // platform (simple AABB draw)
      if (physics_read && platformBody != null) {
        const plat = physics_read.getTransform(platformBody)!;
        const px = Math.floor(m2px(plat.x));
        const py = Math.floor(m2px(plat.y));
        draw.rect(px - 32, py - 32, 64, 64, Colours.Brown);
      }

      // ground (debug stripe so you can see it)
      if (physics_read && groundBody != null) {
        const g = physics_read.getTransform(groundBody)!;
        const gx = Math.floor(m2px(g.x));
        const gy = Math.floor(m2px(g.y));
        draw.rect(gx - Math.floor(ctx.config.width / 2), gy - 8, ctx.config.width, 16, Colours.Black);
      }
    },

    destroy() {
      offDown?.(); offUp?.();
      keys.clear();
    },
  }
}
