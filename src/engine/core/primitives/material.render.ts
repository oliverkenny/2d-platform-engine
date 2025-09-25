export type RenderMaterialId = string;

export type RenderMaterial =
  | { kind: "flat"; id: RenderMaterialId; fill?: string; stroke?: string; lineWidth?: number; opacity?: number }
  | { kind: "sprite"; id: RenderMaterialId; atlas?: string; frame?: number; blend?: "alpha" | "add" | "multiply" }
  | { kind: "text"; id: RenderMaterialId; font: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; shadow?: { blur:number; color:string; x:number; y:number } };

// Optional: hints the coordinator/renderer can use to batch/cull better.
export interface RenderMaterialMeta {
  /** Grouping key for batching; defaults to id. */
  batchKey?: string;
}