/**
 * Standard Application Error Codes
 */

export enum ErrorCodes {
    // Authentication & Authorization (AUTH)
    AUTH_UNAUTHORIZED = 'AUTH_001',   // Not logged in or invalid token
    AUTH_TOKEN_EXPIRED = 'AUTH_002',  // Token expired
    AUTH_FORBIDDEN = 'AUTH_003',      // Logged in but no permission

    // Validation (VAL)
    VAL_BAD_REQUEST = 'VAL_001',      // Schema validation failed or bad input

    // Business Logic (BUS)
    BUS_GENERAL = 'BUS_001',          // Generic business error
    BUS_NOT_FOUND = 'BUS_002',        // Resource not found
    BUS_DUPLICATE = 'BUS_003',        // Resource already exists
    BUS_STATE_INVALID = 'BUS_004',    // Invalid state transition (e.g. approving an already approved item)
    BUS_ACTION_FAILED = 'BUS_005',    // Action failed due to business rules

    // System (SYS)
    SYS_INTERNAL_ERROR = 'SYS_001',   // Unhandled exception
    SYS_DB_ERROR = 'SYS_002',         // Database specific error
    SYS_EXTERNAL_API = 'SYS_003',     // External service failure (e.g. Cloudflare API)
}
