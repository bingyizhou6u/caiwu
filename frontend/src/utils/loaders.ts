/**
 * 通用数据加载工具函数
 * 减少重复的数据加载代码
 */

import { api } from '../config/api'
import { cachedRequest, cacheKeys } from './cache'
import { apiGet } from './api'

export interface SelectOption {
  value: string | number
  label: string
  [key: string]: any
}

/**
 * 加载币种列表（带缓存）
 */
export async function loadCurrencies(): Promise<SelectOption[]> {
  return cachedRequest(
    cacheKeys.currencies,
    async () => {
      const rows = await apiGet<any>(api.currencies)
      return rows.filter((r: any) => r.active === 1).map((r: any) => ({
        value: r.code,
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
      const rows = await apiGet<any>(api.departments)
      return rows.filter((r: any) => r.active === 1).map((r: any) => ({
        value: r.id,
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
      const rows = await apiGet<any>(api.accounts)
      return rows.filter((r: any) => r.active === 1).map((r: any) => {
        const aliasPart = r.alias ? ` (${r.alias})` : ''
        const currencyPart = r.currency ? ` [${r.currency}]` : ''
        return {
          value: r.id,
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
      const rows = await apiGet<any>(api.categories)
      return rows.filter((c: any) => c.kind === 'expense').map((c: any) => ({
        value: c.id,
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
      const rows = await apiGet<any>(`${api.employees}?active_only=true`)
      return rows.filter((e: any) => e.active === 1 && e.status !== 'resigned').map((e: any) => ({
        value: e.id,
        label: `${e.name} (${e.department_name || '-'})`
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
      const rows = await apiGet<any>(api.categories)
      return rows.filter((c: any) => c.kind === 'income').map((c: any) => ({
        value: c.id,
        label: c.name
      }))
    }
  )
}

