/**
 * 通知路由
 * 处理站内通知的 CRUD 操作
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

// 获取通知列表
app.get('/', async (c) => {
    const notificationService = c.get('services').notification
    const employeeId = c.get('employeeId')

    if (!employeeId) {
        return c.json({ success: false, error: '未登录' }, 401)
    }

    const isRead = c.req.query('isRead')
    const type = c.req.query('type')
    const limit = c.req.query('limit')
    const offset = c.req.query('offset')

    const filters = {
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        type: type as any,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
    }

    const notifications = await notificationService.getNotifications(employeeId, filters)

    return c.json({
        success: true,
        data: notifications,
    })
})

// 获取未读数量
app.get('/unread-count', async (c) => {
    const notificationService = c.get('services').notification
    const employeeId = c.get('employeeId')

    if (!employeeId) {
        return c.json({ success: false, error: '未登录' }, 401)
    }

    const count = await notificationService.getUnreadCount(employeeId)

    return c.json({
        success: true,
        data: { count },
    })
})

// 标记单条已读
app.put('/:id/read', async (c) => {
    const notificationService = c.get('services').notification
    const employeeId = c.get('employeeId')
    const { id } = c.req.param()

    if (!employeeId) {
        return c.json({ success: false, error: '未登录' }, 401)
    }

    const success = await notificationService.markAsRead(id, employeeId)

    if (!success) {
        return c.json({ success: false, error: '通知不存在或无权限' }, 404)
    }

    return c.json({ success: true })
})

// 标记全部已读
app.put('/read-all', async (c) => {
    const notificationService = c.get('services').notification
    const employeeId = c.get('employeeId')

    if (!employeeId) {
        return c.json({ success: false, error: '未登录' }, 401)
    }

    const count = await notificationService.markAllAsRead(employeeId)

    return c.json({
        success: true,
        data: { markedCount: count },
    })
})

// 删除通知
app.delete('/:id', async (c) => {
    const notificationService = c.get('services').notification
    const employeeId = c.get('employeeId')
    const { id } = c.req.param()

    if (!employeeId) {
        return c.json({ success: false, error: '未登录' }, 401)
    }

    const success = await notificationService.deleteNotification(id, employeeId)

    if (!success) {
        return c.json({ success: false, error: '通知不存在或无权限' }, 404)
    }

    return c.json({ success: true })
})

export default app
