import { describe, it, expect } from 'vitest'
import { validateAmount } from '../../src/utils/amount-validator'
import { Errors } from '../../src/utils/errors'

describe('validateAmount', () => {
  describe('基本验证', () => {
    it('应该允许有效的整数金额', () => {
      expect(() => validateAmount(100)).not.toThrow()
      expect(() => validateAmount(0)).not.toThrow()
      expect(() => validateAmount(1000000)).not.toThrow()
    })

    it('应该拒绝非整数金额', () => {
      expect(() => validateAmount(100.5)).toThrow()
      expect(() => validateAmount(100.1)).toThrow()
      expect(() => validateAmount(100.99)).toThrow()
    })

    it('应该拒绝负数金额', () => {
      expect(() => validateAmount(-1)).toThrow()
      expect(() => validateAmount(-100)).toThrow()
    })
  })

  describe('最小值验证', () => {
    it('应该允许大于等于最小值的金额', () => {
      expect(() => validateAmount(100, 100)).not.toThrow()
      expect(() => validateAmount(200, 100)).not.toThrow()
    })

    it('应该拒绝小于最小值的金额', () => {
      expect(() => validateAmount(50, 100)).toThrow()
      expect(() => validateAmount(99, 100)).toThrow()
    })
  })

  describe('最大值验证', () => {
    it('应该允许小于等于最大值的金额', () => {
      expect(() => validateAmount(100, 0, 100)).not.toThrow()
      expect(() => validateAmount(50, 0, 100)).not.toThrow()
    })

    it('应该拒绝大于最大值的金额', () => {
      expect(() => validateAmount(101, 0, 100)).toThrow()
      expect(() => validateAmount(200, 0, 100)).toThrow()
    })
  })

  describe('范围验证', () => {
    it('应该允许在范围内的金额', () => {
      expect(() => validateAmount(500, 100, 1000)).not.toThrow()
      expect(() => validateAmount(100, 100, 1000)).not.toThrow()
      expect(() => validateAmount(1000, 100, 1000)).not.toThrow()
    })

    it('应该拒绝超出范围的金额', () => {
      expect(() => validateAmount(50, 100, 1000)).toThrow()
      expect(() => validateAmount(1001, 100, 1000)).toThrow()
    })
  })

  describe('错误信息', () => {
    it('应该提供清晰的错误信息', () => {
      try {
        validateAmount(100.5)
        expect.fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toContain('整数')
      }

      try {
        validateAmount(50, 100)
        expect.fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toContain('不能小于')
      }

      try {
        validateAmount(200, 0, 100)
        expect.fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toContain('不能大于')
      }
    })
  })
})

