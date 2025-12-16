import { PaginationMeta } from './response.js'

export interface PaginationParams {
  page?: number | string
  pageSize?: number | string
}

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 20

/**
 * Calculate pagination meta and offset
 */
export const getPagination = (
  params: PaginationParams,
  total: number
): { meta: PaginationMeta; offset: number; limit: number } => {
  const page = Number(params.page) || DEFAULT_PAGE
  const pageSize = Number(params.pageSize) || DEFAULT_PAGE_SIZE

  const totalPages = Math.ceil(total / pageSize)
  const offset = (page - 1) * pageSize

  return {
    meta: {
      page,
      pageSize,
      total,
      totalPages: totalPages > 0 ? totalPages : 1,
    },
    offset,
    limit: pageSize,
  }
}
