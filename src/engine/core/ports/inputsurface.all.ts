/**
 * Represents an input surface that can be used to map client coordinates to logical coordinates.
 *
 * @remarks
 * This interface is typically implemented by UI elements that handle user input,
 * such as mouse or touch events, and need to translate physical coordinates to
 * logical coordinates within a defined area.
 */
export interface InputSurfacePort {
  /**
   * The underlying DOM element associated with the input surface.
   * Must support event handling and provide its bounding rectangle.
   */
  element: EventTarget & { getBoundingClientRect(): DOMRectReadOnly };

  /**
   * The logical width of the input surface, used for coordinate mapping.
   */
  logicalWidth: number;

  /**
   * The logical height of the input surface, used for coordinate mapping.
   */
  logicalHeight: number;

  /**
   * Converts client (physical) coordinates to logical coordinates relative to the input surface.
   *
   * @param clientX - The X coordinate in client space.
   * @param clientY - The Y coordinate in client space.
   * @returns An object containing the mapped logical `x` and `y` coordinates.
   */
  toLogical(clientX: number, clientY: number): { x: number; y: number };
}
