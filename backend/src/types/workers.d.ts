/**
 * Cloudflare Workers 运行时类型声明
 * 补充标准 TypeScript 类型中缺失的 Workers 特有 API
 */

declare global {
    /**
     * Cloudflare Workers Cache API 扩展
     * caches.default 是 Workers 特有的默认缓存
     */
    interface CacheStorage {
        default: Cache
    }

    /**
     * Performance API 扩展（Node.js 兼容模式）
     * 在某些环境中可能包含内存信息
     */
    interface Performance {
        memory?: {
            usedJSHeapSize: number
            totalJSHeapSize: number
            jsHeapSizeLimit: number
        }
    }
}

/**
 * D1 数据库操作结果类型
 * 用于 batch 操作返回值
 */
export interface D1Result<T = unknown> {
    results?: T[]
    success: boolean
    meta: {
        changes: number
        duration: number
        last_row_id: number
        served_by?: string
        rows_read?: number
        rows_written?: number
    }
}

export { }
