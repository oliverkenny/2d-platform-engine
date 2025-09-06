/**
 * A branded type for unique body IDs.
 * This ensures type safety when working with body identifiers.
 *
 * @remarks
 * - Use `BodyId` instead of `number` when dealing with body IDs.
 * - This prevents accidental mixing of different ID types.
 */
export type BodyId = number & { readonly brand: unique symbol }