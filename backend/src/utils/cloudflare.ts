import type { Env } from '../types.js'

// Cloudflare 服务类型
export type CloudflareService = 'ip_lists' | 'email' | 'firewall'

// 获取认证头（仅使用服务专用 Token）
export function getAuthHeaders(env: Env, service?: CloudflareService): Record<string, string> {
  if (service === 'ip_lists' && env.CF_IP_LISTS_TOKEN) {
    return { 'Authorization': `Bearer ${env.CF_IP_LISTS_TOKEN}` }
  }
  if (service === 'email' && env.CF_EMAIL_TOKEN) {
    return { 'Authorization': `Bearer ${env.CF_EMAIL_TOKEN}` }
  }
  if (service === 'firewall' && env.CF_FIREWALL_TOKEN) {
    return { 'Authorization': `Bearer ${env.CF_FIREWALL_TOKEN}` }
  }

  // 未找到对应 Token 时返回空对象（调用方会报错）
  console.warn(`Missing Cloudflare token for service: ${service}`)
  return {}
}

// 检查 Cloudflare API 配置（用于 IP List 操作）
export function hasCloudflareAPIConfig(env: Env): boolean {
  return !!env.CF_IP_LISTS_TOKEN && !!env.CF_ACCOUNT_ID
}

// 检查 Cloudflare API 配置（用于自定义规则操作）
export function hasCloudflareRuleConfig(env: Env): boolean {
  return !!env.CF_FIREWALL_TOKEN && !!env.CF_ZONE_ID
}

// 获取或创建 IP List（如果不存在则创建）
export async function getOrCreateIPList(env: Env): Promise<string | null> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return null
  }

  // 如果已指定 List ID，直接返回
  if (env.CF_IP_LIST_ID) {
    return env.CF_IP_LIST_ID
  }

  const authHeaders = getAuthHeaders(env, 'ip_lists')
  if (!env.CF_ACCOUNT_ID) {
    console.warn('Cloudflare Account ID not configured')
    return null
  }

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
export async function addIPToCloudflareList(env: Env, ip: string, description?: string): Promise<{ success: boolean, itemId?: string, error?: string }> {
  if (!hasCloudflareAPIConfig(env)) {
    return { success: false, error: 'Cloudflare API credentials or Account ID not configured' }
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return { success: false, error: 'Failed to get or create IP list. Please check API permissions.' }
  }

  const authHeaders = getAuthHeaders(env, 'ip_lists')
  if (!env.CF_ACCOUNT_ID) {
    return { success: false, error: 'Cloudflare Account ID not configured' }
  }

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

// 批量添加 IP 到 Cloudflare List
export async function addIPsToCloudflareList(env: Env, ips: Array<{ ip: string, description?: string }>): Promise<{ success: boolean, successCount: number, failedCount: number, errors: Array<{ ip: string, error: string }> }> {
  if (!hasCloudflareAPIConfig(env)) {
    return { success: false, successCount: 0, failedCount: ips.length, errors: ips.map(item => ({ ip: item.ip, error: 'Cloudflare API credentials or Account ID not configured' })) }
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return { success: false, successCount: 0, failedCount: ips.length, errors: ips.map(item => ({ ip: item.ip, error: 'Failed to get or create IP list' })) }
  }

  const authHeaders = getAuthHeaders(env, 'ip_lists')
  if (!env.CF_ACCOUNT_ID) {
    return { success: false, successCount: 0, failedCount: ips.length, errors: ips.map(item => ({ ip: item.ip, error: 'Cloudflare Account ID not configured' })) }
  }

  try {
    // 构建批量添加的请求体
    const items = ips.map(item => ({
      ip: item.ip,
      comment: item.description || `IP whitelist: ${item.ip}`,
    }))

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(items),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] })) as { errors?: Array<{ message?: string }>, message?: string }
      const errorMsg = error.errors?.[0]?.message || error.message || `HTTP ${response.status}: ${response.statusText}`
      console.error('Failed to batch add IPs to Cloudflare list:', {
        count: ips.length,
        status: response.status,
        statusText: response.statusText,
        error: error.errors || error,
      })
      return { success: false, successCount: 0, failedCount: ips.length, errors: ips.map(item => ({ ip: item.ip, error: errorMsg })) }
    }

    const data = await response.json<{ result: Array<{ id: string, ip?: string }> | { operation_id?: string } }>()

    // 检查是否返回了 operation_id（异步操作）
    if (!Array.isArray(data.result) && (data.result as any).operation_id) {
      // 等待操作完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 重新拉取列表来验证添加结果
      const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
        headers: authHeaders,
      })

      if (listResponse.ok) {
        const listData = await listResponse.json<{ result: Array<{ id: string, ip: string }> }>()
        const addedIPs = new Set(listData.result?.map(item => item.ip) || [])
        const successIPs = ips.filter(item => addedIPs.has(item.ip))
        const failedIPs = ips.filter(item => !addedIPs.has(item.ip))

        return {
          success: successIPs.length > 0,
          successCount: successIPs.length,
          failedCount: failedIPs.length,
          errors: failedIPs.map(item => ({ ip: item.ip, error: 'IP not found after adding' })),
        }
      }
    }

    // 如果返回的是数组，说明同步操作成功
    const resultArray = Array.isArray(data.result) ? data.result : []
    const successCount = resultArray.length
    const failedCount = ips.length - successCount

    return {
      success: successCount > 0,
      successCount,
      failedCount,
      errors: failedCount > 0 ? ips.slice(successCount).map(item => ({ ip: item.ip, error: 'Failed to add' })) : [],
    }
  } catch (error: any) {
    console.error('Error batch adding IPs to Cloudflare list:', {
      count: ips.length,
      error: error.message || error,
      stack: error.stack,
    })
    return {
      success: false,
      successCount: 0,
      failedCount: ips.length,
      errors: ips.map(item => ({ ip: item.ip, error: `Network error: ${error.message || 'Unknown error'}` })),
    }
  }
}

// 批量从 IP List 删除 IP
export async function removeIPsFromCloudflareList(env: Env, itemIds: string[]): Promise<{ success: boolean, successCount: number, failedCount: number }> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return { success: false, successCount: 0, failedCount: itemIds.length }
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return { success: false, successCount: 0, failedCount: itemIds.length }
  }

  const authHeaders = getAuthHeaders(env, 'ip_lists')
  if (!env.CF_ACCOUNT_ID) {
    return { success: false, successCount: 0, failedCount: itemIds.length }
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
      method: 'DELETE',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: itemIds.map(id => ({ id })) }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] })) as { errors?: Array<{ message?: string }>, message?: string }
      console.error('Failed to batch remove IPs from Cloudflare list:', {
        count: itemIds.length,
        status: response.status,
        statusText: response.statusText,
        error: error.errors || error,
      })
      return { success: false, successCount: 0, failedCount: itemIds.length }
    }

    const data = await response.json<{ result: { operation_id?: string } }>()

    // 如果返回 operation_id，等待操作完成
    if (data.result?.operation_id) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // 重新拉取列表来验证删除结果
    const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/rules/lists/${listId}/items`, {
      headers: authHeaders,
    })

    if (listResponse.ok) {
      const listData = await listResponse.json<{ result: Array<{ id: string }> }>()
      const remainingIds = new Set(listData.result?.map(item => item.id) || [])
      const successCount = itemIds.filter(id => !remainingIds.has(id)).length
      const failedCount = itemIds.length - successCount

      return {
        success: successCount > 0,
        successCount,
        failedCount,
      }
    }

    // 如果无法验证，假设全部成功
    return { success: true, successCount: itemIds.length, failedCount: 0 }
  } catch (error: any) {
    console.error('Error batch removing IPs from Cloudflare list:', {
      count: itemIds.length,
      error: error.message || error,
      stack: error.stack,
    })
    return { success: false, successCount: 0, failedCount: itemIds.length }
  }
}

// 从 IP List 删除 IP
export async function removeIPFromCloudflareList(env: Env, itemId: string): Promise<boolean> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return false
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return false
  }

  const authHeaders = getAuthHeaders(env, 'ip_lists')
  if (!env.CF_ACCOUNT_ID) {
    return false
  }

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
export async function fetchCloudflareIPListItems(env: Env): Promise<Array<{ id: string, ip: string, comment?: string }>> {
  if (!hasCloudflareAPIConfig(env)) {
    console.warn('Cloudflare API credentials or Account ID not configured')
    return []
  }

  const listId = await getOrCreateIPList(env)
  if (!listId) {
    return []
  }

  const authHeaders = getAuthHeaders(env, 'ip_lists')
  if (!env.CF_ACCOUNT_ID) {
    return []
  }

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

// 获取或创建自定义规则（不再保存到数据库）
export async function getOrCreateWhitelistRule(env: Env): Promise<{ ruleId: string, rulesetId: string } | null> {
  if (!hasCloudflareRuleConfig(env)) {
    console.warn('Cloudflare API credentials or Zone ID not configured')
    return null
  }

  const authHeaders = getAuthHeaders(env, 'firewall')
  if (!env.CF_ZONE_ID) {
    return null
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
        // 不再保存到数据库
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
        // 不再保存到数据库
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
      // 不再保存到数据库
      return { ruleId, rulesetId }
    }
  } catch (error) {
    console.error('Error creating rule:', error)
  }

  return null
}

// 启用/停用自定义规则（不再更新数据库）
export async function toggleWhitelistRule(env: Env, enabled: boolean): Promise<boolean> {
  if (!hasCloudflareRuleConfig(env)) {
    console.warn('Cloudflare API credentials or Zone ID not configured')
    return false
  }

  const authHeaders = getAuthHeaders(env, 'firewall')
  if (!env.CF_ZONE_ID) {
    return false
  }

  // 先从 Cloudflare 获取规则信息
  let ruleStatus = await getWhitelistRuleStatus(env)
  if (!ruleStatus?.ruleId || !ruleStatus?.rulesetId) {
    // 如果规则不存在，尝试创建
    const created = await getOrCreateWhitelistRule(env)
    if (!created) {
      return false
    }
    ruleStatus = await getWhitelistRuleStatus(env)
    if (!ruleStatus?.ruleId || !ruleStatus?.rulesetId) {
      return false
    }
  }

  const ruleId = ruleStatus.ruleId!
  const rulesetId = ruleStatus.rulesetId!

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

    const rulesetData = await getRulesetResponse.json<{ result: { rules: Array<{ id: string, action: string, expression: string, description?: string, enabled: boolean, last_updated?: string, version?: string, ref?: string }> } }>()
    const existingRules = rulesetData.result?.rules || []

    // 检查规则是否存在
    const targetRule = existingRules.find(rule => rule.id === ruleId)
    if (!targetRule) {
      console.error(`Rule ${ruleId} not found in ruleset ${rulesetId}`)
      return false
    }

    // 如果状态已经一致，直接返回成功（不再更新数据库）
    if (targetRule.enabled === enabled) {
      return true
    }

    // 更新目标规则，保持其他规则不变
    // 只发送 Cloudflare API 更新时需要的字段（id, action, expression, description, enabled）
    // 不包含只读字段（last_updated, version, ref 等）
    // 使用原始规则的 action 和 expression，只更新 enabled 状态
    const updatedRules = existingRules.map(rule => {
      if (rule.id === ruleId) {
        // 保留原始规则的 action 和 expression，只更新 enabled
        const updatedRule: any = {
          id: ruleId,
          action: rule.action,
          expression: rule.expression,
          enabled: enabled,
        }
        // 只在有 description 时添加
        if (rule.description) {
          updatedRule.description = rule.description
        }
        return updatedRule
      }
      // 对于其他规则，只保留更新所需的字段
      const otherRule: any = {
        id: rule.id,
        action: rule.action,
        expression: rule.expression,
        enabled: rule.enabled,
      }
      // 只在有 description 时添加
      if (rule.description) {
        otherRule.description = rule.description
      }
      return otherRule
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
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Failed to toggle rule:', error)
      console.error('Request body:', JSON.stringify({ rules: updatedRules }, null, 2))
      console.error('Rule ID:', ruleId)
      console.error('Ruleset ID:', rulesetId)
      return false
    }

    const responseData = await response.json<{ result: { rules: Array<{ id: string, enabled: boolean }> } }>()
    // 验证更新是否成功
    const updatedRule = responseData.result?.rules?.find((r) => r.id === ruleId)
    if (updatedRule && updatedRule.enabled !== enabled) {
      console.error(`Rule status mismatch after update: expected=${enabled}, actual=${updatedRule.enabled}`)
      return false
    }

    // 不再更新数据库
    return true
  } catch (error: any) {
    console.error('Error toggling rule:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Rule ID:', ruleId)
    console.error('Ruleset ID:', rulesetId)
    return false
  }
}

// 获取自定义规则状态（如果不存在则自动创建）
// 重新设计：先通过 Cloudflare API 拉取规则，如果没有则创建规则后再拉取
// 不再保存到数据库，以 Cloudflare 实时数据为准
export async function getWhitelistRuleStatus(env: Env): Promise<{ enabled: boolean, ruleId?: string, rulesetId?: string } | null> {
  if (!hasCloudflareRuleConfig(env)) {
    return null
  }

  const authHeaders = getAuthHeaders(env, 'firewall')
  if (!env.CF_ZONE_ID) {
    return null
  }

  const phase = 'http_request_firewall_custom'
  let rulesetId: string | null = null
  let ruleId: string | null = null
  let enabled: boolean = false

  try {
    // 步骤1: 获取 entry point ruleset ID
    const getRulesetResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/phases/${phase}/entrypoint`, {
      headers: authHeaders,
    })

    if (getRulesetResponse.ok) {
      const rulesetData = await getRulesetResponse.json<{ result: { id: string } }>()
      rulesetId = rulesetData.result?.id || null
    } else if (getRulesetResponse.status === 404) {
      // Ruleset 不存在，需要创建
      const created = await getOrCreateWhitelistRule(env)
      if (created) {
        rulesetId = created.rulesetId
        ruleId = created.ruleId
      }
    } else {
      const error = await getRulesetResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Failed to get ruleset:', error)
      return null
    }

    if (!rulesetId) {
      // 如果仍然没有 rulesetId，尝试创建
      const created = await getOrCreateWhitelistRule(env)
      if (created) {
        rulesetId = created.rulesetId
        ruleId = created.ruleId
      } else {
        return { enabled: false }
      }
    }

    // 步骤2: 从 Cloudflare 拉取 ruleset 中的所有规则
    const getRulesetRulesResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${rulesetId}`, {
      headers: authHeaders,
    })

    if (!getRulesetRulesResponse.ok) {
      const error = await getRulesetRulesResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Failed to get ruleset rules:', error)
      // 如果获取失败，尝试创建规则
      const created = await getOrCreateWhitelistRule(env)
      if (created) {
        return {
          enabled: false,
          ruleId: created.ruleId,
          rulesetId: created.rulesetId,
        }
      }
      return { enabled: false }
    }

    const rulesetData = await getRulesetRulesResponse.json<{ result: { rules: Array<{ id: string, expression: string, enabled: boolean, action: string, description?: string }> } }>()
    const existingRules = rulesetData.result?.rules || []

    // 步骤3: 查找匹配的规则（通过 expression 包含 'caiwu_whitelist' 或 'caiwu-whitelist'）
    const matchingRule = existingRules.find(rule =>
      rule.expression.includes('caiwu_whitelist') ||
      rule.expression.includes('caiwu-whitelist')
    )

    if (matchingRule) {
      // 找到规则，返回 Cloudflare 的实际状态（不再同步到数据库）
      ruleId = matchingRule.id
      enabled = matchingRule.enabled

      return {
        enabled: enabled,
        ruleId: ruleId,
        rulesetId: rulesetId,
      }
    } else {
      // 步骤4: 如果 Cloudflare 中没有找到规则，创建规则
      const created = await getOrCreateWhitelistRule(env)
      if (created) {
        // 创建后再次从 Cloudflare 拉取规则状态
        const refreshResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${created.rulesetId}`, {
          headers: authHeaders,
        })

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json<{ result: { rules: Array<{ id: string, enabled: boolean }> } }>()
          const newRule = refreshData.result?.rules?.find(rule => rule.id === created.ruleId)
          if (newRule) {
            enabled = newRule.enabled
          }
        }

        return {
          enabled: enabled,
          ruleId: created.ruleId,
          rulesetId: created.rulesetId,
        }
      }
    }
  } catch (error: any) {
    console.error('Error getting whitelist rule status:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    // 发生错误时返回默认值（不再从数据库读取）
    return { enabled: false }
  }

  return { enabled: false }
}

