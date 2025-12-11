/**
 * 数据加载工具函数
 * 用于加载常用的系统基础数据
 */

import { api } from '../config/api'
import { api as apiClient } from '../api/http'
import { cachedRequest, cacheKeys } from './cache'
import type { SelectOption, Currency, Department, Account, Category, Employee } from '../types'

/**
 * 加载币种列表（带缓存）
 */
export async function loadCurrencies(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.currencies,
    async () => {
      const response = await apiClient.get<{ results: Currency[] }>(api.currencies)
      return response.results.filter((r) => r.active === 1).map((r) => ({
        value: String(r.code),
        label: `${r.code} - ${r.name}`
      }))
    }
  )
}

/**
 * 加载项目列表（带缓存）
 */
export async function loadDepartments(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.departments,
    async () => {
      const response = await apiClient.get<{ results: Department[] }>(api.departments)
      return response.results.filter((r) => r.active === 1).map((r) => ({
        value: String(r.id),
        label: r.name
      }))
    }
  )
}

/**
 * 加载账户列表（带缓存）
 */
export async function loadAccounts(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.accounts,
    async () => {
      const response = await apiClient.get<{ results: Account[] }>(api.accounts)
      return response.results.filter((r) => r.active === 1).map((r) => {
        const aliasPart = r.alias ? ` (${r.alias})` : ''
        const currencyPart = r.currency ? ` [${r.currency}]` : ''
        return {
          value: String(r.id),
          label: `${r.name}${aliasPart}${currencyPart}`,
          currency: r.currency
        }
      })
    }
  )
}

/**
 * 加载支出类别列表（带缓存）
 */
export async function loadExpenseCategories(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.expenseCategories,
    async () => {
      const response = await apiClient.get<{ results: Category[] }>(api.categories)
      return response.results.filter((c) => c.kind === 'expense').map((c) => ({
        value: String(c.id),
        label: c.name
      }))
    }
  )
}

/**
 * 加载员工列表（仅在职员工，带缓存）
 */
export async function loadEmployees(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.employees(true),
    async () => {
      const response = await apiClient.get<{ results: Employee[] }>(`${api.employees}?activeOnly=true`)
      return response.results.filter((e) => e.active === 1 && e.status !== 'resigned').map((e) => ({
        value: String(e.id),
        label: `${e.name} (${e.departmentName || '-'})`
      }))
    }
  )
}

/**
 * 加载收入类别列表（带缓存）
 */
export async function loadIncomeCategories(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.incomeCategories,
    async () => {
      const response = await apiClient.get<{ results: Category[] }>(api.categories)
      return response.results.filter((c) => c.kind === 'income').map((c) => ({
        value: String(c.id),
        label: c.name
      }))
    }
  )
}
