import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { headquartersRoutes } from './master-data/headquarters.js'
import { departmentsRoutes } from './master-data/departments.js'
import { accountsRoutes } from './master-data/accounts.js'
import { currenciesRoutes } from './master-data/currencies.js'
import { categoriesRoutes } from './master-data/categories.js'
import { positionsRoutes } from './master-data/positions.js'
import { orgDepartmentsRoutes } from './master-data/org-departments.js'
import { vendorsRoutes } from './master-data/vendors.js'

export const masterDataRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// 挂载子模块路由
masterDataRoutes.route('/hq', headquartersRoutes)
masterDataRoutes.route('/', departmentsRoutes) // 处理 /departments 和 /sites
masterDataRoutes.route('/accounts', accountsRoutes)
masterDataRoutes.route('/currencies', currenciesRoutes)
masterDataRoutes.route('/categories', categoriesRoutes)
masterDataRoutes.route('/positions', positionsRoutes)
masterDataRoutes.route('/org-departments', orgDepartmentsRoutes)
masterDataRoutes.route('/vendors', vendorsRoutes)
