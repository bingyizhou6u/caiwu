/**
 * PM 模块路由入口
 */
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import projects from './projects.js'
import tasks from './tasks.js'
import timelogs from './timelogs.js'

const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// 挂载子路由
app.route('/projects', projects)
app.route('/tasks', tasks)
app.route('/timelogs', timelogs)

export default app
