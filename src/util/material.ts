import { Material } from "../engine/core/primitives/material";

export const Materials = {
    Grass: {
        density: 0.5,
        friction: 0.4,
        restitution: 0.3,
    } as Material,

    Dirt: {
        density: 1.0,
        friction: 0.6,
        restitution: 0.2,
    } as Material,

    Ice: {
        density: 0.9,
        friction: 0.1,
        restitution: 0.05,
    } as Material,
}