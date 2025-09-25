export type RenderSpace = "world" | "ui";
export type RenderPhaseId = string;

export type RenderCommon = {
  id?: string;
  passId: RenderPhaseId;
  space: RenderSpace;
  layer: string;
  z?: number;
  renderMaterial: string;
  aabb?: { x:number; y:number; w:number; h:number };
};

export type RectCmd   = RenderCommon & { kind:"rect";   x:number; y:number; w:number; h:number; radius?: number };
export type CircleCmd = RenderCommon & { kind:"circle"; x:number; y:number; r:number };
export type TextCmd   = RenderCommon & { kind:"text";   x:number; y:number; text:string };
export type SpriteCmd = RenderCommon & { kind:"sprite"; x:number; y:number; w:number; h:number; frame?: number; atlas?: string; rotation?: number; sx?: number; sy?: number };

export type RenderCmd = RectCmd | CircleCmd | TextCmd | SpriteCmd;