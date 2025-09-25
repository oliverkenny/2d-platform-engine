/**
 * PointerInput module for handling pointer (mouse/touch) input events in a 2D platform engine.
 *
 * This module binds to an input surface (typically a canvas element) and listens for pointer events,
 * including pointer down, up, move, cancel, wheel, and context menu. It emits corresponding input events
 * to the game context's event bus, manages pointer lock state, and provides a debug panel for visualizing
 * pointer state and activity.
 *
 * @module modules/pointer-input
 *
 * @param opts - Configuration options for pointer input behavior.
 * @param opts.pointerLock - If true, requests pointer lock on the first pointer down event. Defaults to false.
 * @param opts.disableContextMenu - If true, prevents the context menu from appearing on right-click over the element. Defaults to true.
 *
 * @returns A Module object implementing pointer input handling, including lifecycle methods (`start`, `destroy`).
 *
 * @remarks
 * - The module requires an `InputSurfacePort` to be available in the game context's services.
 * - Pointer lock is requested only if enabled and the surface element is not already locked.
 * - The module maintains internal state for pointer position, button presses, wheel deltas, and last event type.
 * - A debug panel is registered to visualize pointer state, including logical coordinates, held buttons, wheel movement, and pointer lock status.
 * - Pointer events are mapped to logical coordinates using the surface's `toLogical` method.
 * - The module draws a visual pointer indicator on the surface using the `DrawServicePort`, if available.
 *
 * @example
 * ```typescript
 * import PointerInput from "./modules/pointer-input";
 *
 * const pointerModule = PointerInput({ pointerLock: true });
 * engine.registerModule(pointerModule);
 * ```
 */

import type { Module, GameContext, DebugPanel } from "../../engine/core/Types";
import type { DrawServicePort, InputSurfacePort } from "../../engine/core/ports";
import { DRAW_ALL, INPUT_SURFACE } from "../../engine/core/tokens";
import { Colours } from "../../util/colour";
import { Options } from "./types";

export default function PointerInput(opts: Options = {}): Module {
  const { pointerLock = false, disableContextMenu = true } = opts;

  // Bound surface (published by the renderer)
  let surface: InputSurfacePort | undefined;
  let draw: DrawServicePort | undefined;

  // Internal state
  let lastX = 0,
    lastY = 0;
  const downButtons = new Set<number>();
  let buttonsBitfield = 0;
  let lastWheelDX = 0,
    lastWheelDY = 0;
  let lastEventType: string = "—";

  // Debug panel
  const PANEL_ID = -1001 as any;
  const debugPanel: DebugPanel = {
    id: PANEL_ID,
    title: "Pointer Input",
    order: 500,
    render() {
      const attached = !!surface;
      const el = attached
        ? (surface!.element as unknown as Element)
        : undefined;
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
        `Held buttons: ${
          names.length ? names.join(", ") : "—"
        }  [bits=${buttonsBitfield}]`,
        `Down set size: ${downButtons.size}`,
        `Last wheel: dx=${lastWheelDX.toFixed(1)} dy=${lastWheelDY.toFixed(1)}`,
        `Last event: ${lastEventType}`,
      ];
    },
    draw(ctx) {
      if (draw) {
        drawPointer(draw);
      }
    }
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

  function drawPointer(draw: DrawServicePort) {
    if (!surface) return;
  
    const el = surface.element as HTMLCanvasElement;
  
    // Map CSS-px → canvas-px
    const rect = el.getBoundingClientRect();
    const sx = rect.width  ? el.width  / rect.width  : 1;
    const sy = rect.height ? el.height / rect.height : 1;
  
    const cx = lastX * sx;
    const cy = lastY * sy;
  
    draw.toUi(() => {
      // outer ring
      draw.circle(cx, cy, 12, undefined, Colours.WHITE, 3);
      // inner dot
      draw.circle(cx, cy, 4, Colours.BLACK);
    });
  }
  

  return {
    id: "input/pointer",

    start(ctx) {
      ctx.bus.emit({ type: "debug/panel/register", panel: debugPanel });

      draw = ctx.services.get(DRAW_ALL);
      if (!draw) {
        console.warn(
          "[input/pointer] No DrawService; debug pointer rendering disabled"
        );
      }

      surface = ctx.services.get(INPUT_SURFACE);
      if (surface) bind(ctx, surface);
      else
        console.warn(
          "[input/pointer] No InputSurface yet; will retry on start()"
        );

      if (!surface) {
        surface = ctx.services.get(INPUT_SURFACE);
        if (surface) bind(ctx, surface);
        else
          console.warn(
            "[input/pointer] InputSurface still missing; pointer input disabled"
          );
      }
    },

    destroy() {
      unbind();
      downButtons.clear();
      surface = undefined;
    },
  };
}
