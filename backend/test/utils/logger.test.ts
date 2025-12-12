
import { describe, it, expect, vi } from 'vitest'
import { Logger } from '../../src/utils/logger'

describe('Logger Sanitization', () => {
    it('should mask sensitive keys', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

        Logger.info('Test login', {
            email: 'test@example.com',
            password: 'supersecretpassword',
            meta: {
                token: 'abcdef123456',
                other: 'value'
            }
        })

        expect(consoleSpy).toHaveBeenCalled()
        const logContent = consoleSpy.mock.calls[0][0]
        const parsed = JSON.parse(logContent)

        expect(parsed.data.email).toBe('test@example.com')
        expect(parsed.data.password).toBe('******')
        expect(parsed.data.meta.token).toBe('******')
        expect(parsed.data.meta.other).toBe('value')

        consoleSpy.mockRestore()
    })
})
