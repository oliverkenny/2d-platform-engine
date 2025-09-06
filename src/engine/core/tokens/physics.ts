import { defineToken } from "../Token";
import type { PhysicsReadPort } from "../ports/physics.read";
import type { PhysicsWritePort } from "../ports/physics.write";
import type { PhysicsStepPort } from "../ports/physics.step";

export const PHYSICS_READ = defineToken<PhysicsReadPort>('PHYSICS_READ');
export const PHYSICS_WRITE = defineToken<PhysicsWritePort>('PHYSICS_WRITE');
export const PHYSICS_STEP = defineToken<PhysicsStepPort>('PHYSICS_STEP');