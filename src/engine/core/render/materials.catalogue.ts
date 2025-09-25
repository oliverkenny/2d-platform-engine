// src/engine/core/render/materials.catalog.ts
import type { RenderMaterial } from "../primitives/material.render";

/** Stringly-typed but namespaced IDs keep things readable and grep-able. */
export const Mats = {
  flat: {
    white:    "flat/white",
    black:    "flat/black",
    blue:     "flat/blue",
    brown:    "flat/brown",
    darkgrey: "flat/darkgrey",
    cyan:     "flat/cyan",
  },
  text: {
    default: "text/default",
    small:   "text/small",
    large:   "text/large",
  },
  sprite: {
    default:     "sprite/default",
    player:      "sprite/player",
    background:  "sprite/background",
    tiles:       "sprite/tiles",
  },
} as const;

/** Helpful union of all material IDs. */
export type RenderMaterialId =
  | typeof Mats.flat[keyof typeof Mats.flat]
  | typeof Mats.text[keyof typeof Mats.text]
  | typeof Mats.sprite[keyof typeof Mats.sprite];

/** A theme palette the catalog maps to actual CSS colors. */
export type MaterialPalette = {
  flat: {
    white: string; black: string; blue: string; brown: string; darkgrey: string; cyan: string;
  };
  text: {
    defaultFont: string; smallFont: string; largeFont: string;
  };
};

/** A built-in default palette you can skin/override later. */
export const DefaultPalette: MaterialPalette = {
  flat: {
    white:    "#ffffff",
    black:    "#000000",
    blue:     "#1976d2",
    brown:    "#7b5e57",
    darkgrey: "#555555",
    cyan:     "#00ffff",
  },
  text: {
    defaultFont: "14px system-ui, sans-serif",
    smallFont:   "12px system-ui, sans-serif",
    largeFont:   "18px system-ui, sans-serif",
  },
};

/** Build concrete RenderMaterial defs from the palette (renderer-agnostic). */
export function buildMaterialDefs(p: MaterialPalette): RenderMaterial[] {
  const out: RenderMaterial[] = [];

  // Flat fills
  out.push({ kind: "flat", id: Mats.flat.white,    fill: p.flat.white });
  out.push({ kind: "flat", id: Mats.flat.black,    fill: p.flat.black });
  out.push({ kind: "flat", id: Mats.flat.blue,     fill: p.flat.blue });
  out.push({ kind: "flat", id: Mats.flat.brown,    fill: p.flat.brown });
  out.push({ kind: "flat", id: Mats.flat.darkgrey, fill: p.flat.darkgrey });
  out.push({ kind: "flat", id: Mats.flat.cyan,     fill: p.flat.cyan });

  // Text presets
  out.push({ kind: "text", id: Mats.text.default, font: p.text.defaultFont });
  out.push({ kind: "text", id: Mats.text.small,   font: p.text.smallFont });
  out.push({ kind: "text", id: Mats.text.large,   font: p.text.largeFont });

  // Sprites (no fixed atlas for default)
  out.push({ kind: "sprite", id: Mats.sprite.default });
  out.push({ kind: "sprite", id: Mats.sprite.player,     atlas: "player" });
  out.push({ kind: "sprite", id: Mats.sprite.background, atlas: "background" });
  out.push({ kind: "sprite", id: Mats.sprite.tiles,      atlas: "blocks" });

  return out;
}
