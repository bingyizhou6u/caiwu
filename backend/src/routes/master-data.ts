import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { headquartersRoutes } from './master-data/headquarters.js'
import { departmentsRoutes } from './master-data/departments.js'
import { accountsRoutes } from './master-data/accounts.js'
import { currenciesRoutes } from './master-data/currencies.js'
import { categoriesRoutes } from './master-data/categories.js'
import { positionsRoutes } from './master-data/positions.js'
import { orgDepartmentsRoutes } from './master-data/org-departments.js'
import { vendorsRoutes } from './master-data/vendors.js'

export const master_dataRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// 挂载子模块路由
master_dataRoutes.route('/hq', headquartersRoutes)
master_dataRoutes.route('/', departmentsRoutes) // 处理 /departments 和 /sites
master_dataRoutes.route('/accounts', accountsRoutes)
master_dataRoutes.route('/currencies', currenciesRoutes)
master_dataRoutes.route('/categories', categoriesRoutes)
master_dataRoutes.route('/positions', positionsRoutes)
master_dataRoutes.route('/org-departments', orgDepartmentsRoutes)
master_dataRoutes.route('/vendors', vendorsRoutes)
