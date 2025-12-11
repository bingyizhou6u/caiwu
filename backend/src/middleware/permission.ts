import { createMiddleware } from 'hono/factory'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'

/**
 * Middleware to check if the user has the required permission.
 * @param module Module name (e.g., 'asset')
 * @param subModule Sub-module name (e.g., 'fixed')
 * @param action Action name (e.g., 'create')
 */
export function requirePermission(module: string, subModule: string, action: string) {
    return createMiddleware<{ Bindings: Env, Variables: AppVariables }>(async (c, next) => {
        if (!hasPermission(c, module, subModule, action)) {
            throw Errors.FORBIDDEN()
        }
        await next()
    })
}

/**
 * Wrapper for OpenAPI routes to check permission.
 * @param module Module name
 * @param subModule Sub-module name
 * @param action Action name
 * @param handler Route handler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function protectRoute(module: string, subModule: string, action: string, handler: (c: any) => any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (c: any) => {
        if (!hasPermission(c, module, subModule, action)) {
            throw Errors.FORBIDDEN()
        }
        return handler(c)
    }
}

