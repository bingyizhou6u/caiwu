import { dataCache, cachedRequest } from '../cache'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('DataCache', () => {
    beforeEach(() => {
        dataCache.clear()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should store and retrieve data', () => {
        dataCache.set('key', 'value')
        expect(dataCache.get('key')).toBe('value')
    })

    it('should return null for missing key', () => {
        expect(dataCache.get('missing')).toBe(null)
    })

    it('should expire data after default TTL', () => {
        dataCache.set('key', 'value')
        // Default TTL is 5 minutes
        vi.advanceTimersByTime(5 * 60 * 1000 + 1)
        expect(dataCache.get('key')).toBe(null)
    })

    it('should expire data after custom TTL', () => {
        dataCache.set('key', 'value', 1000)
        vi.advanceTimersByTime(1001)
        expect(dataCache.get('key')).toBe(null)
    })

    it('should delete data', () => {
        dataCache.set('key', 'value')
        dataCache.delete('key')
        expect(dataCache.get('key')).toBe(null)
    })

    it('should clear all data', () => {
        dataCache.set('key1', 'value1')
        dataCache.set('key2', 'value2')
        dataCache.clear()
        expect(dataCache.get('key1')).toBe(null)
        expect(dataCache.get('key2')).toBe(null)
    })

    it('should invalidate prefix', () => {
        dataCache.set('prefix_1', 'value1')
        dataCache.set('prefix_2', 'value2')
        dataCache.set('other', 'value3')

        dataCache.invalidatePrefix('prefix')

        expect(dataCache.get('prefix_1')).toBe(null)
        expect(dataCache.get('prefix_2')).toBe(null)
        expect(dataCache.get('other')).toBe('value3')
    })
})

describe('cachedRequest', () => {
    beforeEach(() => {
        dataCache.clear()
    })

    it('should execute request and cache result', async () => {
        const requestFn = vi.fn().mockResolvedValue('data')

        const result1 = await cachedRequest('key', requestFn)
        expect(result1).toBe('data')
        expect(requestFn).toHaveBeenCalledTimes(1)

        const result2 = await cachedRequest('key', requestFn)
        expect(result2).toBe('data')
        expect(requestFn).toHaveBeenCalledTimes(1) // Should use cached result
    })

    it('should execute request again if cache expired', async () => {
        vi.useFakeTimers()
        const requestFn = vi.fn().mockResolvedValue('data')

        await cachedRequest('key', requestFn)

        // Expire cache
        vi.advanceTimersByTime(5 * 60 * 1000 + 1)

        await cachedRequest('key', requestFn)
        expect(requestFn).toHaveBeenCalledTimes(2)

        vi.useRealTimers()
    })
})
