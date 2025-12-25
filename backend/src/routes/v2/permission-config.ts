/**
 * 权限模块配置 API
 * 提供统一的权限模块定义供前端使用
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import {
    PERMISSION_MODULES,
    ACTION_LABELS,
    DATA_SCOPE_LABELS,
    DataScope,
} from '../../constants/permissions.js'
import { apiSuccess, jsonResponse } from '../../utils/response.js'

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * GET /api/v2/permission-config
 * 获取权限模块配置
 * 返回所有可用的权限模块、子模块、操作及其标签
 */
app.get('/', (c) => {
    return jsonResponse(c, apiSuccess({
        modules: PERMISSION_MODULES,
        actionLabels: ACTION_LABELS,
        dataScopeLabels: DATA_SCOPE_LABELS,
        dataScopes: [
            { value: DataScope.ALL, label: DATA_SCOPE_LABELS.all },
            { value: DataScope.PROJECT, label: DATA_SCOPE_LABELS.project },
            { value: DataScope.GROUP, label: DATA_SCOPE_LABELS.group },
            { value: DataScope.SELF, label: DATA_SCOPE_LABELS.self },
        ],
    }))
})

export default app
