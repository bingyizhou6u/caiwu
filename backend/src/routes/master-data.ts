import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { headquartersRoutes } from './master-data/headquarters.js'
import { departmentsRoutes } from './master-data/departments.js'
import { accountsRoutes } from './master-data/accounts.js'
import { currenciesRoutes } from './master-data/currencies.js'
import { categoriesRoutes } from './master-data/categories.js'
import { positionsRoutes } from './master-data/positions.js'

export const master_dataRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 挂载子模块路由
master_dataRoutes.route('/hq', headquartersRoutes)
master_dataRoutes.route('/', departmentsRoutes) // Handles /departments and /sites
master_dataRoutes.route('/accounts', accountsRoutes)
master_dataRoutes.route('/currencies', currenciesRoutes)
master_dataRoutes.route('/categories', categoriesRoutes)
master_dataRoutes.route('/positions', positionsRoutes)
