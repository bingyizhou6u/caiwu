import { Context } from 'hono'
import { ZodError } from 'zod'
import { StatusCode } from 'hono/utils/http-status'
import { ErrorCodes } from '../constants/errorCodes.js'

/**
 * Success Response Structure
 */
export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
}

/**
 * Error Response Structure
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
}

/**
 * Standard API Response Structure (Union)
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Standard Pagination Meta Structure
 */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Standard Paginated Response Data
 */
export interface PaginatedData<T> {
  items: T[]
  pagination: PaginationMeta
}

/**
 * Helper to create a success response
 */
export const apiSuccess = <T>(data: T, message?: string): ApiSuccessResponse<T> => {
  return {
    success: true,
    data,
    message,
  }
}

/**
 * Helper to create an error response
 */
export const apiError = (code: string, message: string, details?: any): ApiErrorResponse => {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  }
}

/**
 * Helper to create a paginated response
 */
export const apiPaged = <T>(
  items: T[],
  meta: PaginationMeta
): ApiSuccessResponse<PaginatedData<T>> => {
  return {
    success: true,
    data: {
      items,
      pagination: meta,
    },
  }
}

/**
 * Cursor Pagination Meta Structure
 */
export interface CursorPaginationMeta {
  hasNext: boolean
  hasPrev: boolean
  nextCursor?: string | null
  prevCursor?: string | null
  limit: number
}

/**
 * Cursor Paginated Response Data
 */
export interface CursorPaginatedData<T> {
  results: T[]
  pagination: CursorPaginationMeta
}

/**
 * Helper to create a cursor paginated response
 */
export const apiCursorPaged = <T>(
  results: T[],
  pagination: CursorPaginationMeta
): ApiSuccessResponse<CursorPaginatedData<T>> => {
  return {
    success: true,
    data: {
      results,
      pagination,
    },
  }
}

/**
 * Helper to return a JSON response with status code
 */
export const jsonResponse = <T>(c: Context, response: ApiResponse<T>, status: StatusCode = 200) => {
  return c.json(response as any, status as any)
}
