import { loadCurrencies, loadDepartments, loadAccounts, loadExpenseCategories, loadEmployees, loadIncomeCategories } from '../loaders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api as apiClient } from '../../api/http'
import { dataCache } from '../cache'

// Mock api client
vi.mock('../../api/http', () => ({
    api: {
        get: vi.fn(),
    },
}))

describe('loaders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        dataCache.clear()
    })

    describe('loadCurrencies', () => {
        it('should load and format currencies', async () => {
            const mockData = {
                results: [
                    { code: 'USD', name: 'US Dollar', active: 1 },
                    { code: 'CNY', name: 'Chinese Yuan', active: 1 },
                    { code: 'EUR', name: 'Euro', active: 0 },
                ]
            }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const result = await loadCurrencies()

            expect(result).toEqual([
                { value: 'USD', label: 'USD - US Dollar' },
                { value: 'CNY', label: 'CNY - Chinese Yuan' },
            ])
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/currencies'))
        })
    })

    describe('loadDepartments', () => {
        it('should load and format departments', async () => {
            const mockData = {
                results: [
                    { id: '1', name: 'Dept A', active: 1 },
                    { id: '2', name: 'Dept B', active: 0 },
                ]
            }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const result = await loadDepartments()

            expect(result).toEqual([
                { value: '1', label: 'Dept A' },
            ])
        })
    })

    describe('loadAccounts', () => {
        it('should load and format accounts', async () => {
            const mockData = {
                results: [
                    { id: '1', name: 'Bank A', currency: 'USD', active: 1 },
                    { id: '2', name: 'Bank B', alias: 'Main', currency: 'CNY', active: 1 },
                ]
            }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const result = await loadAccounts()

            expect(result).toEqual([
                { value: '1', label: 'Bank A [USD]', currency: 'USD' },
                { value: '2', label: 'Bank B (Main) [CNY]', currency: 'CNY' },
            ])
        })
    })

    describe('loadExpenseCategories', () => {
        it('should load and filter expense categories', async () => {
            const mockData = {
                results: [
                    { id: '1', name: 'Expense 1', kind: 'expense' },
                    { id: '2', name: 'Income 1', kind: 'income' },
                ]
            }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const result = await loadExpenseCategories()

            expect(result).toEqual([
                { value: '1', label: 'Expense 1' },
            ])
        })
    })

    describe('loadEmployees', () => {
        it('should load and filter active employees', async () => {
            const mockData = {
                results: [
                    { id: '1', name: 'Emp A', departmentName: 'Dept A', active: 1, status: 'active' },
                    { id: '2', name: 'Emp B', active: 0, status: 'inactive' },
                    { id: '3', name: 'Emp C', active: 1, status: 'resigned' },
                ]
            }
            vi.mocked(apiClient.get).mockResolvedValue(mockData)

            const result = await loadEmployees()

            expect(result).toEqual([
                { value: '1', label: 'Emp A (Dept A)' },
            ])
            expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('activeOnly=true'))
        })
    })
})
