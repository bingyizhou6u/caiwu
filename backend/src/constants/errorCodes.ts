/**
 * Standard Application Error Codes
 */

export enum ErrorCodes {
  // Authentication & Authorization (AUTH)
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED', // Not logged in or invalid token
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED', // Token expired
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN', // Logged in but no permission
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOTP_REQUIRED = 'AUTH_TOTP_REQUIRED',

  // Validation (VAL) -> VALIDATION
  VAL_BAD_REQUEST = 'VALIDATION_BAD_REQUEST', // Schema validation failed or bad input
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',

  // Business Logic (BUS) -> BUSINESS
  BUS_GENERAL = 'BUSINESS_GENERAL', // Generic business error
  BUS_NOT_FOUND = 'BUSINESS_NOT_FOUND', // Resource not found
  BUS_DUPLICATE = 'BUSINESS_DUPLICATE', // Resource already exists
  BUS_STATE_INVALID = 'BUSINESS_STATE_INVALID', // Invalid state transition
  BUS_ACTION_FAILED = 'BUSINESS_ACTION_FAILED', // Action failed due to business rules
  BUSINESS_INSUFFICIENT_BALANCE = 'BUSINESS_INSUFFICIENT_BALANCE',
  BUS_CONCURRENT_MODIFICATION = 'BUSINESS_CONCURRENT_MODIFICATION', // 并发修改冲突

  // System (SYS) -> SYSTEM
  SYS_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR', // Unhandled exception
  SYS_DB_ERROR = 'SYSTEM_DB_ERROR', // Database specific error
  SYS_EXTERNAL_API = 'SYSTEM_EXTERNAL_API', // External service failure
}
