import { describe, it, expect } from 'vitest'
import { validateVersion, incrementVersion } from '../../src/utils/optimistic-lock'
import { Errors } from '../../src/utils/errors'

describe('OptimisticLock', () => {
  describe('validateVersion', () => {
    it('应该允许版本号匹配', () => {
      expect(() => validateVersion(1, 1)).not.toThrow()
      expect(() => validateVersion(5, 5)).not.toThrow()
    })

    it('应该拒绝版本号不匹配', () => {
      expect(() => validateVersion(1, 2)).toThrow()
      expect(() => validateVersion(5, 3)).toThrow()
    })

    it('应该拒绝 null 版本号（强制并发控制）', () => {
      expect(() => validateVersion(null, null)).toThrow('缺少版本号')
      expect(() => validateVersion(1, null)).toThrow('缺少版本号')
      expect(() => validateVersion(null, 1)).toThrow('缺少版本号')
    })

    it('应该抛出正确的错误信息', () => {
      try {
        validateVersion(1, 2)
        expect.fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toContain('数据已被其他用户修改')
      }
    })
  })

  describe('incrementVersion', () => {
    it('应该递增版本号', () => {
      expect(incrementVersion(1)).toBe(2)
      expect(incrementVersion(5)).toBe(6)
      expect(incrementVersion(100)).toBe(101)
    })

    it('应该处理 null 版本号', () => {
      expect(incrementVersion(null)).toBe(1)
      expect(incrementVersion(0)).toBe(1)
    })
  })
})

