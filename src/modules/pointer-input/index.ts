// src/modules/pointer-input/index.ts

/**
 * PointerInput module for handling pointer (mouse/touch) input events in a 2D platform engine.
 * Now emits UI render commands via the Render Queue instead of drawing directly.
 */

import type { Module, GameContext, DebugPanel } from "../../engine/core/Types";
import type { InputSurfacePort } from "../../engine/core/ports";
import { INPUT_SURFACE } from "../../engine/core/tokens";

import type { RenderQueueWritePort } from "../../engine/core/ports"; // your write port interface
import { RENDER_QUEUE_WRITE } from "../../engine/core/tokens";       // public token for write access

import type { RenderCmd } from "../../engine/core/primitives/render";
import { Options } from "./types";

export default function PointerInput(opts: Options = {}): Module {
  const { pointerLock = false, disableContextMenu = true } = opts;

  // Bound surface (published by the renderer)
  let surface: InputSurfacePort | undefined;

  // Render queue write port (what we use to draw the pointer indicator)
  let rq!: RenderQueueWritePort;

  // Internal state
  let lastX = 0,
      lastY = 0;
  const downButtons = new Set<number>();
  let buttonsBitfield = 0;
  let lastWheelDX = 0,
      lastWheelDY = 0;
  let lastEventType: string = "—";

  // Debug panel (text only; no direct drawing here)
  const PANEL_ID = -1001 as any;
  const debugPanel: DebugPanel = {
    id: PANEL_ID,
    title: "Pointer Input",
    order: 500,
    render() {
      const attached = !!surface;
      const el = attached ? (surface!.element as unknown as Element) : undefined;
      const locked = !!el && document.pointerLockElement === el;

      const names: string[] = [];
      if (buttonsBitfield & 1) names.push("Left");
      if (buttonsBitfield & 4) names.push("Middle");
      if (buttonsBitfield & 2) names.push("Right");
      if (buttonsBitfield & 8) names.push("Back");
      if (buttonsBitfield & 16) names.push("Forward");

      return [
        attached ? "Surface: attached" : "Surface: (not available)",
        `Pointer Lock: ${locked ? "ON" : "off"}`,
        `Cursor (logical): ${lastX.toFixed(1)}, ${lastY.toFixed(1)}`,
        `Held buttons: ${names.length ? names.join(", ") : "—"}  [bits=${buttonsBitfield}]`,
        `Down set size: ${downButtons.size}`,
        `Last wheel: dx=${lastWheelDX.toFixed(1)} dy=${lastWheelDY.toFixed(1)}`,
        `Last event: ${lastEventType}`,
      ];
    },
    // No draw(ctx, draw) here anymore; rendering happens in module.render()
  };

  // Handlers (assigned on bind)
  let onPointerDown!: (e: PointerEvent) => void;
  let onPointerUp!: (e: PointerEvent) => void;
  let onPointerMove!: (e: PointerEvent) => void;
  let onPointerCancel!: (e: PointerEvent) => void;
  let onWheel!: (e: WheelEvent) => void;
  let onContextMenu!: (e: MouseEvent) => void;
  let onBlur!: () => void;

  function clearAll(ctx: GameContext) {
    if (!downButtons.size) return;
    for (const b of downButtons) {
      ctx.bus.emit({
        type: "input/pointerup",
        id: -1,
        button: b,
        x: lastX,
        y: lastY,
        buttons: 0,
      });
    }
    downButtons.clear();
  }

  function bind(ctx: GameContext, s: InputSurfacePort) {
    const el = s.element as unknown as HTMLElement;

    onPointerDown = (e) => {
      const { x, y } = s.toLogical(e.clientX, e.clientY);
      lastX = x;
      lastY = y;
      buttonsBitfield = e.buttons ?? 0;
      lastEventType = "pointerdown";
      downButtons.add(e.button);

      if (pointerLock && document.pointerLockElement !== (el as Element)) {
        (el as Element).requestPointerLock?.();
      }
      try {
        (el as any).setPointerCapture?.(e.pointerId);
      } catch {}

      ctx.bus.emit({
        type: "input/pointerdown",
        id: e.pointerId,
        button: e.button,
        x,
        y,
        buttons: buttonsBitfield,
      });
    };

    onPointerUp = (e) => {
      const { x, y } = s.toLogical(e.clientX, e.clientY);
      lastX = x;
      lastY = y;
      buttonsBitfield = e.buttons ?? 0;
      lastEventType = "pointerup";
      downButtons.delete(e.button);
      try {
        (el as any).releasePointerCapture?.(e.pointerId);
      } catch {}

      ctx.bus.emit({
        type: "input/pointerup",
        id: e.pointerId,
        button: e.button,
        x,
        y,
        buttons: buttonsBitfield,
      });
    };

    onPointerMove = (e) => {
      lastEventType = "pointermove";
      const locked = document.pointerLockElement === (el as Element);

      if (locked) {
        const dx = (e as any).movementX ?? 0;
        const dy = (e as any).movementY ?? 0;
        lastX += dx;
        lastY += dy;
        buttonsBitfield = e.buttons ?? 0;

        ctx.bus.emit({
          type: "input/pointermove",
          id: e.pointerId,
          x: lastX,
          y: lastY,
          dx,
          dy,
          buttons: buttonsBitfield,
        });
        return;
      }

      const { x, y } = s.toLogical(e.clientX, e.clientY);
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x;
      lastY = y;
      buttonsBitfield = e.buttons ?? 0;

      ctx.bus.emit({
        type: "input/pointermove",
        id: e.pointerId,
        x,
        y,
        dx,
        dy,
        buttons: buttonsBitfield,
      });
    };

    onPointerCancel = () => {
      lastEventType = "pointercancel";
      clearAll(ctx);
    };

    onWheel = (e) => {
      const { x, y } = s.toLogical(e.clientX, e.clientY);
      e.preventDefault();
      lastWheelDX = e.deltaX;
      lastWheelDY = e.deltaY;
      lastEventType = "wheel";
      ctx.bus.emit({ type: "input/wheel", x, y, dx: e.deltaX, dy: e.deltaY });
    };

    onContextMenu = (e) => {
      if (disableContextMenu) e.preventDefault();
    };

    onBlur = () => {
      lastEventType = "window blur";
      clearAll(ctx);
      if (document.pointerLockElement === (el as Element))
        document.exitPointerLock?.();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("blur", onBlur);
  }

  function unbind() {
    if (!surface) return;
    const el = surface.element as unknown as HTMLElement;
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointercancel", onPointerCancel);
    el.removeEventListener("wheel", onWheel as any);
    el.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("blur", onBlur);
  }

  /**
   * Enqueue UI-space render commands to show the pointer.
   * Uses logical (canvas) pixels so no DPR math is needed.
   */
  function enqueuePointerCommands() {
    if (!surface) return;

    const passId = "ui";         // matches coordinator's DEFAULT_PASSES
    const layer  = "debug";      // draw above HUD but under other debug if you like
    const space  = "ui";

    // White outer ring (r ≈ 12)
    const ring: RenderCmd = {
      kind: "circle",
      passId,
      space,
      layer,
      z: 1000,
      renderMaterial: "flat/white",
      x: lastX,
      y: lastY,
      r: 12,
    };

    // Inner fill to create a "ring" look (black circle a bit smaller)
    const innerFill: RenderCmd = {
      kind: "circle",
      passId,
      space,
      layer,
      z: 1001,
      renderMaterial: "flat/black",
      x: lastX,
      y: lastY,
      r: 9, // 12 - strokeThickness (~3)
    };

    // Tiny center dot (optional; keeps the old visual)
    const dot: RenderCmd = {
      kind: "circle",
      passId,
      space,
      layer,
      z: 1002,
      renderMaterial: "flat/black",
      x: lastX,
      y: lastY,
      r: 4,
    };

    rq.pushMany([ring, innerFill, dot]);
  }

  return {
    id: "input/pointer",

    start(ctx) {
      // Register debug panel (text only)
      ctx.bus.emit({ type: "debug/panel/register", panel: debugPanel });

      // Get services
      rq = ctx.services.getOrThrow(RENDER_QUEUE_WRITE);
      surface = ctx.services.get(INPUT_SURFACE);

      if (surface) bind(ctx, surface);
      else console.warn("[input/pointer] No InputSurface yet; will retry on start()");

      if (!surface) {
        surface = ctx.services.get(INPUT_SURFACE);
        if (surface) bind(ctx, surface);
        else console.warn("[input/pointer] InputSurface still missing; pointer input disabled");
      }
    },

    // NEW: push render commands every frame
    render() {
      enqueuePointerCommands();
    },

    destroy() {
      unbind();
      downButtons.clear();
      surface = undefined;
    },
  };
}
