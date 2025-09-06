/**
 * A simple 2D vector interface.
 * Includes `x` and `y` components.
 *
 * @remarks
 * - Use this interface for representing points, directions, and velocities in 2D space.
 * - This is a lightweight alternative to more complex vector libraries.
 */
export interface Vec2 { x: number; y: number }

/**
 * A 2D transform interface.
 * Includes position (`x`, `y`) and rotation (`angle` in radians).
 * 
 * @remarks
 * - Use this interface for representing the position and orientation of objects in 2D space.
 * - The `angle` is measured in radians, where 0 points to the right (positive x-axis) and increases counter-clockwise.
 */
export interface Transform { x: number; y: number; angle: number }