import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPositionCode, getUserPosition, getDataAccessFilter, isTeamDeveloper, getUserId } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid, getUserEmployeeId } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { isValidIPAddress } from '../utils/validation.js'
import { createBorrowingSchema, createRepaymentSchema } from '../schemas/business.schema.js'
import { borrowingQuerySchema, repaymentQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const borrowingsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 借款管理 - 列表
borrowingsRoutes.get('/borrowings', validateQuery(borrowingQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof borrowingQuerySchema>>(c)
  const userId = query.user_id

  let sql = `
    select b.*, 
      u.name as borrower_name, u.email as borrower_email,
      a.name as account_name, a.currency as account_currency,
      creator.name as creator_name
    from borrowings b
    left join users u on u.id=b.user_id
    left join accounts a on a.id=b.account_id
    left join users creator on creator.id=b.created_by
  `
  const binds: any[] = []

  // 组员只能查看自己的借款记录
  if (isTeamDeveloper(c)) {
    const currentUserId = getUserId(c)
    if (currentUserId) {
      sql += ' where b.user_id = ?'
      binds.push(currentUserId)
    } else {
      return c.json({ results: [] })
    }
  } else if (userId) {
    sql += ' where b.user_id=?'
    binds.push(userId)
  }

  sql += ' order by b.borrow_date desc, b.created_at desc'

  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 借款管理 - 创建
borrowingsRoutes.post('/borrowings', validateJson(createBorrowingSchema), async (c) => {
  if (!hasPositionCode(c, ['hq_finance', 'project_finance'])) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createBorrowingSchema>>(c)

  // 验证用户存在
  const user = await c.env.DB.prepare('select * from users where id=?').bind(body.user_id).first<any>()
  if (!user) throw Errors.NOT_FOUND('用户')
  if (user.active === 0) throw Errors.BUSINESS_ERROR('用户已停用')

  // 验证账户存在
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')

  // 验证账户币种匹配
  if (account.currency !== body.currency) {
    throw Errors.BUSINESS_ERROR('账户币种不匹配')
  }

  // 验证币种存在
  const currency = await c.env.DB.prepare('select * from currencies where code=?').bind(body.currency).first<any>()
  if (!currency) throw Errors.NOT_FOUND('币种')

  const id = uuid()
  const currentUserId = c.get('userId') as string | undefined
  const amountCents = Math.round(body.amount * 100)

  // 优先使用 user_id，如果没有则使用 borrower_id（向后兼容）
  await c.env.DB.prepare('insert into borrowings(id,user_id,borrower_id,account_id,amount_cents,currency,borrow_date,memo,created_by,created_at) values(?,?,?,?,?,?,?,?,?,?)')
    .bind(id, body.user_id, body.user_id, body.account_id, amountCents, body.currency, body.borrow_date, body.memo || null, currentUserId || null, Date.now()).run()

  logAuditAction(c, 'create', 'borrowing', id, JSON.stringify({ user_id: body.user_id, account_id: body.account_id, amount_cents: amountCents }))

  const created = await c.env.DB.prepare(`
    select b.*, 
      u.name as borrower_name, u.email as borrower_email,
      a.name as account_name, a.currency as account_currency,
      creator.name as creator_name
    from borrowings b
    left join users u on u.id=b.user_id
    left join accounts a on a.id=b.account_id
    left join users creator on creator.id=b.created_by
    where b.id=?
  `).bind(id).first()

  return c.json(created)
})

// 还款管理 - 列表
borrowingsRoutes.get('/repayments', validateQuery(repaymentQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof repaymentQuerySchema>>(c)
  const borrowingId = query.borrowing_id

  let sql = `
    select r.*, b.user_id, u.name as borrower_name, u.email as borrower_email,
      a.name as account_name, a.currency as account_currency,
      creator.name as creator_name
    from repayments r
    left join borrowings b on b.id=r.borrowing_id
    left join users u on u.id=b.user_id
    left join accounts a on a.id=r.account_id
    left join users creator on creator.id=r.created_by
  `
  const binds: any[] = []

  // 组员只能查看自己的还款记录（通过borrowing关联）
  if (isTeamDeveloper(c)) {
    const currentUserId = getUserId(c)
    if (currentUserId) {
      sql += ' where b.user_id = ?'
      binds.push(currentUserId)
    } else {
      return c.json({ results: [] })
    }
  } else if (borrowingId) {
    sql += ' where r.borrowing_id=?'
    binds.push(borrowingId)
  }

  sql += ' order by r.repay_date desc, r.created_at desc'

  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 还款管理 - 创建
borrowingsRoutes.post('/repayments', validateJson(createRepaymentSchema), async (c) => {
  if (!hasPositionCode(c, ['hq_finance', 'project_finance'])) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createRepaymentSchema>>(c)

  // 验证借款记录存在
  const borrowing = await c.env.DB.prepare('select * from borrowings where id=?').bind(body.borrowing_id).first<any>()
  if (!borrowing) throw Errors.NOT_FOUND('borrowing')

  // 验证账户存在
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')

  // 验证币种匹配
  if (borrowing.currency !== body.currency) {
    throw Errors.BUSINESS_ERROR('币种与借款币种不匹配')
  }

  // 验证账户币种匹配
  if (account.currency !== body.currency) {
    throw Errors.BUSINESS_ERROR('账户币种不匹配')
  }

  // 验证币种存在
  const currency = await c.env.DB.prepare('select * from currencies where code=?').bind(body.currency).first<any>()
  if (!currency) throw Errors.NOT_FOUND('币种')

  const id = uuid()
  const userId = c.get('userId') as string | undefined
  const amountCents = Math.round(body.amount * 100)

  await c.env.DB.prepare('insert into repayments(id,borrowing_id,account_id,amount_cents,currency,repay_date,memo,created_by,created_at) values(?,?,?,?,?,?,?,?,?)')
    .bind(id, body.borrowing_id, body.account_id, amountCents, body.currency, body.repay_date, body.memo || null, userId || null, Date.now()).run()

  logAuditAction(c, 'create', 'repayment', id, JSON.stringify({ borrowing_id: body.borrowing_id, account_id: body.account_id, amount_cents: amountCents }))

  const created = await c.env.DB.prepare(`
    select r.*, b.user_id, u.name as borrower_name, u.email as borrower_email,
      a.name as account_name, a.currency as account_currency,
      creator.name as creator_name
    from repayments r
    left join borrowings b on b.id=r.borrowing_id
    left join users u on u.id=b.user_id
    left join accounts a on a.id=r.account_id
    left join users creator on creator.id=r.created_by
    where r.id=?
  `).bind(id).first()

  return c.json(created)
})

// 借款统计 - 查询每个人的借款余额
borrowingsRoutes.get('/borrowings/balance', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()

  // 使用 user_id 计算每个用户的借款余额
  let sql = `
    select 
      u.id as user_id, 
      u.name as borrower_name, 
      u.email as borrower_email,
      b.currency,
      coalesce(sum(b.amount_cents), 0) as total_borrowed_cents,
      coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id in (
          select id from borrowings b2 
          where b2.user_id = b.user_id and b2.currency = b.currency
        )
      ), 0) as total_repaid_cents,
      (coalesce(sum(b.amount_cents), 0) - coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id in (
          select id from borrowings b2 
          where b2.user_id = b.user_id and b2.currency = b.currency
        )
      ), 0)) as balance_cents
    from users u
    inner join borrowings b on b.user_id = u.id
    where u.active = 1
    group by u.id, u.name, u.email, b.currency
    having balance_cents != 0
    order by u.name, b.currency
  `

  // 应用数据权限过滤
  const { where, binds: scopeBinds } = getDataAccessFilter(c, 'u')
  if (where !== '1=1') {
    // SQL 中已有 where 子句，使用 AND 追加条件
    const finalSql = sql.replace('where u.active = 1', `where u.active = 1 and ${where}`)
    const rows = await c.env.DB.prepare(finalSql).bind(...scopeBinds).all()
    return c.json({ results: rows.results ?? [] })
  }
  const rows = await c.env.DB.prepare(sql).all()
  return c.json({ results: rows.results ?? [] })
})

// IP 白名单管理 - Cloudflare IP Lists API 辅助函数
// 获取认证头（优先使用 Global API Key）
function getAuthHeaders(env: Env): Record<string, string> {
  if (env.CF_GLOBAL_API_KEY && env.CF_AUTH_EMAIL) {
    return {
      'X-Auth-Email': env.CF_AUTH_EMAIL,
      'X-Auth-Key': env.CF_GLOBAL_API_KEY,
    }
  } else if (env.CF_API_TOKEN) {
    return {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
    }
  }
  return {}
}

// 检查 Cloudflare API 配置（用于 IP List 操作）
function hasCloudflareAPIConfig(env: Env): boolean {
  const hasAuth = !!(env.CF_GLOBAL_API_KEY && env.CF_AUTH_EMAIL) || !!env.CF_API_TOKEN
  return hasAuth && !!env.CF_ACCOUNT_ID
}

// 检查 Cloudflare API 配置（用于自定义规则操作）
function hasCloudflareRuleConfig(env: Env): boolean {
  const hasAuth = !!(env.CF_GLOBAL_API_KEY && env.CF_AUTH_EMAIL) || !!env.CF_API_TOKEN
  return hasAuth && !!env.CF_ZONE_ID
}

// 获取或创建 IP List（如果不存在则创建）
async function getOrCreateIPList(env: Env): Promise<string | null> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return null
  }

  // 如果已指定 List ID，直接返回
  if (env.CF_IP_LIST_ID) {
    return env.CF_IP_LIST_ID
  }

  const authHeaders = getAuthHeaders(env)

  try {
    // 先尝试查找名为 "caiwu-whitelist" 的列表
    const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists?kind=ip`, {
      headers: authHeaders,
    })

    if (listResponse.ok) {
      const listData = await listResponse.json<{ result: Array<{ id: string, name: string }> }>()
      const existingList = listData.result?.find(list =>
        list.name === 'caiwu-whitelist' ||
        list.name === 'caiwu_whitelist' ||
        list.name === 'IP Whitelist' ||
        list.name === 'caiwu-whitelist' ||
        list.name.toLowerCase().includes('caiwu') && list.name.toLowerCase().includes('whitelist')
      )
      if (existingList) {
        return existingList.id
      }
    } else {
      // 处理非200响应
      const error = await listResponse.json().catch(() => ({ errors: [{ message: 'Unknown error' }] })) as { errors?: Array<{ message?: string }>, message?: string }
      console.error('Failed to list IP lists:', {
        status: listResponse.status,
        statusText: listResponse.statusText,
        error: error.errors || error,
      })
      // 如果是401/403，可能是权限问题，不继续创建
      if (listResponse.status === 401 || listResponse.status === 403) {
        return null
      }
    }

    // 如果不存在，创建新列表
    const createResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'caiwu_whitelist',
        description: '财务系统 IP 白名单',
        kind: 'ip',
      }),
    })

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({ errors: [{ message: 'Unknown error' }] })) as { errors?: Array<{ message?: string }>, message?: string }
      console.error('Failed to create IP list:', {
        status: createResponse.status,
        statusText: createResponse.statusText,
        error: error.errors || error,
      })
      return null
    }

    const createData = await createResponse.json<{ result: { id: string } }>()
    return createData.result?.id || null
  } catch (error: any) {
    console.error('Error getting/creating IP list:', {
      error: error.message || error,
      stack: error.stack,
    })
    return null
  }
}

// 添加 IP 到 IP List
async function addIPToCloudflareList(env: Env, ip: string, description?: string): Promise<{ success: boolean, itemId?: string, error?: string }> {
  if (!hasCloudflareAPIConfig(env)) {
    return { success: false, error: 'Cloudflare API credentials or Account ID not configured' }
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return { success: false, error: 'Failed to get or create IP list. Please check API permissions.' }
  }

  const authHeaders = getAuthHeaders(env)

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          ip: ip,
          comment: description || `IP whitelist: ${ip}`,
        },
      ]),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] })) as { errors?: Array<{ message?: string, code?: number }>, message?: string }
      const errorMsg = error.errors?.[0]?.message || error.message || `HTTP ${response.status}: ${response.statusText}`
      console.error('Failed to add IP to Cloudflare list:', {
        ip,
        status: response.status,
        statusText: response.statusText,
        error: error.errors || error,
      })
      return { success: false, error: `Cloudflare API error: ${errorMsg}` }
    }

    const data = await response.json<{ result: { operation_id?: string, id?: string } | Array<{ id: string }> }>()

    // Cloudflare API 可能返回两种格式：
    // 1. { result: { operation_id: "..." } } - 异步操作
    // 2. { result: [{ id: "..." }] } - 同步操作，直接返回 ID
    let itemId: string | null = null

    if (Array.isArray(data.result)) {
      // 格式 2: 直接返回数组
      itemId = data.result[0]?.id || null
    } else if (data.result?.operation_id) {
      // 格式 1: 返回 operation_id，需要等待操作完成并查询列表获取 ID
      // 等待一小段时间让操作完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 查询列表获取最新添加的 IP 的 ID
      const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
        headers: authHeaders,
      })

      if (listResponse.ok) {
        const listData = await listResponse.json<{ result: Array<{ id: string, ip: string }> }>()
        // 查找匹配的 IP
        const matchedItem = listData.result?.find(item => item.ip === ip)
        if (matchedItem) {
          itemId = matchedItem.id
        }
      }
    } else if (data.result?.id) {
      // 直接返回 ID
      itemId = data.result.id
    }

    if (!itemId) {
      console.error('Failed to get item ID from Cloudflare API response:', {
        ip,
        response: data,
      })
      return { success: false, error: 'Cloudflare API returned no item ID' }
    }

    return { success: true, itemId }
  } catch (error: any) {
    console.error('Error adding IP to Cloudflare list:', {
      ip,
      error: error.message || error,
      stack: error.stack,
    })
    return { success: false, error: `Network error: ${error.message || 'Unknown error'}` }
  }
}

// 从 IP List 删除 IP
async function removeIPFromCloudflareList(env: Env, itemId: string): Promise<boolean> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return false
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return false
  }

  const authHeaders = getAuthHeaders(env)

  try {
    // Cloudflare API 删除操作返回 operation_id，需要等待操作完成
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
      method: 'DELETE',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [{ id: itemId }] }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] }))
      console.error('Failed to remove IP from Cloudflare list:', {
        itemId,
        status: response.status,
        statusText: response.statusText,
        error,
      })
      return false
    }

    // 检查响应格式
    const data = await response.json<{ result: { operation_id?: string } | null, success: boolean }>()

    // 如果返回 operation_id，等待操作完成
    if (data.result && typeof data.result === 'object' && 'operation_id' in data.result) {
      // 等待一小段时间让删除操作完成
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 验证删除是否成功（查询列表确认 IP 已不存在）
      const verifyResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
        headers: authHeaders,
      })

      if (verifyResponse.ok) {
        const listData = await verifyResponse.json<{ result: Array<{ id: string }> }>()
        const stillExists = listData.result?.some(item => item.id === itemId)
        if (stillExists) {
          console.warn('IP still exists after deletion, operation may be in progress')
          // 即使还在列表中，也认为删除请求已成功（可能是异步操作）
          return true
        }
      }
    }

    return data.success !== false
  } catch (error) {
    console.error('Error removing IP from Cloudflare list:', {
      itemId,
      error: error instanceof Error ? error.message : error,
    })
    return false
  }
}

// 获取 IP List 中的所有 IP
async function fetchCloudflareIPListItems(env: Env): Promise<Array<{ id: string, ip: string, comment?: string }>> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return []
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return []
  }

  const authHeaders = getAuthHeaders(env)

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
      headers: authHeaders,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to fetch Cloudflare IP list items:', error)
      return []
    }

    const data = await response.json<{ result: Array<{ id: string, ip: string, comment?: string }> }>()
    return data.result || []
  } catch (error) {
    console.error('Error fetching Cloudflare IP list items:', error)
    return []
  }
}

// IP 白名单自定义规则管理 - Cloudflare Custom Rules API 辅助函数
// 获取或创建自定义规则
async function getOrCreateWhitelistRule(env: Env): Promise<{ ruleId: string, rulesetId: string } | null> {
  if (!hasCloudflareRuleConfig(env)) {
    console.warn('Cloudflare API credentials or Zone ID not configured')
    return null
  }

  const authHeaders = getAuthHeaders(env)

  // 先检查数据库中是否已有规则记录
  const dbRule = await env.DB.prepare('select * from ip_whitelist_rule limit 1').first<{ cloudflare_rule_id: string, cloudflare_ruleset_id: string }>()
  if (dbRule?.cloudflare_rule_id && dbRule?.cloudflare_ruleset_id) {
    // 验证规则是否还存在
    try {
      const checkResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${dbRule.cloudflare_ruleset_id}/rules/${dbRule.cloudflare_rule_id}`, {
        headers: authHeaders,
      })
      if (checkResponse.ok) {
        return { ruleId: dbRule.cloudflare_rule_id, rulesetId: dbRule.cloudflare_ruleset_id }
      }
    } catch (error) {
      console.warn('Rule not found, will create new one')
    }
  }

  // 1. 获取 entry point ruleset
  const phase = 'http_request_firewall_custom'
  let rulesetId: string | null = null

  try {
    const getRulesetResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/phases/${phase}/entrypoint`, {
      headers: authHeaders,
    })

    if (getRulesetResponse.ok) {
      const rulesetData = await getRulesetResponse.json<{ result: { id: string } }>()
      rulesetId = rulesetData.result?.id || null
    } else if (getRulesetResponse.status === 404) {
      // Ruleset 不存在，需要创建
      const createRulesetResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'IP Whitelist Rule',
          kind: 'zone',
          phase: phase,
          rules: [
            {
              action: 'block',
              expression: 'not ip.src in $caiwu_whitelist',
              description: 'Block IPs not in whitelist',
              enabled: false, // 默认停用
            },
          ],
        }),
      })

      if (!createRulesetResponse.ok) {
        const error = await createRulesetResponse.json()
        console.error('Failed to create ruleset:', error)
        return null
      }

      const createRulesetData = await createRulesetResponse.json<{ result: { id: string, rules: Array<{ id: string }> } }>()
      rulesetId = createRulesetData.result?.id || null
      const ruleId = createRulesetData.result?.rules?.[0]?.id

      if (rulesetId && ruleId) {
        // 保存到数据库
        const id = uuid()
        const now = Date.now()
        await env.DB.prepare('insert into ip_whitelist_rule(id,cloudflare_rule_id,cloudflare_ruleset_id,enabled,description,created_at,updated_at) values(?,?,?,?,?,?,?)')
          .bind(id, ruleId, rulesetId, 0, 'IP白名单规则', now, now).run()

        return { ruleId, rulesetId }
      }
      return null
    }
  } catch (error) {
    console.error('Error getting/creating ruleset:', error)
    return null
  }

  if (!rulesetId) {
    return null
  }

  // 2. 检查 ruleset 中是否已有我们的规则
  try {
    const listRulesResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${rulesetId}/rules`, {
      headers: authHeaders,
    })

    if (listRulesResponse.ok) {
      const listRulesData = await listRulesResponse.json<{ result: Array<{ id: string, expression: string, enabled: boolean }> }>()
      const existingRule = listRulesData.result?.find(rule => rule.expression.includes('caiwu_whitelist') || rule.expression.includes('caiwu-whitelist'))
      if (existingRule) {
        // 保存到数据库，使用实际的 enabled 状态
        const id = uuid()
        const now = Date.now()
        await env.DB.prepare('insert into ip_whitelist_rule(id,cloudflare_rule_id,cloudflare_ruleset_id,enabled,description,created_at,updated_at) values(?,?,?,?,?,?,?)')
          .bind(id, existingRule.id, rulesetId, existingRule.enabled ? 1 : 0, 'IP白名单规则', now, now).run()

        return { ruleId: existingRule.id, rulesetId }
      }
    }
  } catch (error) {
    console.error('Error listing rules:', error)
  }

  // 3. 创建新规则
  try {
    const createRuleResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${rulesetId}/rules`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block',
        expression: 'not ip.src in $caiwu_whitelist',
        description: 'Block IPs not in whitelist',
        enabled: false, // 默认停用
      }),
    })

    if (!createRuleResponse.ok) {
      const error = await createRuleResponse.json()
      console.error('Failed to create rule:', error)
      return null
    }

    const createRuleData = await createRuleResponse.json<{ result: { id: string } }>()
    const ruleId = createRuleData.result?.id

    if (ruleId) {
      // 保存到数据库
      const id = uuid()
      const now = Date.now()
      await env.DB.prepare('insert into ip_whitelist_rule(id,cloudflare_rule_id,cloudflare_ruleset_id,enabled,description,created_at,updated_at) values(?,?,?,?,?,?,?)')
        .bind(id, ruleId, rulesetId, 1, 'IP白名单规则', now, now).run()

      return { ruleId, rulesetId }
    }
  } catch (error) {
    console.error('Error creating rule:', error)
  }

  return null
}

// 启用/停用自定义规则
async function toggleWhitelistRule(env: Env, enabled: boolean): Promise<boolean> {
  if (!hasCloudflareRuleConfig(env)) {
    console.warn('Cloudflare API credentials or Zone ID not configured')
    return false
  }

  const authHeaders = getAuthHeaders(env)

  let dbRule = await env.DB.prepare('select * from ip_whitelist_rule limit 1').first<{ cloudflare_rule_id: string, cloudflare_ruleset_id: string }>()
  if (!dbRule?.cloudflare_rule_id || !dbRule?.cloudflare_ruleset_id) {
    // 如果数据库中没有规则，先创建
    const created = await getOrCreateWhitelistRule(env)
    if (!created) {
      return false
    }
    // 重新获取
    dbRule = await env.DB.prepare('select * from ip_whitelist_rule limit 1').first<{ cloudflare_rule_id: string, cloudflare_ruleset_id: string }>()
    if (!dbRule) return false
  }

  const ruleId = dbRule.cloudflare_rule_id
  const rulesetId = dbRule.cloudflare_ruleset_id

  try {
    // 需要更新整个 ruleset，而不是单个规则
    // 先获取当前 ruleset 的所有规则
    const getRulesetResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${rulesetId}`, {
      headers: authHeaders,
    })

    if (!getRulesetResponse.ok) {
      const error = await getRulesetResponse.json()
      console.error('Failed to get ruleset:', error)
      return false
    }

    const rulesetData = await getRulesetResponse.json<{ result: { rules: Array<{ id: string, action: string, expression: string, description?: string, enabled: boolean }> } }>()
    const existingRules = rulesetData.result?.rules || []

    // 更新目标规则，保持其他规则不变
    const updatedRules = existingRules.map(rule => {
      if (rule.id === ruleId) {
        return {
          id: ruleId,
          action: 'block',
          expression: 'not ip.src in $caiwu_whitelist',
          description: 'Block IPs not in whitelist',
          enabled: enabled,
        }
      }
      return rule
    })

    // 更新整个 ruleset
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${rulesetId}`, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rules: updatedRules,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to toggle rule:', error)
      return false
    }

    // 更新数据库
    const now = Date.now()
    await env.DB.prepare('update ip_whitelist_rule set enabled=?, updated_at=? where cloudflare_rule_id=?')
      .bind(enabled ? 1 : 0, now, ruleId).run()

    return true
  } catch (error) {
    console.error('Error toggling rule:', error)
    return false
  }
}

// 获取自定义规则状态（如果不存在则自动创建）
async function getWhitelistRuleStatus(env: Env): Promise<{ enabled: boolean, ruleId?: string, rulesetId?: string } | null> {
  if (!hasCloudflareRuleConfig(env)) {
    return null
  }

  const authHeaders = getAuthHeaders(env)

  const dbRule = await env.DB.prepare('select * from ip_whitelist_rule limit 1').first<{ cloudflare_rule_id: string, cloudflare_ruleset_id: string, enabled: number }>()
  if (dbRule) {
    return {
      enabled: dbRule.enabled === 1,
      ruleId: dbRule.cloudflare_rule_id,
      rulesetId: dbRule.cloudflare_ruleset_id,
    }
  }

  // 如果数据库中没有规则，尝试自动创建
  const created = await getOrCreateWhitelistRule(env)
  if (created) {
    // 重新查询数据库
    const newDbRule = await env.DB.prepare('select * from ip_whitelist_rule limit 1').first<{ cloudflare_rule_id: string, cloudflare_ruleset_id: string, enabled: number }>()
    if (newDbRule) {
      return {
        enabled: newDbRule.enabled === 1,
        ruleId: newDbRule.cloudflare_rule_id,
        rulesetId: newDbRule.cloudflare_ruleset_id,
      }
    }
  }

  return { enabled: false }
}

// IP 白名单管理 - 列表
