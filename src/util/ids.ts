import { BodyId } from "../engine/core";

export function generateId(): BodyId {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) as BodyId;
}