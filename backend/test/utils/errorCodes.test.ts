
import { describe, it, expect, vi } from 'vitest'
import { Errors } from '../../src/utils/errors'
import { ErrorCodes } from '../../src/constants/errorCodes'

describe('Error Codes Verification', () => {
    it('should use correct code for UNAUTHORIZED', () => {
        const error = Errors.UNAUTHORIZED()
        expect(error.code).toBe(ErrorCodes.AUTH_UNAUTHORIZED)
        expect(error.code).toBe('AUTH_001')
    })

    it('should use correct code for VALIDATION_ERROR', () => {
        const error = Errors.VALIDATION_ERROR('Invalid Input')
        expect(error.code).toBe(ErrorCodes.VAL_BAD_REQUEST)
        expect(error.code).toBe('VAL_001')
    })

    it('should use correct code for DUPLICATE', () => {
        const error = Errors.DUPLICATE('Email')
        expect(error.code).toBe(ErrorCodes.BUS_DUPLICATE)
        expect(error.code).toBe('BUS_003')
    })
})
