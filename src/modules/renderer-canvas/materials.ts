// src/modules/renderer-canvas/materials.ts
import type { CanvasMaterialRegistry } from "./service";

/** Register a small default palette + text & sprite materials. */
export function registerDefaultCanvasMaterials(materials: CanvasMaterialRegistry) {
  // Flat fills
  materials.register({ kind: "flat", id: "flat/white",    fill: "#ffffff" });
  materials.register({ kind: "flat", id: "flat/black",    fill: "#000000" });
  materials.register({ kind: "flat", id: "flat/blue",     fill: "#1976d2" });
  materials.register({ kind: "flat", id: "flat/brown",    fill: "#7b5e57" });
  materials.register({ kind: "flat", id: "flat/darkgrey", fill: "#555555" });
  materials.register({ kind: "flat", id: "flat/cyan",     fill: "#00ffff" });

  // Text (UI/world; you can add align/baseline/shadow per your interface)
  materials.register({ kind: "text", id: "text/default", font: "14px system-ui, sans-serif" });

  // Sprite — no fixed atlas so per-command `atlas` can override
  materials.register({ kind: "sprite", id: "sprite/default" });

  // If you want fixed-atlas variants, you can also add:
  // materials.register({ kind: "sprite", id: "sprite/player", atlas: "player" });
  // materials.register({ kind: "sprite", id: "sprite/background", atlas: "background" });
}
