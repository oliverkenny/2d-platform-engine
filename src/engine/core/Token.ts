import type { Services } from '../core/Types'

/**
 * A unique identifier for a service token.
 * @remarks
 * The `key` property is a unique symbol that distinguishes this token from others.
 */
export type ServiceToken<T> = { readonly key: unique symbol }

/**
 * Defines a new service token.
 * @remarks
 * Service tokens are used to register and retrieve services from the {@link Services} registry.
 * They provide type safety and help avoid naming collisions.
 * @param desc - A description for the token, useful for debugging.
 * @returns A new service token.
 */
export const defineToken = <T>(desc: string): ServiceToken<T> =>
  ({ key: Symbol(desc) }) as ServiceToken<T>
