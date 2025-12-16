import { describe, it, expect, vi } from 'vitest'
import { Errors } from '../../src/utils/errors'
import { ErrorCodes } from '../../src/constants/errorCodes'

describe('Error Codes Verification', () => {
  it('should use correct code for UNAUTHORIZED', () => {
    const error = Errors.UNAUTHORIZED()
    expect(error.code).toBe(ErrorCodes.AUTH_UNAUTHORIZED)
  })

  it('should use correct code for VALIDATION_ERROR', () => {
    const error = Errors.VALIDATION_ERROR('Invalid Input')
    expect(error.code).toBe(ErrorCodes.VAL_BAD_REQUEST)
  })

  it('should use correct code for DUPLICATE', () => {
    const error = Errors.DUPLICATE('Email')
    expect(error.code).toBe(ErrorCodes.BUS_DUPLICATE)
  })
})
