import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid, getAccountBalanceBefore } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../utils/validator.js'
import { createAccountTransferSchema } from '../schemas/business.schema.js'
import { accountTransferQuerySchema, idParamSchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const accountTransfersRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取账户转账列表
accountTransfersRoutes.get('/account-transfers', validateQuery(accountTransferQuerySchema), async (c) => {
  // manager角色有完整权限，可以访问所有功能
  if (!(await requireRole(c, ['manager', 'finance', 'auditor']))) throw Errors.FORBIDDEN()
  
  const query = getValidatedQuery<z.infer<typeof accountTransferQuerySchema>>(c)
  const fromAccountId = query.from_account_id
  const toAccountId = query.to_account_id
  const startDate = query.start_date
  const endDate = query.end_date
  
  let sql = `
    select 
      t.*,
      fa.name as from_account_name,
      fa.currency as from_account_currency,
      ta.name as to_account_name,
      ta.currency as to_account_currency
    from account_transfers t
    left join accounts fa on fa.id = t.from_account_id
    left join accounts ta on ta.id = t.to_account_id
    where 1=1
  `
  const binds: any[] = []
  
  if (fromAccountId) {
    sql += ' and t.from_account_id = ?'
    binds.push(fromAccountId)
  }
  if (toAccountId) {
    sql += ' and t.to_account_id = ?'
    binds.push(toAccountId)
  }
  if (startDate) {
    sql += ' and t.transfer_date >= ?'
    binds.push(startDate)
  }
  if (endDate) {
    sql += ' and t.transfer_date <= ?'
    binds.push(endDate)
  }
  
  sql += ' order by t.transfer_date desc, t.created_at desc'
  
  try {
    const rows = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json({ results: rows.results ?? [] })
  } catch (err: any) {
    console.error('GET /account-transfers error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

// 创建账户转账
accountTransfersRoutes.post('/account-transfers', validateJson(createAccountTransferSchema), async (c) => {
  // manager角色有完整权限，可以执行所有操作
  if (!(await requireRole(c, ['manager', 'finance']))) throw Errors.FORBIDDEN()
  
  const body = getValidatedData<z.infer<typeof createAccountTransferSchema>>(c)
  
  // 获取账户信息
  const fromAccount = await c.env.DB.prepare('select id, name, currency, active from accounts where id=?')
    .bind(body.from_account_id).first<{ id: string, name: string, currency: string, active: number }>()
  const toAccount = await c.env.DB.prepare('select id, name, currency, active from accounts where id=?')
    .bind(body.to_account_id).first<{ id: string, name: string, currency: string, active: number }>()
  
  if (!fromAccount || !fromAccount.active) {
    throw Errors.BUSINESS_ERROR('转出账户不存在或已停用')
  }
  
  if (!toAccount || !toAccount.active) {
    throw Errors.BUSINESS_ERROR('转入账户不存在或已停用')
  }
  
  // 计算汇率（如果未提供）
  let exchangeRate = body.exchange_rate
  if (!exchangeRate) {
    if (fromAccount.currency === toAccount.currency) {
      exchangeRate = 1
    } else {
      throw Errors.VALIDATION_ERROR('不同币种转账必须提供汇率')
    }
  }
  
  // 验证汇率计算的金额是否正确
  if (fromAccount.currency !== toAccount.currency) {
    const calculatedToAmount = Math.round(body.from_amount_cents * exchangeRate)
    const diff = Math.abs(calculatedToAmount - body.to_amount_cents)
    // 允许1分钱的误差（由于四舍五入）
    if (diff > 1) {
      throw Errors.VALIDATION_ERROR('转入金额与汇率计算结果不一致')
    }
  } else {
    // 同币种转账，金额必须相等
    if (body.from_amount_cents !== body.to_amount_cents) {
      throw Errors.VALIDATION_ERROR('同币种转账，转出金额和转入金额必须相等')
    }
  }
  
  // 检查转出账户余额
  const now = Date.now()
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.from_account_id, body.transfer_date, now)
  if (balanceBefore < body.from_amount_cents) {
    throw Errors.BUSINESS_ERROR('转出账户余额不足')
  }
  
  const id = uuid()
  const userId = c.get('userId') as string | undefined
  
  // 创建转账记录
  await c.env.DB.prepare(`
    insert into account_transfers(
      id, transfer_date, from_account_id, to_account_id,
      from_currency, to_currency, from_amount_cents, to_amount_cents,
      exchange_rate, memo, voucher_url, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.transfer_date,
    body.from_account_id,
    body.to_account_id,
    fromAccount.currency,
    toAccount.currency,
    body.from_amount_cents,
    body.to_amount_cents,
    exchangeRate,
    body.memo ?? null,
    body.voucher_url ?? null,
    userId ?? 'system',
    now
  ).run()
  
  // 创建转出账户的现金流记录（支出）
  const fromFlowId = uuid()
  const fromBalanceAfter = balanceBefore - body.from_amount_cents
  
  // 生成凭证号
  const day = String(body.transfer_date).replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(body.transfer_date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const voucherNo = `JZ${day}-${seq}`
  
  await c.env.DB.prepare(`
    insert into cash_flows(
      id, voucher_no, biz_date, type, account_id, category_id, method, amount_cents,
      site_id, department_id, counterparty, memo, voucher_url, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    fromFlowId,
    voucherNo,
    body.transfer_date,
    'expense',
    body.from_account_id,
    null,
    'transfer',
    body.from_amount_cents,
    null,
    null,
    toAccount.name,
    body.memo ?? `转账至${toAccount.name}`,
    body.voucher_url ?? null,
    userId ?? 'system',
    now
  ).run()
  
  // 创建转出账户的账变记录
  const fromTransactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    fromTransactionId,
    body.from_account_id,
    fromFlowId,
    body.transfer_date,
    'transfer',
    body.from_amount_cents,
    balanceBefore,
    fromBalanceAfter,
    now
  ).run()
  
  // 创建转入账户的现金流记录（收入）
  const toFlowId = uuid()
  const toBalanceBefore = await getAccountBalanceBefore(c.env.DB, body.to_account_id, body.transfer_date, now + 1)
  const toBalanceAfter = toBalanceBefore + body.to_amount_cents
  
  const toSeq = ((count?.n ?? 0) + 2).toString().padStart(3, '0')
  const toVoucherNo = `JZ${day}-${toSeq}`
  
  await c.env.DB.prepare(`
    insert into cash_flows(
      id, voucher_no, biz_date, type, account_id, category_id, method, amount_cents,
      site_id, department_id, counterparty, memo, voucher_url, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    toFlowId,
    toVoucherNo,
    body.transfer_date,
    'income',
    body.to_account_id,
    null,
    'transfer',
    body.to_amount_cents,
    null,
    null,
    fromAccount.name,
    body.memo ?? `从${fromAccount.name}转入`,
    body.voucher_url ?? null,
    userId ?? 'system',
    now + 1
  ).run()
  
  // 创建转入账户的账变记录
  const toTransactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    toTransactionId,
    body.to_account_id,
    toFlowId,
    body.transfer_date,
    'transfer',
    body.to_amount_cents,
    toBalanceBefore,
    toBalanceAfter,
    now + 1
  ).run()
  
  logAuditAction(c, 'create', 'account_transfer', id, JSON.stringify({
    from_account: fromAccount.name,
    to_account: toAccount.name,
    from_amount_cents: body.from_amount_cents,
    to_amount_cents: body.to_amount_cents,
    exchange_rate: exchangeRate
  }))
  
  return c.json({ id })
})

// 获取单笔转账详情
accountTransfersRoutes.get('/account-transfers/:id', validateParam(idParamSchema), async (c) => {
  // manager角色有完整权限，可以查看所有数据
  if (!(await requireRole(c, ['manager', 'finance', 'auditor']))) throw Errors.FORBIDDEN()
  
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const row = await c.env.DB.prepare(`
    select 
      t.*,
      fa.name as from_account_name,
      fa.currency as from_account_currency,
      ta.name as to_account_name,
      ta.currency as to_account_currency
    from account_transfers t
    left join accounts fa on fa.id = t.from_account_id
    left join accounts ta on ta.id = t.to_account_id
    where t.id = ?
  `).bind(id).first()
  
  if (!row) {
    throw Errors.NOT_FOUND()
  }
  
  return c.json(row)
})

