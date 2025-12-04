import type { components } from './schema'

export type Schema<T extends keyof components['schemas']> = components['schemas'][T]
export type { components, paths } from './schema'
